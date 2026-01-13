#!/bin/bash

# Deploy script - deploys to a remote server or cloud platform
# Supports: manual SSH deploy, or platform-specific deployment

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"

cd "$PROJECT_DIR"

echo "🚀 Tic Tac Toe - Deploy Script"
echo "==============================="

# Configuration (customize these)
DEPLOY_METHOD="${DEPLOY_METHOD:-local}"  # local, ssh, heroku
REMOTE_HOST="${REMOTE_HOST:-}"
REMOTE_USER="${REMOTE_USER:-}"
REMOTE_PATH="${REMOTE_PATH:-/var/www/tic-tac-toe}"
APP_NAME="${APP_NAME:-tic-tac-toe-online}"

# Build first
echo "📦 Building project..."
bash "$SCRIPT_DIR/build.sh"

echo ""

case "$DEPLOY_METHOD" in
    "local")
        echo "🏠 Local deployment"
        echo "Starting production server from dist/..."
        cd dist
        NODE_ENV=production node server.js
        ;;
        
    "ssh")
        if [ -z "$REMOTE_HOST" ] || [ -z "$REMOTE_USER" ]; then
            echo "❌ Error: REMOTE_HOST and REMOTE_USER must be set for SSH deploy"
            echo ""
            echo "Usage:"
            echo "  REMOTE_HOST=server.com REMOTE_USER=user ./scripts/deploy.sh"
            exit 1
        fi
        
        echo "📤 Deploying to $REMOTE_USER@$REMOTE_HOST:$REMOTE_PATH"
        
        # Create remote directory
        ssh "$REMOTE_USER@$REMOTE_HOST" "mkdir -p $REMOTE_PATH"
        
        # Sync files
        rsync -avz --delete dist/ "$REMOTE_USER@$REMOTE_HOST:$REMOTE_PATH/"
        
        # Restart service (assumes PM2 or systemd)
        echo "🔄 Restarting service..."
        ssh "$REMOTE_USER@$REMOTE_HOST" "cd $REMOTE_PATH && pm2 restart $APP_NAME 2>/dev/null || pm2 start server.js --name $APP_NAME"
        
        echo "✅ Deployed successfully!"
        ;;
        
    "heroku")
        echo "☁️  Deploying to Heroku..."
        
        # Check if Heroku CLI is installed
        if ! command -v heroku &> /dev/null; then
            echo "❌ Heroku CLI not found. Install it from: https://devcenter.heroku.com/articles/heroku-cli"
            exit 1
        fi
        
        # Create Procfile if it doesn't exist
        if [ ! -f "Procfile" ]; then
            echo "web: node server.js" > Procfile
            echo "📝 Created Procfile"
        fi
        
        # Deploy
        git add -A
        git commit -m "Deploy to Heroku" --allow-empty
        git push heroku main 2>/dev/null || git push heroku master
        
        echo "✅ Deployed to Heroku!"
        heroku open
        ;;
        
    *)
        echo "❌ Unknown deploy method: $DEPLOY_METHOD"
        echo ""
        echo "Available methods:"
        echo "  local   - Run production build locally (default)"
        echo "  ssh     - Deploy via SSH/rsync"
        echo "  heroku  - Deploy to Heroku"
        echo ""
        echo "Usage:"
        echo "  DEPLOY_METHOD=heroku ./scripts/deploy.sh"
        exit 1
        ;;
esac

