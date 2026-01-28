import cron from 'node-cron';
import { query, transaction } from '../db';
import { confirmKarma, KARMA_CONFIG } from '../services/karma';
import * as blockchain from '../services/blockchain';

/**
 * Initialize all scheduled jobs
 */
export function initScheduler() {
  console.log('Initializing scheduled jobs...');

  // Daily emission calculation (midnight UTC)
  cron.schedule('0 0 * * *', async () => {
    console.log('Running daily emission job...');
    await runDailyEmission();
  });

  // Challenge period expiration check (every hour)
  cron.schedule('0 * * * *', async () => {
    console.log('Running challenge expiration job...');
    await expireChallenges();
  });

  // Sync daily points to chain (every 6 hours)
  cron.schedule('0 */6 * * *', async () => {
    console.log('Running chain sync job...');
    await syncPointsToChain();
  });

  console.log('Scheduled jobs initialized');
}

/**
 * Daily emission calculation
 * Runs at midnight UTC to finalize previous day's points
 */
async function runDailyEmission() {
  try {
    // Get yesterday's date
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = yesterday.toISOString().split('T')[0];

    // Get all users who earned points yesterday
    const dailyPoints = await query<{
      user_id: string;
      points: number;
      wallet_address: string;
    }>(
      `SELECT dp.user_id, dp.points, u.wallet_address
       FROM daily_points dp
       JOIN users u ON dp.user_id = u.id
       WHERE dp.day_date = $1 AND dp.synced_to_chain = false`,
      [yesterdayStr]
    );

    if (dailyPoints.length === 0) {
      console.log('No points to process for', yesterdayStr);
      return;
    }

    // Calculate total points
    const totalPoints = dailyPoints.reduce((sum, dp) => sum + dp.points, 0);
    const dailyEmission = 1000; // 1000 tokens per day

    console.log(`Processing ${dailyPoints.length} users with ${totalPoints} total points`);

    // Calculate each user's share
    for (const dp of dailyPoints) {
      const userShare = (dp.points / totalPoints) * dailyEmission;
      console.log(`User ${dp.user_id}: ${dp.points} points = ${userShare.toFixed(4)} tokens`);
    }

    // Mark as processed
    await query(
      `UPDATE daily_points SET synced_to_chain = true
       WHERE day_date = $1`,
      [yesterdayStr]
    );

    console.log('Daily emission job completed');
  } catch (error) {
    console.error('Daily emission job failed:', error);
  }
}

/**
 * Expire challenges that have passed their deadline
 * Auto-confirms karma for unchallenged donations
 */
async function expireChallenges() {
  try {
    // Find donations past challenge deadline that are still pending
    const expiredDonations = await query<{
      id: string;
      donor_id: string;
      points_awarded: number;
    }>(
      `SELECT id, donor_id, points_awarded
       FROM donations
       WHERE status = 'pending'
         AND challenge_deadline < CURRENT_TIMESTAMP`,
      []
    );

    console.log(`Found ${expiredDonations.length} expired challenges`);

    for (const donation of expiredDonations) {
      try {
        await transaction(async (client) => {
          // Update donation status to expired (auto-confirmed)
          await client.query(
            `UPDATE donations SET status = 'confirmed', confirmed_at = CURRENT_TIMESTAMP
             WHERE id = $1`,
            [donation.id]
          );

          // Confirm karma for donor
          await confirmKarma(donation.donor_id, donation.id, donation.points_awarded);
        });

        console.log(`Auto-confirmed donation ${donation.id}`);
      } catch (error) {
        console.error(`Failed to process donation ${donation.id}:`, error);
      }
    }

    console.log('Challenge expiration job completed');
  } catch (error) {
    console.error('Challenge expiration job failed:', error);
  }
}

/**
 * Sync daily points to blockchain
 */
async function syncPointsToChain() {
  try {
    // Get unsynced points with wallet addresses
    const unsynced = await query<{
      user_id: string;
      points: number;
      wallet_address: string;
      day_date: string;
    }>(
      `SELECT dp.user_id, dp.points, u.wallet_address, dp.day_date
       FROM daily_points dp
       JOIN users u ON dp.user_id = u.id
       WHERE dp.synced_to_chain = false
         AND u.wallet_address IS NOT NULL
         AND dp.day_date < CURRENT_DATE`,
      []
    );

    if (unsynced.length === 0) {
      console.log('No points to sync to chain');
      return;
    }

    // Group by date and batch record
    const byDate = new Map<string, typeof unsynced>();
    for (const record of unsynced) {
      const existing = byDate.get(record.day_date) || [];
      existing.push(record);
      byDate.set(record.day_date, existing);
    }

    for (const [date, records] of byDate) {
      const users = records.map(r => r.wallet_address);
      const points = records.map(r => r.points);

      try {
        // Record points on chain
        const txHash = await blockchain.recordPointsOnChain(users, points);
        console.log(`Recorded ${records.length} user points for ${date}: ${txHash}`);

        // Mark as synced
        await query(
          `UPDATE daily_points SET synced_to_chain = true
           WHERE user_id = ANY($1) AND day_date = $2`,
          [records.map(r => r.user_id), date]
        );
      } catch (error) {
        console.error(`Failed to sync points for ${date}:`, error);
      }
    }

    console.log('Chain sync job completed');
  } catch (error) {
    console.error('Chain sync job failed:', error);
  }
}

export { runDailyEmission, expireChallenges, syncPointsToChain };
