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
        this.gameVariation = state.gameVariation || 'normal';
        this.gameMode = state.gameMode || 'wild';
        // Use allowDelete and allowMove from state (set by server based on gameMode)
        this.allowDelete = state.allowDelete !== undefined ? state.allowDelete : false;
        this.allowMove = state.allowMove !== undefined ? state.allowMove : false;
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
            case 'delete': 
                if (!this.allowDelete) return false;
                return counters.movesSinceDelete >= this.deleteCooldown;
            case 'move': 
                if (!this.allowMove) return false;
                return counters.movesSinceMove >= this.moveCooldown;
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
                // Hide buttons for actions not allowed in this variation
                if (action === 'delete' && !this.allowDelete) {
                    btn.style.display = 'none';
                    return;
                }
                if (action === 'move' && !this.allowMove) {
                    btn.style.display = 'none';
                    return;
                }
                
                // Show allowed actions
                btn.style.display = 'inline-flex';
                
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
    constructor(numPlayers, vsComputer = false, playerConfig = null, difficultyLevels = null, gameVariation = 'normal', gameMode = 'wild') {
        this.numPlayers = numPlayers;
        this.vsComputer = vsComputer;
        this.gameMode = gameMode; // 'classic' or 'wild'
        
        // Set board size and win length based on game mode
        if (gameMode === 'classic') {
            this.boardSize = 3;
            this.winLength = 3;
            this.numPlayers = 2; // Classic mode only supports 2 players
        } else {
            this.boardSize = 4 + numPlayers;
            this.winLength = 4;
        }
        
        this.board = Array(this.boardSize * this.boardSize).fill('');
        this.gameVariation = gameVariation;
        
        // Classic mode doesn't allow delete/move
        if (gameMode === 'classic') {
            this.allowDelete = false;
            this.allowMove = false;
        } else {
            this.allowDelete = gameVariation === 'with-remove' || gameVariation === 'with-remove-move';
            this.allowMove = gameVariation === 'with-remove-move';
        }

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

        // If first player is a computer, start the game automatically
        if (this.isComputerPlayer(this.currentPlayer) && this.gameActive) {
            this.isComputerTurn = true;
            setTimeout(() => this.makeComputerMove(), 500);
        }
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
            case 'delete': 
                if (!this.allowDelete) return false;
                return counters.movesSinceDelete >= this.deleteCooldown;
            case 'move': 
                if (!this.allowMove) return false;
                return counters.movesSinceMove >= this.moveCooldown;
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
                // Hide buttons for actions not allowed in this variation
                if (action === 'delete' && !this.allowDelete) {
                    btn.style.display = 'none';
                    return;
                }
                if (action === 'move' && !this.allowMove) {
                    btn.style.display = 'none';
                    return;
                }
                
                // Show allowed actions
                btn.style.display = 'inline-flex';
                
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
        // Scope the query to the board element to avoid conflicts with modal elements
        const boardElement = document.getElementById('board');
        if (!boardElement) {
            console.error('Board element not found!');
            return;
        }
        
        const cell = boardElement.querySelector(`[data-index="${index}"]`);
        const player = this.board[index];
        
        if (!cell) {
            console.error(`Cell at index ${index} not found in board!`);
            return;
        }
        
        if (player) {
            const config = PLAYER_CONFIGS[player];
            if (!config) {
                console.error(`No config found for player: ${player}`);
                return;
            }
            
            // Remove all player symbol classes first
            PLAYER_SYMBOLS.forEach(p => {
                cell.classList.remove(p.toLowerCase());
            });
            
            // Set the content and styling
            cell.textContent = config.symbol;
            cell.style.color = config.color;
            cell.classList.add('marked');
            
            // Add the current player's class
            const playerClass = player.toLowerCase();
            cell.classList.add(playerClass);
        } else {
            // If no player, clear the cell
            cell.textContent = '';
            cell.style.color = '';
            cell.classList.remove('marked');
            PLAYER_SYMBOLS.forEach(p => {
                cell.classList.remove(p.toLowerCase());
            });
        }
    }

    clearCellDisplay(index) {
        // Scope the query to the board element to avoid conflicts with modal elements
        const boardElement = document.getElementById('board');
        if (!boardElement) return;
        
        const cell = boardElement.querySelector(`[data-index="${index}"]`);
        if (!cell) return;
        
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
        const boardElement = document.getElementById('board');
        if (!boardElement) return;
        
        this.winningCells.forEach(index => {
            const cell = boardElement.querySelector(`[data-index="${index}"]`);
            if (cell) {
                cell.classList.add('winning');
            }
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

    // Optimized move ordering: prioritize winning moves, blocking moves, then others
    orderMoves(moves, board, player, opponents) {
        const ordered = [];
        const winning = [];
        const blocking = [];
        const others = [];

        for (const move of moves) {
            const testBoard = [...board];
            if (move.action === 'mark') {
                testBoard[move.index] = player;
                // Check if this is a winning move
                if (this.checkWinnerQuick(testBoard, player)) {
                    winning.push(move);
                    continue;
                }
                // Check if this blocks an opponent win
                let blocksWin = false;
                for (const opp of opponents) {
                    testBoard[move.index] = opp;
                    if (this.checkWinnerQuick(testBoard, opp)) {
                        blocking.push(move);
                        blocksWin = true;
                        break;
                    }
                    testBoard[move.index] = '';
                }
                if (!blocksWin) {
                    others.push(move);
                }
            } else {
                others.push(move);
            }
        }

        // Return ordered: winning moves first, then blocking, then others
        return [...winning, ...blocking, ...others];
    }

    // Quick winner check for move ordering (optimized version)
    checkWinnerQuick(board, player) {
        const size = this.boardSize;
        const winLength = this.winLength;

        // Quick check - only check if player has enough pieces
        const playerCount = board.filter(c => c === player).length;
        if (playerCount < winLength) return false;

        // Check rows
        for (let row = 0; row < size; row++) {
            for (let col = 0; col <= size - winLength; col++) {
                let count = 0;
                for (let i = 0; i < winLength; i++) {
                    if (board[row * size + col + i] === player) count++;
                }
                if (count === winLength) return true;
            }
        }

        // Check columns
        for (let col = 0; col < size; col++) {
            for (let row = 0; row <= size - winLength; row++) {
                let count = 0;
                for (let i = 0; i < winLength; i++) {
                    if (board[(row + i) * size + col] === player) count++;
                }
                if (count === winLength) return true;
            }
        }

        // Check diagonals
        for (let row = 0; row <= size - winLength; row++) {
            for (let col = 0; col <= size - winLength; col++) {
                let count = 0;
                for (let i = 0; i < winLength; i++) {
                    if (board[(row + i) * size + (col + i)] === player) count++;
                }
                if (count === winLength) return true;
            }
        }

        for (let row = 0; row <= size - winLength; row++) {
            for (let col = winLength - 1; col < size; col++) {
                let count = 0;
                for (let i = 0; i < winLength; i++) {
                    if (board[(row + i) * size + (col - i)] === player) count++;
                }
                if (count === winLength) return true;
            }
        }

        return false;
    }

    updateProgressBar(progress, text) {
        const progressBar = document.getElementById('computer-progress-bar');
        const progressText = document.getElementById('computer-progress-text');
        const progressContainer = document.getElementById('computer-progress-container');
        
        if (progressBar) {
            progressBar.style.width = `${Math.min(100, Math.max(0, progress))}%`;
        }
        if (progressText) {
            progressText.textContent = text;
        }
        if (progressContainer) {
            progressContainer.style.display = 'flex';
        }
    }

    hideProgressBar() {
        const progressContainer = document.getElementById('computer-progress-container');
        if (progressContainer) {
            progressContainer.style.display = 'none';
        }
        const progressBar = document.getElementById('computer-progress-bar');
        if (progressBar) {
            progressBar.style.width = '0%';
        }
    }

    makeComputerMove() {
        if (!this.isComputerTurn || !this.gameActive) return;
        
        // Prevent multiple simultaneous computer moves
        if (this._computingMove) return;
        this._computingMove = true;

        const thinkingIndicator = document.getElementById('computer-thinking');
        const actionSelector = document.getElementById('action-selector');
        if (thinkingIndicator) thinkingIndicator.style.display = 'inline';
        if (actionSelector) actionSelector.style.opacity = '0.5';

        // Show progress bar
        this.updateProgressBar(0, 'Initializing...');

        setTimeout(() => {
            const board = [...this.board];
            const moveCounters = JSON.parse(JSON.stringify(this.moveCounters));

            // Get all opponents (human players and other computer players)
            const opponents = this.players.filter(symbol => symbol !== this.currentPlayer);
            let moves = this.getPossibleMovesMultiplayer(board, this.currentPlayer, opponents, moveCounters, true);

            if (moves.length === 0) {
                this._computingMove = false;
                this.hideProgressBar();
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

            // OPTIMIZATION: Order moves for better alpha-beta pruning (winning moves first)
            this.updateProgressBar(5, 'Analyzing moves...');
            moves = this.orderMoves(moves, board, this.currentPlayer, opponents);

            // OPTIMIZATION: Iterative deepening - start shallow, go deeper if time allows
            const startTime = performance.now();
            const maxTime = 3000; // 3 second max thinking time
            let currentDepth = 1;
            const totalMoves = moves.length;
            let movesEvaluated = 0;

            while (currentDepth <= maxDepth && (performance.now() - startTime) < maxTime) {
                let depthBestMove = null;
                let depthBestScore = -Infinity;

                for (let moveIndex = 0; moveIndex < moves.length; moveIndex++) {
                    const move = moves[moveIndex];
                    const newBoard = [...board];
                    const newCounters = JSON.parse(JSON.stringify(moveCounters));
                    this.applyMove(newBoard, move, this.currentPlayer, newCounters);

                    const score = this.minimax(newBoard, 0, -Infinity, Infinity, false,
                        this.currentPlayer, opponents, newCounters, currentDepth);

                    movesEvaluated++;
                    
                    // Update progress: 10% for initialization, 80% for move evaluation, 10% for finalization
                    const moveProgress = 10 + (movesEvaluated / (totalMoves * maxDepth)) * 80;
                    const depthProgress = (currentDepth / maxDepth) * 80;
                    const timeProgress = Math.min(90, 10 + ((performance.now() - startTime) / maxTime) * 80);
                    const overallProgress = Math.min(95, Math.max(moveProgress, depthProgress, timeProgress));
                    
                    this.updateProgressBar(
                        overallProgress,
                        `Depth ${currentDepth}/${maxDepth} - Evaluating move ${moveIndex + 1}/${totalMoves}...`
                    );

                    if (score > depthBestScore) {
                        depthBestScore = score;
                        depthBestMove = move;
                    }

                    // Early exit if we found a winning move
                    if (score > 900) {
                        bestMove = move;
                        bestScore = score;
                        break;
                    }

                    // Check time limit
                    if ((performance.now() - startTime) > maxTime) break;
                }

                // Update best move if we found a better one at this depth
                if (depthBestScore > bestScore) {
                    bestMove = depthBestMove;
                    bestScore = depthBestScore;
                }

                // If we found a winning move, no need to go deeper
                if (bestScore > 900) break;

                currentDepth++;
            }

            // Finalize progress
            this.updateProgressBar(100, 'Selecting best move...');

            setTimeout(() => {
                if (bestMove) {
                    this.currentAction = bestMove.action;
                    // Show notification and execute move (notification is shown inside executeComputerMove)
                    this.executeComputerMove(bestMove);
                } else {
                    // No valid move found, hide thinking indicator
                    this._computingMove = false;
                    this.hideProgressBar();
                    if (thinkingIndicator) thinkingIndicator.style.display = 'none';
                    if (actionSelector) actionSelector.style.opacity = '1';
                }
            }, 200);
        }, 500);
    }

    showComputerMoveNotification(move) {
        const statusDisplay = document.getElementById('status');
        const config = PLAYER_CONFIGS[this.currentPlayer];
        let message = '';
        let consoleMessage = '';

        if (move.action === 'mark') {
            const row = Math.floor(move.index / this.boardSize) + 1;
            const col = (move.index % this.boardSize) + 1;
            message = `🤖 ${config.name} will mark cell at row ${row}, column ${col}`;
            consoleMessage = `${config.name} (Computer) chose to MARK cell at position ${move.index} (row ${row}, col ${col})`;
            statusDisplay.style.color = config.color;
        } else if (move.action === 'delete') {
            const deletedPlayer = this.board[move.index];
            if (deletedPlayer) {
                const deletedConfig = PLAYER_CONFIGS[deletedPlayer];
                const row = Math.floor(move.index / this.boardSize) + 1;
                const col = (move.index % this.boardSize) + 1;
                message = `⚠️ ${config.name} will DELETE ${deletedConfig.name}'s cell at row ${row}, column ${col}!`;
                consoleMessage = `⚠️ ${config.name} (Computer) chose to DELETE ${deletedConfig.name}'s cell at position ${move.index} (row ${row}, col ${col})!`;
                statusDisplay.style.color = '#dc3545'; // Red for delete action
            } else {
                message = `⚠️ ${config.name} will delete a cell!`;
                consoleMessage = `⚠️ ${config.name} (Computer) chose to DELETE a cell at position ${move.index}!`;
                statusDisplay.style.color = '#dc3545';
            }
        } else if (move.action === 'move') {
            const sourceIndex = move.sourceIndex !== undefined ? move.sourceIndex : this.findAdjacentOwnCell(move.index);
            if (sourceIndex !== -1) {
                const sourceRow = Math.floor(sourceIndex / this.boardSize) + 1;
                const sourceCol = (sourceIndex % this.boardSize) + 1;
                const targetRow = Math.floor(move.index / this.boardSize) + 1;
                const targetCol = (move.index % this.boardSize) + 1;
                message = `🤖 ${config.name} will move from row ${sourceRow}, column ${sourceCol} to row ${targetRow}, column ${targetCol}`;
                consoleMessage = `${config.name} (Computer) chose to MOVE from position ${sourceIndex} (row ${sourceRow}, col ${sourceCol}) to position ${move.index} (row ${targetRow}, col ${targetCol})`;
            } else {
                const targetRow = Math.floor(move.index / this.boardSize) + 1;
                const targetCol = (move.index % this.boardSize) + 1;
                message = `🤖 ${config.name} will move to row ${targetRow}, column ${targetCol}`;
                consoleMessage = `${config.name} (Computer) chose to MOVE to position ${move.index} (row ${targetRow}, col ${targetCol})`;
            }
            statusDisplay.style.color = config.color;
        }

        // Display in UI
        statusDisplay.textContent = message;

        // Print to console
        console.log(consoleMessage);
    }

    executeComputerMove(move) {
        const thinkingIndicator = document.getElementById('computer-thinking');
        const actionSelector = document.getElementById('action-selector');

        // Show notification before executing the move
        this.showComputerMoveNotification(move);

        // Wait a moment for user to see the notification, then execute
        setTimeout(() => {
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

            // Hide thinking indicator and progress bar after move is executed
            if (thinkingIndicator) thinkingIndicator.style.display = 'none';
            if (actionSelector) actionSelector.style.opacity = '1';
            this.hideProgressBar();

            if (actionPerformed) {
                this.updateMoveCounters(move.action);
                this.isComputerTurn = false;
                this._computingMove = false; // Reset flag after move

                // Clear notification after move (unless game is over)
                setTimeout(() => {
                    const statusDisplay = document.getElementById('status');
                    if (this.gameActive && !statusDisplay.textContent.includes('Wins') && !statusDisplay.textContent.includes('Draw')) {
                        statusDisplay.textContent = '';
                        statusDisplay.style.color = '';
                    }
                }, 1500); // Clear after showing the move result

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
                        // Add a small delay between computer moves for better visibility
                        setTimeout(() => this.makeComputerMove(), 800);
                    }
                }
            } else {
                // Move failed, reset flag and hide progress
                this._computingMove = false;
                this.hideProgressBar();
            }
        }, 1000); // 1 second delay to show notification
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
        this.hideProgressBar();

        this.updateDisplay();
        this.updateActionButtons();

        if (this.isComputerPlayer(this.currentPlayer) && this.gameActive) {
            this.isComputerTurn = true;
            setTimeout(() => this.makeComputerMove(), 500);
        }
    }
}

// ==================== MAIN APP LOGIC ====================
let game = null;
let socket = null;
let selectedPlayerCount = 2;
let selectedGameVariation = 'normal';
let selectedGameMode = 'wild'; // 'classic' or 'wild'

// Variation names mapping
const VARIATION_NAMES = {
    'normal': 'Normal',
    'with-remove': 'With Remove',
    'with-remove-move': 'With Remove & Move'
};

document.addEventListener('DOMContentLoaded', () => {
    // Get DOM elements
    const mainMenuModal = document.getElementById('main-menu-modal');
    const onlineLobbyModal = document.getElementById('online-lobby-modal');
    const waitingRoomModal = document.getElementById('waiting-room-modal');
    const gameModeSelectionModal = document.getElementById('game-mode-selection-modal');
    const gameModeModal = document.getElementById('game-mode-modal');
    const playerSelectionModal = document.getElementById('player-selection-modal');
    const variationSelectionModal = document.getElementById('variation-selection-modal');
    const gameContainer = document.getElementById('game-container');

    // Main menu buttons
    const btnOnline = document.getElementById('btn-online');
    const btnPvpLocal = document.getElementById('btn-pvp-local');
    const btnPvc = document.getElementById('btn-pvc');
    const btnMultiplayer = document.getElementById('btn-multiplayer');
    const btnBonusModes = document.getElementById('btn-bonus-modes');
    
    // Bonus modes elements
    const bonusModesModal = document.getElementById('bonus-modes-modal');
    const bonusModesBackBtn = document.getElementById('bonus-modes-back-btn');
    const btnMazeMode = document.getElementById('btn-maze-mode');
    
    // Maze mode elements
    const mazeDifficultyModal = document.getElementById('maze-difficulty-modal');
    const mazeDifficultyBackBtn = document.getElementById('maze-difficulty-back-btn');
    const difficultyOptionButtons = document.querySelectorAll('.difficulty-option-btn');
    const mazeContainer = document.getElementById('maze-container');
    const mazeBoard = document.getElementById('maze-board');
    const mazeResetBtn = document.getElementById('maze-reset-btn');
    const mazeBackBtn = document.getElementById('maze-back-btn');
    const mazeStatus = document.getElementById('maze-status');
    const mazeMovesDisplay = document.getElementById('maze-moves');
    const mazeDifficultyDisplay = document.getElementById('maze-difficulty-display');

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

    // Game mode selection elements
    const gameModeSelectionBackBtn = document.getElementById('game-mode-selection-back-btn');
    const gameModeOptionButtons = document.querySelectorAll('.game-mode-option-btn');

    // Variation selection elements
    const variationBackBtn = document.getElementById('variation-back-btn');
    const variationOptionButtons = document.querySelectorAll('.variation-option-btn');
    const selectedVariationDisplay = document.getElementById('selected-variation-display');
    const variationNameSpan = document.getElementById('variation-name');
    const localVariationDisplay = document.getElementById('local-variation-display');
    const localVariationNameSpan = document.getElementById('local-variation-name');
    const changeLocalVariationBtn = document.getElementById('change-local-variation-btn');

    // Helper functions
    function hideAllModals() {
        mainMenuModal.style.display = 'none';
        onlineLobbyModal.style.display = 'none';
        waitingRoomModal.style.display = 'none';
        gameModeSelectionModal.style.display = 'none';
        gameModeModal.style.display = 'none';
        playerSelectionModal.style.display = 'none';
        playerConfigModal.style.display = 'none';
        variationSelectionModal.style.display = 'none';
        bonusModesModal.style.display = 'none';
        mazeDifficultyModal.style.display = 'none';
    }

    function updateVariationDisplay() {
        if (variationNameSpan) {
            variationNameSpan.textContent = VARIATION_NAMES[selectedGameVariation] || 'Normal';
        }
        if (localVariationNameSpan) {
            localVariationNameSpan.textContent = VARIATION_NAMES[selectedGameVariation] || 'Normal';
        }
    }

    function showError(message) {
        lobbyError.textContent = message;
        setTimeout(() => {
            lobbyError.textContent = '';
        }, 5000);
    }

    // Variation selection handlers
    variationBackBtn.addEventListener('click', () => {
        hideAllModals();
        gameModeSelectionModal.style.display = 'flex';
        // Restore versus mode
        const versusMode = variationSelectionModal.dataset.versusMode;
        if (versusMode) {
            gameModeSelectionModal.dataset.versusMode = versusMode;
        }
    });

    variationOptionButtons.forEach(btn => {
        btn.addEventListener('click', (e) => {
            const variation = e.target.closest('.variation-option-btn').getAttribute('data-variation');
            selectedGameVariation = variation;
            updateVariationDisplay();
            hideAllModals();
            
            // Determine where to go based on versus mode
            const versusMode = variationSelectionModal.dataset.versusMode;
            
            if (versusMode === 'online') {
                selectedGameMode = 'wild'; // Wild mode for online variations
                onlineLobbyModal.style.display = 'flex';
                // Initialize socket connection
                if (!socket) {
                    socket = io();
                    setupSocketListeners();
                }
            } else if (versusMode === 'pvp-local') {
                // Direct to 2-player local game (wild mode)
                hideAllModals();
                gameContainer.style.display = 'block';
                game = new TicTacToe(2, false, [true, true], [null, null], selectedGameVariation, 'wild');
            } else if (versusMode === 'pvc') {
                // Direct to vs computer game with difficulty selection (wild mode)
                hideAllModals();
                gameModeModal.style.display = 'flex';
                document.querySelectorAll('.mode-option-btn').forEach(b => {
                    b.style.display = 'none';
                });
                computerDifficultySection.style.display = 'block';
                vsComputerStartBtn.style.display = 'block';
                const modalTitle = gameModeModal.querySelector('h2');
                if (modalTitle) modalTitle.textContent = 'Player vs Computer';
                gameModeModal.dataset.gameMode = 'wild';
            } else if (versusMode === 'multiplayer') {
                // Show player selection modal (wild mode)
                playerSelectionModal.style.display = 'flex';
            }
        });
    });

    changeLocalVariationBtn.addEventListener('click', () => {
        hideAllModals();
        variationSelectionModal.style.display = 'flex';
    });

    // Main menu handlers
    // Player vs Player (Local 2 Players)
    btnPvpLocal.addEventListener('click', () => {
        selectedPlayerCount = 2;
        hideAllModals();
        gameModeSelectionModal.style.display = 'flex';
        gameModeSelectionModal.dataset.versusMode = 'pvp-local';
    });

    // Player vs Computer
    btnPvc.addEventListener('click', () => {
        hideAllModals();
        gameModeSelectionModal.style.display = 'flex';
        gameModeSelectionModal.dataset.versusMode = 'pvc';
    });

    // Multi-Player (2-5 Players Local)
    btnMultiplayer.addEventListener('click', () => {
        hideAllModals();
        gameModeSelectionModal.style.display = 'flex';
        gameModeSelectionModal.dataset.versusMode = 'multiplayer';
    });

    // Play Online
    btnOnline.addEventListener('click', () => {
        hideAllModals();
        gameModeSelectionModal.style.display = 'flex';
        gameModeSelectionModal.dataset.versusMode = 'online';
    });

    // Game mode selection handlers
    gameModeSelectionBackBtn.addEventListener('click', () => {
        hideAllModals();
        mainMenuModal.style.display = 'flex';
    });

    gameModeOptionButtons.forEach(btn => {
        btn.addEventListener('click', (e) => {
            const gameMode = e.target.closest('.game-mode-option-btn').getAttribute('data-game-mode');
            selectedGameMode = gameMode;
            const versusMode = gameModeSelectionModal.dataset.versusMode;

            hideAllModals();

            if (gameMode === 'classic') {
                // Classic mode: skip variation selection, go directly to game setup
                if (versusMode === 'pvp-local') {
                    // Direct to 2-player classic game
                    gameContainer.style.display = 'block';
                    game = new TicTacToe(2, false, [true, true], [null, null], 'normal', 'classic');
                } else if (versusMode === 'pvc') {
                    // Show difficulty selection for vs computer
                    gameModeModal.style.display = 'flex';
                    document.querySelectorAll('.mode-option-btn').forEach(b => b.style.display = 'none');
                    computerDifficultySection.style.display = 'block';
                    vsComputerStartBtn.style.display = 'block';
                    const modalTitle = gameModeModal.querySelector('h2');
                    if (modalTitle) modalTitle.textContent = 'Player vs Computer - Classic';
                    gameModeModal.dataset.gameMode = 'classic';
                } else if (versusMode === 'multiplayer') {
                    // Classic mode only supports 2 players
                    alert('Classic Tic Tac Toe only supports 2 players. Please choose Wild Addition for multiplayer.');
                    hideAllModals();
                    gameModeSelectionModal.style.display = 'flex';
                    gameModeSelectionModal.dataset.versusMode = versusMode;
            } else if (versusMode === 'online') {
                // Online classic mode
                selectedGameMode = 'classic';
                onlineLobbyModal.style.display = 'flex';
                selectedPlayerCount = 2; // Classic is always 2 players
                if (!socket) {
                    socket = io();
                    setupSocketListeners();
                }
            }
            } else {
                // Wild mode: show variation selection
                variationSelectionModal.style.display = 'flex';
                variationSelectionModal.dataset.versusMode = versusMode;
            }
        });
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

        // Initialize socket connection if not already done
        if (!socket) {
            socket = io();
            setupSocketListeners();
        }

        socket.emit('createRoom', {
            playerName,
            numPlayers: selectedPlayerCount,
            gameVariation: selectedGameVariation,
            gameMode: selectedGameMode
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
        // If we came from a specific game mode, go back to variation selection
        if (variationSelectionModal.dataset.gameMode) {
            hideAllModals();
            variationSelectionModal.style.display = 'flex';
            // Reset mode option buttons visibility
            document.querySelectorAll('.mode-option-btn').forEach(btn => {
                btn.style.display = 'block';
            });
            computerDifficultySection.style.display = 'none';
            vsComputerStartBtn.style.display = 'none';
            // Reset modal title
            const modalTitle = gameModeModal.querySelector('h2');
            if (modalTitle) modalTitle.textContent = 'Select Game Mode';
        } else {
            hideAllModals();
            mainMenuModal.style.display = 'flex';
        }
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
        const gameMode = gameModeModal.dataset.gameMode || 'wild';
        hideAllModals();
        gameContainer.style.display = 'block';
        game = new TicTacToe(2, true, null, [null, difficulty], selectedGameVariation, gameMode);
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
                // This shouldn't be reached from the new home screen, but keep for compatibility
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
        game = new TicTacToe(numPlayers, false, playerConfig, difficultyLevels, selectedGameVariation, 'wild');
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

    // Initialize variation display
    updateVariationDisplay();

    // Bonus modes handlers
    btnBonusModes.addEventListener('click', () => {
        hideAllModals();
        bonusModesModal.style.display = 'flex';
    });

    bonusModesBackBtn.addEventListener('click', () => {
        hideAllModals();
        mainMenuModal.style.display = 'flex';
    });

    btnMazeMode.addEventListener('click', () => {
        hideAllModals();
        mazeDifficultyModal.style.display = 'flex';
    });

    mazeDifficultyBackBtn.addEventListener('click', () => {
        hideAllModals();
        bonusModesModal.style.display = 'flex';
    });

    // Maze game variables
    let currentMaze = null;
    let playerPosition = null;
    let targetPosition = null;
    let mazeMoves = 0;
    let currentDifficulty = 1;
    let mazeSize = 5;

    // Difficulty configurations
    const MAZE_DIFFICULTIES = {
        1: { size: 5, name: 'Very Easy' },
        2: { size: 7, name: 'Easy' },
        3: { size: 10, name: 'Medium' },
        4: { size: 15, name: 'Hard' },
        5: { size: 20, name: 'Very Hard' }
    };

    difficultyOptionButtons.forEach(btn => {
        btn.addEventListener('click', (e) => {
            const difficulty = parseInt(e.target.closest('.difficulty-option-btn').getAttribute('data-difficulty'));
            currentDifficulty = difficulty;
            mazeSize = MAZE_DIFFICULTIES[difficulty].size;
            startMazeGame(difficulty);
        });
    });

    function startMazeGame(difficulty) {
        hideAllModals();
        mazeContainer.style.display = 'block';
        gameContainer.style.display = 'none';
        
        currentDifficulty = difficulty;
        mazeSize = MAZE_DIFFICULTIES[difficulty].size;
        mazeMoves = 0;
        mazeStatus.textContent = '';
        mazeStatus.classList.remove('success');
        mazeDifficultyDisplay.textContent = `Difficulty: ${MAZE_DIFFICULTIES[difficulty].name}`;
        updateMovesDisplay();
        
        generateMaze();
        renderMaze();
    }

    function generateMaze() {
        // Initialize maze with walls
        currentMaze = Array(mazeSize).fill(null).map(() => Array(mazeSize).fill(1));
        
        // Use recursive backtracking algorithm to generate maze
        const stack = [];
        const visited = Array(mazeSize).fill(null).map(() => Array(mazeSize).fill(false));
        
        // Start from top-left
        let current = { row: 0, col: 0 };
        currentMaze[0][0] = 0; // Path
        visited[0][0] = true;
        stack.push(current);
        
        const directions = [
            { row: -1, col: 0 }, // Up
            { row: 1, col: 0 },  // Down
            { row: 0, col: -1 },  // Left
            { row: 0, col: 1 }    // Right
        ];
        
        while (stack.length > 0) {
            const neighbors = [];
            
            for (const dir of directions) {
                const newRow = current.row + dir.row * 2;
                const newCol = current.col + dir.col * 2;
                
                if (newRow >= 0 && newRow < mazeSize && 
                    newCol >= 0 && newCol < mazeSize && 
                    !visited[newRow][newCol]) {
                    neighbors.push({
                        row: newRow,
                        col: newCol,
                        wallRow: current.row + dir.row,
                        wallCol: current.col + dir.col
                    });
                }
            }
            
            if (neighbors.length > 0) {
                const next = neighbors[Math.floor(Math.random() * neighbors.length)];
                currentMaze[next.wallRow][next.wallCol] = 0; // Remove wall
                currentMaze[next.row][next.col] = 0; // Path
                visited[next.row][next.col] = true;
                stack.push(current);
                current = { row: next.row, col: next.col };
            } else {
                current = stack.pop();
            }
        }
        
        // Ensure bottom-right is a path
        currentMaze[mazeSize - 1][mazeSize - 1] = 0;
        if (mazeSize > 1) {
            currentMaze[mazeSize - 2][mazeSize - 1] = 0;
            currentMaze[mazeSize - 1][mazeSize - 2] = 0;
        }
        
        // Set player and target positions
        playerPosition = { row: 0, col: 0 };
        targetPosition = { row: mazeSize - 1, col: mazeSize - 1 };
        
        // Add some random walls for difficulty (more walls = harder)
        // But ensure there's still a path from start to finish
        const wallDensity = [0.05, 0.1, 0.15, 0.2, 0.25][difficulty - 1];
        const totalCells = mazeSize * mazeSize;
        const wallsToAdd = Math.floor(totalCells * wallDensity);
        
        // Keep track of which cells are critical for pathfinding
        const criticalCells = new Set();
        criticalCells.add(`${0}-${0}`);
        criticalCells.add(`${mazeSize - 1}-${mazeSize - 1}`);
        
        for (let i = 0; i < wallsToAdd; i++) {
            const row = Math.floor(Math.random() * mazeSize);
            const col = Math.floor(Math.random() * mazeSize);
            const cellKey = `${row}-${col}`;
            
            // Don't block start, end, or critical path cells
            if (!criticalCells.has(cellKey)) {
                // Temporarily add wall
                const original = currentMaze[row][col];
                currentMaze[row][col] = 1;
                
                // Check if path still exists
                if (hasPath(0, 0, mazeSize - 1, mazeSize - 1)) {
                    // Path exists, keep the wall
                } else {
                    // Path broken, revert
                    currentMaze[row][col] = original;
                }
            }
        }
    }

    function hasPath(startRow, startCol, endRow, endCol) {
        const visited = Array(mazeSize).fill(null).map(() => Array(mazeSize).fill(false));
        const queue = [{ row: startRow, col: startCol }];
        visited[startRow][startCol] = true;
        
        const directions = [
            { row: -1, col: 0 }, // Up
            { row: 1, col: 0 },  // Down
            { row: 0, col: -1 }, // Left
            { row: 0, col: 1 }   // Right
        ];
        
        while (queue.length > 0) {
            const current = queue.shift();
            
            if (current.row === endRow && current.col === endCol) {
                return true;
            }
            
            for (const dir of directions) {
                const newRow = current.row + dir.row;
                const newCol = current.col + dir.col;
                
                if (newRow >= 0 && newRow < mazeSize && 
                    newCol >= 0 && newCol < mazeSize && 
                    !visited[newRow][newCol] && 
                    currentMaze[newRow][newCol] === 0) {
                    visited[newRow][newCol] = true;
                    queue.push({ row: newRow, col: newCol });
                }
            }
        }
        
        return false;
    }

    function renderMaze() {
        mazeBoard.innerHTML = '';
        mazeBoard.style.gridTemplateColumns = `repeat(${mazeSize}, 1fr)`;
        
        // Calculate cell size based on maze size
        const maxSize = Math.min(600, window.innerWidth - 100);
        const cellSize = Math.floor(maxSize / mazeSize);
        mazeBoard.style.gridTemplateColumns = `repeat(${mazeSize}, ${cellSize}px)`;
        
        for (let row = 0; row < mazeSize; row++) {
            for (let col = 0; col < mazeSize; col++) {
                const cell = document.createElement('div');
                cell.className = 'maze-cell';
                cell.setAttribute('data-row', row);
                cell.setAttribute('data-col', col);
                
                if (currentMaze[row][col] === 1) {
                    cell.classList.add('wall');
                } else {
                    cell.classList.add('path');
                    
                    if (row === playerPosition.row && col === playerPosition.col) {
                        cell.classList.add('player');
                        cell.textContent = '✕';
                    } else if (row === targetPosition.row && col === targetPosition.col) {
                        cell.classList.add('target');
                        cell.textContent = '○';
                    }
                    
                    cell.addEventListener('click', () => handleMazeCellClick(row, col));
                }
                
                mazeBoard.appendChild(cell);
            }
        }
    }

    function handleMazeCellClick(row, col) {
        if (currentMaze[row][col] === 1) return; // Can't move to wall
        
        // Check if cell is adjacent to player
        const rowDiff = Math.abs(row - playerPosition.row);
        const colDiff = Math.abs(col - playerPosition.col);
        
        if ((rowDiff === 1 && colDiff === 0) || (rowDiff === 0 && colDiff === 1)) {
            playerPosition = { row, col };
            mazeMoves++;
            updateMovesDisplay();
            renderMaze();
            
            // Check win condition
            if (row === targetPosition.row && col === targetPosition.col) {
                mazeStatus.textContent = `🎉 Congratulations! You reached the target in ${mazeMoves} moves!`;
                mazeStatus.classList.add('success');
            }
        }
    }

    function updateMovesDisplay() {
        mazeMovesDisplay.textContent = `Moves: ${mazeMoves}`;
    }

    mazeResetBtn.addEventListener('click', () => {
        startMazeGame(currentDifficulty);
    });

    mazeBackBtn.addEventListener('click', () => {
        mazeContainer.style.display = 'none';
        hideAllModals();
        mainMenuModal.style.display = 'flex';
    });

    // Keyboard controls for maze
    document.addEventListener('keydown', (e) => {
        if (mazeContainer.style.display === 'none' || !currentMaze) return;
        
        let newRow = playerPosition.row;
        let newCol = playerPosition.col;
        
        switch(e.key) {
            case 'ArrowUp':
            case 'w':
            case 'W':
                newRow--;
                break;
            case 'ArrowDown':
            case 's':
            case 'S':
                newRow++;
                break;
            case 'ArrowLeft':
            case 'a':
            case 'A':
                newCol--;
                break;
            case 'ArrowRight':
            case 'd':
            case 'D':
                newCol++;
                break;
            default:
                return;
        }
        
        e.preventDefault();
        
        if (newRow >= 0 && newRow < mazeSize && 
            newCol >= 0 && newCol < mazeSize && 
            currentMaze[newRow][newCol] === 0) {
            handleMazeCellClick(newRow, newCol);
        }
    });
});
