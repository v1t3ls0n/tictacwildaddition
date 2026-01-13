// Build script for Node.js (alternative to build.sh)
// Copies necessary files to dist/ directory for production

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const PROJECT_DIR = __dirname.replace(/shell_scripts$/, '');
const DIST_DIR = path.join(PROJECT_DIR, 'dist');

console.log('🔨 Tic Tac Toe - Build Script');
console.log('==============================\n');

// Clean previous build
if (fs.existsSync(DIST_DIR)) {
    console.log('🧹 Cleaning previous build...');
    fs.rmSync(DIST_DIR, { recursive: true, force: true });
}

// Create dist directory
fs.mkdirSync(DIST_DIR, { recursive: true });

// Files to copy
const filesToCopy = [
    'package.json',
    'server.js',
    'index.html',
    'style.css',
    'script.js'
];

console.log('📁 Copying files...');
filesToCopy.forEach(file => {
    const src = path.join(PROJECT_DIR, file);
    const dest = path.join(DIST_DIR, file);
    if (fs.existsSync(src)) {
        fs.copyFileSync(src, dest);
        console.log(`  ✓ ${file}`);
    } else {
        console.log(`  ✗ ${file} (not found)`);
    }
});

// Install production dependencies
console.log('\n📦 Installing production dependencies...');
process.chdir(DIST_DIR);
try {
    execSync('npm install --production --silent', { stdio: 'inherit' });
} catch (error) {
    console.error('❌ Failed to install dependencies');
    process.exit(1);
}

console.log('\n✅ Build complete!');
console.log(`📂 Output: ${DIST_DIR}\n`);
console.log('To run the production build:');
console.log('  cd dist && node server.js');
