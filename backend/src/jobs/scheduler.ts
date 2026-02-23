import cron from 'node-cron';
import { query, queryOne } from '../db/index';
import { getDayDistribution, listenForDayFinalized } from '../lib/blockchain';
import { markDaySynced } from '../services/karma';

// ---------------------------------------------------------------------------
// Job: expire stale donation challenges (hourly)
// ---------------------------------------------------------------------------

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

  console.log('[scheduler] Challenge expiry job scheduled (hourly)');
}

// ---------------------------------------------------------------------------
// Job: emission health check (midnight UTC)
//
// The actual emission is handled by the Chainlink CRE DON workflow
// (cre-workflow/src/workflow.ts). DON nodes independently fetch
// /api/internal/daily-points, reach consensus on the payload, and call
// EmissionPoolReceiver.onReport() → EmissionPool.recordPointsBatch() +
// finalizeDay(). This job only monitors whether CRE delivered on time.
// ---------------------------------------------------------------------------

function scheduleEmissionCheck(): void {
  // Run at 00:05 UTC — five minutes after CRE's midnight trigger — to give
  // the DON time to settle the report on-chain before we check.
  cron.schedule('5 0 * * *', async () => {
    const yesterday = Math.floor(Date.now() / 1000 / 86_400) - 1;
    const dateStr   = new Date(yesterday * 86_400 * 1000).toISOString().split('T')[0];

    try {
      const dist = await getDayDistribution(yesterday);

      if (dist.finalized) {
        console.log(
          `[scheduler] Emission check OK — day ${yesterday} (${dateStr}) finalized on-chain ` +
          `(${dist.totalPoints} pts, ${dist.totalDistributed} distributed)`
        );
      } else {
        // CRE may have been delayed or encountered a DON issue.
        // Log a prominent warning; operators should investigate the CRE dashboard.
        console.warn(
          `[scheduler] ⚠️  Emission check FAILED — day ${yesterday} (${dateStr}) is NOT ` +
          `finalized on-chain. Check the Chainlink CRE workflow logs and ` +
          `EmissionPoolReceiver for errors.`
        );
      }
    } catch (err) {
      console.error(`[scheduler] Emission check error for day ${yesterday}:`, err);
    }
  });

  console.log('[scheduler] Emission health-check job scheduled (00:05 UTC daily)');
}

// ---------------------------------------------------------------------------
// Job: sync daily_points with on-chain state (every 6 hours)
//
// Complements the DayFinalized event listener: if the process restarted and
// missed events, this job catches up by querying unsynced past days and
// checking their on-chain finalization status.
// ---------------------------------------------------------------------------

function scheduleSyncJob(): void {
  cron.schedule('0 */6 * * *', async () => {
    try {
      // Find distinct past dates that still have unsynced rows
      const unsyncedDates = await query<{ day_date: string }>(
        `SELECT DISTINCT day_date::text AS day_date
         FROM daily_points
         WHERE synced_to_chain = false
           AND day_date < CURRENT_DATE
         ORDER BY day_date ASC`
      );

      if (unsyncedDates.length === 0) return;

      console.log(`[scheduler] Sync job: checking ${unsyncedDates.length} unsynced date(s)`);

      for (const { day_date } of unsyncedDates) {
        const dayNumber = Math.floor(new Date(day_date).getTime() / 1000 / 86_400);
        try {
          const dist = await getDayDistribution(dayNumber);
          if (dist.finalized) {
            await markDaySynced(day_date);
            console.log(`[scheduler] Sync: marked ${day_date} (day ${dayNumber}) as synced`);
          }
        } catch (err) {
          console.error(`[scheduler] Sync: failed to check day ${dayNumber}:`, err);
        }
      }
    } catch (err) {
      console.error('[scheduler] Sync job failed:', err);
    }
  });

  console.log('[scheduler] Daily-points sync job scheduled (every 6 hours)');
}

// ---------------------------------------------------------------------------
// Bootstrap
// ---------------------------------------------------------------------------

export function initScheduler(): void {
  scheduleExpiry();
  scheduleEmissionCheck();
  scheduleSyncJob();

  // Real-time complement to the sync job: mark synced immediately when the
  // CRE EmissionPoolReceiver.onReport() tx confirms on-chain.
  listenForDayFinalized();
}
