# AI Optimization Guide

## Current Performance Issues

The minimax algorithm with alpha-beta pruning is computationally expensive, especially at higher depths. For a 7x7 board with 3+ players, evaluating all possible moves can take several seconds.

## Optimization Options

### 1. JavaScript Web Workers (Parallelism)

**Pros:**
- Runs in separate thread, doesn't block UI
- Can parallelize move evaluation
- No backend required
- Works in browser

**Cons:**
- Message passing overhead
- Limited to browser's thread pool
- Still JavaScript (slower than native code)

**Implementation:**
- See `ai-worker.js` for Web Worker implementation
- Can spawn multiple workers to evaluate different move branches in parallel

### 2. Immediate Optimizations (No Web Workers)

These can be applied right now:

#### a) Move Ordering
Evaluate better moves first to improve alpha-beta pruning:
- Winning moves first
- Blocking opponent wins second
- Center positions prioritized
- Then other moves

#### b) Iterative Deepening
Start with depth 1, then 2, 3... until time limit
- Can return best move found so far if interrupted
- Better move ordering from previous iterations

#### c) Transposition Table
Cache evaluated positions:
- Hash board state
- Store evaluation results
- Reuse for identical positions

#### d) Better Evaluation Function
- Pre-compute line evaluations
- Use bitboards for faster checks
- Optimize win detection

### 3. Python Backend

**Pros:**
- Can use multiprocessing for true parallelism
- NumPy for fast array operations
- Can use C extensions (Cython, Numba)
- Better profiling tools

**Cons:**
- Requires backend server
- Network latency
- More complex architecture

**Example Structure:**
```python
# ai_service.py
from flask import Flask, request, jsonify
from multiprocessing import Pool
import numpy as np

app = Flask(__name__)

def evaluate_move(args):
    board, move, player, opponents, depth = args
    # Minimax evaluation
    return (move, score)

@app.route('/ai/move', methods=['POST'])
def get_move():
    data = request.json
    board = np.array(data['board'])
    moves = generate_moves(board)
    
    # Parallel evaluation
    with Pool() as pool:
        results = pool.map(evaluate_move, [(board, m, ...) for m in moves])
    
    best_move = max(results, key=lambda x: x[1])
    return jsonify(best_move)
```

### 4. C++ Backend (Fastest)

**Pros:**
- Much faster (10-100x JavaScript)
- True multithreading (std::thread, OpenMP)
- Optimized memory access
- Can compile to WebAssembly

**Cons:**
- Requires backend server
- More complex development
- Need to expose API

**Example Structure:**
```cpp
// ai_service.cpp
#include <thread>
#include <vector>
#include <algorithm>

struct Move {
    int index;
    int score;
};

Move evaluateMoveParallel(const Board& board, const Move& move) {
    // Minimax evaluation
    return {move.index, score};
}

std::vector<Move> evaluateMovesParallel(const Board& board, 
                                       const std::vector<Move>& moves) {
    std::vector<std::thread> threads;
    std::vector<Move> results(moves.size());
    
    // Divide moves among threads
    int numThreads = std::thread::hardware_concurrency();
    int movesPerThread = moves.size() / numThreads;
    
    for (int t = 0; t < numThreads; t++) {
        threads.emplace_back([&, t]() {
            int start = t * movesPerThread;
            int end = (t == numThreads - 1) ? moves.size() : start + movesPerThread;
            for (int i = start; i < end; i++) {
                results[i] = evaluateMoveParallel(board, moves[i]);
            }
        });
    }
    
    for (auto& thread : threads) {
        thread.join();
    }
    
    return results;
}
```

### 5. WebAssembly (WASM)

**Pros:**
- Near-native performance
- Runs in browser
- Can compile from C/C++/Rust

**Cons:**
- Still has message passing overhead
- More complex build process

## Recommended Approach

### Short Term (Quick Wins):
1. **Move Ordering** - Easy to implement, significant speedup
2. **Iterative Deepening** - Better user experience
3. **Transposition Table** - Good for repeated positions

### Medium Term:
1. **Web Workers** - Parallel move evaluation
2. **Better Evaluation** - Optimize win checking

### Long Term (If Needed):
1. **Python Backend** - If Web Workers aren't fast enough
2. **C++ Backend** - For maximum performance
3. **WebAssembly** - Best of both worlds (browser + speed)

## Performance Estimates

- **Current JavaScript**: ~2-5 seconds for depth 6 on 7x7 board
- **With Optimizations**: ~0.5-1 second (5x faster)
- **Web Workers**: ~0.3-0.8 seconds (parallel evaluation)
- **Python Backend**: ~0.1-0.3 seconds (with multiprocessing)
- **C++ Backend**: ~0.05-0.15 seconds (with threading)

## Implementation Priority

1. ✅ Move ordering (easiest, good impact)
2. ✅ Iterative deepening (better UX)
3. ⚠️ Transposition table (moderate complexity)
4. ⚠️ Web Workers (moderate complexity)
5. 🔴 Backend service (high complexity, only if needed)

