import { Router } from 'express';
import { z } from 'zod';
import { query, queryOne, transaction } from '../db';
import { authenticate } from '../middleware/auth';
import { AppError } from '../middleware/errorHandler';
import { getKarmaBalance, deductKarmaForExchange, getKarmaHistory } from '../services/karma';
import * as blockchain from '../services/blockchain';
import * as pinata from '../services/pinata';

const router = Router();

const exchangeSchema = z.object({
  karmaAmount: z.number().int().min(100),
});

const mintMedalSchema = z.object({
  tier: z.enum(['bronze', 'silver', 'gold', 'platinum']),
});

const EXCHANGE_RATE = 10; // 10 karma = 1 token

// GET /rewards/karma - Get karma balance
router.get('/karma', authenticate, async (req, res, next) => {
  try {
    const balance = await getKarmaBalance(req.user!.id);

    res.json({ karma: balance });
  } catch (error) {
    next(error);
  }
});

// GET /rewards/karma/history - Get karma history
router.get('/karma/history', authenticate, async (req, res, next) => {
  try {
    const { limit = '50', offset = '0' } = req.query;

    const history = await getKarmaHistory(
      req.user!.id,
      parseInt(limit as string),
      parseInt(offset as string)
    );

    res.json({ history });
  } catch (error) {
    next(error);
  }
});

// POST /rewards/exchange - Exchange karma for $SHARE
router.post('/exchange', authenticate, async (req, res, next) => {
  try {
    const { karmaAmount } = exchangeSchema.parse(req.body);

    if (!req.user!.walletAddress) {
      throw new AppError('Must link wallet first', 400);
    }

    // Check if user is withdrawal eligible (has staked tokens)
    const isEligible = await blockchain.isWithdrawalEligible(req.user!.walletAddress);
    if (!isEligible) {
      throw new AppError('Must stake at least 10 $SHARE to withdraw', 400);
    }

    // Calculate token amount
    const tokenAmount = karmaAmount / EXCHANGE_RATE;

    // Deduct karma
    const success = await deductKarmaForExchange(req.user!.id, karmaAmount);
    if (!success) {
      throw new AppError('Insufficient karma balance', 400);
    }

    // Create exchange request
    const result = await query(
      `INSERT INTO exchange_requests (user_id, karma_amount, token_amount, status)
       VALUES ($1, $2, $3, 'pending')
       RETURNING id, status, created_at`,
      [req.user!.id, karmaAmount, tokenAmount]
    );

    // In production, this would trigger an off-chain process to mint tokens
    // For now, we'll just return the exchange request

    res.json({
      exchange: {
        ...result[0],
        karmaAmount,
        tokenAmount,
      },
      message: 'Exchange request submitted. Tokens will be distributed shortly.',
    });
  } catch (error) {
    next(error);
  }
});

// GET /rewards/tokens - Get token balance
router.get('/tokens', authenticate, async (req, res, next) => {
  try {
    if (!req.user!.walletAddress) {
      return res.json({
        balance: '0',
        transferable: '0',
        walletLinked: false,
      });
    }

    const [balance, transferable, stakeInfo] = await Promise.all([
      blockchain.getTokenBalance(req.user!.walletAddress),
      blockchain.getTransferableBalance(req.user!.walletAddress),
      blockchain.getStakeInfo(req.user!.walletAddress),
    ]);

    res.json({
      balance,
      transferable,
      staked: stakeInfo.amount,
      isSuperDonor: stakeInfo.isSuperDonor,
      unlockTime: stakeInfo.unlockTime,
      walletLinked: true,
    });
  } catch (error) {
    next(error);
  }
});

// GET /rewards/medals - Get medal eligibility
router.get('/medals', authenticate, async (req, res, next) => {
  try {
    // Get user's medal progress
    const progress = await queryOne<{
      first_donation_date: Date;
      total_confirmed_donations: number;
      bronze_earned_at: Date;
      silver_earned_at: Date;
      gold_earned_at: Date;
      platinum_earned_at: Date;
    }>(
      'SELECT * FROM medal_progress WHERE user_id = $1',
      [req.user!.id]
    );

    if (!progress) {
      return res.json({
        progress: null,
        eligibility: {},
        owned: [],
      });
    }

    // Get medal requirements
    const requirements = {
      bronze: { minDays: 30, minDonations: 20, burnCost: '50' },
      silver: { minDays: 90, minDonations: 70, burnCost: '150' },
      gold: { minDays: 180, minDonations: 150, burnCost: '300' },
      platinum: { minDays: 365, minDonations: 320, burnCost: '500' },
    };

    const daysSinceFirst = progress.first_donation_date
      ? Math.floor((Date.now() - new Date(progress.first_donation_date).getTime()) / (1000 * 60 * 60 * 24))
      : 0;

    const eligibility: Record<string, { eligible: boolean; reason?: string }> = {};

    for (const [tier, req] of Object.entries(requirements)) {
      if (progress[`${tier}_earned_at` as keyof typeof progress]) {
        eligibility[tier] = { eligible: false, reason: 'Already owned' };
      } else if (daysSinceFirst < req.minDays) {
        eligibility[tier] = { eligible: false, reason: `Need ${req.minDays - daysSinceFirst} more days` };
      } else if (progress.total_confirmed_donations < req.minDonations) {
        eligibility[tier] = { eligible: false, reason: `Need ${req.minDonations - progress.total_confirmed_donations} more donations` };
      } else {
        eligibility[tier] = { eligible: true };
      }
    }

    const owned = [];
    if (progress.bronze_earned_at) owned.push('bronze');
    if (progress.silver_earned_at) owned.push('silver');
    if (progress.gold_earned_at) owned.push('gold');
    if (progress.platinum_earned_at) owned.push('platinum');

    res.json({
      progress: {
        firstDonationDate: progress.first_donation_date,
        totalConfirmedDonations: progress.total_confirmed_donations,
        daysSinceFirst,
      },
      requirements,
      eligibility,
      owned,
    });
  } catch (error) {
    next(error);
  }
});

// POST /rewards/medals/mint - Mint medal NFT
router.post('/medals/mint', authenticate, async (req, res, next) => {
  try {
    const { tier } = mintMedalSchema.parse(req.body);

    if (!req.user!.walletAddress) {
      throw new AppError('Must link wallet first', 400);
    }

    const progress = await queryOne<{
      first_donation_date: Date;
      total_confirmed_donations: number;
    }>(
      'SELECT first_donation_date, total_confirmed_donations FROM medal_progress WHERE user_id = $1',
      [req.user!.id]
    );

    if (!progress || !progress.first_donation_date) {
      throw new AppError('No donation history found', 400);
    }

    const tierIndex = ['bronze', 'silver', 'gold', 'platinum'].indexOf(tier);
    const firstDonationTimestamp = Math.floor(new Date(progress.first_donation_date).getTime() / 1000);

    // Check eligibility on-chain
    const { canMint, reason } = await blockchain.canMintMedal(
      req.user!.walletAddress,
      tierIndex,
      firstDonationTimestamp,
      progress.total_confirmed_donations
    );

    if (!canMint) {
      throw new AppError(reason || 'Not eligible to mint this medal', 400);
    }

    // Mint the medal
    const { txHash, tokenId } = await blockchain.mintMedal(
      req.user!.walletAddress,
      tierIndex,
      firstDonationTimestamp,
      progress.total_confirmed_donations
    );

    // Update database
    await query(
      `UPDATE medal_progress SET ${tier}_earned_at = CURRENT_TIMESTAMP WHERE user_id = $1`,
      [req.user!.id]
    );

    // Upload metadata to IPFS and set on-chain (async, don't block response)
    const mintedAt = Math.floor(Date.now() / 1000);
    uploadMedalMetadataAsync(
      tokenId,
      tierIndex,
      mintedAt,
      progress.total_confirmed_donations,
      req.user!.walletAddress
    );

    res.json({
      message: `${tier.charAt(0).toUpperCase() + tier.slice(1)} medal minted successfully!`,
      txHash,
      tokenId,
    });
  } catch (error) {
    next(error);
  }
});

// Helper to upload metadata to IPFS and set on-chain
async function uploadMedalMetadataAsync(
  tokenId: number,
  tierIndex: number,
  mintedAt: number,
  donationsAtMint: number,
  ownerAddress: string
): Promise<void> {
  try {
    // Upload metadata to IPFS via Pinata
    const metadataCID = await pinata.uploadMedalMetadata(
      tokenId,
      tierIndex,
      mintedAt,
      donationsAtMint,
      ownerAddress
    );

    const metadataURI = `ipfs://${metadataCID}`;
    console.log(`Medal metadata uploaded: ${metadataURI}`);

    // Set the metadata URI on-chain
    const txHash = await blockchain.setTokenMetadataURI(tokenId, metadataURI);
    console.log(`Medal metadata URI set on-chain: ${txHash}`);
  } catch (error) {
    console.error('Failed to upload medal metadata or set URI:', error);
    // Don't throw - minting succeeded, metadata upload is secondary
  }
}

export default router;
