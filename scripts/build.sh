#!/bin/bash

# Build script - prepares the project for production deployment

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"

cd "$PROJECT_DIR"

echo "🔨 Tic Tac Toe - Build Script"
echo "=============================="

# Clean previous build
if [ -d "dist" ]; then
    echo "🧹 Cleaning previous build..."
    rm -rf dist
fi

# Create dist directory
mkdir -p dist

# Copy necessary files
echo "📁 Copying files..."
cp package.json dist/
cp server.js dist/
cp index.html dist/
cp style.css dist/
cp script.js dist/

# Install production dependencies only
echo "📦 Installing production dependencies..."
cd dist
npm install --production --silent

echo ""
echo "✅ Build complete!"
echo "📂 Output: $PROJECT_DIR/dist"
echo ""
echo "To run the production build:"
echo "  cd dist && node server.js"

