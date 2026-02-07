import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.dirname(__dirname);

const frontendClientDir = path.join(rootDir, 'packages', 'frontend', 'build', 'client');
const outputDir = path.join(rootDir, 'packages', 'backend', 'src', 'generated');
const outputFile = path.join(outputDir, 'assets.ts');

function getAllFiles(dirPath, arrayOfFiles) {
  const files = fs.readdirSync(dirPath);

  arrayOfFiles = arrayOfFiles || [];

  files.forEach(function(file) {
    if (fs.statSync(dirPath + "/" + file).isDirectory()) {
      arrayOfFiles = getAllFiles(dirPath + "/" + file, arrayOfFiles);
    } else {
      arrayOfFiles.push(path.join(dirPath, "/", file));
    }
  });

  return arrayOfFiles;
}

if (!fs.existsSync(frontendClientDir)) {
    console.error(`Frontend build directory not found at ${frontendClientDir}`);
    process.exit(1);
}

if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
}

const files = getAllFiles(frontendClientDir, []);
const imports = [];
const mappings = [];

files.forEach((file, index) => {
    // Relative path from the generated file to the asset
    // generated file is in packages/backend/src/generated
    // asset is in packages/frontend/build/client/...
    const relativePath = path.relative(outputDir, file).split(path.sep).join('/');
    const varName = `asset_${index}`;
    
    // Import path must be relative to the TS file
    imports.push(`import ${varName} from "./${relativePath}" with { type: "file" };`);
    
    // URL path should be relative to client dir
    const urlPath = path.relative(frontendClientDir, file).split(path.sep).join('/');
    mappings.push(`  "/${urlPath}": ${varName},`);
    
    // Also map without leading slash just in case
    // mappings.push(`  "${urlPath}": ${varName},`);
});

const content = `// @ts-nocheck
// This file is auto-generated. Do not edit.
${imports.join('\n')}

export const assets: Record<string, string> = {
${mappings.join('\n')}
};
`;

fs.writeFileSync(outputFile, content);
console.log(`Generated assets.ts with ${files.length} files.`);
