import { beforeAll, afterAll } from 'vitest';
import { spawn, ChildProcess } from 'child_process';
import path from 'path';

let hardhatProcess: ChildProcess | null = null;

// Start Hardhat node before all tests
beforeAll(async () => {
  // Check if hardhat is already running
  try {
    const response = await fetch('http://127.0.0.1:8545', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        method: 'eth_chainId',
        params: [],
        id: 1,
      }),
    });
    if (response.ok) {
      console.log('Hardhat node already running');
      return;
    }
  } catch {
    // Node not running, start it
  }

  console.log('Starting Hardhat node...');
  const contractsDir = path.resolve(__dirname, '../../contracts');

  hardhatProcess = spawn('npx', ['hardhat', 'node'], {
    cwd: contractsDir,
    shell: true,
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  // Wait for node to be ready
  await new Promise<void>((resolve, reject) => {
    const timeout = setTimeout(() => {
      reject(new Error('Hardhat node startup timeout'));
    }, 30000);

    hardhatProcess!.stdout?.on('data', (data: Buffer) => {
      const output = data.toString();
      if (output.includes('Started HTTP and WebSocket JSON-RPC server')) {
        clearTimeout(timeout);
        resolve();
      }
    });

    hardhatProcess!.stderr?.on('data', (data: Buffer) => {
      console.error('Hardhat stderr:', data.toString());
    });

    hardhatProcess!.on('error', (err) => {
      clearTimeout(timeout);
      reject(err);
    });
  });

  console.log('Hardhat node started');
});

// Clean up after all tests
afterAll(async () => {
  if (hardhatProcess) {
    console.log('Stopping Hardhat node...');
    hardhatProcess.kill('SIGTERM');
    hardhatProcess = null;
  }
});
