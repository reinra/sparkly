import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.dirname(__dirname);

async function createDistributionPackage() {
  console.log('📦 Creating distribution package...\n');

  const distDir = path.join(rootDir, 'dist');
  const packageDir = path.join(distDir, 'twinkly-server-package');

  // Create package directory
  if (!fs.existsSync(packageDir)) {
    fs.mkdirSync(packageDir, { recursive: true });
  }

  // 1. Copy executable
  console.log('📋 Copying executable...');
  const exePath = path.join(distDir, 'twinkly-server.exe');
  if (!fs.existsSync(exePath)) {
    console.error('❌ Executable not found. Run "npm run build:executable" first.');
    process.exit(1);
  }
  fs.copyFileSync(exePath, path.join(packageDir, 'twinkly-server.exe'));
  console.log('✓ Executable copied');

  // 2. Copy frontend build directory
  console.log('📋 Copying frontend files...');
  const frontendSrc = path.join(rootDir, 'packages', 'frontend', 'build');
  const frontendDest = path.join(packageDir, 'packages', 'frontend', 'build');
  
  if (!fs.existsSync(frontendSrc)) {
    console.error('❌ Frontend build not found. Run "npm run build" first.');
    process.exit(1);
  }

  copyDirectory(frontendSrc, frontendDest);
  console.log('✓ Frontend files copied');

  // 3. Copy config example
  console.log('📋 Copying configuration example...');
  const configExample = path.join(rootDir, 'packages', 'backend', 'config.toml.example');
  if (fs.existsSync(configExample)) {
    fs.copyFileSync(configExample, path.join(packageDir, 'config.toml.example'));
    console.log('✓ Config example copied');
  }

  // 4. Copy README
  console.log('📋 Copying documentation...');
  const readmeSrc = path.join(rootDir, 'EXECUTABLE_README.md');
  if (fs.existsSync(readmeSrc)) {
    fs.copyFileSync(readmeSrc, path.join(packageDir, 'README.md'));
    console.log('✓ Documentation copied');
  }

  // 5. Create quick start batch file
  console.log('📋 Creating startup script...');
  const startScript = `@echo off
echo Starting Twinkly Server...
echo.
echo Make sure you have created a config.toml file in this directory.
echo If you haven't, copy config.toml.example to config.toml and edit it.
echo.
twinkly-server.exe
pause
`;
  fs.writeFileSync(path.join(packageDir, 'start.bat'), startScript);
  console.log('✓ Startup script created');

  // Calculate package size
  const packageSize = getDirectorySize(packageDir);
  const sizeMB = (packageSize / (1024 * 1024)).toFixed(2);

  console.log('\n✅ Distribution package created successfully!');
  console.log(`📍 Location: ${packageDir}`);
  console.log(`📦 Total size: ${sizeMB} MB`);
  console.log('\n📋 Package contents:');
  console.log('   - twinkly-server.exe (self-contained executable)');
  console.log('   - packages/frontend/build/ (web interface)');
  console.log('   - config.toml.example (configuration template)');
  console.log('   - README.md (user documentation)');
  console.log('   - start.bat (Windows startup script)');
  console.log('\n🚀 Distribution package is ready to deploy!');
  console.log('📦 You can now zip this folder and distribute it.');
  console.log('\n⚠️  Users will need to:');
  console.log('   1. Create config.toml from config.toml.example');
  console.log('   2. Run start.bat or twinkly-server.exe');
  console.log('   3. Access http://localhost:3001 in their browser');
  
  // Rename the build artifact to prevent confusion
  console.log('\n🔧 Renaming build artifact to prevent accidental use...');
  const buildArtifact = path.join(distDir, 'twinkly-server.exe');
  const renamedArtifact = path.join(distDir, 'twinkly-server-BUILD-ARTIFACT-DO-NOT-RUN.exe');
  
  if (fs.existsSync(buildArtifact)) {
    if (fs.existsSync(renamedArtifact)) {
      fs.unlinkSync(renamedArtifact);
    }
    fs.renameSync(buildArtifact, renamedArtifact);
    console.log('✓ Build artifact renamed to prevent confusion');
    console.log(`   dist/twinkly-server-BUILD-ARTIFACT-DO-NOT-RUN.exe`);
    console.log('\n⚠️  IMPORTANT: Always use the distribution package:');
    console.log(`   ✓ CORRECT: ${path.join('dist', 'twinkly-server-package', 'twinkly-server.exe')}`);
    console.log(`   ✗ WRONG:   ${path.join('dist', 'twinkly-server.exe')} (build artifact)`);
  }
}

function copyDirectory(src, dest) {
  if (!fs.existsSync(dest)) {
    fs.mkdirSync(dest, { recursive: true });
  }

  const entries = fs.readdirSync(src, { withFileTypes: true });

  for (const entry of entries) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);

    if (entry.isDirectory()) {
      copyDirectory(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

function getDirectorySize(dirPath) {
  let size = 0;

  if (fs.statSync(dirPath).isFile()) {
    return fs.statSync(dirPath).size;
  }

  const entries = fs.readdirSync(dirPath, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = path.join(dirPath, entry.name);

    if (entry.isDirectory()) {
      size += getDirectorySize(fullPath);
    } else {
      size += fs.statSync(fullPath).size;
    }
  }

  return size;
}

createDistributionPackage().catch((error) => {
  console.error('❌ Unexpected error:', error);
  process.exit(1);
});
