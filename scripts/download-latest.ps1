# download-latest.ps1
# Downloads the latest Sparkly distribution from GitHub Releases.
# No authentication needed — the repository is public.
#
# Exit codes:
#   0 = updated successfully (or already up to date)
#   1 = error
#
# Output variable $Updated is $true if files were replaced, $false if already current.

param(
    [switch]$Force
)

$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Definition
$repo = 'reinra/sparkly'
$tag = 'dev-latest'
$assetName = 'sparkly-dev.zip'

$global:Updated = $false

function FormatTimestamp($isoString) {
    return ([datetime]::Parse($isoString)).ToLocalTime().ToString('yyyy-MM-dd HH:mm')
}

$headers = @{
    Accept = 'application/vnd.github+json'
    'X-GitHub-Api-Version' = '2022-11-28'
}

# --- Find latest release ---

Write-Host 'Checking for updates...'

$releaseUrl = "https://api.github.com/repos/$repo/releases/tags/$tag"

try {
    $release = Invoke-RestMethod -Uri $releaseUrl -Headers $headers -Method Get
} catch {
    $status = $_.Exception.Response.StatusCode.value__
    if ($status -eq 404) {
        Write-Host 'No release found. The project may not have been published yet.' -ForegroundColor Yellow
    } else {
        Write-Host "ERROR: Failed to query GitHub API (HTTP $status)." -ForegroundColor Red
        Write-Host $_.Exception.Message
    }
    exit 1
}

$releaseDate = $release.published_at

# Resolve the tag to its commit SHA
$tagRefUrl = "https://api.github.com/repos/$repo/git/ref/tags/$tag"
try {
    $tagRef = Invoke-RestMethod -Uri $tagRefUrl -Headers $headers -Method Get
    $remoteSha = $tagRef.object.sha
} catch {
    Write-Host 'ERROR: Failed to resolve tag commit.' -ForegroundColor Red
    Write-Host $_.Exception.Message
    exit 1
}

# --- Compare with local version ---

$versionFile = Join-Path $scriptDir 'version.txt'
if ((Test-Path $versionFile) -and -not $Force) {
    $localVersion = @{}
    Get-Content $versionFile | ForEach-Object {
        if ($_ -match '^\s*(\w+)\s*=\s*(.+)\s*$') {
            $localVersion[$Matches[1]] = $Matches[2]
        }
    }
    $localSha = $localVersion['commit']
    $localBuilt = $localVersion['built']

    if ($localSha -eq $remoteSha) {
        Write-Host "Already up to date." -ForegroundColor Green
        if ($localBuilt) {
            Write-Host "  Installed: $(FormatTimestamp $localBuilt)"
        }
        $global:Updated = $false
        exit 0
    }

    Write-Host "Update available: $($localSha.Substring(0, 8)) -> $($remoteSha.Substring(0, 8))"
    if ($localBuilt) {
        Write-Host "  Installed: $(FormatTimestamp $localBuilt)"
    }
    Write-Host "  Available: $(FormatTimestamp $releaseDate)"
} else {
    if ($Force) {
        Write-Host 'Force update requested.'
    } else {
        Write-Host 'No local version info found. Downloading latest build.'
    }
}

# --- Find the asset download URL ---

$asset = $release.assets | Where-Object { $_.name -eq $assetName } | Select-Object -First 1

if (-not $asset) {
    Write-Host "ERROR: Asset '$assetName' not found in release." -ForegroundColor Red
    exit 1
}

$downloadUrl = $asset.browser_download_url
$totalSize = $asset.size

# --- Download asset ---

$tempDir = Join-Path ([System.IO.Path]::GetTempPath()) "sparkly-update-$([System.Guid]::NewGuid().ToString('N'))"
New-Item -ItemType Directory -Path $tempDir | Out-Null

$zipPath = Join-Path $tempDir 'sparkly-dev.zip'

$totalMB = [math]::Round($totalSize / 1MB, 1)
$barWidth = 30

try {
    $webRequest = [System.Net.HttpWebRequest]::Create($downloadUrl)
    $webRequest.UserAgent = 'sparkly-updater'
    $response = $webRequest.GetResponse()
    $responseStream = $response.GetResponseStream()
    $fileStream = [System.IO.File]::Create($zipPath)
    $buffer = New-Object byte[] 65536
    $downloadedBytes = 0
    while (($bytesRead = $responseStream.Read($buffer, 0, $buffer.Length)) -gt 0) {
        $fileStream.Write($buffer, 0, $bytesRead)
        $downloadedBytes += $bytesRead
        $percent = [math]::Floor($downloadedBytes * 100 / $totalSize)
        $filled = [math]::Floor($barWidth * $downloadedBytes / $totalSize)
        $empty = $barWidth - $filled
        $bar = ('=' * $filled) + (' ' * $empty)
        Write-Host "`rDownloading [$bar] ${percent}% of ${totalMB} MB" -NoNewline
    }
    $fileStream.Close()
    $responseStream.Close()
    $response.Close()
    $bar = '=' * $barWidth
    Write-Host "`rDownloading [$bar] done.              "
} catch {
    Write-Host ''
    Write-Host 'ERROR: Download failed.' -ForegroundColor Red
    Write-Host $_.Exception.Message
    Remove-Item -Recurse -Force $tempDir -ErrorAction SilentlyContinue
    exit 1
}

# --- Extract and copy ---

$extractDir = Join-Path $tempDir 'extracted'
Write-Host 'Extracting...'
Expand-Archive -Path $zipPath -DestinationPath $extractDir -Force

# Copy all files from extracted directory to script directory, overwriting existing
$filesToCopy = Get-ChildItem -Path $extractDir -File -Recurse
$copiedCount = 0

foreach ($file in $filesToCopy) {
    $relativePath = $file.FullName.Substring($extractDir.Length + 1)
    $destination = Join-Path $scriptDir $relativePath
    $destinationDir = Split-Path -Parent $destination

    if (-not (Test-Path $destinationDir)) {
        New-Item -ItemType Directory -Path $destinationDir -Force | Out-Null
    }

    Copy-Item -Path $file.FullName -Destination $destination -Force
    $copiedCount++
}

# --- Cleanup ---

Remove-Item -Recurse -Force $tempDir -ErrorAction SilentlyContinue

Write-Host "Updated successfully ($copiedCount files)." -ForegroundColor Green
$global:Updated = $true
exit 0
