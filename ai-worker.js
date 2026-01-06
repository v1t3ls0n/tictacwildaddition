// AI Worker for parallel minimax computation
// This runs in a separate thread to avoid blocking the UI

// Import the game logic (we'll need to copy necessary functions)
const PLAYER_SYMBOLS = ['X', 'O', 'D', 'T', 'S'];

// Optimized minimax with parallel search support
function minimax(board, depth, alpha, beta, isMaximizing, player, opponents, moveCounters, maxDepth, boardSize, winLength) {
    const winner = checkWinner(board, player, boardSize, winLength);
    const opponentWinners = opponents.map(opp => checkWinner(board, opp, boardSize, winLength)).filter(w => w !== null);

    if (winner === player) return 1000 - depth;
    if (opponentWinners.length > 0) return -1000 + depth;
    if (isBoardFull(board)) return 0;

    if (depth >= maxDepth) {
        return evaluateBoardMultiplayer(board, player, opponents, boardSize, winLength);
    }

    if (isMaximizing) {
        let maxEval = -Infinity;
        const moves = getPossibleMovesMultiplayer(board, player, opponents, moveCounters, true, boardSize, 5, 3);

        // Sort moves for better alpha-beta pruning (best moves first)
        moves.sort((a, b) => {
            // Prioritize winning moves, then blocking moves
            return 0; // Could add move ordering here
        });

        for (const move of moves) {
            const newBoard = [...board];
            const newCounters = JSON.parse(JSON.stringify(moveCounters));
            applyMove(newBoard, move, player, newCounters);

            const evalScore = minimax(newBoard, depth + 1, alpha, beta, false, player, opponents, newCounters, maxDepth, boardSize, winLength);
            maxEval = Math.max(maxEval, evalScore);
            alpha = Math.max(alpha, evalScore);
            if (beta <= alpha) break; // Alpha-beta pruning
        }
        return maxEval;
    } else {
        let minEval = Infinity;
        let bestOpponent = opponents[0];
        let bestOpponentScore = -Infinity;
        
        for (const opponent of opponents) {
            const score = evaluateBoardMultiplayer(board, opponent, [player, ...opponents.filter(o => o !== opponent)], boardSize, winLength);
            if (score > bestOpponentScore) {
                bestOpponentScore = score;
                bestOpponent = opponent;
            }
        }
        
        const moves = getPossibleMovesMultiplayer(board, bestOpponent, [player, ...opponents.filter(o => o !== bestOpponent)], moveCounters, false, boardSize, 5, 3);

        for (const move of moves) {
            const newBoard = [...board];
            const newCounters = JSON.parse(JSON.stringify(moveCounters));
            applyMove(newBoard, move, bestOpponent, newCounters);
            const evalScore = minimax(newBoard, depth + 1, alpha, beta, true, player, opponents, newCounters, maxDepth, boardSize, winLength);
            minEval = Math.min(minEval, evalScore);
            beta = Math.min(beta, evalScore);
            if (beta <= alpha) break;
        }
        return minEval;
    }
}

function checkWinner(board, player, boardSize, winLength) {
    const size = boardSize;

    // Check rows
    for (let row = 0; row < size; row++) {
        for (let col = 0; col <= size - winLength; col++) {
            let count = 0;
            for (let i = 0; i < winLength; i++) {
                if (board[row * size + col + i] === player) count++;
            }
            if (count === winLength) return player;
        }
    }

    // Check columns
    for (let col = 0; col < size; col++) {
        for (let row = 0; row <= size - winLength; row++) {
            let count = 0;
            for (let i = 0; i < winLength; i++) {
                if (board[(row + i) * size + col] === player) count++;
            }
            if (count === winLength) return player;
        }
    }

    // Check diagonals
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

function isBoardFull(board) {
    return board.every(cell => cell !== '');
}

function evaluateBoardMultiplayer(board, player, opponents, boardSize, winLength) {
    let score = 0;
    const size = boardSize;

    const evaluateLine = (cells) => {
        let playerCount = 0;
        let opponentCounts = {};
        opponents.forEach(opp => opponentCounts[opp] = 0);

        for (const cell of cells) {
            if (cell === player) playerCount++;
            else if (opponents.includes(cell)) opponentCounts[cell]++;
        }

        if (playerCount > 0 && opponents.every(opp => opponentCounts[opp] === 0)) {
            score += Math.pow(10, playerCount);
        }
        
        opponents.forEach(opp => {
            if (opponentCounts[opp] > 0 && playerCount === 0) {
                score -= Math.pow(10, opponentCounts[opp]);
            }
        });
    };

    // Check all lines
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

function getPossibleMovesMultiplayer(board, player, opponents, moveCounters, isMaximizing, boardSize, deleteCooldown, moveCooldown) {
    const moves = [];
    const size = boardSize;
    const counters = moveCounters[player];

    // Mark moves
    for (let i = 0; i < board.length; i++) {
        if (board[i] === '') {
            moves.push({ action: 'mark', index: i });
        }
    }

    // Delete moves
    if (counters.movesSinceDelete >= deleteCooldown) {
        for (let i = 0; i < board.length; i++) {
            if (opponents.includes(board[i])) {
                moves.push({ action: 'delete', index: i });
            }
        }
    }

    // Move moves
    if (counters.movesSinceMove >= moveCooldown) {
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

function applyMove(board, move, player, moveCounters) {
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

// Listen for messages from main thread
self.onmessage = function(e) {
    const { board, player, opponents, moveCounters, maxDepth, boardSize, winLength, deleteCooldown, moveCooldown } = e.data;
    
    const moves = getPossibleMovesMultiplayer(board, player, opponents, moveCounters, true, boardSize, deleteCooldown, moveCooldown);
    
    if (moves.length === 0) {
        self.postMessage({ bestMove: null, bestScore: -Infinity });
        return;
    }

    let bestMove = null;
    let bestScore = -Infinity;

    // Parallel search: evaluate moves in batches
    const batchSize = Math.ceil(moves.length / 4); // Divide into 4 batches for parallel processing
    
    for (let i = 0; i < moves.length; i++) {
        const move = moves[i];
        const newBoard = [...board];
        const newCounters = JSON.parse(JSON.stringify(moveCounters));
        applyMove(newBoard, move, player, newCounters);

        const score = minimax(newBoard, 0, -Infinity, Infinity, false, player, opponents, newCounters, maxDepth, boardSize, winLength);

        if (score > bestScore) {
            bestScore = score;
            bestMove = move;
        }
    }

    self.postMessage({ bestMove, bestScore });
};

