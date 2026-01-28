import { query, queryOne, transaction } from '../db';
import { PoolClient } from 'pg';

const CHALLENGE_PERIOD_DAYS = 3;
const POINTS_PER_DONATION = 10;
const BONUS_STREAK_POINTS = 5;

interface KarmaTransaction {
  userId: string;
  amount: number;
  transactionType: 'donation_given' | 'donation_received' | 'dispute_lost' | 'exchange' | 'bonus' | 'penalty';
  referenceId?: string;
  description?: string;
}

/**
 * Add pending karma points for a donation
 */
export async function addPendingKarma(
  userId: string,
  donationId: string,
  points: number = POINTS_PER_DONATION
): Promise<void> {
  await transaction(async (client) => {
    // Add to pending karma
    await client.query(
      'UPDATE users SET pending_karma = pending_karma + $1 WHERE id = $2',
      [points, userId]
    );

    // Log transaction
    await logKarmaTransaction(client, {
      userId,
      amount: points,
      transactionType: 'donation_given',
      referenceId: donationId,
      description: 'Pending karma for donation',
    });
  });
}

/**
 * Confirm pending karma after challenge period
 */
export async function confirmKarma(userId: string, donationId: string, points: number): Promise<void> {
  await transaction(async (client) => {
    // Move from pending to confirmed
    await client.query(
      `UPDATE users SET
        karma_points = karma_points + $1,
        pending_karma = pending_karma - $1
       WHERE id = $2 AND pending_karma >= $1`,
      [points, userId]
    );

    // Update daily points for emission pool
    const today = new Date().toISOString().split('T')[0];
    await client.query(
      `INSERT INTO daily_points (user_id, day_date, points)
       VALUES ($1, $2, $3)
       ON CONFLICT (user_id, day_date)
       DO UPDATE SET points = daily_points.points + $3`,
      [userId, today, points]
    );

    // Update medal progress
    await client.query(
      `INSERT INTO medal_progress (user_id, first_donation_date, total_confirmed_donations)
       VALUES ($1, CURRENT_TIMESTAMP, 1)
       ON CONFLICT (user_id)
       DO UPDATE SET
         total_confirmed_donations = medal_progress.total_confirmed_donations + 1,
         first_donation_date = COALESCE(medal_progress.first_donation_date, CURRENT_TIMESTAMP)`,
      [userId]
    );
  });
}

/**
 * Cancel pending karma due to dispute
 */
export async function cancelKarma(userId: string, donationId: string, points: number): Promise<void> {
  await transaction(async (client) => {
    // Remove from pending karma
    await client.query(
      'UPDATE users SET pending_karma = GREATEST(0, pending_karma - $1) WHERE id = $2',
      [points, userId]
    );

    // Log transaction
    await logKarmaTransaction(client, {
      userId,
      amount: -points,
      transactionType: 'dispute_lost',
      referenceId: donationId,
      description: 'Karma cancelled due to dispute',
    });
  });
}

/**
 * Deduct karma for exchange
 */
export async function deductKarmaForExchange(userId: string, amount: number): Promise<boolean> {
  const result = await query(
    `UPDATE users SET karma_points = karma_points - $1
     WHERE id = $2 AND karma_points >= $1
     RETURNING id`,
    [amount, userId]
  );

  return result.length > 0;
}

/**
 * Get user's karma balance
 */
export async function getKarmaBalance(userId: string): Promise<{
  confirmed: number;
  pending: number;
  total: number;
}> {
  const user = await queryOne<{ karma_points: number; pending_karma: number }>(
    'SELECT karma_points, pending_karma FROM users WHERE id = $1',
    [userId]
  );

  if (!user) {
    return { confirmed: 0, pending: 0, total: 0 };
  }

  return {
    confirmed: user.karma_points,
    pending: user.pending_karma,
    total: user.karma_points + user.pending_karma,
  };
}

/**
 * Log karma transaction
 */
async function logKarmaTransaction(client: PoolClient, tx: KarmaTransaction): Promise<void> {
  await client.query(
    `INSERT INTO karma_transactions (user_id, amount, transaction_type, reference_id, description)
     VALUES ($1, $2, $3, $4, $5)`,
    [tx.userId, tx.amount, tx.transactionType, tx.referenceId, tx.description]
  );
}

/**
 * Get karma history for user
 */
export async function getKarmaHistory(
  userId: string,
  limit: number = 50,
  offset: number = 0
): Promise<KarmaTransaction[]> {
  return query(
    `SELECT user_id as "userId", amount, transaction_type as "transactionType",
            reference_id as "referenceId", description, created_at as "createdAt"
     FROM karma_transactions
     WHERE user_id = $1
     ORDER BY created_at DESC
     LIMIT $2 OFFSET $3`,
    [userId, limit, offset]
  );
}

export const KARMA_CONFIG = {
  CHALLENGE_PERIOD_DAYS,
  POINTS_PER_DONATION,
  BONUS_STREAK_POINTS,
};
