#!/usr/bin/env node

/**
 * Cross-platform script to kill processes running on a specific port
 */

const { exec } = require('child_process');
const { promisify } = require('util');
const execAsync = promisify(exec);

const PORT = process.env.PORT || 3000;

async function killPort(port) {
    const platform = process.platform;
    
    try {
        if (platform === 'win32') {
            // Windows: Find PID using netstat and kill it
            const { stdout } = await execAsync(`netstat -ano | findstr :${port}`);
            const lines = stdout.trim().split('\n');
            const pids = new Set();
            
            for (const line of lines) {
                const parts = line.trim().split(/\s+/);
                if (parts.length > 0) {
                    const pid = parts[parts.length - 1];
                    if (pid && !isNaN(pid)) {
                        pids.add(pid);
                    }
                }
            }
            
            if (pids.size > 0) {
                console.log(`🔪 Killing processes on port ${port}...`);
                for (const pid of pids) {
                    try {
                        await execAsync(`taskkill /F /PID ${pid}`);
                        console.log(`   ✓ Killed process ${pid}`);
                    } catch (err) {
                        // Process might already be dead, ignore
                    }
                }
                // Give it a moment to fully terminate
                await new Promise(resolve => setTimeout(resolve, 500));
            } else {
                console.log(`✓ No processes found on port ${port}`);
            }
        } else {
            // Unix/Linux/Mac: Use lsof or fuser
            try {
                const { stdout } = await execAsync(`lsof -ti:${port}`);
                const pids = stdout.trim().split('\n').filter(pid => pid);
                
                if (pids.length > 0) {
                    console.log(`🔪 Killing processes on port ${port}...`);
                    await execAsync(`kill -9 ${pids.join(' ')}`);
                    pids.forEach(pid => console.log(`   ✓ Killed process ${pid}`));
                    await new Promise(resolve => setTimeout(resolve, 500));
                } else {
                    console.log(`✓ No processes found on port ${port}`);
                }
            } catch (err) {
                // Try fuser as fallback
                try {
                    await execAsync(`fuser -k ${port}/tcp`);
                    console.log(`🔪 Killed processes on port ${port} using fuser`);
                    await new Promise(resolve => setTimeout(resolve, 500));
                } catch (err2) {
                    // No process found or fuser not available
                    console.log(`✓ No processes found on port ${port}`);
                }
            }
        }
    } catch (error) {
        // If netstat/lsof fails, assume no process is running
        console.log(`✓ No processes found on port ${port}`);
    }
}

killPort(PORT).catch(err => {
    console.error('Error killing server:', err.message);
    process.exit(1);
});
