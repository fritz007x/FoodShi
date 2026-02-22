import { PoolClient } from 'pg';
import { query, queryOne, transaction } from '../db/index';

export type KarmaTransactionType =
  | 'donation_given'
  | 'donation_received'
  | 'dispute_lost'
  | 'exchange'
  | 'bonus'
  | 'penalty';

/**
 * Core karma mutation — must be called inside an existing DB transaction.
 *
 * Positive points  → accumulated in daily_points for nightly CRE emission
 *                    + added to users.karma_points
 * Negative points  → subtracted from users.karma_points only (no daily_points
 *                    entry; penalties don't affect the on-chain emission total)
 */
export async function recordKarma(
  client: PoolClient,
  userId: string,
  points: number,
  type: KarmaTransactionType,
  referenceId?: string,
  description?: string
): Promise<void> {
  if (points > 0) {
    const today = new Date().toISOString().split('T')[0];
    // Accumulate in daily_points — the Chainlink CRE workflow reads this
    // table (WHERE synced_to_chain = false) at midnight and emits totals
    // on-chain via EmissionPoolReceiver → EmissionPool.recordPointsBatch()
    await client.query(
      `INSERT INTO daily_points (user_id, day_date, points)
       VALUES ($1, $2, $3)
       ON CONFLICT (user_id, day_date)
       DO UPDATE SET points = daily_points.points + EXCLUDED.points`,
      [userId, today, points]
    );
  }

  // Running karma total (signed — penalties can make it decrease)
  await client.query(
    'UPDATE users SET karma_points = karma_points + $1 WHERE id = $2',
    [points, userId]
  );

  // Immutable audit log
  await client.query(
    `INSERT INTO karma_transactions
       (user_id, amount, transaction_type, reference_id, description)
     VALUES ($1, $2, $3, $4, $5)`,
    [userId, points, type, referenceId ?? null, description ?? null]
  );
}

/**
 * Award karma outside of an existing transaction.
 */
export async function awardKarma(
  userId: string,
  points: number,
  type: KarmaTransactionType,
  referenceId?: string,
  description?: string
): Promise<void> {
  await transaction((client) =>
    recordKarma(client, userId, points, type, referenceId, description)
  );
}

/**
 * Deduct karma as a penalty (stores a negative karma_transactions entry).
 */
export async function deductKarma(
  userId: string,
  points: number,
  type: KarmaTransactionType,
  referenceId?: string,
  description?: string
): Promise<void> {
  await transaction((client) =>
    recordKarma(client, userId, -Math.abs(points), type, referenceId, description)
  );
}

/**
 * Paginated karma transaction history for a user.
 */
export async function getKarmaHistory(
  userId: string,
  limit = 20,
  offset = 0
): Promise<object[]> {
  return query(
    `SELECT id, amount, transaction_type, reference_id, description, created_at
     FROM karma_transactions
     WHERE user_id = $1
     ORDER BY created_at DESC
     LIMIT $2 OFFSET $3`,
    [userId, limit, offset]
  );
}

/**
 * Points earned today that have not yet been synced to the chain.
 * This is what the CRE workflow will include in tonight's emission.
 */
export async function getPendingEmissionPoints(userId: string): Promise<number> {
  const today = new Date().toISOString().split('T')[0];
  const row = await queryOne<{ points: number }>(
    `SELECT points FROM daily_points
     WHERE user_id = $1 AND day_date = $2 AND synced_to_chain = false`,
    [userId, today]
  );
  return row?.points ?? 0;
}

/**
 * Mark all rows for a given date as synced after the CRE emission succeeds.
 * Call this from a webhook or blockchain event listener once the
 * EmissionPoolReceiver.onReport() transaction is confirmed.
 */
export async function markDaySynced(date: string): Promise<void> {
  await query(
    'UPDATE daily_points SET synced_to_chain = true WHERE day_date = $1',
    [date]
  );
}
