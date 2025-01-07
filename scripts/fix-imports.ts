import { readFileSync, writeFileSync, readdirSync } from 'fs';
import { join, resolve } from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

function addJsExtensions(content: string): string {
  // Add .js to relative imports without extension
  return content.replace(
    /(from\s+['"]\.\.?\/[^'"]*?)(['"])/g,
    (match, p1, p2) => {
      if (p1.endsWith('.js')) return match;
      return `${p1}.js${p2}`;
    }
  );
}

function fixPathAliases(content: string): string {
  // Replace @/ with relative paths
  return content.replace(
    /(from\s+['"])@\//g,
    '$1../../src/'
  );
}

function processFile(filePath: string) {
  const content = readFileSync(filePath, 'utf8');
  let newContent = content;
  
  // Only process .ts files
  if (filePath.endsWith('.ts')) {
    newContent = addJsExtensions(content);
    newContent = fixPathAliases(newContent);
    
    if (newContent !== content) {
      writeFileSync(filePath, newContent);
      console.log(`Updated ${filePath}`);
    }
  }
}

function processDirectory(dir: string) {
  const entries = readdirSync(dir, { withFileTypes: true });
  
  for (const entry of entries) {
    const fullPath = join(dir, entry.name);
    
    if (entry.isDirectory() && !entry.name.startsWith('.') && entry.name !== 'node_modules' && entry.name !== 'dist') {
      processDirectory(fullPath);
    } else if (entry.isFile() && entry.name.endsWith('.ts')) {
      processFile(fullPath);
    }
  }
}

// Get current file path and directory in ESM
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Start processing from src directory
processDirectory(resolve(__dirname, '../src'));
