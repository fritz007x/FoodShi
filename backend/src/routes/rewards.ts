import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { query, queryOne, transaction } from '../db/index';
import { verifyJWT } from '../middleware/auth';
import { requireVerified } from '../middleware/requireVerified';
import { getKarmaHistory, getPendingEmissionPoints, recordKarma } from '../services/karma';

const router = Router();

router.use(verifyJWT);

// Medal tier requirements — mirror MedalNFT.sol constructor values
const MEDAL_TIERS = [
  { name: 'Bronze',   minDays: 30,  minDonations: 20,  burnCost: 50  },
  { name: 'Silver',   minDays: 90,  minDonations: 70,  burnCost: 150 },
  { name: 'Gold',     minDays: 180, minDonations: 150, burnCost: 300 },
  { name: 'Platinum', minDays: 365, minDonations: 320, burnCost: 500 },
] as const;

const ExchangeBody = z.object({
  karmaAmount: z.number().int().min(100),
});

/**
 * GET /api/rewards/karma
 * Karma balance, pending CRE emission points for today, and recent history.
 */
router.get('/karma', async (req: Request, res: Response): Promise<void> => {
  const userId = req.user!.userId;

  const user = await queryOne<{ karma_points: number }>(
    'SELECT karma_points FROM users WHERE id = $1',
    [userId]
  );

  const [pendingPoints, history] = await Promise.all([
    getPendingEmissionPoints(userId),
    getKarmaHistory(userId, 20, 0),
  ]);

  res.json({
    karmaPoints: user?.karma_points ?? 0,
    pendingEmissionPoints: pendingPoints,
    history,
  });
});

/**
 * GET /api/rewards/medals
 * Medal progress and per-tier eligibility (mirrors MedalNFT.sol requirements).
 * The burn cost must be satisfied on-chain when the user calls MedalNFT.mint();
 * this endpoint checks the off-chain preconditions (time elapsed + donation count).
 */
router.get('/medals', async (req: Request, res: Response): Promise<void> => {
  const userId = req.user!.userId;

  const progress = await queryOne<{
    first_donation_date: Date | null;
    total_confirmed_donations: number;
    bronze_earned_at: Date | null;
    silver_earned_at: Date | null;
    gold_earned_at: Date | null;
    platinum_earned_at: Date | null;
  }>(
    `SELECT first_donation_date, total_confirmed_donations,
            bronze_earned_at, silver_earned_at, gold_earned_at, platinum_earned_at
     FROM medal_progress WHERE user_id = $1`,
    [userId]
  );

  const now = Date.now();
  const firstDonationMs = progress?.first_donation_date
    ? new Date(progress.first_donation_date).getTime()
    : null;
  const daysSinceFirst = firstDonationMs
    ? Math.floor((now - firstDonationMs) / 86_400_000)
    : 0;
  const totalDonations = progress?.total_confirmed_donations ?? 0;

  const earnedAtByTier: Record<string, Date | null> = {
    Bronze:   progress?.bronze_earned_at   ?? null,
    Silver:   progress?.silver_earned_at   ?? null,
    Gold:     progress?.gold_earned_at     ?? null,
    Platinum: progress?.platinum_earned_at ?? null,
  };

  const tiers = MEDAL_TIERS.map((tier) => {
    const meetsTime      = daysSinceFirst >= tier.minDays;
    const meetsDonations = totalDonations >= tier.minDonations;
    return {
      name: tier.name,
      minDays: tier.minDays,
      minDonations: tier.minDonations,
      burnCostShare: tier.burnCost,
      earnedAt: earnedAtByTier[tier.name],
      eligible: meetsTime && meetsDonations,
      progress: {
        days: { current: daysSinceFirst, required: tier.minDays },
        donations: { current: totalDonations, required: tier.minDonations },
      },
    };
  });

  res.json({
    firstDonationDate: progress?.first_donation_date ?? null,
    totalConfirmedDonations: totalDonations,
    tiers,
  });
});

/**
 * POST /api/rewards/exchange
 * Initiate a karma-for-token exchange request.
 * Deducts karma from the DB immediately; the user must then call
 * EmissionPool.exchangePoints() from their wallet to receive $SHARE tokens.
 * Requires a linked wallet_address (set via POST /api/auth/link-wallet).
 */
router.post('/exchange', requireVerified, async (req: Request, res: Response): Promise<void> => {
  const parsed = ExchangeBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.errors[0].message });
    return;
  }

  const { karmaAmount } = parsed.data;
  const userId = req.user!.userId;

  const user = await queryOne<{ karma_points: number; wallet_address: string | null }>(
    'SELECT karma_points, wallet_address FROM users WHERE id = $1',
    [userId]
  );

  if (!user?.wallet_address) {
    res.status(422).json({ error: 'Link a wallet address before exchanging karma' });
    return;
  }

  if ((user.karma_points ?? 0) < karmaAmount) {
    res.status(422).json({ error: 'Insufficient karma balance' });
    return;
  }

  // Exchange rate: 10 karma = 1 SHARE (matches EmissionPool.exchangeRate default)
  const EXCHANGE_RATE = 10;
  const tokenAmount = karmaAmount / EXCHANGE_RATE;

  // Deduct karma and record the exchange request atomically so a crash
  // between the two operations cannot leave the user with missing karma
  // and no exchange record (or vice-versa).
  const exchangeRequest = await transaction(async (client) => {
    await recordKarma(
      client, userId, -Math.abs(karmaAmount), 'exchange', undefined,
      `Exchange ${karmaAmount} karma for ${tokenAmount} SHARE`
    );

    const result = await client.query(
      `INSERT INTO exchange_requests (user_id, karma_amount, token_amount, status)
       VALUES ($1, $2, $3, 'pending')
       RETURNING id, karma_amount, token_amount, status, created_at`,
      [userId, karmaAmount, tokenAmount]
    );
    return result.rows[0];
  });

  res.status(201).json({
    exchangeRequest,
    instruction: `Call EmissionPool.exchangePoints(${karmaAmount}) from wallet ${user.wallet_address} to receive ${tokenAmount} SHARE`,
  });
});

export default router;
