import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.dirname(__dirname);

async function createDistributionPackage() {
  console.log('📦 Creating distribution package...\n');

  const distDir = path.join(rootDir, 'dist');
  const packageDir = path.join(distDir, 'sparkly-package');

  // Create package directory
  if (!fs.existsSync(packageDir)) {
    fs.mkdirSync(packageDir, { recursive: true });
  }

  // 1. Copy executable
  console.log('📋 Copying executable...');
  const exePath = path.join(distDir, 'sparkly.exe');
  if (!fs.existsSync(exePath)) {
    console.error('❌ Executable not found. Run "npm run build:executable" first.');
    process.exit(1);
  }
  fs.copyFileSync(exePath, path.join(packageDir, 'sparkly.exe'));
  console.log('✓ Executable copied');

  // 2. Frontend files are now embedded in the executable - no need to copy
  console.log('✓ Frontend files are embedded in the executable');

  // 3. Generate version.txt
  console.log('📋 Generating version.txt...');
  const commitSha = process.env.GITHUB_SHA || execSync('git rev-parse HEAD').toString().trim();
  const builtTimestamp = new Date().toISOString();
  const versionContent = `commit=${commitSha}\nbuilt=${builtTimestamp}\n`;
  fs.writeFileSync(path.join(packageDir, 'version.txt'), versionContent);
  console.log(`✓ version.txt generated (commit=${commitSha.substring(0, 8)})`);

  // 4. Copy update scripts
  console.log('📋 Copying update scripts...');
  const updateScripts = ['start.cmd', 'update.cmd', 'download-latest.ps1'];
  const scriptsDir = path.join(rootDir, 'scripts');
  for (const script of updateScripts) {
    const src = path.join(scriptsDir, script);
    if (fs.existsSync(src)) {
      fs.copyFileSync(src, path.join(packageDir, script));
      console.log(`✓ ${script} copied`);
    } else {
      console.warn(`⚠️ ${script} not found at ${src}`);
    }
  }

  // 5. Copy README
  console.log('📋 Copying documentation...');
  const readmeSrc = path.join(rootDir, 'docs', 'EXECUTABLE_README.md');
  if (fs.existsSync(readmeSrc)) {
    fs.copyFileSync(readmeSrc, path.join(packageDir, 'README.md'));
    console.log('✓ Documentation copied');
  } else {
    console.warn('⚠️ EXECUTABLE_README.md not found at', readmeSrc);
  }

  // Calculate package size
  const packageSize = getDirectorySize(packageDir);
  const sizeMB = (packageSize / (1024 * 1024)).toFixed(2);

  console.log('\n✅ Distribution package created successfully!');
  console.log(`📍 Location: ${packageDir}`);
  console.log(`📦 Total size: ${sizeMB} MB`);
  console.log('\n📋 Package contents:');
  console.log('   - sparkly.exe (self-contained executable)');
  console.log('   - start.cmd (auto-update + launch)');
  console.log('   - update.cmd (check for updates)');
  console.log('   - download-latest.ps1 (update engine)');
  console.log('   - version.txt (version tracking)');
  console.log('   - README.md (user documentation)');
  console.log('\n🚀 Distribution package is ready to deploy!');
  console.log('📦 You can now zip this folder and distribute it.');
  console.log('\n⚠️  Users will need to:');
  console.log('   1. Run sparkly.exe');
  console.log('   2. Access http://localhost:3001 in their browser');
  console.log('   3. Add devices via the web interface');
  
  // Rename the build artifact to prevent confusion
  console.log('\n🔧 Renaming build artifact to prevent accidental use...');
  const buildArtifact = path.join(distDir, 'sparkly.exe');
  const renamedArtifact = path.join(distDir, 'sparkly-BUILD-ARTIFACT-DO-NOT-RUN.exe');
  
  if (fs.existsSync(buildArtifact)) {
    if (fs.existsSync(renamedArtifact)) {
      fs.unlinkSync(renamedArtifact);
    }
    fs.renameSync(buildArtifact, renamedArtifact);
    console.log('✓ Build artifact renamed to prevent confusion');
    console.log(`   dist/sparkly-BUILD-ARTIFACT-DO-NOT-RUN.exe`);
    console.log('\n⚠️  IMPORTANT: Always use the distribution package:');
    console.log(`   ✓ CORRECT: ${path.join('dist', 'sparkly-package', 'sparkly.exe')}`);
    console.log(`   ✗ WRONG:   ${path.join('dist', 'sparkly.exe')} (build artifact)`);
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
