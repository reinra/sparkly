import { exec } from 'child_process';
import { promisify } from 'util';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const execAsync = promisify(exec);
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.dirname(__dirname);

async function buildExecutable() {
  console.log('🔨 Building self-contained executable with Bun...\n');

  // Check if Bun is installed
  try {
    const { stdout } = await execAsync('bun --version');
    console.log(`✓ Bun version: ${stdout.trim()}`);
  } catch (error) {
    console.error('❌ Bun is not installed. Please install Bun from https://bun.sh');
    process.exit(1);
  }

  // Ensure all packages are built
  console.log('\n📦 Ensuring all packages are built...');
  const buildDir = path.join(rootDir, 'packages', 'backend', 'dist');
  if (!fs.existsSync(buildDir)) {
    console.error('❌ Backend not built. Run "npm run build" first.');
    process.exit(1);
  }

  const frontendBuildDir = path.join(rootDir, 'packages', 'frontend', 'build');
  if (!fs.existsSync(frontendBuildDir)) {
    console.error('❌ Frontend not built. Run "npm run build" first.');
    process.exit(1);
  }

  console.log('✓ All packages are built');

  // Create output directory
  const distDir = path.join(rootDir, 'dist');
  if (!fs.existsSync(distDir)) {
    fs.mkdirSync(distDir, { recursive: true });
  }

  // Build the executable
  console.log('\n🚀 Building executable...');
  const entryPoint = path.join(rootDir, 'packages', 'backend', 'dist', 'server-production.js');
  const outputPath = path.join(distDir, 'twinkly-server.exe');

  // Check if entry point exists
  if (!fs.existsSync(entryPoint)) {
    console.error(`❌ Entry point not found: ${entryPoint}`);
    console.error('Make sure server-production.ts is compiled.');
    process.exit(1);
  }

  const bunCommand = `bun build ${entryPoint} --compile --minify --sourcemap --outfile ${outputPath}`;

  try {
    console.log(`Running: ${bunCommand}\n`);
    const { stdout, stderr } = await execAsync(bunCommand, {
      cwd: rootDir,
      maxBuffer: 10 * 1024 * 1024, // 10MB buffer
    });

    if (stdout) console.log(stdout);
    if (stderr) console.error(stderr);

    // Check if executable was created
    if (fs.existsSync(outputPath)) {
      const stats = fs.statSync(outputPath);
      const sizeMB = (stats.size / (1024 * 1024)).toFixed(2);
      console.log(`\n✅ Executable created successfully!`);
      console.log(`📍 Location: ${outputPath}`);
      console.log(`📦 Size: ${sizeMB} MB`);
      console.log(`\n🎉 You can now run: ${outputPath}`);
      console.log(`\n⚠️  Note: Make sure config.toml is in the same directory as the executable`);
    } else {
      console.error('❌ Executable was not created');
      process.exit(1);
    }
  } catch (error) {
    console.error('❌ Build failed:', error.message);
    if (error.stdout) console.log(error.stdout);
    if (error.stderr) console.error(error.stderr);
    process.exit(1);
  }
}

buildExecutable().catch((error) => {
  console.error('❌ Unexpected error:', error);
  process.exit(1);
});
