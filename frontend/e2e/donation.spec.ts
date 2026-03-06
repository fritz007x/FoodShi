import { test, expect } from '@playwright/test';
import { createUser, injectAuth, createAuthedContext, TestUser } from './helpers/auth';
import { createDonation, verifyUser } from './helpers/api';

// ── Shared test coordinates ──────────────────────────────────────────────────
// Both donor and recipient use the same coordinates so the 5 km geofence
// check in POST /donations/:id/confirm always passes.
const COORDS = { latitude: 48.8566, longitude: 2.3522 }; // Paris centre

const PASSWORD = 'TestPass123!';

// Generate a unique email per test run so tests never collide with leftover
// data from a previous run.  Uses both timestamp + random suffix to survive
// fast consecutive reruns where Date.now() could repeat.
function uid(prefix: string): string {
  return `${prefix}+${Date.now()}-${Math.random().toString(36).slice(2, 7)}@e2e.test`;
}

// ── Shared users created once for the whole describe block ───────────────────

let donor: TestUser;
let recipient: TestUser;

test.describe('Donation lifecycle', () => {
  test.beforeAll(async () => {
    donor    = await createUser(uid('donor'),    PASSWORD, 'E2E Donor');
    recipient = await createUser(uid('recipient'), PASSWORD, 'E2E Recipient');
    // Mark both users as World ID verified so donation creation/confirm works
    await verifyUser(donor.token);
    await verifyUser(recipient.token);
  });

  // ── 1. Create a donation via the UI ────────────────────────────────────────

  test('donor can create a donation listing via the UI', async ({ page, context }) => {
    // Mock geolocation before any navigation so the store picks it up.
    await context.setGeolocation(COORDS);

    await injectAuth(page, donor);
    await page.goto('/donate');

    // Enable GPS — the store calls navigator.geolocation.getCurrentPosition
    await page.getByRole('button', { name: /enable gps/i }).click();

    // Coordinates appear once geolocation resolves
    await expect(page.getByText(/48\.85/)).toBeVisible({ timeout: 10_000 });

    await page.getByLabel(/description/i).fill(
      '2 kg of basmati rice, sealed bag — E2E UI test',
    );

    await page.getByRole('button', { name: /list donation/i }).click();

    // On success the app redirects to the detail page
    await expect(page).toHaveURL(/\/donations\/[0-9a-f-]+$/, { timeout: 10_000 });

    await expect(page.getByText('2 kg of basmati rice, sealed bag')).toBeVisible();
    // Status badge shows "pending"
    await expect(page.getByText('pending')).toBeVisible();
  });

  // ── 2. Listing appears on the browse page ──────────────────────────────────

  test('created donation appears in the pending donations list', async ({ page }) => {
    // Create a donation directly via the API — no need to drive the UI again.
    await createDonation(
      donor.token,
      { lat: COORDS.latitude, lng: COORDS.longitude },
      'Canned tomatoes x4 — browse page E2E test',
    );

    await injectAuth(page, donor);
    await page.goto('/donations');

    await expect(
      page.getByText('Canned tomatoes x4 — browse page E2E test').first(),
    ).toBeVisible({ timeout: 10_000 });
  });

  // ── 3. Donor cannot confirm their own donation ─────────────────────────────

  test('donor sees cancel button but not confirm button on their own listing', async ({
    page,
    context,
  }) => {
    const donation = await createDonation(
      donor.token,
      { lat: COORDS.latitude, lng: COORDS.longitude },
      'Pasta 500g — self-confirm guard test',
    );

    await context.setGeolocation(COORDS);
    await injectAuth(page, donor);
    await page.goto(`/donations/${donation.id}`);

    // The "Confirm pickup" button must NOT be rendered for the donor
    await expect(
      page.getByRole('button', { name: /confirm pickup/i }),
    ).not.toBeVisible();

    // The "Cancel donation" button must be visible
    await expect(
      page.getByRole('button', { name: /cancel donation/i }),
    ).toBeVisible();
  });

  // ── 4. Recipient confirms pickup via the UI ────────────────────────────────

  test('recipient can confirm pickup and sees karma awarded banner', async ({ browser }) => {
    // Create a fresh donation via API to avoid depending on test 1's state.
    const donation = await createDonation(
      donor.token,
      { lat: COORDS.latitude, lng: COORDS.longitude },
      'Sourdough loaf — confirm flow E2E test',
    );

    // Open a separate browser context for the recipient so both sessions can
    // coexist without sharing auth state or React Query cache.
    const recipientCtx = await createAuthedContext(browser, recipient, COORDS);
    const recipientPage = await recipientCtx.newPage();

    try {
      await recipientPage.goto(`/donations/${donation.id}`);

      await expect(recipientPage.getByText('Sourdough loaf')).toBeVisible();

      // The confirm button is visible for non-donors
      await expect(
        recipientPage.getByRole('button', { name: /confirm pickup/i }),
      ).toBeVisible();

      await recipientPage.getByRole('button', { name: /confirm pickup/i }).click();

      // The button triggers a geolocation request and then the confirm API call.
      // Use a regex so the assertion matches either the toast notification OR
      // the static confirmation banner rendered by the detail page component.
      await expect(
        recipientPage.getByText('Pickup confirmed!', { exact: true }),
      ).toBeVisible({ timeout: 15_000 });

      // The karma points banner is rendered when the API response includes a
      // non-zero points_awarded value (POINTS_DONOR = 100, always set by the
      // confirm endpoint).
      await expect(
        recipientPage.getByText('karma points awarded to donor.'),
      ).toBeVisible();

      // The status badge should now read "confirmed"
      await expect(recipientPage.locator('span', { hasText: /^confirmed$/i })).toBeVisible();
    } finally {
      await recipientCtx.close();
    }
  });

  // ── 5. Donor cancels a pending donation ────────────────────────────────────

  test('donor can cancel their own pending donation', async ({ page, context }) => {
    const donation = await createDonation(
      donor.token,
      { lat: COORDS.latitude, lng: COORDS.longitude },
      'Orange juice 1L — cancel flow E2E test',
    );

    await context.setGeolocation(COORDS);
    await injectAuth(page, donor);
    await page.goto(`/donations/${donation.id}`);

    await page.getByRole('button', { name: /cancel donation/i }).click();

    // After cancellation the app redirects to the donations list
    await expect(page).toHaveURL('/donations', { timeout: 10_000 });
  });

  // ── 6. Geofence rejection ──────────────────────────────────────────────────

  test('confirm is rejected when recipient is more than 5 km from the donation', async ({
    browser,
  }) => {
    // Donation created at Paris centre (48.8566, 2.3522)
    const donation = await createDonation(
      donor.token,
      { lat: COORDS.latitude, lng: COORDS.longitude },
      'Yoghurt pack — geofence rejection E2E test',
    );

    // Recipient is in London (~340 km away)
    const farCoords = { latitude: 51.5074, longitude: -0.1278 };
    const recipientCtx = await createAuthedContext(browser, recipient, farCoords);
    const recipientPage = await recipientCtx.newPage();

    try {
      await recipientPage.goto(`/donations/${donation.id}`);
      await expect(
        recipientPage.getByRole('button', { name: /confirm pickup/i }),
      ).toBeVisible();

      await recipientPage.getByRole('button', { name: /confirm pickup/i }).click();

      // The backend rejects the request; the toast error must appear
      await expect(
        recipientPage.getByRole('status').getByText(/must be within/i),
      ).toBeVisible({ timeout: 10_000 });

      // Donation remains pending
      await expect(recipientPage.getByText('pending')).toBeVisible();
    } finally {
      await recipientCtx.close();
    }
  });
});

// ── Auth-wall tests (no shared users needed) ─────────────────────────────────

test.describe('Auth wall', () => {
  test('unauthenticated user is redirected away from /donate', async ({ page }) => {
    // No injectAuth — localStorage is empty → isAuthenticated is false
    await page.goto('/donate');

    // The app should redirect to /login or /feed (depends on Layout guard).
    // At minimum, the donation form must not be visible.
    await expect(
      page.getByRole('button', { name: /list donation/i }),
    ).not.toBeVisible({ timeout: 5_000 });
  });
});
