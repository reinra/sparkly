# Executable Validation Guide

How to verify the distribution package works correctly after building.

## Validation Script

```powershell
# Kill any running instances
Get-Process | Where-Object {$_.ProcessName -like "*sparkly*"} | Stop-Process -Force

# Start the executable from the distribution package
cd dist\sparkly-package
Start-Process -FilePath ".\sparkly.exe" -NoNewWindow
Start-Sleep -Seconds 4

# Test the frontend
$response = Invoke-WebRequest -Uri "http://localhost:3001/" -UseBasicParsing

# Check for success markers
$checks = @(
    @{Test='HTML Document'; Pass=$response.Content -match '<!doctype html>'},
    @{Test='Sparkly Header'; Pass=$response.Content -match 'Sparkly'},
    @{Test='Devices Link'; Pass=$response.Content -match 'href="/devices"'},
    @{Test='Debug Link'; Pass=$response.Content -match 'href="/debug"'},
    @{Test='App Container'; Pass=$response.Content -match 'class="app'},
    @{Test='Main Content'; Pass=$response.Content -match '<main'},
    @{Test='NO Errors'; Pass=$response.Content -notmatch 'Frontend failed to load'}
)

$allPassed = ($checks | Where-Object {-not $_.Pass}).Count -eq 0
foreach($check in $checks) {
    $symbol = if($check.Pass){'✓'}else{'✗'}
    Write-Host "$symbol $($check.Test)"
}

if($allPassed) {
    Write-Host "VALIDATION PASSED" -ForegroundColor Green
} else {
    Write-Host "VALIDATION FAILED" -ForegroundColor Red
}

# Cleanup
Get-Process | Where-Object {$_.ProcessName -like "*sparkly*"} | Stop-Process -Force
```

## Clean Location Test

Copy the distribution to a temp folder outside the project to simulate a real user install:

```powershell
$testDir = "C:\Temp\sparkly-test"
if (Test-Path $testDir) { Remove-Item $testDir -Recurse -Force }
Copy-Item "dist\sparkly-package" -Destination $testDir -Recurse

cd $testDir
Start-Process -FilePath ".\sparkly.exe" -NoNewWindow
Start-Sleep -Seconds 5

$response = Invoke-WebRequest -Uri "http://localhost:3001/" -UseBasicParsing
if ($response.Content -match 'Sparkly') {
    Write-Host "PASSED - Distribution is self-contained" -ForegroundColor Green
} else {
    Write-Host "FAILED" -ForegroundColor Red
}

Get-Process | Where-Object {$_.ProcessName -like "*sparkly*"} | Stop-Process -Force
```

## Troubleshooting

If validation fails, check for leftover processes:

```powershell
Get-Process | Where-Object {$_.ProcessName -like "*sparkly*"} |
    ForEach-Object { Write-Host "Running: $($_.Path)" }
```

Kill all instances and retry:

```powershell
Get-Process | Where-Object {$_.ProcessName -like "*sparkly*"} | Stop-Process -Force
```
