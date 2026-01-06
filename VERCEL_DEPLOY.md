# Vercel Frontend (Branch: `vercel-frontend`)

This branch is meant to deploy the **frontend** (static files) on Vercel.

Your **backend** (Express + Socket.IO in `server.js`) must be deployed separately on a host that supports long-running Node processes (for example: Render).

## Deploy frontend on Vercel

1. Push this branch to GitHub:
   - `git push -u origin vercel-frontend`
2. In Vercel:
   - New Project → Import your repo
   - Select the **`vercel-frontend`** branch
   - Framework preset: **Other**
   - Build command: **none**
   - Output directory: **.**
3. Deploy.

## Configure the backend URL in the UI

Because the frontend and backend are on different domains, the game needs to know where your Socket.IO server lives.

- Open the Vercel site.
- Click **Play Online**.
- In **Server URL (Render backend)**, paste your backend URL, e.g.:
  - `https://your-backend.onrender.com`
- Create/Join rooms normally.

The URL is saved to `localStorage` so you don’t need to enter it every time.

## Notes

- This branch loads Socket.IO client from the CDN (`cdn.socket.io`) so it works without `/socket.io/socket.io.js`.
- The backend must allow CORS. Your backend currently allows all origins.


