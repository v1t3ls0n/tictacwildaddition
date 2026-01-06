# Railway Deployment Guide

This guide will help you deploy the Tic Tac Toe game to Railway.

## Prerequisites

1. A Railway account (sign up at [railway.app](https://railway.app))
2. Git repository (GitHub, GitLab, or Bitbucket)

## Deployment Steps

### Option 1: Deploy via Railway Dashboard

1. **Connect Repository**
   - Go to [Railway Dashboard](https://railway.app/dashboard)
   - Click "New Project"
   - Select "Deploy from GitHub repo" (or your Git provider)
   - Choose your repository

2. **Configure Service**
   - Railway will automatically detect it's a Node.js project
   - It will use the `start` script from `package.json`
   - The service will automatically build and deploy

3. **Set Environment Variables** (if needed)
   - Railway automatically sets `PORT` environment variable
   - No additional configuration needed for basic deployment

4. **Get Your URL**
   - Railway automatically generates a domain when you deploy
   - **To find your URL:**
     1. Go to your project in Railway dashboard
     2. Click on your service
     3. Go to the "Settings" tab
     4. Scroll down to "Networking" section
     5. You'll see your generated domain (e.g., `https://your-app-name.up.railway.app`)
     6. Click "Generate Domain" if you don't see one yet
   
   - **To share with players:**
     - Copy the URL from the Networking section
     - Share this URL with players (e.g., `https://tictactoe-production.up.railway.app`)
     - Players can open this URL in their browser to play
   
   - **Custom Domain (Optional):**
     - In the Networking section, click "Custom Domain"
     - Add your own domain (e.g., `tictactoe.yourdomain.com`)
     - Follow the DNS configuration instructions
     - This gives you a cleaner, branded URL

### Option 2: Deploy via Railway CLI

1. **Install Railway CLI**
   ```bash
   npm i -g @railway/cli
   ```

2. **Login to Railway**
   ```bash
   railway login
   ```

3. **Initialize Project**
   ```bash
   railway init
   ```

4. **Deploy**
   ```bash
   railway up
   ```

## Configuration Files

The project includes the following Railway configuration files:

- **`railway.json`** - Railway configuration (JSON format)
- **`railway.toml`** - Railway configuration (TOML format)
- **`Procfile`** - Process file for Railway
- **`.railwayignore`** - Files to exclude from deployment

## Environment Variables

Railway automatically provides:
- `PORT` - Port number for the server (automatically set by Railway)

No additional environment variables are required for basic deployment.

## Build Process

Railway will:
1. Detect Node.js project from `package.json`
2. Run `npm install` to install dependencies
3. Run `npm start` to start the server
4. Expose the service on the provided PORT

## Health Checks

Railway automatically monitors your service:
- Checks if the service responds to HTTP requests
- Restarts on failure (configured in `railway.json`)

## Custom Domain

To use a custom domain:
1. Go to your service settings in Railway
2. Click "Settings" → "Networking"
3. Add your custom domain
4. Follow the DNS configuration instructions

## Monitoring

Railway provides:
- Real-time logs in the dashboard
- Metrics and analytics
- Automatic restarts on failure

## Troubleshooting

### Service won't start
- Check logs in Railway dashboard
- Verify `package.json` has correct `start` script
- Ensure all dependencies are listed in `package.json`

### Port issues
- Railway automatically sets `PORT` environment variable
- The server already uses `process.env.PORT || 3000`

### Build fails
- Check that all dependencies are in `package.json`
- Verify Node.js version compatibility (requires Node 18+)

## Support

For Railway-specific issues, check:
- [Railway Documentation](https://docs.railway.app)
- [Railway Discord](https://discord.gg/railway)

