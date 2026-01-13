#!/bin/bash

# Development script - starts the server with auto-restart on file changes
# Requires: npm install -g nodemon (optional, falls back to node)

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"

cd "$PROJECT_DIR"

echo "🎮 Tic Tac Toe - Development Server"
echo "===================================="

# Kill any existing server on port 3000 (or PORT from env)
PORT=${PORT:-3000}
echo "🔪 Checking for existing servers on port $PORT..."

if command -v lsof &> /dev/null; then
    PIDS=$(lsof -ti:$PORT 2>/dev/null || true)
    if [ -n "$PIDS" ]; then
        echo "   Killing existing processes..."
        echo "$PIDS" | xargs kill -9 2>/dev/null || true
        sleep 0.5
    else
        echo "   ✓ No existing processes found"
    fi
elif command -v fuser &> /dev/null; then
    fuser -k $PORT/tcp 2>/dev/null || echo "   ✓ No existing processes found"
    sleep 0.5
else
    echo "   ⚠ Could not check for existing processes (lsof/fuser not available)"
fi

echo ""

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

