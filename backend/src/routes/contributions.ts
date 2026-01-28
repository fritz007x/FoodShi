import { Router } from 'express';
import { z } from 'zod';
import Stripe from 'stripe';
import { query, queryOne } from '../db';
import { authenticate } from '../middleware/auth';
import { AppError } from '../middleware/errorHandler';

const router = Router();

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '', {
  apiVersion: '2023-10-16',
});

const fiatContributionSchema = z.object({
  amount: z.number().min(1).max(10000),
  currency: z.enum(['usd', 'eur', 'gbp']).default('usd'),
});

const cryptoContributionSchema = z.object({
  txHash: z.string().regex(/^0x[a-fA-F0-9]{64}$/),
  amount: z.string(),
  currency: z.string().default('MATIC'),
});

// POST /contributions/fiat - Create Stripe payment intent
router.post('/fiat', authenticate, async (req, res, next) => {
  try {
    const { amount, currency } = fiatContributionSchema.parse(req.body);

    // Create Stripe payment intent
    const paymentIntent = await stripe.paymentIntents.create({
      amount: Math.round(amount * 100), // Convert to cents
      currency,
      metadata: {
        userId: req.user!.id,
        type: 'contribution',
      },
    });

    // Create contribution record
    const result = await query(
      `INSERT INTO contributions (user_id, amount, currency, payment_method, payment_id, status)
       VALUES ($1, $2, $3, 'stripe', $4, 'pending')
       RETURNING id`,
      [req.user!.id, amount, currency.toUpperCase(), paymentIntent.id]
    );

    res.json({
      contributionId: result[0].id,
      clientSecret: paymentIntent.client_secret,
    });
  } catch (error) {
    next(error);
  }
});

// POST /contributions/fiat/confirm - Confirm Stripe payment
router.post('/fiat/confirm', authenticate, async (req, res, next) => {
  try {
    const { paymentIntentId } = req.body;

    if (!paymentIntentId) {
      throw new AppError('Payment intent ID required', 400);
    }

    // Verify payment with Stripe
    const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);

    if (paymentIntent.status !== 'succeeded') {
      throw new AppError('Payment not completed', 400);
    }

    // Update contribution status
    await query(
      `UPDATE contributions
       SET status = 'completed', completed_at = CURRENT_TIMESTAMP
       WHERE payment_id = $1 AND user_id = $2`,
      [paymentIntentId, req.user!.id]
    );

    // Give bonus karma based on amount
    const bonusKarma = Math.floor(paymentIntent.amount / 100); // 1 karma per dollar
    await query(
      'UPDATE users SET karma_points = karma_points + $1 WHERE id = $2',
      [bonusKarma, req.user!.id]
    );

    res.json({
      message: 'Contribution confirmed',
      bonusKarma,
    });
  } catch (error) {
    next(error);
  }
});

// POST /contributions/crypto - Record crypto contribution
router.post('/crypto', authenticate, async (req, res, next) => {
  try {
    const { txHash, amount, currency } = cryptoContributionSchema.parse(req.body);

    // Check for duplicate
    const existing = await queryOne(
      'SELECT id FROM contributions WHERE tx_hash = $1',
      [txHash]
    );

    if (existing) {
      throw new AppError('Transaction already recorded', 400);
    }

    // Create contribution record
    // In production, verify the transaction on-chain
    const result = await query(
      `INSERT INTO contributions (user_id, amount, currency, payment_method, tx_hash, status)
       VALUES ($1, $2, $3, 'crypto', $4, 'pending')
       RETURNING id, status, created_at`,
      [req.user!.id, parseFloat(amount), currency, txHash]
    );

    res.status(201).json({
      contribution: result[0],
      message: 'Crypto contribution recorded. Will be verified shortly.',
    });
  } catch (error) {
    next(error);
  }
});

// GET /contributions - Get user's contributions
router.get('/', authenticate, async (req, res, next) => {
  try {
    const { limit = '20', offset = '0' } = req.query;

    const contributions = await query(
      `SELECT id, amount, currency, payment_method, status, created_at, completed_at
       FROM contributions
       WHERE user_id = $1
       ORDER BY created_at DESC
       LIMIT $2 OFFSET $3`,
      [req.user!.id, parseInt(limit as string), parseInt(offset as string)]
    );

    const stats = await queryOne<{
      total_fiat: string;
      total_crypto: string;
    }>(
      `SELECT
         COALESCE(SUM(amount) FILTER (WHERE payment_method = 'stripe' AND status = 'completed'), 0) as total_fiat,
         COALESCE(SUM(amount) FILTER (WHERE payment_method = 'crypto' AND status = 'completed'), 0) as total_crypto
       FROM contributions
       WHERE user_id = $1`,
      [req.user!.id]
    );

    res.json({
      contributions,
      stats: {
        totalFiat: parseFloat(stats?.total_fiat || '0'),
        totalCrypto: parseFloat(stats?.total_crypto || '0'),
      },
    });
  } catch (error) {
    next(error);
  }
});

// Stripe webhook handler
router.post('/webhook', async (req, res) => {
  const sig = req.headers['stripe-signature'] as string;
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!webhookSecret) {
    return res.status(500).json({ error: 'Webhook secret not configured' });
  }

  try {
    const event = stripe.webhooks.constructEvent(req.body, sig, webhookSecret);

    if (event.type === 'payment_intent.succeeded') {
      const paymentIntent = event.data.object as Stripe.PaymentIntent;

      await query(
        `UPDATE contributions
         SET status = 'completed', completed_at = CURRENT_TIMESTAMP
         WHERE payment_id = $1`,
        [paymentIntent.id]
      );

      // Give bonus karma
      const userId = paymentIntent.metadata.userId;
      if (userId) {
        const bonusKarma = Math.floor(paymentIntent.amount / 100);
        await query(
          'UPDATE users SET karma_points = karma_points + $1 WHERE id = $2',
          [bonusKarma, userId]
        );
      }
    }

    res.json({ received: true });
  } catch (error: any) {
    console.error('Webhook error:', error.message);
    res.status(400).json({ error: error.message });
  }
});

export default router;
