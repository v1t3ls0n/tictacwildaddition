#!/bin/bash

# Development script - starts the server with auto-restart on file changes
# Requires: npm install -g nodemon (optional, falls back to node)

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"

cd "$PROJECT_DIR"

echo "🎮 Tic Tac Toe - Development Server"
echo "===================================="

# Check if node_modules exists
if [ ! -d "node_modules" ]; then
    echo "📦 Installing dependencies..."
    npm install
fi

# Check if nodemon is available
if command -v nodemon &> /dev/null; then
    echo "🔄 Starting with nodemon (auto-restart enabled)..."
    echo ""
    nodemon server.js
else
    echo "💡 Tip: Install nodemon for auto-restart: npm install -g nodemon"
    echo "🚀 Starting server..."
    echo ""
    node server.js
fi

