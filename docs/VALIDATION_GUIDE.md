# Executable Validation Guide

## Understanding the Build vs Distribution

### File Locations

The build process creates an executable and then packages it:

1. **Build Artifact** — `dist/sparkly.exe`
   - Intermediate build output
   - Renamed after packaging to prevent accidental use

2. **Distribution Package** — `dist/sparkly-package/sparkly.exe`
   - Ready to run and distribute
   - Frontend is embedded in the executable itself

Both are functionally identical — the distribution step simply copies and packages.

## Success-Based Validation

Instead of checking for error strings, validate the expected success case by checking for markers from the source code.

### Expected Success Markers

From `packages/frontend/src/routes/+layout.svelte`:

✅ **Required Elements:**

1. `<!doctype html>` - Valid HTML document
2. `Twinkly LED Controller` - Application title
3. `href="/devices"` - Devices navigation link
4. `href="/debug"` - Debug navigation link
5. `class="app"` - SvelteKit app container
6. `<main` - Main content area

✅ **Must NOT Contain:**

1. `Frontend failed to load` - Error message
2. `^{"error"` - JSON error response

### Validation Script

```powershell
# Kill any running instances
Get-Process | Where-Object {$_.ProcessName -like "*sparkly*"} | Stop-Process -Force

# Navigate to the DISTRIBUTION directory (not build artifact)
cd F:\Progemine\sparkly\dist\sparkly-package

# Start the executable
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
    Write-Host "✓✓✓ VALIDATION PASSED ✓✓✓" -ForegroundColor Green
} else {
    Write-Host "✗✗✗ VALIDATION FAILED ✗✗✗" -ForegroundColor Red
}

# Cleanup
Get-Process | Where-Object {$_.ProcessName -like "*twinkly*"} | Stop-Process -Force
```

## Common Errors and Solutions

### Error: Multiple Process Instances

If validation fails even from the correct location, check for multiple running instances:

```powershell
Get-Process | Where-Object {$_.ProcessName -like "*twinkly*"} |
    ForEach-Object { Write-Host "Running: $($_.Path)" }
```

Kill all instances before testing:

```powershell
Get-Process | Where-Object {$_.ProcessName -like "*twinkly*"} |
    Stop-Process -Force
```

## Build and Distribution Workflow

1. **Build:** `npm run build:executable`
   - Creates `dist/sparkly.exe` (frontend embedded in executable)

2. **Package:** `npm run package:distribution`
   - Copies executable to `dist/sparkly-package/`
   - Copies documentation

3. **Distribute:** Zip `dist/sparkly-package/` folder
   - Users extract and run `sparkly.exe`

## Testing Different Scenarios

### Test 1: Correct Location

```powershell
cd F:\...\dist\sparkly-package
.\sparkly.exe
# ✅ Should work
```

### Test 2: From Parent Directory

```powershell
cd F:\...\dist
.\sparkly-package\sparkly.exe
# ✅ Should work (uses absolute path)
```

### Test 3: Unbiased Clean Location (Recommended)

```powershell
# Copy distribution to a clean temp folder outside the project
$testDir = "C:\Temp\twinkly-test"
if(Test-Path $testDir) { Remove-Item $testDir -Recurse -Force }
New-Item -ItemType Directory -Path $testDir | Out-Null
Copy-Item "F:\...\dist\sparkly-package\*" -Destination $testDir -Recurse

# Run from clean location
cd $testDir
Start-Process -FilePath ".\sparkly.exe" -NoNewWindow
Start-Sleep -Seconds 5

# Validate
$response = Invoke-WebRequest -Uri "http://localhost:3001/" -UseBasicParsing
if($response.Content -match 'Twinkly LED Controller') {
    Write-Host "✓ PASSED - Distribution is self-contained!" -ForegroundColor Green
} else {
    Write-Host "✗ FAILED" -ForegroundColor Red
}

# Cleanup
Get-Process | Where-Object {$_.ProcessName -like "*twinkly*"} | Stop-Process -Force
```

**Why this test is important:**

- Eliminates bias from development environment
- Proves the distribution is truly self-contained
- Simulates end-user deployment scenario
- No access to project files or node_modules

## Summary

- The executable embeds the frontend — no external `packages/` folder needed
- Validate using expected success markers, not error strings
- Check for SvelteKit-rendered HTML content
- Test in a clean location outside the project for unbiased validation
