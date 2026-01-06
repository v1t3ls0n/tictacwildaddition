// Player configurations
const PLAYER_CONFIGS = {
    'X': { symbol: '✕', color: '#ff6b6b', name: 'X' },
    'O': { symbol: '○', color: '#4ecdc4', name: 'Circle' },
    'D': { symbol: '•', color: '#28a745', name: 'Dot' },
    'T': { symbol: '▲', color: '#ffc107', name: 'Triangle' },
    'S': { symbol: '■', color: '#dc3545', name: 'Square' }
};

const PLAYER_SYMBOLS = ['X', 'O', 'D', 'T', 'S'];

// Computer difficulty levels
const DIFFICULTY_LEVELS = {
    'easy': { name: 'Easy', depth: 2, description: 'Quick moves, basic strategy' },
    'medium': { name: 'Medium', depth: 4, description: 'Balanced play' },
    'hard': { name: 'Hard', depth: 6, description: 'Strong strategy' },
    'expert': { name: 'Expert', depth: 8, description: 'Very challenging' }
};

const DEFAULT_DIFFICULTY = 'medium';

// ==================== ONLINE GAME CLASS ====================
class OnlineTicTacToe {
    constructor(socket, state, mySymbol, myIndex) {
        this.socket = socket;
        this.roomCode = state.roomCode;
        this.mySymbol = mySymbol;
        this.myIndex = myIndex;
        this.numPlayers = state.numPlayers;
        this.boardSize = state.boardSize;
        this.board = state.board;
        this.players = state.players;
        this.currentPlayerIndex = state.currentPlayerIndex;
        this.gameActive = state.gameActive;
        this.moveCounters = state.moveCounters;
        this.deleteCooldown = state.deleteCooldown;
        this.moveCooldown = state.moveCooldown;
        this.scores = {};
        this.currentAction = 'mark';
        this.winningCells = [];

        // Initialize scores
        this.players.forEach(p => {
            this.scores[p.symbol] = 0;
        });

        this.initializeGame();
        this.setupSocketListeners();
    }

    initializeGame() {
        this.createBoard();
        this.createScoreDisplay();

        const resetBtn = document.getElementById('reset-btn');
        const newGameBtn = document.getElementById('new-game-btn');
        const actionButtons = document.querySelectorAll('.action-btn');

        resetBtn.addEventListener('click', () => this.requestReset());
        newGameBtn.addEventListener('click', () => this.leaveGame());

        actionButtons.forEach(btn => {
            btn.addEventListener('click', (e) => {
                if (e.target.disabled || e.target.closest('.action-btn').disabled) return;
                const action = e.target.closest('.action-btn').getAttribute('data-action');
                if (this.isMyTurn() && this.isActionAvailable(action)) {
                    this.setAction(action);
                    this.updateActionButtons();
                }
            });
        });

        // Show online indicator
        document.getElementById('online-indicator').style.display = 'flex';
        document.getElementById('room-info').textContent = `Room: ${this.roomCode}`;

        // Show chat
        document.getElementById('chat-container').style.display = 'block';
        this.setupChat();

        this.updateDisplay();
        this.updateScores();
        this.updateActionButtons();
    }

    setupChat() {
        const chatInput = document.getElementById('chat-input');
        const chatSendBtn = document.getElementById('chat-send-btn');
        const chatToggle = document.getElementById('chat-toggle');
        const chatMessages = document.getElementById('chat-messages');

        const sendMessage = () => {
            const message = chatInput.value.trim();
            if (message) {
                this.socket.emit('chatMessage', {
                    roomCode: this.roomCode,
                    message
                });
                chatInput.value = '';
            }
        };

        chatSendBtn.addEventListener('click', sendMessage);
        chatInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') sendMessage();
        });

        chatToggle.addEventListener('click', () => {
            chatToggle.classList.toggle('collapsed');
            chatMessages.style.display = chatToggle.classList.contains('collapsed') ? 'none' : 'flex';
            document.querySelector('.chat-input-area').style.display = chatToggle.classList.contains('collapsed') ? 'none' : 'flex';
        });
    }

    addChatMessage(playerName, symbol, message) {
        const chatMessages = document.getElementById('chat-messages');
        const msgDiv = document.createElement('div');
        msgDiv.className = 'chat-message';
        const config = PLAYER_CONFIGS[symbol];
        msgDiv.innerHTML = `<span class="sender" style="color: ${config.color}">${playerName}:</span>${message}`;
        chatMessages.appendChild(msgDiv);
        chatMessages.scrollTop = chatMessages.scrollHeight;
    }

    setupSocketListeners() {
        this.socket.on('moveMade', (data) => {
            this.handleMoveMade(data);
        });

        this.socket.on('gameReset', (data) => {
            this.handleGameReset(data);
        });

        this.socket.on('playerLeft', (data) => {
            this.handlePlayerLeft(data);
        });

        this.socket.on('chatMessage', (data) => {
            this.addChatMessage(data.playerName, data.symbol, data.message);
        });

        this.socket.on('moveError', (data) => {
            console.error('Move error:', data.error);
        });
    }

    handleMoveMade(data) {
        const { moveData, board, state, gameOver, winner, winnerName, winningCells, draw } = data;

        this.board = board;
        this.moveCounters = state.moveCounters;
        this.currentPlayerIndex = state.currentPlayerIndex;

        // Update cell display
        if (moveData.action === 'mark' || moveData.action === 'move') {
            this.updateCellDisplay(moveData.index);
        }
        if (moveData.action === 'delete') {
            this.clearCellDisplay(moveData.index);
        }
        if (moveData.action === 'move' && moveData.sourceIndex !== undefined) {
            this.clearCellDisplay(moveData.sourceIndex);
        }

        if (gameOver) {
            this.gameActive = false;
            if (winner) {
                this.winningCells = winningCells;
                this.displayWinner(winner, winnerName);
                this.highlightWinningCells();
                this.scores[winner]++;
                this.updateScores();
            } else if (draw) {
                this.displayDraw();
            }
        } else {
            this.gameActive = true;
            this.updateDisplay();
            this.setAction('mark');
            this.updateActionButtons();
        }
    }

    handleGameReset(data) {
        this.board = data.state.board;
        this.currentPlayerIndex = data.state.currentPlayerIndex;
        this.moveCounters = data.state.moveCounters;
        this.gameActive = true;
        this.winningCells = [];

        document.querySelectorAll('.cell').forEach(cell => {
            cell.textContent = '';
            cell.style.color = '';
            cell.classList.remove('marked', 'x', 'o', 'd', 't', 's', 'disabled', 'winning');
        });

        document.getElementById('status').textContent = '';
        this.setAction('mark');
        this.updateDisplay();
        this.updateActionButtons();
    }

    handlePlayerLeft(data) {
        this.players = data.state.players;
        this.gameActive = false;

        const statusDisplay = document.getElementById('status');
        statusDisplay.textContent = `${data.playerName} left the game`;
        statusDisplay.style.color = '#dc3545';

        document.querySelectorAll('.cell').forEach(cell => {
            cell.classList.add('disabled');
        });
    }

    createBoard() {
        const boardElement = document.getElementById('board');
        boardElement.innerHTML = '';
        boardElement.style.gridTemplateColumns = `repeat(${this.boardSize}, 1fr)`;

        let fontSize = '2em';
        if (this.boardSize >= 9) fontSize = '1.2em';
        else if (this.boardSize >= 8) fontSize = '1.4em';
        else if (this.boardSize >= 7) fontSize = '1.6em';
        boardElement.style.setProperty('--cell-font-size', fontSize);

        for (let i = 0; i < this.boardSize * this.boardSize; i++) {
            const cell = document.createElement('div');
            cell.className = 'cell';
            cell.setAttribute('data-index', i);
            cell.addEventListener('click', () => this.handleCellClick(i));
            boardElement.appendChild(cell);

            // Render existing marks
            if (this.board[i]) {
                this.updateCellDisplay(i);
            }
        }
    }

    createScoreDisplay() {
        const scoreBoard = document.getElementById('score-board');
        scoreBoard.innerHTML = '';

        this.players.forEach(player => {
            const config = PLAYER_CONFIGS[player.symbol];
            const scoreItem = document.createElement('div');
            scoreItem.className = 'score-item';
            scoreItem.innerHTML = `
                <span class="score-label">${player.name}</span>
                <span class="score-value" id="score-${player.symbol}" style="color: ${config.color}">0</span>
            `;
            scoreBoard.appendChild(scoreItem);
        });
    }

    getCurrentPlayer() {
        return this.players[this.currentPlayerIndex];
    }

    isMyTurn() {
        const currentPlayer = this.getCurrentPlayer();
        return currentPlayer && currentPlayer.symbol === this.mySymbol;
    }

    handleCellClick(index) {
        if (!this.gameActive || !this.isMyTurn()) {
            return;
        }

        // Emit move to server
        this.socket.emit('makeMove', {
            roomCode: this.roomCode,
            action: this.currentAction,
            index: index
        });
    }

    setAction(action) {
        if (!this.isActionAvailable(action)) return false;

        this.currentAction = action;

        document.querySelectorAll('.action-btn').forEach(btn => {
            btn.classList.remove('active');
        });
        const actionBtn = document.getElementById(`action-${action}`);
        if (actionBtn) {
            actionBtn.classList.add('active');
        }

        return true;
    }

    isActionAvailable(action) {
        const counters = this.moveCounters[this.mySymbol];
        if (!counters) return action === 'mark';

        switch (action) {
            case 'mark': return true;
            case 'delete': return counters.movesSinceDelete >= this.deleteCooldown;
            case 'move': return counters.movesSinceMove >= this.moveCooldown;
            default: return false;
        }
    }

    updateActionButtons() {
        const actions = ['mark', 'delete', 'move'];
        const actionSelector = document.getElementById('action-selector');

        if (!this.isMyTurn() || !this.gameActive) {
            actionSelector.style.opacity = '0.5';
            actionSelector.style.pointerEvents = 'none';
        } else {
            actionSelector.style.opacity = '1';
            actionSelector.style.pointerEvents = 'auto';
        }

        actions.forEach(action => {
            const btn = document.getElementById(`action-${action}`);
            if (btn) {
                const isAvailable = this.isActionAvailable(action);
                if (isAvailable) {
                    btn.classList.remove('disabled');
                    btn.disabled = false;
                } else {
                    btn.classList.add('disabled');
                    btn.disabled = true;
                }
                this.updateButtonCooldown(btn, action);
            }
        });

        if (!this.isActionAvailable(this.currentAction)) {
            this.setAction('mark');
        }
    }

    updateButtonCooldown(btn, action) {
        const counters = this.moveCounters[this.mySymbol];
        if (!counters) return;

        if (action === 'mark') {
            btn.title = 'Mark a cell (always available)';
            return;
        }

        const cooldownIndicator = document.getElementById(`cooldown-${action}`);
        let movesRemaining = 0;

        if (action === 'delete') {
            movesRemaining = this.deleteCooldown - counters.movesSinceDelete;
        } else if (action === 'move') {
            movesRemaining = this.moveCooldown - counters.movesSinceMove;
        }

        if (movesRemaining <= 0) {
            if (cooldownIndicator) {
                cooldownIndicator.textContent = '';
                cooldownIndicator.classList.remove('visible');
            }
        } else {
            if (cooldownIndicator) {
                cooldownIndicator.textContent = movesRemaining;
                cooldownIndicator.classList.add('visible');
            }
        }
    }

    updateCellDisplay(index) {
        const cell = document.querySelector(`[data-index="${index}"]`);
        const player = this.board[index];
        if (player) {
            const config = PLAYER_CONFIGS[player];
            cell.textContent = config.symbol;
            cell.style.color = config.color;
            cell.classList.add('marked');
            PLAYER_SYMBOLS.forEach(p => {
                cell.classList.remove(p.toLowerCase());
            });
            cell.classList.add(player.toLowerCase());
        }
    }

    clearCellDisplay(index) {
        const cell = document.querySelector(`[data-index="${index}"]`);
        cell.textContent = '';
        cell.style.color = '';
        cell.classList.remove('marked', 'x', 'o', 'd', 't', 's', 'disabled', 'winning');
    }

    highlightWinningCells() {
        this.winningCells.forEach(index => {
            const cell = document.querySelector(`[data-index="${index}"]`);
            cell.classList.add('winning');
        });
    }

    displayWinner(symbol, name) {
        const statusDisplay = document.getElementById('status');
        const config = PLAYER_CONFIGS[symbol];
        statusDisplay.textContent = `${name} Wins! 🎉`;
        statusDisplay.style.color = config.color;

        document.querySelectorAll('.cell').forEach(cell => {
            cell.classList.add('disabled');
        });
    }

    displayDraw() {
        const statusDisplay = document.getElementById('status');
        statusDisplay.textContent = "It's a Draw! 🤝";
        statusDisplay.style.color = '#ffc107';
    }

    updateDisplay() {
        const currentPlayerDisplay = document.getElementById('current-player');
        const yourTurnIndicator = document.getElementById('your-turn-indicator');
        const currentPlayer = this.getCurrentPlayer();

        if (currentPlayer) {
            const config = PLAYER_CONFIGS[currentPlayer.symbol];
            currentPlayerDisplay.textContent = currentPlayer.name;
            currentPlayerDisplay.style.color = config.color;

            if (this.isMyTurn() && this.gameActive) {
                yourTurnIndicator.style.display = 'inline';
            } else {
                yourTurnIndicator.style.display = 'none';
            }
        }
    }

    updateScores() {
        this.players.forEach(player => {
            const scoreElement = document.getElementById(`score-${player.symbol}`);
            if (scoreElement) {
                scoreElement.textContent = this.scores[player.symbol] || 0;
            }
        });
    }

    requestReset() {
        this.socket.emit('resetGame', { roomCode: this.roomCode });
    }

    leaveGame() {
        this.socket.disconnect();
        location.reload();
    }
}

// ==================== LOCAL GAME CLASS ====================
class TicTacToe {
    constructor(numPlayers, vsComputer = false, playerConfig = null, difficultyLevels = null) {
        this.numPlayers = numPlayers;
        this.vsComputer = vsComputer;
        this.boardSize = 4 + numPlayers;
        this.winLength = 4;
        this.board = Array(this.boardSize * this.boardSize).fill('');

        this.players = PLAYER_SYMBOLS.slice(0, numPlayers);
        this.currentPlayerIndex = 0;
        this.currentPlayer = this.players[0];

        // Player configuration: array of booleans, true = human, false = computer
        // If playerConfig is null, use legacy mode (vsComputer flag)
        if (playerConfig === null) {
            if (this.vsComputer) {
                this.playerConfig = [true, false]; // First is human, second is computer
            } else {
                this.playerConfig = Array(numPlayers).fill(true); // All human
            }
        } else {
            this.playerConfig = playerConfig;
        }

        // Difficulty levels: array of difficulty strings (or null for human players)
        // If difficultyLevels is null, use default difficulty for computer players
        if (difficultyLevels === null) {
            this.difficultyLevels = this.players.map((symbol, index) =>
                !this.playerConfig[index] ? DEFAULT_DIFFICULTY : null
            );
        } else {
            this.difficultyLevels = difficultyLevels;
        }

        // Store which players are computer
        this.computerPlayers = [];
        this.humanPlayers = [];
        this.players.forEach((symbol, index) => {
            if (!this.playerConfig[index]) {
                this.computerPlayers.push(symbol);
            } else {
                this.humanPlayers.push(symbol);
            }
        });

        this.gameActive = true;
        this.winningCells = [];
        this.currentAction = 'mark';
        this.isComputerTurn = false;

        this.scores = {};
        this.players.forEach(player => {
            this.scores[player] = 0;
        });

        this.deleteCooldown = 5;
        this.moveCooldown = 3;

        this.moveCounters = {};
        this.players.forEach(player => {
            this.moveCounters[player] = {
                movesSinceDelete: this.deleteCooldown,
                movesSinceMove: this.moveCooldown
            };
        });

        this.initializeGame();
    }

    initializeGame() {
        this.createBoard();
        this.createScoreDisplay();

        const resetBtn = document.getElementById('reset-btn');
        const newGameBtn = document.getElementById('new-game-btn');
        const actionButtons = document.querySelectorAll('.action-btn');

        resetBtn.addEventListener('click', () => this.resetGame());
        newGameBtn.addEventListener('click', () => location.reload());

        actionButtons.forEach(btn => {
            btn.addEventListener('click', (e) => {
                if (e.target.disabled || e.target.closest('.action-btn').disabled) return;
                const action = e.target.closest('.action-btn').getAttribute('data-action');
                if (this.isActionAvailable(action)) {
                    this.setAction(action);
                    this.updateActionButtons();
                }
            });
        });

        // Hide online elements
        document.getElementById('online-indicator').style.display = 'none';
        document.getElementById('chat-container').style.display = 'none';
        document.getElementById('your-turn-indicator').style.display = 'none';

        this.updateDisplay();
        this.updateScores();
        this.updateActionButtons();
    }

    createBoard() {
        const boardElement = document.getElementById('board');
        boardElement.innerHTML = '';
        boardElement.style.gridTemplateColumns = `repeat(${this.boardSize}, 1fr)`;

        let fontSize = '2em';
        if (this.boardSize >= 9) fontSize = '1.2em';
        else if (this.boardSize >= 8) fontSize = '1.4em';
        else if (this.boardSize >= 7) fontSize = '1.6em';
        boardElement.style.setProperty('--cell-font-size', fontSize);

        for (let i = 0; i < this.boardSize * this.boardSize; i++) {
            const cell = document.createElement('div');
            cell.className = 'cell';
            cell.setAttribute('data-index', i);
            cell.addEventListener('click', () => this.handleCellClick(i));
            boardElement.appendChild(cell);
        }
    }

    createScoreDisplay() {
        const scoreBoard = document.getElementById('score-board');
        scoreBoard.innerHTML = '';

        this.players.forEach((player, index) => {
            const config = PLAYER_CONFIGS[player];
            const isComputer = !this.playerConfig[index];
            const difficulty = isComputer ? this.difficultyLevels[index] : null;
            const difficultyInfo = difficulty ? ` (${DIFFICULTY_LEVELS[difficulty].name})` : '';

            const scoreItem = document.createElement('div');
            scoreItem.className = 'score-item';
            scoreItem.innerHTML = `
                <span class="score-label">${config.name}${difficultyInfo}:</span>
                <span class="score-value" id="score-${player}">0</span>
            `;
            const scoreValue = scoreItem.querySelector(`#score-${player}`);
            scoreValue.style.color = config.color;
            scoreBoard.appendChild(scoreItem);
        });
    }

    handleCellClick(index) {
        if (!this.gameActive || this.isComputerTurn || this.isComputerPlayer(this.currentPlayer)) {
            return;
        }

        let actionPerformed = false;

        switch (this.currentAction) {
            case 'mark':
                actionPerformed = this.handleMark(index);
                break;
            case 'delete':
                actionPerformed = this.handleDelete(index);
                break;
            case 'move':
                actionPerformed = this.handleMove(index);
                break;
        }

        if (actionPerformed) {
            this.updateMoveCounters(this.currentAction);

            if (this.checkWin()) {
                this.gameActive = false;
                this.displayWinner();
                this.highlightWinningCells();
            } else if (this.checkDraw()) {
                this.gameActive = false;
                this.displayDraw();
            } else {
                this.nextPlayer();
                this.updateDisplay();
                this.setAction('mark');
                this.updateActionButtons();

                // Check if current player is a computer player
                if (this.isComputerPlayer(this.currentPlayer) && this.gameActive) {
                    this.isComputerTurn = true;
                    this.makeComputerMove();
                }
            }
        }
    }

    nextPlayer() {
        this.currentPlayerIndex = (this.currentPlayerIndex + 1) % this.numPlayers;
        this.currentPlayer = this.players[this.currentPlayerIndex];
    }

    handleMark(index) {
        if (this.board[index] !== '') return false;
        this.board[index] = this.currentPlayer;
        this.updateCellDisplay(index);
        return true;
    }

    handleDelete(index) {
        if (this.board[index] === '' || this.board[index] === this.currentPlayer) return false;
        this.board[index] = '';
        this.clearCellDisplay(index);
        return true;
    }

    handleMove(index) {
        if (this.board[index] !== '') return false;
        const adjacentIndex = this.findAdjacentOwnCell(index);
        if (adjacentIndex === -1) return false;
        this.board[index] = this.currentPlayer;
        this.board[adjacentIndex] = '';
        this.updateCellDisplay(index);
        this.clearCellDisplay(adjacentIndex);
        return true;
    }

    findAdjacentOwnCell(index) {
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
                if (this.board[adjacentIndex] === this.currentPlayer) {
                    return adjacentIndex;
                }
            }
        }

        return -1;
    }

    setAction(action) {
        if (!this.isActionAvailable(action)) return false;

        this.currentAction = action;

        document.querySelectorAll('.action-btn').forEach(btn => {
            btn.classList.remove('active');
        });
        const actionBtn = document.getElementById(`action-${action}`);
        if (actionBtn) {
            actionBtn.classList.add('active');
        }

        const statusDisplay = document.getElementById('status');
        if (!statusDisplay.textContent.includes('Wins') && !statusDisplay.textContent.includes('Draw')) {
            statusDisplay.textContent = '';
        }

        return true;
    }

    isActionAvailable(action) {
        const player = this.currentPlayer;
        const counters = this.moveCounters[player];

        switch (action) {
            case 'mark': return true;
            case 'delete': return counters.movesSinceDelete >= this.deleteCooldown;
            case 'move': return counters.movesSinceMove >= this.moveCooldown;
            default: return false;
        }
    }

    updateMoveCounters(action) {
        const player = this.currentPlayer;
        const counters = this.moveCounters[player];

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

    isComputerPlayer(symbol) {
        const index = this.players.indexOf(symbol);
        return index !== -1 && !this.playerConfig[index];
    }

    updateActionButtons() {
        const actions = ['mark', 'delete', 'move'];
        const actionSelector = document.getElementById('action-selector');

        if (this.isComputerTurn || this.isComputerPlayer(this.currentPlayer)) {
            if (actionSelector) actionSelector.style.display = 'none';
            return;
        }
        if (actionSelector) actionSelector.style.display = 'block';

        actions.forEach(action => {
            const btn = document.getElementById(`action-${action}`);
            if (btn) {
                const isAvailable = this.isActionAvailable(action);
                if (isAvailable) {
                    btn.classList.remove('disabled');
                    btn.disabled = false;
                    this.updateButtonCooldown(btn, action);
                } else {
                    btn.classList.add('disabled');
                    btn.disabled = true;
                    this.updateButtonCooldown(btn, action);
                }
            }
        });

        if (!this.isActionAvailable(this.currentAction)) {
            this.setAction('mark');
        }
    }

    updateButtonCooldown(btn, action) {
        const player = this.currentPlayer;
        const counters = this.moveCounters[player];

        if (action === 'mark') {
            btn.title = 'Mark a cell (always available)';
            return;
        }

        const cooldownIndicator = document.getElementById(`cooldown-${action}`);
        let movesRemaining = 0;

        if (action === 'delete') {
            movesRemaining = this.deleteCooldown - counters.movesSinceDelete;
            if (movesRemaining <= 0) {
                btn.title = 'Delete opponent\'s cell (available)';
                if (cooldownIndicator) {
                    cooldownIndicator.textContent = '';
                    cooldownIndicator.classList.remove('visible');
                }
            } else {
                btn.title = `Delete opponent's cell (available in ${movesRemaining} move${movesRemaining !== 1 ? 's' : ''})`;
                if (cooldownIndicator) {
                    cooldownIndicator.textContent = movesRemaining;
                    cooldownIndicator.classList.add('visible');
                }
            }
        } else if (action === 'move') {
            movesRemaining = this.moveCooldown - counters.movesSinceMove;
            if (movesRemaining <= 0) {
                btn.title = 'Move your adjacent cell (available)';
                if (cooldownIndicator) {
                    cooldownIndicator.textContent = '';
                    cooldownIndicator.classList.remove('visible');
                }
            } else {
                btn.title = `Move your adjacent cell (available in ${movesRemaining} move${movesRemaining !== 1 ? 's' : ''})`;
                if (cooldownIndicator) {
                    cooldownIndicator.textContent = movesRemaining;
                    cooldownIndicator.classList.add('visible');
                }
            }
        }
    }

    updateCellDisplay(index) {
        const cell = document.querySelector(`[data-index="${index}"]`);
        const player = this.board[index];
        if (player) {
            const config = PLAYER_CONFIGS[player];
            cell.textContent = config.symbol;
            cell.style.color = config.color;
            cell.classList.add('marked');
            this.players.forEach(p => {
                const pLower = p.toLowerCase();
                cell.classList.remove('x', 'o', 'd', 't', 's', pLower);
            });
            cell.classList.add(player.toLowerCase());
        }
    }

    clearCellDisplay(index) {
        const cell = document.querySelector(`[data-index="${index}"]`);
        cell.textContent = '';
        cell.style.color = '';
        cell.classList.remove('marked', 'x', 'o', 'c', 't', 's', 'disabled', 'winning');
    }

    checkWin() {
        const size = this.boardSize;
        const winLength = this.winLength;
        const player = this.currentPlayer;

        for (let row = 0; row < size; row++) {
            for (let col = 0; col <= size - winLength; col++) {
                const indices = [];
                let count = 0;
                for (let i = 0; i < winLength; i++) {
                    const idx = row * size + col + i;
                    indices.push(idx);
                    if (this.board[idx] === player) count++;
                }
                if (count === winLength) {
                    this.winningCells = indices;
                    return true;
                }
            }
        }

        for (let col = 0; col < size; col++) {
            for (let row = 0; row <= size - winLength; row++) {
                const indices = [];
                let count = 0;
                for (let i = 0; i < winLength; i++) {
                    const idx = (row + i) * size + col;
                    indices.push(idx);
                    if (this.board[idx] === player) count++;
                }
                if (count === winLength) {
                    this.winningCells = indices;
                    return true;
                }
            }
        }

        for (let row = 0; row <= size - winLength; row++) {
            for (let col = 0; col <= size - winLength; col++) {
                const indices = [];
                let count = 0;
                for (let i = 0; i < winLength; i++) {
                    const idx = (row + i) * size + (col + i);
                    indices.push(idx);
                    if (this.board[idx] === player) count++;
                }
                if (count === winLength) {
                    this.winningCells = indices;
                    return true;
                }
            }
        }

        for (let row = 0; row <= size - winLength; row++) {
            for (let col = winLength - 1; col < size; col++) {
                const indices = [];
                let count = 0;
                for (let i = 0; i < winLength; i++) {
                    const idx = (row + i) * size + (col - i);
                    indices.push(idx);
                    if (this.board[idx] === player) count++;
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
        return this.board.every(cell => cell !== '') && !this.checkWin();
    }

    highlightWinningCells() {
        this.winningCells.forEach(index => {
            const cell = document.querySelector(`[data-index="${index}"]`);
            cell.classList.add('winning');
        });
    }

    displayWinner() {
        const statusDisplay = document.getElementById('status');
        const config = PLAYER_CONFIGS[this.currentPlayer];
        statusDisplay.textContent = `Player ${config.name} Wins! 🎉`;
        statusDisplay.style.color = config.color;

        this.scores[this.currentPlayer]++;
        this.updateScores();

        document.querySelectorAll('.cell').forEach(cell => {
            cell.classList.add('disabled');
        });
    }

    displayDraw() {
        const statusDisplay = document.getElementById('status');
        statusDisplay.textContent = "It's a Draw! 🤝";
        statusDisplay.style.color = '#ffc107';
    }

    updateDisplay() {
        const currentPlayerDisplay = document.getElementById('current-player');
        const config = PLAYER_CONFIGS[this.currentPlayer];
        currentPlayerDisplay.textContent = config.name;
        currentPlayerDisplay.style.color = config.color;
    }

    updateScores() {
        this.players.forEach(player => {
            const scoreElement = document.getElementById(`score-${player}`);
            if (scoreElement) {
                scoreElement.textContent = this.scores[player];
            }
        });
    }

    // AI Methods - Updated to handle multiple opponents
    minimax(board, depth, alpha, beta, isMaximizing, player, opponents, moveCounters, maxDepth) {
        const winner = this.checkWinner(board, player);
        const opponentWinners = opponents.map(opp => this.checkWinner(board, opp)).filter(w => w !== null);

        if (winner === player) return 1000 - depth;
        if (opponentWinners.length > 0) return -1000 + depth;
        if (this.isBoardFull(board)) return 0;

        if (depth >= maxDepth) {
            return this.evaluateBoardMultiplayer(board, player, opponents);
        }

        if (isMaximizing) {
            let maxEval = -Infinity;
            const moves = this.getPossibleMovesMultiplayer(board, player, opponents, moveCounters, true);

            for (const move of moves) {
                const newBoard = [...board];
                const newCounters = JSON.parse(JSON.stringify(moveCounters));
                this.applyMove(newBoard, move, player, newCounters);
                const evalScore = this.minimax(newBoard, depth + 1, alpha, beta, false, player, opponents, newCounters, maxDepth);
                maxEval = Math.max(maxEval, evalScore);
                alpha = Math.max(alpha, evalScore);
                if (beta <= alpha) break;
            }
            return maxEval;
        } else {
            let minEval = Infinity;
            // For minimizing, evaluate against the most threatening opponent
            // Find the opponent with the best position
            let bestOpponent = opponents[0];
            let bestOpponentScore = -Infinity;

            for (const opponent of opponents) {
                const score = this.evaluateBoardMultiplayer(board, opponent, [player, ...opponents.filter(o => o !== opponent)]);
                if (score > bestOpponentScore) {
                    bestOpponentScore = score;
                    bestOpponent = opponent;
                }
            }

            // Evaluate moves for the most threatening opponent
            const moves = this.getPossibleMovesMultiplayer(board, bestOpponent, [player, ...opponents.filter(o => o !== bestOpponent)], moveCounters, false);

            for (const move of moves) {
                const newBoard = [...board];
                const newCounters = JSON.parse(JSON.stringify(moveCounters));
                this.applyMove(newBoard, move, bestOpponent, newCounters);
                const evalScore = this.minimax(newBoard, depth + 1, alpha, beta, true, player, opponents, newCounters, maxDepth);
                minEval = Math.min(minEval, evalScore);
                beta = Math.min(beta, evalScore);
                if (beta <= alpha) break;
            }
            return minEval;
        }
    }

    evaluateBoardMultiplayer(board, player, opponents) {
        let score = 0;
        const size = this.boardSize;
        const winLength = this.winLength;

        const evaluateLine = (cells) => {
            let playerCount = 0;
            let opponentCounts = {};
            opponents.forEach(opp => opponentCounts[opp] = 0);

            for (const cell of cells) {
                if (cell === player) playerCount++;
                else if (opponents.includes(cell)) opponentCounts[cell]++;
            }

            // Positive score for player's line
            if (playerCount > 0 && opponents.every(opp => opponentCounts[opp] === 0)) {
                score += Math.pow(10, playerCount);
            }

            // Negative score for opponent lines
            opponents.forEach(opp => {
                if (opponentCounts[opp] > 0 && playerCount === 0) {
                    score -= Math.pow(10, opponentCounts[opp]);
                }
            });
        };

        // Check all lines (rows, columns, diagonals)
        for (let row = 0; row < size; row++) {
            for (let col = 0; col <= size - winLength; col++) {
                const cells = [];
                for (let i = 0; i < winLength; i++) {
                    cells.push(board[row * size + col + i]);
                }
                evaluateLine(cells);
            }
        }

        for (let col = 0; col < size; col++) {
            for (let row = 0; row <= size - winLength; row++) {
                const cells = [];
                for (let i = 0; i < winLength; i++) {
                    cells.push(board[(row + i) * size + col]);
                }
                evaluateLine(cells);
            }
        }

        for (let row = 0; row <= size - winLength; row++) {
            for (let col = 0; col <= size - winLength; col++) {
                const cells = [];
                for (let i = 0; i < winLength; i++) {
                    cells.push(board[(row + i) * size + (col + i)]);
                }
                evaluateLine(cells);
            }
        }

        for (let row = 0; row <= size - winLength; row++) {
            for (let col = winLength - 1; col < size; col++) {
                const cells = [];
                for (let i = 0; i < winLength; i++) {
                    cells.push(board[(row + i) * size + (col - i)]);
                }
                evaluateLine(cells);
            }
        }

        return score;
    }

    getPossibleMovesMultiplayer(board, player, opponents, moveCounters, isMaximizing) {
        const moves = [];
        const size = this.boardSize;
        const counters = moveCounters[player];

        // Mark moves
        for (let i = 0; i < board.length; i++) {
            if (board[i] === '') {
                moves.push({ action: 'mark', index: i });
            }
        }

        // Delete moves (can delete any opponent's cell)
        if (counters.movesSinceDelete >= this.deleteCooldown) {
            for (let i = 0; i < board.length; i++) {
                if (opponents.includes(board[i])) {
                    moves.push({ action: 'delete', index: i });
                }
            }
        }

        // Move moves
        if (counters.movesSinceMove >= this.moveCooldown) {
            for (let i = 0; i < board.length; i++) {
                if (board[i] === '') {
                    const row = Math.floor(i / size);
                    const col = i % size;
                    const directions = [[-1, -1], [-1, 0], [-1, 1], [0, -1], [0, 1], [1, -1], [1, 0], [1, 1]];

                    for (const [dr, dc] of directions) {
                        const newRow = row + dr;
                        const newCol = col + dc;
                        if (newRow >= 0 && newRow < size && newCol >= 0 && newCol < size) {
                            const adjIndex = newRow * size + newCol;
                            if (board[adjIndex] === player) {
                                moves.push({ action: 'move', index: i, sourceIndex: adjIndex });
                                break;
                            }
                        }
                    }
                }
            }
        }

        return moves;
    }

    checkWinner(board, player) {
        const size = this.boardSize;
        const winLength = this.winLength;

        for (let row = 0; row < size; row++) {
            for (let col = 0; col <= size - winLength; col++) {
                let count = 0;
                for (let i = 0; i < winLength; i++) {
                    if (board[row * size + col + i] === player) count++;
                }
                if (count === winLength) return player;
            }
        }

        for (let col = 0; col < size; col++) {
            for (let row = 0; row <= size - winLength; row++) {
                let count = 0;
                for (let i = 0; i < winLength; i++) {
                    if (board[(row + i) * size + col] === player) count++;
                }
                if (count === winLength) return player;
            }
        }

        for (let row = 0; row <= size - winLength; row++) {
            for (let col = 0; col <= size - winLength; col++) {
                let count = 0;
                for (let i = 0; i < winLength; i++) {
                    if (board[(row + i) * size + (col + i)] === player) count++;
                }
                if (count === winLength) return player;
            }
        }

        for (let row = 0; row <= size - winLength; row++) {
            for (let col = winLength - 1; col < size; col++) {
                let count = 0;
                for (let i = 0; i < winLength; i++) {
                    if (board[(row + i) * size + (col - i)] === player) count++;
                }
                if (count === winLength) return player;
            }
        }

        return null;
    }

    isBoardFull(board) {
        return board.every(cell => cell !== '');
    }

    evaluateBoard(board, player, opponent) {
        // Legacy method for backward compatibility
        return this.evaluateBoardMultiplayer(board, player, [opponent]);
    }

    getPossibleMoves(board, player, opponent, moveCounters, isMaximizing) {
        // Legacy method for backward compatibility
        return this.getPossibleMovesMultiplayer(board, player, [opponent], moveCounters, isMaximizing);
    }

    applyMove(board, move, player, moveCounters) {
        const counters = moveCounters[player];

        if (move.action === 'mark') {
            board[move.index] = player;
            counters.movesSinceDelete++;
            counters.movesSinceMove++;
        } else if (move.action === 'delete') {
            board[move.index] = '';
            counters.movesSinceDelete = 0;
            counters.movesSinceMove++;
        } else if (move.action === 'move') {
            board[move.index] = player;
            board[move.sourceIndex] = '';
            counters.movesSinceMove = 0;
            counters.movesSinceDelete++;
        }
    }

    makeComputerMove() {
        if (!this.isComputerTurn || !this.gameActive) return;

        const thinkingIndicator = document.getElementById('computer-thinking');
        const actionSelector = document.getElementById('action-selector');
        if (thinkingIndicator) thinkingIndicator.style.display = 'inline';
        if (actionSelector) actionSelector.style.opacity = '0.5';

        setTimeout(() => {
            const board = [...this.board];
            const moveCounters = JSON.parse(JSON.stringify(this.moveCounters));

            // Get all opponents (human players and other computer players)
            const opponents = this.players.filter(symbol => symbol !== this.currentPlayer);
            const moves = this.getPossibleMovesMultiplayer(board, this.currentPlayer, opponents, moveCounters, true);

            if (moves.length === 0) {
                if (thinkingIndicator) thinkingIndicator.style.display = 'none';
                if (actionSelector) actionSelector.style.opacity = '1';
                return;
            }

            let bestMove = null;
            let bestScore = -Infinity;

            // Get difficulty level for current computer player
            const playerIndex = this.players.indexOf(this.currentPlayer);
            const difficulty = this.difficultyLevels[playerIndex] || DEFAULT_DIFFICULTY;
            const maxDepth = DIFFICULTY_LEVELS[difficulty].depth;

            for (const move of moves) {
                const newBoard = [...board];
                const newCounters = JSON.parse(JSON.stringify(moveCounters));
                this.applyMove(newBoard, move, this.currentPlayer, newCounters);

                const score = this.minimax(newBoard, 0, -Infinity, Infinity, false,
                    this.currentPlayer, opponents, newCounters, maxDepth);

                if (score > bestScore) {
                    bestScore = score;
                    bestMove = move;
                }
            }

            if (bestMove) {
                this.currentAction = bestMove.action;
                this.executeComputerMove(bestMove);
            }

            if (thinkingIndicator) thinkingIndicator.style.display = 'none';
            if (actionSelector) actionSelector.style.opacity = '1';
        }, 500);
    }

    executeComputerMove(move) {
        let actionPerformed = false;

        if (move.action === 'mark') {
            actionPerformed = this.handleMark(move.index);
        } else if (move.action === 'delete') {
            actionPerformed = this.handleDelete(move.index);
        } else if (move.action === 'move') {
            const adjacentIndex = this.findAdjacentOwnCell(move.index);
            if (adjacentIndex !== -1) {
                this.board[move.index] = this.currentPlayer;
                this.board[adjacentIndex] = '';
                this.updateCellDisplay(move.index);
                this.clearCellDisplay(adjacentIndex);
                actionPerformed = true;
            }
        }

        if (actionPerformed) {
            this.updateMoveCounters(move.action);
            this.isComputerTurn = false;

            if (this.checkWin()) {
                this.gameActive = false;
                this.displayWinner();
                this.highlightWinningCells();
            } else if (this.checkDraw()) {
                this.gameActive = false;
                this.displayDraw();
            } else {
                this.nextPlayer();
                this.updateDisplay();
                this.setAction('mark');
                this.updateActionButtons();

                // If next player is also a computer, trigger their move
                if (this.isComputerPlayer(this.currentPlayer) && this.gameActive) {
                    this.isComputerTurn = true;
                    setTimeout(() => this.makeComputerMove(), 300);
                }
            }
        }
    }

    resetGame() {
        this.board = Array(this.boardSize * this.boardSize).fill('');
        this.currentPlayerIndex = 0;
        this.currentPlayer = this.players[0];
        this.gameActive = true;
        this.winningCells = [];
        this.isComputerTurn = false;

        this.players.forEach(player => {
            this.moveCounters[player] = {
                movesSinceDelete: this.deleteCooldown,
                movesSinceMove: this.moveCooldown
            };
        });

        this.setAction('mark');

        document.querySelectorAll('.cell').forEach(cell => {
            cell.textContent = '';
            cell.style.color = '';
            cell.classList.remove('marked', 'x', 'o', 'd', 't', 's', 'disabled', 'winning');
        });

        document.getElementById('status').textContent = '';
        const thinkingIndicator = document.getElementById('computer-thinking');
        if (thinkingIndicator) thinkingIndicator.style.display = 'none';

        this.updateDisplay();
        this.updateActionButtons();

        if (this.isComputerPlayer(this.currentPlayer) && this.gameActive) {
            this.isComputerTurn = true;
            this.makeComputerMove();
        }
    }
}

// ==================== MAIN APP LOGIC ====================
let game = null;
let socket = null;
let selectedPlayerCount = 2;

document.addEventListener('DOMContentLoaded', () => {
    // Get DOM elements
    const mainMenuModal = document.getElementById('main-menu-modal');
    const onlineLobbyModal = document.getElementById('online-lobby-modal');
    const waitingRoomModal = document.getElementById('waiting-room-modal');
    const gameModeModal = document.getElementById('game-mode-modal');
    const playerSelectionModal = document.getElementById('player-selection-modal');
    const gameContainer = document.getElementById('game-container');

    // Main menu buttons
    const btnOnline = document.getElementById('btn-online');
    const btnLocal = document.getElementById('btn-local');

    // Lobby elements
    const lobbyBackBtn = document.getElementById('lobby-back-btn');
    const playerNameInput = document.getElementById('player-name');
    const countBtns = document.querySelectorAll('.count-btn');
    const btnCreateRoom = document.getElementById('btn-create-room');
    const roomCodeInput = document.getElementById('room-code-input');
    const btnJoinRoom = document.getElementById('btn-join-room');
    const lobbyError = document.getElementById('lobby-error');

    // Waiting room elements
    const displayRoomCode = document.getElementById('display-room-code');
    const copyCodeBtn = document.getElementById('copy-code-btn');
    const playersList = document.getElementById('players-list');
    const playersWaitingText = document.getElementById('players-waiting-text');
    const btnStartGame = document.getElementById('btn-start-game');
    const btnLeaveRoom = document.getElementById('btn-leave-room');

    // Local game elements
    const modeBackBtn = document.getElementById('mode-back-btn');
    const playersBackBtn = document.getElementById('players-back-btn');
    const configBackBtn = document.getElementById('config-back-btn');
    const modeOptionButtons = document.querySelectorAll('.mode-option-btn');
    const playerOptionButtons = document.querySelectorAll('.player-option-btn');
    const playerConfigModal = document.getElementById('player-config-modal');
    const playerConfigList = document.getElementById('player-config-list');
    const btnStartConfigGame = document.getElementById('btn-start-config-game');

    // Helper functions
    function hideAllModals() {
        mainMenuModal.style.display = 'none';
        onlineLobbyModal.style.display = 'none';
        waitingRoomModal.style.display = 'none';
        gameModeModal.style.display = 'none';
        playerSelectionModal.style.display = 'none';
        playerConfigModal.style.display = 'none';
    }

    function showError(message) {
        lobbyError.textContent = message;
        setTimeout(() => {
            lobbyError.textContent = '';
        }, 5000);
    }

    // Main menu handlers
    btnOnline.addEventListener('click', () => {
        hideAllModals();
        onlineLobbyModal.style.display = 'flex';

        // Initialize socket connection
        if (!socket) {
            socket = io();
            setupSocketListeners();
        }
    });

    btnLocal.addEventListener('click', () => {
        hideAllModals();
        gameModeModal.style.display = 'flex';
    });

    // Lobby handlers
    lobbyBackBtn.addEventListener('click', () => {
        hideAllModals();
        mainMenuModal.style.display = 'flex';
    });

    countBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            countBtns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            selectedPlayerCount = parseInt(btn.getAttribute('data-count'));
        });
    });

    btnCreateRoom.addEventListener('click', () => {
        const playerName = playerNameInput.value.trim();
        if (!playerName) {
            showError('Please enter your name');
            return;
        }

        socket.emit('createRoom', {
            playerName,
            numPlayers: selectedPlayerCount
        });
    });

    btnJoinRoom.addEventListener('click', () => {
        const playerName = playerNameInput.value.trim();
        const roomCode = roomCodeInput.value.trim().toUpperCase();

        if (!playerName) {
            showError('Please enter your name');
            return;
        }
        if (!roomCode) {
            showError('Please enter a room code');
            return;
        }

        socket.emit('joinRoom', {
            playerName,
            roomCode
        });
    });

    // Waiting room handlers
    copyCodeBtn.addEventListener('click', () => {
        navigator.clipboard.writeText(displayRoomCode.textContent);
        copyCodeBtn.textContent = '✓';
        setTimeout(() => {
            copyCodeBtn.textContent = '📋';
        }, 2000);
    });

    btnStartGame.addEventListener('click', () => {
        const roomCode = displayRoomCode.textContent;
        socket.emit('startGame', { roomCode });
    });

    btnLeaveRoom.addEventListener('click', () => {
        socket.disconnect();
        socket = null;
        hideAllModals();
        mainMenuModal.style.display = 'flex';
    });

    // Local game handlers
    modeBackBtn.addEventListener('click', () => {
        hideAllModals();
        mainMenuModal.style.display = 'flex';
    });

    playersBackBtn.addEventListener('click', () => {
        hideAllModals();
        gameModeModal.style.display = 'flex';
    });

    const computerDifficultySection = document.getElementById('computer-difficulty-section');
    const vsComputerDifficultySelect = document.getElementById('vs-computer-difficulty');

    // Start vs computer game button
    const vsComputerStartBtn = document.createElement('button');
    vsComputerStartBtn.className = 'menu-btn primary';
    vsComputerStartBtn.textContent = 'Start Game';
    vsComputerStartBtn.style.marginTop = '20px';
    vsComputerStartBtn.style.display = 'none';
    vsComputerStartBtn.addEventListener('click', () => {
        const difficulty = vsComputerDifficultySelect.value;
        hideAllModals();
        gameContainer.style.display = 'block';
        game = new TicTacToe(2, true, null, [null, difficulty]);
    });

    // Add start button to modal
    const gameModeModalContent = document.getElementById('game-mode-modal').querySelector('.modal-content');
    gameModeModalContent.appendChild(vsComputerStartBtn);

    modeOptionButtons.forEach(btn => {
        btn.addEventListener('click', (e) => {
            const mode = e.target.getAttribute('data-mode');
            if (mode === 'computer') {
                // Show difficulty selector and start button for vs computer mode
                computerDifficultySection.style.display = 'block';
                vsComputerStartBtn.style.display = 'block';
            } else {
                computerDifficultySection.style.display = 'none';
                vsComputerStartBtn.style.display = 'none';
                hideAllModals();
                playerSelectionModal.style.display = 'flex';
            }
        });
    });

    playerOptionButtons.forEach(btn => {
        btn.addEventListener('click', (e) => {
            const numPlayers = parseInt(e.target.getAttribute('data-players'));
            showPlayerConfigModal(numPlayers);
        });
    });

    configBackBtn.addEventListener('click', () => {
        hideAllModals();
        playerSelectionModal.style.display = 'flex';
    });

    btnStartConfigGame.addEventListener('click', () => {
        const playerConfig = [];
        const difficultyLevels = [];
        const configItems = playerConfigList.querySelectorAll('.player-config-item');
        configItems.forEach(item => {
            const isHuman = item.querySelector('.player-type-toggle').classList.contains('human');
            playerConfig.push(isHuman);

            if (!isHuman) {
                const difficultySelect = item.querySelector('.difficulty-select');
                const difficulty = difficultySelect ? difficultySelect.value : DEFAULT_DIFFICULTY;
                difficultyLevels.push(difficulty);
            } else {
                difficultyLevels.push(null);
            }
        });

        const numPlayers = playerConfig.length;
        hideAllModals();
        gameContainer.style.display = 'block';
        game = new TicTacToe(numPlayers, false, playerConfig, difficultyLevels);
    });

    function showPlayerConfigModal(numPlayers) {
        hideAllModals();
        playerConfigModal.style.display = 'flex';
        playerConfigList.innerHTML = '';

        for (let i = 0; i < numPlayers; i++) {
            const symbol = PLAYER_SYMBOLS[i];
            const config = PLAYER_CONFIGS[symbol];
            const configItem = document.createElement('div');
            configItem.className = 'player-config-item';

            // Default: first player is human, rest can be configured
            const isHuman = i === 0;

            // Create difficulty selector HTML (only shown for computer players)
            const difficultyOptions = Object.keys(DIFFICULTY_LEVELS).map(key =>
                `<option value="${key}">${DIFFICULTY_LEVELS[key].name}</option>`
            ).join('');

            configItem.innerHTML = `
                <div class="player-config-symbol" style="color: ${config.color}">
                    ${config.symbol}
                </div>
                <div class="player-config-info">
                    <span class="player-config-name">${config.name}</span>
                </div>
                <div class="player-config-controls">
                    <div class="player-type-toggle ${isHuman ? 'human' : 'computer'}" data-index="${i}">
                        <span class="toggle-label">${isHuman ? 'Human' : 'Computer'}</span>
                    </div>
                    <select class="difficulty-select" ${isHuman ? 'style="display: none;"' : ''}>
                        ${difficultyOptions}
                    </select>
                </div>
            `;

            const toggle = configItem.querySelector('.player-type-toggle');
            const difficultySelect = configItem.querySelector('.difficulty-select');

            // Set default difficulty
            if (!isHuman) {
                difficultySelect.value = DEFAULT_DIFFICULTY;
            }

            toggle.addEventListener('click', () => {
                const wasHuman = toggle.classList.contains('human');
                toggle.classList.toggle('human');
                toggle.classList.toggle('computer');
                const isNowHuman = toggle.classList.contains('human');
                toggle.querySelector('.toggle-label').textContent =
                    isNowHuman ? 'Human' : 'Computer';

                // Show/hide difficulty selector
                if (isNowHuman) {
                    difficultySelect.style.display = 'none';
                } else {
                    difficultySelect.style.display = 'block';
                    if (wasHuman) {
                        difficultySelect.value = DEFAULT_DIFFICULTY;
                    }
                }
            });

            playerConfigList.appendChild(configItem);
        }
    }

    // Socket event listeners
    function setupSocketListeners() {
        socket.on('roomCreated', (data) => {
            hideAllModals();
            waitingRoomModal.style.display = 'flex';
            displayRoomCode.textContent = data.roomCode;
            btnStartGame.style.display = 'block';
            updateWaitingRoom(data.state, data.yourSymbol);
        });

        socket.on('roomJoined', (data) => {
            hideAllModals();
            waitingRoomModal.style.display = 'flex';
            displayRoomCode.textContent = data.roomCode;
            btnStartGame.style.display = 'none';
            updateWaitingRoom(data.state, data.yourSymbol);
        });

        socket.on('playerJoined', (data) => {
            updateWaitingRoom(data.state);
        });

        socket.on('joinError', (data) => {
            showError(data.error);
        });

        socket.on('gameError', (data) => {
            showError(data.error);
        });

        socket.on('gameStarted', (data) => {
            hideAllModals();
            gameContainer.style.display = 'block';

            // Find my symbol
            const myData = data.state.players.find(p => p.socketId === socket.id);
            game = new OnlineTicTacToe(socket, data.state, myData.symbol, myData.index);
        });

        socket.on('playerLeft', (data) => {
            if (game && game instanceof OnlineTicTacToe) {
                game.handlePlayerLeft(data);
            }
        });
    }

    function updateWaitingRoom(state, mySymbol = null) {
        playersList.innerHTML = '';

        const mySocketId = socket.id;

        state.players.forEach(player => {
            const config = PLAYER_CONFIGS[player.symbol];
            const isMe = player.socketId === mySocketId;
            const isHost = player.socketId === state.hostId;

            const playerItem = document.createElement('div');
            playerItem.className = 'player-item';
            playerItem.innerHTML = `
                <div class="player-symbol ${player.symbol.toLowerCase()}">${config.symbol}</div>
                <span class="player-name">${player.name}</span>
                ${isHost ? '<span class="player-badge">Host</span>' : ''}
                ${isMe ? '<span class="player-badge you">You</span>' : ''}
            `;
            playersList.appendChild(playerItem);
        });

        // Add empty slots
        for (let i = state.players.length; i < state.numPlayers; i++) {
            const emptySlot = document.createElement('div');
            emptySlot.className = 'empty-slot';
            emptySlot.textContent = 'Waiting for player...';
            playersList.appendChild(emptySlot);
        }

        // Update waiting text
        const remaining = state.numPlayers - state.players.length;
        if (remaining > 0) {
            playersWaitingText.textContent = `Waiting for ${remaining} more player${remaining > 1 ? 's' : ''}...`;
        } else {
            playersWaitingText.textContent = 'All players joined! Ready to start.';
        }

        // Show start button only for host when enough players
        if (socket.id === state.hostId && state.players.length >= 2) {
            btnStartGame.style.display = 'block';
        }
    }
});
