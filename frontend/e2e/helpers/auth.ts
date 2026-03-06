import { BrowserContext, Browser, Page } from '@playwright/test';

const API = 'http://127.0.0.1:3001/api';

export interface TestUser {
  id: string;
  email: string;
  token: string;
}

/**
 * Creates a user account via the backend REST API and returns credentials.
 * Faster than driving the signup UI for every test.
 */
export async function createUser(
  email: string,
  password: string,
  name?: string,
): Promise<TestUser> {
  const res = await fetch(`${API}/auth/signup`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password, name }),
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(`createUser failed (${res.status}): ${body.error ?? res.statusText}`);
  }

  const { token, user } = await res.json();
  return { id: user.id, email: user.email, token };
}

/**
 * Injects a JWT into the browser page's localStorage using zustand's persist
 * format so the Next.js app treats the session as authenticated — no need to
 * go through the login UI in every test.
 *
 * Must be called BEFORE the first `page.goto()` so the script runs before
 * React hydrates and reads the store.
 */
export async function injectAuth(page: Page, user: TestUser): Promise<void> {
  await page.context().addInitScript(
    ({ key, value }) => localStorage.setItem(key, value),
    { key: 'foodshi-auth', value: buildAuthStorage(user) },
  );
}

/**
 * Creates a fully configured browser context with:
 *   - Geolocation permission granted
 *   - Mocked GPS coordinates
 *   - User JWT pre-injected into localStorage
 *
 * Use this for multi-context tests (e.g. donor + recipient in the same test).
 */
export async function createAuthedContext(
  browser: Browser,
  user: TestUser,
  coords: { latitude: number; longitude: number },
): Promise<BrowserContext> {
  const ctx = await browser.newContext({
    permissions: ['geolocation'],
    geolocation: coords,
  });

  await ctx.addInitScript(
    ({ key, value }) => localStorage.setItem(key, value),
    { key: 'foodshi-auth', value: buildAuthStorage(user) },
  );

  return ctx;
}

// ── Private ─────────────────────────────────────────────────────────────────

/**
 * Builds the JSON string that zustand's `persist` middleware stores under
 * the `foodshi-auth` localStorage key.
 *
 * Shape mirrors the `partialize` function in `lib/store.ts`.
 */
function buildAuthStorage(user: TestUser): string {
  return JSON.stringify({
    state: {
      token: user.token,
      user: {
        id: user.id,
        email: user.email,
        username: user.email.split('@')[0],
        walletAddress: null,
        karmaPoints: 0,
        avatarUrl: null,
        isVerified: true,
      },
      isAuthenticated: true,
    },
    version: 0,
  });
}
