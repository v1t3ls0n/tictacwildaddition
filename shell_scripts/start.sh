#!/bin/bash

# Quick start script - installs dependencies and starts the server

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"

cd "$PROJECT_DIR"

echo "🎮 Tic Tac Toe Online"
echo "====================="
echo ""

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

# Check for Node.js
if ! command -v node &> /dev/null; then
    echo "❌ Node.js is not installed!"
    echo "Please install Node.js from: https://nodejs.org/"
    exit 1
fi

echo "✓ Node.js $(node -v)"

# Install dependencies if needed
if [ ! -d "node_modules" ]; then
    echo ""
    echo "📦 Installing dependencies..."
    npm install
fi

echo ""
echo "🚀 Starting server..."
echo ""

node server.js

