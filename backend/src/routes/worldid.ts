import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { queryOne } from '../db/index';
import { verifyJWT } from '../middleware/auth';

const router = Router();

router.use(verifyJWT);

const VerifyBody = z.object({
  merkle_root: z.string(),
  nullifier_hash: z.string(),
  proof: z.string(),
  verification_level: z.string().optional(),
});

/**
 * POST /api/worldid/verify
 * Accepts a World ID proof, verifies it via the cloud API,
 * and marks the user as verified.
 */
router.post('/verify', async (req: Request, res: Response): Promise<void> => {
  const parsed = VerifyBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.errors[0].message });
    return;
  }

  const userId = req.user!.userId;
  const { merkle_root, nullifier_hash, proof, verification_level } = parsed.data;

  // Check if user is already verified
  const user = await queryOne<{ is_verified_donor: boolean }>(
    'SELECT is_verified_donor FROM users WHERE id = $1',
    [userId]
  );
  if (user?.is_verified_donor) {
    res.status(409).json({ error: 'Already verified with World ID' });
    return;
  }

  // Verify proof with World ID cloud API
  const appId = process.env.WORLDID_APP_ID;
  const action = process.env.WORLDID_ACTION || 'verify-donor';

  if (!appId) {
    res.status(500).json({ error: 'World ID not configured' });
    return;
  }

  let verifyRes: globalThis.Response;
  try {
    verifyRes = await fetch(
      `https://developer.worldcoin.org/api/v2/verify/${appId}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          merkle_root,
          nullifier_hash,
          proof,
          action,
          ...(verification_level ? { verification_level } : {}),
        }),
      }
    );
  } catch {
    res.status(502).json({ error: 'Failed to reach World ID verification service' });
    return;
  }

  if (!verifyRes.ok) {
    const body = await verifyRes.json().catch(() => ({}));
    res.status(400).json({
      error: (body as Record<string, string>).detail ?? 'World ID verification failed',
    });
    return;
  }

  // Store nullifier hash and mark as verified.
  // UNIQUE constraint on worldid_nullifier_hash prevents the same person
  // from verifying multiple accounts (sybil prevention).
  try {
    await queryOne(
      `UPDATE users
       SET is_verified_donor = TRUE,
           worldid_nullifier_hash = $2,
           worldid_verified_at = NOW()
       WHERE id = $1
       RETURNING id`,
      [userId, nullifier_hash]
    );
  } catch (err: unknown) {
    const pgErr = err as { code?: string };
    if (pgErr.code === '23505') {
      res.status(409).json({ error: 'This World ID is already linked to another account' });
      return;
    }
    throw err;
  }

  res.json({ verified: true });
});

/**
 * GET /api/worldid/status
 * Returns the current World ID verification status for the authenticated user.
 */
router.get('/status', async (req: Request, res: Response): Promise<void> => {
  const userId = req.user!.userId;

  const user = await queryOne<{
    is_verified_donor: boolean;
    worldid_verified_at: Date | null;
  }>(
    'SELECT is_verified_donor, worldid_verified_at FROM users WHERE id = $1',
    [userId]
  );

  res.json({
    verified: user?.is_verified_donor ?? false,
    verifiedAt: user?.worldid_verified_at ?? null,
  });
});

export default router;
