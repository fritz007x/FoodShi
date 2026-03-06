import type { FullConfig } from '@playwright/test';
import { ChildProcess, spawn } from 'child_process';
import path from 'path';

let backendProcess: ChildProcess | null = null;

/**
 * Playwright global setup — runs once before all tests.
 *
 * Starts the Express backend if it is not already listening on :3001.
 * Returns a teardown function that Playwright calls after all tests finish.
 */
export default async function globalSetup(_config: FullConfig): Promise<() => Promise<void>> {
  if (await isReachable('http://127.0.0.1:3001/health')) {
    console.log('[e2e] Backend already running — skipping startup');
  } else {
    await startBackend();
  }

  return async () => {
    if (backendProcess) {
      console.log('[e2e] Stopping backend process');
      backendProcess.kill('SIGTERM');
      backendProcess = null;
    }
  };
}

async function startBackend(): Promise<void> {
  // The backend is at the monorepo root relative to this file:
  //   frontend/e2e/global-setup.ts  →  ../../  (monorepo root)
  const rootDir = path.resolve(__dirname, '../..');

  backendProcess = spawn('npm', ['run', 'backend:dev'], {
    cwd: rootDir,
    shell: true,
    // Inherit env so DATABASE_URL, JWT_SECRET, etc. are available.
    env: { ...process.env, NODE_ENV: 'test' },
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  backendProcess.stdout?.on('data', (chunk: Buffer) => {
    process.stdout.write(`[backend] ${chunk}`);
  });
  backendProcess.stderr?.on('data', (chunk: Buffer) => {
    process.stderr.write(`[backend] ${chunk}`);
  });
  backendProcess.on('error', (err) => {
    console.error('[e2e] Backend process error:', err.message);
  });

  await waitForUrl('http://127.0.0.1:3001/health', 30_000);
  console.log('[e2e] Backend ready');
}

async function isReachable(url: string): Promise<boolean> {
  try {
    const res = await fetch(url);
    return res.ok;
  } catch {
    return false;
  }
}

async function waitForUrl(url: string, timeoutMs: number): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (await isReachable(url)) return;
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error(`[e2e] Timed out after ${timeoutMs}ms waiting for ${url}`);
}
