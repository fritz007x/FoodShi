import cron from 'node-cron';
import { query } from '../db/index';
import { listenForDayFinalized } from '../lib/blockchain';

/**
 * Expire donation listings whose challenge_deadline has passed.
 * Runs every hour.
 */
function scheduleExpiry(): void {
  cron.schedule('0 * * * *', async () => {
    try {
      const result = await query(
        `UPDATE donations
         SET status = 'expired'
         WHERE status = 'pending'
           AND challenge_deadline < NOW()
         RETURNING id`
      );
      if (result.length > 0) {
        console.log(`[scheduler] Expired ${result.length} stale donation listing(s)`);
      }
    } catch (err) {
      console.error('[scheduler] Donation expiry job failed:', err);
    }
  });

  console.log('[scheduler] Donation expiry job scheduled (hourly)');
}

/**
 * Initialise all background jobs and blockchain event listeners.
 *
 * Note: the midnight emission job has been replaced by the Chainlink CRE
 * workflow (cre-workflow/src/workflow.ts). DON nodes independently fetch
 * /api/internal/daily-points, reach consensus, and call
 * EmissionPoolReceiver.onReport() — no centralised cron needed for emission.
 */
export function initScheduler(): void {
  scheduleExpiry();

  // Start listening for on-chain DayFinalized events so daily_points rows
  // get marked synced_to_chain = true after CRE emission confirms.
  listenForDayFinalized();
}
