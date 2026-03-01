# Executable Validation Guide

## Understanding the Build vs Distribution

### File Locations

The build process creates TWO executable files:

1. **Build Artifact** (DO NOT RUN DIRECTLY)
   - Location: `dist/twinkly-server.exe`
   - Purpose: Intermediate build output
   - ⚠️ Missing the `packages/` directory - will fail with error

2. **Distribution Package** (READY TO RUN)
   - Location: `dist/twinkly-server-package/twinkly-server.exe`
   - Purpose: Complete distribution with all files
   - ✅ Includes `packages/frontend/build/` directory
   - ✅ Ready for deployment

### Why This Matters

The executable uses `path.dirname(process.execPath)` to find frontend files. This means:

- If you run `dist/twinkly-server.exe` → looks for `dist/packages/` (❌ doesn't exist)
- If you run `dist/twinkly-server-package/twinkly-server.exe` → looks for `dist/twinkly-server-package/packages/` (✅ exists)

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
Get-Process | Where-Object {$_.ProcessName -like "*twinkly*"} | Stop-Process -Force

# Navigate to the DISTRIBUTION directory (not build artifact)
cd F:\Progemine\twinkly-ts\dist\twinkly-server-package

# Start the executable
Start-Process -FilePath ".\twinkly-server.exe" -NoNewWindow
Start-Sleep -Seconds 4

# Test the frontend
$response = Invoke-WebRequest -Uri "http://localhost:3001/" -UseBasicParsing

# Check for success markers
$checks = @(
    @{Test='HTML Document'; Pass=$response.Content -match '<!doctype html>'},
    @{Test='Twinkly LED Controller'; Pass=$response.Content -match 'Twinkly LED Controller'},
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

### Error: "Missing 'packages' directory"

```json
{
  "error": "Frontend failed to load - Invalid directory structure",
  "details": "Missing 'packages' directory...",
  "executableLocation": "F:\\...\\dist\\twinkly-server.exe",
  "expectedFrontendPath": "F:\\...\\dist\\packages\\frontend\\build"
}
```

**Cause:** Running the build artifact instead of the distribution package.

**Solution:** Use `dist/twinkly-server-package/twinkly-server.exe` instead of `dist/twinkly-server.exe`.

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
   - Creates `dist/twinkly-server.exe` (intermediate artifact)

2. **Package:** `npm run package:distribution` (or use `scripts/create-distribution.js`)
   - Copies executable to `dist/twinkly-server-package/`
   - Copies frontend files to `dist/twinkly-server-package/packages/`
   - Copies config example and documentation

3. **Distribute:** Zip `dist/twinkly-server-package/` folder
   - Users extract and run from that directory
   - Executable finds files relative to its location

## Testing Different Scenarios

### Test 1: Correct Location

```powershell
cd F:\...\dist\twinkly-server-package
.\twinkly-server.exe
# ✅ Should work
```

### Test 2: From Parent Directory

```powershell
cd F:\...\dist
.\twinkly-server-package\twinkly-server.exe
# ✅ Should work (uses absolute path)
```

### Test 3: Wrong Location (Expected to Fail)

```powershell
cd F:\...\dist
.\twinkly-server.exe
# ❌ Will show "Missing 'packages' directory" error
```

### Test 4: Unbiased Clean Location (Recommended)

```powershell
# Copy distribution to a clean temp folder outside the project
$testDir = "C:\Temp\twinkly-test"
if(Test-Path $testDir) { Remove-Item $testDir -Recurse -Force }
New-Item -ItemType Directory -Path $testDir | Out-Null
Copy-Item "F:\...\dist\twinkly-server-package\*" -Destination $testDir -Recurse

# Run from clean location
cd $testDir
Start-Process -FilePath ".\twinkly-server.exe" -NoNewWindow
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

- Always run from `dist/twinkly-server-package/` directory
- Validate using expected success markers, not error strings
- Check for SvelteKit-rendered HTML content
- Test in a clean location outside the project for unbiased validation
- Clear error messages guide users to correct location
