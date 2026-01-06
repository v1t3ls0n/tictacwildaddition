# How to Get Your Railway URL

## Quick Steps to Get Your Railway URL

### Method 1: From Railway Dashboard (Easiest)

1. **Go to Railway Dashboard**
   - Visit [railway.app/dashboard](https://railway.app/dashboard)
   - Login to your account

2. **Select Your Project**
   - Click on your Tic Tac Toe project

3. **Open Your Service**
   - Click on the service (usually named after your project)

4. **Get the URL**
   - Go to the **"Settings"** tab
   - Scroll down to the **"Networking"** section
   - You'll see your Railway-generated domain
   - Example: `https://tictactoe-production.up.railway.app`

5. **Copy and Share**
   - Click the copy icon next to the URL
   - Share this URL with players
   - Players can open it in any browser to play

### Method 2: From Service Overview

1. **Go to Your Service**
   - In the Railway dashboard, click your service

2. **Check the Overview Tab**
   - The URL is often displayed at the top
   - Look for a "Visit" or "Open" button
   - This will show your public URL

### Method 3: Generate a New Domain

If you don't see a domain:

1. **Go to Settings → Networking**
2. **Click "Generate Domain"**
3. **Railway will create a new domain**
4. **Copy and use this URL**

## URL Format

Railway URLs typically look like:
```
https://[service-name]-[environment].up.railway.app
```

Examples:
- `https://tictactoe-production.up.railway.app`
- `https://tictactoe-staging.up.railway.app`
- `https://my-game-1234.up.railway.app`

## Custom Domain (Optional)

For a cleaner, branded URL:

1. **Go to Settings → Networking**
2. **Click "Custom Domain"**
3. **Enter your domain** (e.g., `tictactoe.yourdomain.com`)
4. **Configure DNS** as instructed by Railway
5. **Wait for DNS propagation** (usually 5-15 minutes)
6. **Your custom domain will work!**

## Sharing the URL

Once you have your Railway URL:

1. **Copy the URL** from Railway dashboard
2. **Share it with players** via:
   - Direct message
   - Email
   - Social media
   - QR code
   - Your website

3. **Players can:**
   - Open the URL in any browser
   - Play immediately (no installation needed)
   - Create or join game rooms

## Important Notes

- ✅ **HTTPS is automatic** - Railway provides SSL certificates
- ✅ **URL is permanent** - It won't change unless you delete the service
- ✅ **Works worldwide** - Accessible from anywhere
- ✅ **No port number needed** - Railway handles routing

## Troubleshooting

### Can't find the URL?
- Make sure your service is deployed and running
- Check the "Deployments" tab to see if deployment succeeded
- Look in the "Settings" → "Networking" section

### URL not working?
- Check if the service is running (green status)
- Verify the deployment was successful
- Check the logs for any errors

### Want to change the URL?
- You can generate a new domain in Settings → Networking
- Or set up a custom domain

## Example Workflow

1. Deploy your app to Railway
2. Wait for deployment to complete (usually 1-2 minutes)
3. Go to Settings → Networking
4. Copy the generated URL: `https://tictactoe-production.up.railway.app`
5. Share with players: "Hey! Play Tic Tac Toe here: https://tictactoe-production.up.railway.app"
6. Players open the URL and start playing!

