import { Router, Request, Response, NextFunction } from 'express';
import { timingSafeEqual } from 'crypto';
import { query, queryOne } from '../db/index';

const router = Router();

// Bearer token auth middleware for internal routes
function requireInternalKey(req: Request, res: Response, next: NextFunction): void {
  const apiKey = process.env.INTERNAL_API_KEY;
  const authHeader = req.headers.authorization;

  if (!apiKey) {
    res.status(500).json({ error: 'Internal API key not configured' });
    return;
  }

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Missing Authorization header' });
    return;
  }

  const token = authHeader.slice('Bearer '.length);
  // Use constant-time comparison to prevent timing attacks
  const tokenBuf  = Buffer.from(token,  'utf8');
  const apiKeyBuf = Buffer.from(apiKey, 'utf8');
  const invalid =
    tokenBuf.length !== apiKeyBuf.length ||
    !timingSafeEqual(tokenBuf, apiKeyBuf);
  if (invalid) {
    res.status(401).json({ error: 'Invalid API key' });
    return;
  }

  next();
}

router.use(requireInternalKey);

/**
 * GET /api/internal/daily-points?date=YYYY-MM-DD
 * Returns unsynced daily points for users with a wallet address.
 * Called by the Chainlink CRE workflow DON nodes.
 */
router.get('/daily-points', async (req: Request, res: Response): Promise<void> => {
  const { date } = req.query;

  if (!date || typeof date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    res.status(400).json({ error: 'Query param "date" must be in YYYY-MM-DD format' });
    return;
  }

  const rows = await query<{ points: number; wallet_address: string }>(
    `SELECT dp.points, u.wallet_address
     FROM daily_points dp
     JOIN users u ON dp.user_id = u.id
     WHERE dp.day_date = $1
       AND dp.synced_to_chain = false
       AND u.wallet_address IS NOT NULL
       AND u.is_verified_donor = TRUE`,
    [date]
  );

  const users = rows.map((row) => ({
    walletAddress: row.wallet_address,
    points: row.points,
  }));

  res.json({ date, users });
});

/**
 * POST /api/internal/verify-user
 * Marks a user as World ID verified. Used by E2E tests and admin tooling.
 * Body: { userId: string }
 */
router.post('/verify-user', async (req: Request, res: Response): Promise<void> => {
  const { userId } = req.body ?? {};
  if (!userId || typeof userId !== 'string') {
    res.status(400).json({ error: 'Missing userId in request body' });
    return;
  }

  const user = await queryOne(
    `UPDATE users SET is_verified_donor = TRUE, worldid_verified_at = NOW()
     WHERE id = $1 RETURNING id`,
    [userId]
  );

  if (!user) {
    res.status(404).json({ error: 'User not found' });
    return;
  }

  res.json({ verified: true });
});

export default router;
