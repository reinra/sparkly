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

  // Generate asset map for embedding
  console.log('\n📄 Generating embedded assets map...');
  try {
    const { stdout } = await execAsync('node scripts/generate-bun-assets.js', { cwd: rootDir });
    console.log(stdout.trim());
  } catch (error) {
    console.error('❌ Failed to generate assets:', error.message);
    process.exit(1);
  }

  // Create output directory
  const distDir = path.join(rootDir, 'dist');
  if (!fs.existsSync(distDir)) {
    fs.mkdirSync(distDir, { recursive: true });
  }

  // Build the executable
  console.log('\n🚀 Building executable...');
  // Use server-bun.ts which statically imports assets and handler
  const entryPoint = path.join(rootDir, 'packages', 'backend', 'src', 'server-bun.ts');
  const outputPath = path.join(distDir, 'twinkly-server.exe');

  // Check if entry point exists
  if (!fs.existsSync(entryPoint)) {
    console.error(`❌ Entry point not found: ${entryPoint}`);
    process.exit(1);
  }

  const buildDate = new Date().toISOString();
  // Using JSON.stringify ensures the string is properly quoted for the define replacement
  // We need to escape double quotes for the shell command if necessary, but JSON.stringify wraps in double quotes
  // For bun --define, we want: process.env.BUILD_DATE="value" or 'value'
  // In shell execution, we usually want: --define "process.env.BUILD_DATE='value'"
  const defineArg = `--define "process.env.BUILD_DATE='${buildDate}'"`;

  const bunCommand = `bun build ${entryPoint} --compile --minify --sourcemap --outfile ${outputPath} ${defineArg}`;

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
