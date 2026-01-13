require('dotenv').config();
const express = require('express');
const { createServer } = require('http');
const { Server } = require('socket.io');
const { v4: uuidv4 } = require('uuid');
const path = require('path');
const { spawn } = require('child_process');

// ngrok binary path (from npm package)
const NGROK_BIN = path.join(__dirname, 'node_modules', 'ngrok', 'bin', process.platform === 'win32' ? 'ngrok.exe' : 'ngrok');

let ngrokProcess = null;

// Start ngrok tunnel using the binary directly
async function startNgrokTunnel(port, authtoken) {
    return new Promise((resolve, reject) => {
        console.log('🌐 Starting ngrok tunnel...');
        
        // Start ngrok with http tunnel
        ngrokProcess = spawn(NGROK_BIN, ['http', port.toString(), '--log=stdout', '--log-format=json'], {
            env: { ...process.env, NGROK_AUTHTOKEN: authtoken },
            windowsHide: true
        });
        
        let resolved = false;
        
        ngrokProcess.stdout.on('data', (data) => {
            const lines = data.toString().trim().split('\n');
            for (const line of lines) {
                try {
                    const log = JSON.parse(line);
                    // Look for the URL in the log output
                    if (log.url && log.url.startsWith('https://')) {
                        if (!resolved) {
                            resolved = true;
                            resolve(log.url);
                        }
                    }
                    // Also check for addr field which contains the public URL
                    if (log.addr && log.msg === 'started tunnel') {
                        // The URL might be in a different field
                    }
                } catch (e) {
                    // Not JSON, check for URL pattern
                    const urlMatch = line.match(/url=(https:\/\/[^\s]+)/);
                    if (urlMatch && !resolved) {
                        resolved = true;
                        resolve(urlMatch[1]);
                    }
                }
            }
        });
        
        ngrokProcess.stderr.on('data', (data) => {
            const msg = data.toString();
            if (!resolved && msg.includes('error')) {
                resolved = true;
                reject(new Error(msg));
            }
        });
        
        ngrokProcess.on('error', (err) => {
            if (!resolved) {
                resolved = true;
                reject(err);
            }
        });
        
        ngrokProcess.on('exit', (code) => {
            if (!resolved && code !== 0) {
                resolved = true;
                reject(new Error(`ngrok exited with code ${code}`));
            }
        });
        
        // Timeout after 30 seconds
        setTimeout(() => {
            if (!resolved) {
                resolved = true;
                reject(new Error('ngrok startup timed out'));
            }
        }, 30000);
    });
}

// Cleanup ngrok on exit
function cleanupNgrok() {
    if (ngrokProcess) {
        ngrokProcess.kill();
        ngrokProcess = null;
    }
}

process.on('exit', cleanupNgrok);
process.on('SIGINT', () => { cleanupNgrok(); process.exit(); });
process.on('SIGTERM', () => { cleanupNgrok(); process.exit(); });

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    }
});

// Serve static files
app.use(express.static(path.join(__dirname)));

// Game rooms storage
const rooms = new Map();

// Player configurations (matching client)
const PLAYER_SYMBOLS = ['X', 'O', 'D', 'T', 'S'];

class GameRoom {
    constructor(roomCode, hostId, numPlayers, hostName, gameVariation = 'normal') {
        this.roomCode = roomCode;
        this.hostId = hostId;
        this.numPlayers = numPlayers;
        this.boardSize = 4 + numPlayers;
        this.winLength = 4;
        this.players = new Map(); // socketId -> { name, symbol, index }
        this.playerOrder = []; // Array of socket IDs in play order
        this.board = Array(this.boardSize * this.boardSize).fill('');
        this.currentPlayerIndex = 0;
        this.gameActive = false;
        this.gameStarted = false;
        this.winningCells = [];
        this.gameVariation = gameVariation; // 'normal', 'with-remove', 'with-remove-move'

        // Variation-specific settings
        this.allowDelete = gameVariation === 'with-remove' || gameVariation === 'with-remove-move';
        this.allowMove = gameVariation === 'with-remove-move';

        this.deleteCooldown = 5;
        this.moveCooldown = 3;
        this.moveCounters = {};

        // Add host as first player
        this.addPlayer(hostId, hostName);
    }

    addPlayer(socketId, playerName) {
        if (this.players.size >= this.numPlayers) {
            return { success: false, error: 'Room is full' };
        }

        const playerIndex = this.players.size;
        const symbol = PLAYER_SYMBOLS[playerIndex];

        this.players.set(socketId, {
            name: playerName,
            symbol: symbol,
            index: playerIndex
        });
        this.playerOrder.push(socketId);

        // Initialize move counters for this player
        this.moveCounters[symbol] = {
            movesSinceDelete: this.deleteCooldown,
            movesSinceMove: this.moveCooldown
        };

        return { success: true, symbol, playerIndex };
    }

    removePlayer(socketId) {
        const player = this.players.get(socketId);
        if (!player) return null;

        this.players.delete(socketId);
        this.playerOrder = this.playerOrder.filter(id => id !== socketId);

        // If game was started and player left, end the game
        if (this.gameStarted) {
            this.gameActive = false;
        }

        return player;
    }

    startGame() {
        if (this.players.size < 2) {
            return { success: false, error: 'Need at least 2 players' };
        }

        this.gameStarted = true;
        this.gameActive = true;
        this.currentPlayerIndex = 0;
        this.board = Array(this.boardSize * this.boardSize).fill('');
        this.winningCells = [];

        // Reset move counters
        this.playerOrder.forEach(socketId => {
            const player = this.players.get(socketId);
            if (player) {
                this.moveCounters[player.symbol] = {
                    movesSinceDelete: this.deleteCooldown,
                    movesSinceMove: this.moveCooldown
                };
            }
        });

        return { success: true };
    }

    getCurrentPlayer() {
        const socketId = this.playerOrder[this.currentPlayerIndex];
        return this.players.get(socketId);
    }

    getCurrentPlayerId() {
        return this.playerOrder[this.currentPlayerIndex];
    }

    isPlayerTurn(socketId) {
        return this.playerOrder[this.currentPlayerIndex] === socketId;
    }

    makeMove(socketId, action, index) {
        if (!this.gameActive) {
            return { success: false, error: 'Game is not active' };
        }

        if (!this.isPlayerTurn(socketId)) {
            return { success: false, error: 'Not your turn' };
        }

        const player = this.players.get(socketId);
        if (!player) {
            return { success: false, error: 'Player not found' };
        }

        const currentSymbol = player.symbol;
        let actionPerformed = false;
        let moveData = { action, index };

        switch (action) {
            case 'mark':
                if (this.board[index] !== '') {
                    return { success: false, error: 'Cell is not empty' };
                }
                this.board[index] = currentSymbol;
                actionPerformed = true;
                break;

            case 'delete':
                if (!this.allowDelete) {
                    return { success: false, error: 'Delete action not allowed in this game variation' };
                }
                const counters = this.moveCounters[currentSymbol];
                if (counters.movesSinceDelete < this.deleteCooldown) {
                    return { success: false, error: 'Delete on cooldown' };
                }
                if (this.board[index] === '' || this.board[index] === currentSymbol) {
                    return { success: false, error: 'Cannot delete this cell' };
                }
                this.board[index] = '';
                actionPerformed = true;
                break;

            case 'move':
                if (!this.allowMove) {
                    return { success: false, error: 'Move action not allowed in this game variation' };
                }
                const moveCounters = this.moveCounters[currentSymbol];
                if (moveCounters.movesSinceMove < this.moveCooldown) {
                    return { success: false, error: 'Move on cooldown' };
                }
                if (this.board[index] !== '') {
                    return { success: false, error: 'Target cell is not empty' };
                }
                const adjacentIndex = this.findAdjacentOwnCell(index, currentSymbol);
                if (adjacentIndex === -1) {
                    return { success: false, error: 'No adjacent cell to move' };
                }
                this.board[index] = currentSymbol;
                this.board[adjacentIndex] = '';
                moveData.sourceIndex = adjacentIndex;
                actionPerformed = true;
                break;
        }

        if (actionPerformed) {
            this.updateMoveCounters(currentSymbol, action);

            const winner = this.checkWin(currentSymbol);
            const draw = this.checkDraw();

            if (winner) {
                this.gameActive = false;
                return {
                    success: true,
                    moveData,
                    gameOver: true,
                    winner: currentSymbol,
                    winnerName: player.name,
                    winningCells: this.winningCells
                };
            } else if (draw) {
                this.gameActive = false;
                return {
                    success: true,
                    moveData,
                    gameOver: true,
                    draw: true
                };
            } else {
                this.nextPlayer();
                const nextPlayer = this.getCurrentPlayer();
                return {
                    success: true,
                    moveData,
                    nextPlayerSymbol: nextPlayer.symbol,
                    nextPlayerName: nextPlayer.name,
                    nextPlayerId: this.getCurrentPlayerId(),
                    moveCounters: this.moveCounters
                };
            }
        }

        return { success: false, error: 'Move failed' };
    }

    findAdjacentOwnCell(index, symbol) {
        const size = this.boardSize;
        const row = Math.floor(index / size);
        const col = index % size;

        const directions = [
            [-1, -1], [-1, 0], [-1, 1],
            [0, -1], [0, 1],
            [1, -1], [1, 0], [1, 1]
        ];

        for (const [dr, dc] of directions) {
            const newRow = row + dr;
            const newCol = col + dc;

            if (newRow >= 0 && newRow < size && newCol >= 0 && newCol < size) {
                const adjacentIndex = newRow * size + newCol;
                if (this.board[adjacentIndex] === symbol) {
                    return adjacentIndex;
                }
            }
        }

        return -1;
    }

    updateMoveCounters(symbol, action) {
        const counters = this.moveCounters[symbol];

        if (action === 'delete') {
            counters.movesSinceDelete = 0;
            counters.movesSinceMove++;
        } else if (action === 'move') {
            counters.movesSinceMove = 0;
            counters.movesSinceDelete++;
        } else if (action === 'mark') {
            counters.movesSinceDelete++;
            counters.movesSinceMove++;
        }
    }

    nextPlayer() {
        this.currentPlayerIndex = (this.currentPlayerIndex + 1) % this.playerOrder.length;
    }

    checkWin(symbol) {
        const size = this.boardSize;
        const winLength = this.winLength;

        // Check rows
        for (let row = 0; row < size; row++) {
            for (let col = 0; col <= size - winLength; col++) {
                const indices = [];
                let count = 0;
                for (let i = 0; i < winLength; i++) {
                    const idx = row * size + col + i;
                    indices.push(idx);
                    if (this.board[idx] === symbol) count++;
                }
                if (count === winLength) {
                    this.winningCells = indices;
                    return true;
                }
            }
        }

        // Check columns
        for (let col = 0; col < size; col++) {
            for (let row = 0; row <= size - winLength; row++) {
                const indices = [];
                let count = 0;
                for (let i = 0; i < winLength; i++) {
                    const idx = (row + i) * size + col;
                    indices.push(idx);
                    if (this.board[idx] === symbol) count++;
                }
                if (count === winLength) {
                    this.winningCells = indices;
                    return true;
                }
            }
        }

        // Check diagonal (top-left to bottom-right)
        for (let row = 0; row <= size - winLength; row++) {
            for (let col = 0; col <= size - winLength; col++) {
                const indices = [];
                let count = 0;
                for (let i = 0; i < winLength; i++) {
                    const idx = (row + i) * size + (col + i);
                    indices.push(idx);
                    if (this.board[idx] === symbol) count++;
                }
                if (count === winLength) {
                    this.winningCells = indices;
                    return true;
                }
            }
        }

        // Check diagonal (top-right to bottom-left)
        for (let row = 0; row <= size - winLength; row++) {
            for (let col = winLength - 1; col < size; col++) {
                const indices = [];
                let count = 0;
                for (let i = 0; i < winLength; i++) {
                    const idx = (row + i) * size + (col - i);
                    indices.push(idx);
                    if (this.board[idx] === symbol) count++;
                }
                if (count === winLength) {
                    this.winningCells = indices;
                    return true;
                }
            }
        }

        return false;
    }

    checkDraw() {
        return this.board.every(cell => cell !== '');
    }

    resetGame() {
        this.board = Array(this.boardSize * this.boardSize).fill('');
        this.currentPlayerIndex = 0;
        this.gameActive = true;
        this.winningCells = [];

        // Reset move counters
        this.playerOrder.forEach(socketId => {
            const player = this.players.get(socketId);
            if (player) {
                this.moveCounters[player.symbol] = {
                    movesSinceDelete: this.deleteCooldown,
                    movesSinceMove: this.moveCooldown
                };
            }
        });

        return { success: true };
    }

    getState() {
        const playersList = [];
        this.playerOrder.forEach(socketId => {
            const player = this.players.get(socketId);
            if (player) {
                playersList.push({
                    socketId,
                    name: player.name,
                    symbol: player.symbol,
                    index: player.index
                });
            }
        });

        return {
            roomCode: this.roomCode,
            hostId: this.hostId,
            numPlayers: this.numPlayers,
            boardSize: this.boardSize,
            board: this.board,
            players: playersList,
            currentPlayerIndex: this.currentPlayerIndex,
            currentPlayerId: this.getCurrentPlayerId(),
            gameActive: this.gameActive,
            gameStarted: this.gameStarted,
            moveCounters: this.moveCounters,
            deleteCooldown: this.deleteCooldown,
            moveCooldown: this.moveCooldown,
            gameVariation: this.gameVariation,
            allowDelete: this.allowDelete,
            allowMove: this.allowMove
        };
    }
}

// Generate a unique room code
function generateRoomCode() {
    const characters = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let code = '';
    for (let i = 0; i < 6; i++) {
        code += characters.charAt(Math.floor(Math.random() * characters.length));
    }
    return code;
}

io.on('connection', (socket) => {
    console.log(`Player connected: ${socket.id}`);

    // Create a new room
    socket.on('createRoom', ({ playerName, numPlayers, gameVariation = 'normal' }) => {
        let roomCode = generateRoomCode();
        // Ensure unique code
        while (rooms.has(roomCode)) {
            roomCode = generateRoomCode();
        }

        const room = new GameRoom(roomCode, socket.id, numPlayers, playerName, gameVariation);
        rooms.set(roomCode, room);
        socket.join(roomCode);

        console.log(`Room ${roomCode} created by ${playerName} with variation: ${gameVariation}`);

        socket.emit('roomCreated', {
            roomCode,
            state: room.getState(),
            yourSymbol: 'X',
            yourIndex: 0
        });
    });

    // Join an existing room
    socket.on('joinRoom', ({ roomCode, playerName }) => {
        const room = rooms.get(roomCode.toUpperCase());

        if (!room) {
            socket.emit('joinError', { error: 'Room not found' });
            return;
        }

        if (room.gameStarted) {
            socket.emit('joinError', { error: 'Game already started' });
            return;
        }

        const result = room.addPlayer(socket.id, playerName);

        if (!result.success) {
            socket.emit('joinError', { error: result.error });
            return;
        }

        socket.join(roomCode.toUpperCase());

        console.log(`${playerName} joined room ${roomCode}`);

        // Notify the joining player
        socket.emit('roomJoined', {
            roomCode: room.roomCode,
            state: room.getState(),
            yourSymbol: result.symbol,
            yourIndex: result.playerIndex
        });

        // Notify all players in the room
        io.to(room.roomCode).emit('playerJoined', {
            state: room.getState()
        });
    });

    // Start the game (host only)
    socket.on('startGame', ({ roomCode }) => {
        const room = rooms.get(roomCode);

        if (!room) {
            socket.emit('gameError', { error: 'Room not found' });
            return;
        }

        if (room.hostId !== socket.id) {
            socket.emit('gameError', { error: 'Only host can start the game' });
            return;
        }

        const result = room.startGame();

        if (!result.success) {
            socket.emit('gameError', { error: result.error });
            return;
        }

        console.log(`Game started in room ${roomCode}`);

        io.to(roomCode).emit('gameStarted', {
            state: room.getState()
        });
    });

    // Handle player move
    socket.on('makeMove', ({ roomCode, action, index }) => {
        const room = rooms.get(roomCode);

        if (!room) {
            socket.emit('moveError', { error: 'Room not found' });
            return;
        }

        const result = room.makeMove(socket.id, action, index);

        if (!result.success) {
            socket.emit('moveError', { error: result.error });
            return;
        }

        // Broadcast the move to all players
        io.to(roomCode).emit('moveMade', {
            ...result,
            board: room.board,
            state: room.getState()
        });
    });

    // Reset game
    socket.on('resetGame', ({ roomCode }) => {
        const room = rooms.get(roomCode);

        if (!room) {
            socket.emit('gameError', { error: 'Room not found' });
            return;
        }

        if (room.hostId !== socket.id) {
            socket.emit('gameError', { error: 'Only host can reset the game' });
            return;
        }

        room.resetGame();

        io.to(roomCode).emit('gameReset', {
            state: room.getState()
        });
    });

    // Handle disconnection
    socket.on('disconnect', () => {
        console.log(`Player disconnected: ${socket.id}`);

        // Find and clean up any rooms this player was in
        for (const [roomCode, room] of rooms.entries()) {
            if (room.players.has(socket.id)) {
                const player = room.removePlayer(socket.id);

                if (room.players.size === 0) {
                    // Delete empty room
                    rooms.delete(roomCode);
                    console.log(`Room ${roomCode} deleted (empty)`);
                } else {
                    // If host left, assign new host
                    if (room.hostId === socket.id) {
                        room.hostId = room.playerOrder[0];
                    }

                    // Notify remaining players
                    io.to(roomCode).emit('playerLeft', {
                        playerName: player.name,
                        state: room.getState()
                    });
                }
                break;
            }
        }
    });

    // Send chat message
    socket.on('chatMessage', ({ roomCode, message }) => {
        const room = rooms.get(roomCode);
        if (!room) return;

        const player = room.players.get(socket.id);
        if (!player) return;

        io.to(roomCode).emit('chatMessage', {
            playerName: player.name,
            symbol: player.symbol,
            message
        });
    });
});

const PORT = process.env.PORT || 3000;
httpServer.listen(PORT, '0.0.0.0', async () => {
    let url = `http://localhost:${PORT}`;
    
    // Setup ngrok if NGROK_AUTHTOKEN is provided
    if (process.env.NGROK_AUTHTOKEN) {
        try {
            const ngrokUrl = await startNgrokTunnel(PORT, process.env.NGROK_AUTHTOKEN);
            url = ngrokUrl;
            console.log(`\n🌐 Ngrok tunnel established: ${ngrokUrl}\n`);
        } catch (error) {
            console.error('Failed to establish ngrok tunnel:', error.message);
            console.log('Continuing without ngrok...\n');
        }
    }

    console.log(`
╔════════════════════════════════════════════╗
║   Tic Tac Toe Online Server Running!       ║
║   Server: ${url.padEnd(40)}║
║   Port: ${PORT.toString().padEnd(42)}║
╚════════════════════════════════════════════╝
    `);
});

