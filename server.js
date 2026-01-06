const express = require('express');
const { createServer } = require('http');
const { Server } = require('socket.io');
const { v4: uuidv4 } = require('uuid');
const path = require('path');

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
    constructor(roomCode, hostId, numPlayers, hostName) {
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
            [0, -1],           [0, 1],
            [1, -1],  [1, 0],  [1, 1]
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
            moveCooldown: this.moveCooldown
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
    socket.on('createRoom', ({ playerName, numPlayers }) => {
        let roomCode = generateRoomCode();
        // Ensure unique code
        while (rooms.has(roomCode)) {
            roomCode = generateRoomCode();
        }
        
        const room = new GameRoom(roomCode, socket.id, numPlayers, playerName);
        rooms.set(roomCode, room);
        socket.join(roomCode);
        
        console.log(`Room ${roomCode} created by ${playerName}`);
        
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
httpServer.listen(PORT, () => {
    console.log(`
╔════════════════════════════════════════════╗
║   Tic Tac Toe Online Server Running!       ║
║   Open http://localhost:${PORT} to play        ║
╚════════════════════════════════════════════╝
    `);
});

