// Player configurations
const PLAYER_CONFIGS = {
    'X': { symbol: '✕', color: '#667eea', name: 'X' },
    'O': { symbol: '○', color: '#764ba2', name: 'Circle' },
    'D': { symbol: '•', color: '#28a745', name: 'Dot' },
    'T': { symbol: '▲', color: '#ffc107', name: 'Triangle' },
    'S': { symbol: '■', color: '#dc3545', name: 'Square' }
};

const PLAYER_SYMBOLS = ['X', 'O', 'D', 'T', 'S']; // Order of player symbols (X, Circle, Dot, Triangle, Square)

class TicTacToe {
    constructor(numPlayers, vsComputer = false) {
        this.numPlayers = numPlayers;
        this.vsComputer = vsComputer;
        // Determine board size based on number of players
        // 2 players: 6x6, 3 players: 7x7, 4 players: 8x8, 5 players: 9x9
        this.boardSize = 4 + numPlayers; // 6, 7, 8, 9
        this.winLength = 4; // Keep win length at 4 for all sizes
        this.board = Array(this.boardSize * this.boardSize).fill('');
        
        // Set up players
        this.players = PLAYER_SYMBOLS.slice(0, numPlayers);
        this.currentPlayerIndex = 0;
        this.currentPlayer = this.players[0];
        
        // In vs computer mode, computer is always player 2 (O)
        if (this.vsComputer) {
            this.computerPlayer = this.players[1]; // Computer is O
            this.humanPlayer = this.players[0]; // Human is X
        }
        
        this.gameActive = true;
        this.winningCells = [];
        this.currentAction = 'mark';
        this.isComputerTurn = false;
        
        // Initialize scores for all players
        this.scores = {};
        this.players.forEach(player => {
            this.scores[player] = 0;
        });
        
        this.deleteCooldown = 5;
        this.moveCooldown = 3;
        
        // Initialize move counters for all players
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
        // Create board dynamically
        this.createBoard();
        
        // Create score display
        this.createScoreDisplay();
        
        const resetBtn = document.getElementById('reset-btn');
        const actionButtons = document.querySelectorAll('.action-btn');
        
        // Add reset button listener
        resetBtn.addEventListener('click', () => this.resetGame());
        
        // Add action button listeners
        actionButtons.forEach(btn => {
            btn.addEventListener('click', (e) => {
                if (e.target.disabled) return;
                const action = e.target.getAttribute('data-action');
                if (this.isActionAvailable(action)) {
                    this.setAction(action);
                    this.updateActionButtons();
                }
            });
        });
        
        // Initial display update
        this.updateDisplay();
        this.updateScores();
        this.updateActionButtons();
    }
    
    createBoard() {
        const boardElement = document.getElementById('board');
        boardElement.innerHTML = ''; // Clear existing cells
        boardElement.style.gridTemplateColumns = `repeat(${this.boardSize}, 1fr)`;
        
        // Adjust cell font size based on board size
        // Smaller boards get larger fonts, larger boards get smaller fonts
        let fontSize = '2em';
        if (this.boardSize >= 9) {
            fontSize = '1.2em';
        } else if (this.boardSize >= 8) {
            fontSize = '1.4em';
        } else if (this.boardSize >= 7) {
            fontSize = '1.6em';
        }
        boardElement.style.setProperty('--cell-font-size', fontSize);
        
        // Create cells
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
        scoreBoard.innerHTML = ''; // Clear existing scores
        
        this.players.forEach(player => {
            const config = PLAYER_CONFIGS[player];
            const scoreItem = document.createElement('div');
            scoreItem.className = 'score-item';
            scoreItem.innerHTML = `
                <span class="score-label">${config.name}:</span>
                <span class="score-value" id="score-${player}">0</span>
            `;
            const scoreValue = scoreItem.querySelector(`#score-${player}`);
            scoreValue.style.color = config.color;
            scoreBoard.appendChild(scoreItem);
        });
    }
    
    handleCellClick(index) {
        if (!this.gameActive || this.isComputerTurn) {
            return; // Don't allow clicks during computer's turn
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
            // Update move counters based on action
            this.updateMoveCounters(this.currentAction);
            
            // Check for win after action
            if (this.checkWin()) {
                this.gameActive = false;
                this.displayWinner();
                this.highlightWinningCells();
            } else if (this.checkDraw()) {
                this.gameActive = false;
                this.displayDraw();
            } else {
                // Switch to next player
                this.nextPlayer();
                this.updateDisplay();
                // Reset to mark action after turn
                this.setAction('mark');
                this.updateActionButtons();
                
                // If it's computer's turn in vs computer mode, make computer move
                if (this.vsComputer && this.currentPlayer === this.computerPlayer && this.gameActive) {
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
        if (this.board[index] !== '') {
            return false;
        }
        
        this.board[index] = this.currentPlayer;
        this.updateCellDisplay(index);
        return true;
    }
    
    handleDelete(index) {
        // Can delete any opponent's cell
        if (this.board[index] === '' || this.board[index] === this.currentPlayer) {
            return false;
        }
        
        this.board[index] = '';
        this.clearCellDisplay(index);
        return true;
    }
    
    handleMove(index) {
        if (this.board[index] !== '') {
            return false;
        }
        
        // Find adjacent cells with current player's mark
        const adjacentIndex = this.findAdjacentOwnCell(index);
        if (adjacentIndex === -1) {
            return false;
        }
        
        // Move the mark
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
        
        // Check all 8 adjacent cells (including diagonals)
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
                if (this.board[adjacentIndex] === this.currentPlayer) {
                    return adjacentIndex;
                }
            }
        }
        
        return -1;
    }
    
    setAction(action) {
        if (!this.isActionAvailable(action)) {
            return false;
        }
        
        this.currentAction = action;
        
        // Update button styles
        document.querySelectorAll('.action-btn').forEach(btn => {
            btn.classList.remove('active');
        });
        const actionBtn = document.getElementById(`action-${action}`);
        if (actionBtn) {
            actionBtn.classList.add('active');
        }
        
        // Clear any status messages
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
            case 'mark':
                return true;
            case 'delete':
                return counters.movesSinceDelete >= this.deleteCooldown;
            case 'move':
                return counters.movesSinceMove >= this.moveCooldown;
            default:
                return false;
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
    
    updateActionButtons() {
        const actions = ['mark', 'delete', 'move'];
        const actionSelector = document.getElementById('action-selector');
        
        // Hide action selector during computer's turn in vs computer mode
        if (this.vsComputer && this.isComputerTurn) {
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
        
        // If current action is no longer available, switch to mark
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
            // Remove all player classes and add current one
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
        
        // Check rows
        for (let row = 0; row < size; row++) {
            for (let col = 0; col <= size - winLength; col++) {
                const indices = [];
                let count = 0;
                for (let i = 0; i < winLength; i++) {
                    const idx = row * size + col + i;
                    indices.push(idx);
                    if (this.board[idx] === player) {
                        count++;
                    }
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
                    if (this.board[idx] === player) {
                        count++;
                    }
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
                    if (this.board[idx] === player) {
                        count++;
                    }
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
                    if (this.board[idx] === player) {
                        count++;
                    }
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
        
        // Update score
        this.scores[this.currentPlayer]++;
        this.updateScores();
        
        // Disable all cells
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
    
    // Minimax with alpha-beta pruning for computer AI
    minimax(board, depth, alpha, beta, isMaximizing, player, opponent, moveCounters) {
        // Check for win
        const winner = this.checkWinner(board, player);
        const loser = this.checkWinner(board, opponent);
        
        if (winner === player) return 1000 - depth; // Prefer faster wins
        if (loser === opponent) return -1000 + depth; // Avoid slower losses
        if (this.isBoardFull(board)) return 0; // Draw
        
        // Limit depth to prevent excessive computation
        if (depth >= 4) {
            return this.evaluateBoard(board, player, opponent);
        }
        
        if (isMaximizing) {
            let maxEval = -Infinity;
            const moves = this.getPossibleMoves(board, player, opponent, moveCounters, true);
            
            for (const move of moves) {
                const newBoard = [...board];
                const newCounters = JSON.parse(JSON.stringify(moveCounters));
                
                // Apply move
                this.applyMove(newBoard, move, player, newCounters);
                
                const evalScore = this.minimax(newBoard, depth + 1, alpha, beta, false, player, opponent, newCounters);
                maxEval = Math.max(maxEval, evalScore);
                alpha = Math.max(alpha, evalScore);
                
                if (beta <= alpha) break; // Alpha-beta pruning
            }
            return maxEval;
        } else {
            let minEval = Infinity;
            const moves = this.getPossibleMoves(board, opponent, player, moveCounters, false);
            
            for (const move of moves) {
                const newBoard = [...board];
                const newCounters = JSON.parse(JSON.stringify(moveCounters));
                
                // Apply move
                this.applyMove(newBoard, move, opponent, newCounters);
                
                const evalScore = this.minimax(newBoard, depth + 1, alpha, beta, true, player, opponent, newCounters);
                minEval = Math.min(minEval, evalScore);
                beta = Math.min(beta, evalScore);
                
                if (beta <= alpha) break; // Alpha-beta pruning
            }
            return minEval;
        }
    }
    
    checkWinner(board, player) {
        const size = this.boardSize;
        const winLength = this.winLength;
        
        // Check rows, columns, and diagonals
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
        let score = 0;
        const size = this.boardSize;
        const winLength = this.winLength;
        
        // Evaluate potential lines
        const evaluateLine = (cells) => {
            let playerCount = 0;
            let opponentCount = 0;
            
            for (const cell of cells) {
                if (cell === player) playerCount++;
                else if (cell === opponent) opponentCount++;
            }
            
            if (playerCount > 0 && opponentCount === 0) {
                score += Math.pow(10, playerCount);
            } else if (opponentCount > 0 && playerCount === 0) {
                score -= Math.pow(10, opponentCount);
            }
        };
        
        // Check rows
        for (let row = 0; row < size; row++) {
            for (let col = 0; col <= size - winLength; col++) {
                const cells = [];
                for (let i = 0; i < winLength; i++) {
                    cells.push(board[row * size + col + i]);
                }
                evaluateLine(cells);
            }
        }
        
        // Check columns
        for (let col = 0; col < size; col++) {
            for (let row = 0; row <= size - winLength; row++) {
                const cells = [];
                for (let i = 0; i < winLength; i++) {
                    cells.push(board[(row + i) * size + col]);
                }
                evaluateLine(cells);
            }
        }
        
        // Check diagonals
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
    
    getPossibleMoves(board, player, opponent, moveCounters, isMaximizing) {
        const moves = [];
        const size = this.boardSize;
        const counters = moveCounters[player];
        
        // Mark moves
        for (let i = 0; i < board.length; i++) {
            if (board[i] === '') {
                moves.push({ action: 'mark', index: i });
            }
        }
        
        // Delete moves (if available)
        if (counters.movesSinceDelete >= this.deleteCooldown) {
            for (let i = 0; i < board.length; i++) {
                if (board[i] === opponent) {
                    moves.push({ action: 'delete', index: i });
                }
            }
        }
        
        // Move moves (if available)
        if (counters.movesSinceMove >= this.moveCooldown) {
            for (let i = 0; i < board.length; i++) {
                if (board[i] === '') {
                    // Check if there's an adjacent cell with player's mark
                    const row = Math.floor(i / size);
                    const col = i % size;
                    const directions = [[-1,-1],[-1,0],[-1,1],[0,-1],[0,1],[1,-1],[1,0],[1,1]];
                    
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
        
        // Show thinking indicator
        const thinkingIndicator = document.getElementById('computer-thinking');
        const actionSelector = document.getElementById('action-selector');
        if (thinkingIndicator) thinkingIndicator.style.display = 'inline';
        if (actionSelector) actionSelector.style.opacity = '0.5';
        
        // Add small delay for better UX
        setTimeout(() => {
            const board = [...this.board];
            const moveCounters = JSON.parse(JSON.stringify(this.moveCounters));
            const moves = this.getPossibleMoves(board, this.computerPlayer, this.humanPlayer, moveCounters, true);
            
            if (moves.length === 0) {
                if (thinkingIndicator) thinkingIndicator.style.display = 'none';
                if (actionSelector) actionSelector.style.opacity = '1';
                return;
            }
            
            let bestMove = null;
            let bestScore = -Infinity;
            
            // Evaluate all moves
            for (const move of moves) {
                const newBoard = [...board];
                const newCounters = JSON.parse(JSON.stringify(moveCounters));
                this.applyMove(newBoard, move, this.computerPlayer, newCounters);
                
                const score = this.minimax(newBoard, 0, -Infinity, Infinity, false, 
                    this.computerPlayer, this.humanPlayer, newCounters);
                
                if (score > bestScore) {
                    bestScore = score;
                    bestMove = move;
                }
            }
            
            if (bestMove) {
                // Execute the best move
                this.currentAction = bestMove.action;
                this.executeComputerMove(bestMove);
            }
            
            // Hide thinking indicator
            if (thinkingIndicator) thinkingIndicator.style.display = 'none';
            if (actionSelector) actionSelector.style.opacity = '1';
        }, 500); // 500ms delay
    }
    
    executeComputerMove(move) {
        let actionPerformed = false;
        
        if (move.action === 'mark') {
            actionPerformed = this.handleMark(move.index);
        } else if (move.action === 'delete') {
            actionPerformed = this.handleDelete(move.index);
        } else if (move.action === 'move') {
            // For move action, we need to find the source cell
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
        
        // Reset move counters
        this.players.forEach(player => {
            this.moveCounters[player] = {
                movesSinceDelete: this.deleteCooldown,
                movesSinceMove: this.moveCooldown
            };
        });
        
        this.setAction('mark');
        
        // Clear all cells
        document.querySelectorAll('.cell').forEach(cell => {
            cell.textContent = '';
            cell.style.color = '';
            cell.classList.remove('marked', 'x', 'o', 'd', 't', 's', 'disabled', 'winning');
        });
        
        // Reset status and thinking indicator
        document.getElementById('status').textContent = '';
        const thinkingIndicator = document.getElementById('computer-thinking');
        if (thinkingIndicator) thinkingIndicator.style.display = 'none';
        
        this.updateDisplay();
        this.updateActionButtons();
        
        // If computer goes first in vs computer mode
        if (this.vsComputer && this.currentPlayer === this.computerPlayer && this.gameActive) {
            this.isComputerTurn = true;
            this.makeComputerMove();
        }
    }
}

// Game mode and player selection
let game = null;

document.addEventListener('DOMContentLoaded', () => {
    const modeModal = document.getElementById('game-mode-modal');
    const playerModal = document.getElementById('player-selection-modal');
    const gameContainer = document.getElementById('game-container');
    const modeOptionButtons = document.querySelectorAll('.mode-option-btn');
    const playerOptionButtons = document.querySelectorAll('.player-option-btn');
    
    modeOptionButtons.forEach(btn => {
        btn.addEventListener('click', (e) => {
            const mode = e.target.getAttribute('data-mode');
            if (mode === 'computer') {
                modeModal.style.display = 'none';
                gameContainer.style.display = 'block';
                game = new TicTacToe(2, true); // 2 players, vs computer
            } else {
                modeModal.style.display = 'none';
                playerModal.style.display = 'flex';
            }
        });
    });
    
    playerOptionButtons.forEach(btn => {
        btn.addEventListener('click', (e) => {
            const numPlayers = parseInt(e.target.getAttribute('data-players'));
            playerModal.style.display = 'none';
            gameContainer.style.display = 'block';
            game = new TicTacToe(numPlayers, false);
        });
    });
});
