# Tic Tac Toe - Ultimate Edition

An advanced multiplayer Tic Tac Toe game with support for 2-5 players, computer AI opponents, and online multiplayer.

## Features

- 🎮 **Local Multiplayer**: Play with 2-5 players locally
- 🤖 **Computer AI**: Multiple difficulty levels (Easy, Medium, Hard, Expert)
- 🌐 **Online Multiplayer**: Create and join game rooms
- 🎯 **Advanced Gameplay**: Mark, delete, and move actions with cooldowns
- 💬 **Chat System**: Communicate with other players in online games
- 📊 **Score Tracking**: Track wins across multiple games

## Quick Start

### Local Development

1. Install dependencies:
   ```bash
   npm install
   ```

2. Start the server:
   ```bash
   npm start
   ```

3. Open your browser to `http://localhost:3000`

### Deployment with Ngrok

1. Get your ngrok authtoken from https://dashboard.ngrok.com/get-started/your-authtoken
2. Create a `.env` file with:
   ```
   NGROK_AUTHTOKEN=your_ngrok_authtoken_here
   ```
3. Start the server:
   ```bash
   npm start
   ```
4. The ngrok public URL will be displayed in the console. Share this URL to access your game from anywhere.

## Game Modes

- **Local Multiplayer**: Play with friends on the same device
- **Vs Computer**: Play against AI with configurable difficulty
- **Mixed Mode**: Combine human and computer players
- **Online Multiplayer**: Play with others over the internet

## Technology Stack

- **Backend**: Node.js, Express, Socket.io
- **Frontend**: Vanilla JavaScript, HTML5, CSS3
- **Deployment**: Ngrok integration for public access

## License

MIT
