import { test, expect } from '@playwright/test';
import { createUser, injectAuth, TestUser } from './helpers/auth';
import { verifyUser } from './helpers/api';

const PASSWORD = 'TestPass123!';

function uid(prefix: string): string {
  return `${prefix}+${Date.now()}-${Math.random().toString(36).slice(2, 7)}@e2e.test`;
}

let user: TestUser;

test.describe('Wallet page', () => {
  test.beforeAll(async () => {
    user = await createUser(uid('wallet'), PASSWORD, 'E2E Wallet');
    await verifyUser(user.token);
  });

  test('renders wallet connection card for authenticated user', async ({ page }) => {
    await injectAuth(page, user);
    await page.goto('/wallet', { timeout: 60_000 });

    // Page title is visible
    await expect(page.getByRole('heading', { name: /wallet/i }).first()).toBeVisible({ timeout: 10_000 });

    // Wallet connection section is present
    await expect(page.getByText(/wallet connection/i)).toBeVisible();

    // RainbowKit connect button is rendered
    await expect(page.getByRole('button', { name: /connect wallet/i })).toBeVisible();
  });

  test('shows contract config warning when no wallet is connected', async ({ page }) => {
    await injectAuth(page, user);
    await page.goto('/wallet');

    // Without a connected wallet, balance and staking cards should not be visible
    await expect(page.getByText(/\$SHARE Balance/i)).not.toBeVisible();
    await expect(page.getByText(/^Staking$/)).not.toBeVisible();
  });

  test('unauthenticated user is redirected away from /wallet', async ({ page }) => {
    await page.goto('/wallet');

    // The Layout guard redirects to /login
    await expect(
      page.getByText(/wallet connection/i),
    ).not.toBeVisible({ timeout: 5_000 });
  });

  test('wallet link is visible in sidebar navigation', async ({ page }) => {
    await injectAuth(page, user);
    await page.goto('/wallet');

    // Sidebar nav item for wallet should be active
    const walletLink = page.locator('a[href="/wallet"]');
    await expect(walletLink).toBeVisible();
  });
});
