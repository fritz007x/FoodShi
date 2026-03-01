import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { query, queryOne } from '../db/index';
import { verifyJWT } from '../middleware/auth';

const router = Router();

router.use(verifyJWT);

const UpdateProfileBody = z.object({
  name:       z.string().min(1).max(100).optional(),
  bio:        z.string().max(500).optional(),
  profilePic: z.string().url().optional(),
});

/**
 * GET /api/users/me
 * Own full profile including karma and medal progress.
 */
router.get('/me', async (req: Request, res: Response): Promise<void> => {
  const userId = req.user!.userId;

  const user = await queryOne(
    `SELECT u.id, u.email, u.name, u.bio, u.profile_pic, u.wallet_address,
            u.karma_points, u.is_verified_donor, u.stake_amount,
            u.fraud_strikes, u.created_at,
            mp.total_confirmed_donations, mp.first_donation_date,
            mp.bronze_earned_at, mp.silver_earned_at,
            mp.gold_earned_at,  mp.platinum_earned_at
     FROM users u
     LEFT JOIN medal_progress mp ON mp.user_id = u.id
     WHERE u.id = $1`,
    [userId]
  );

  if (!user) {
    res.status(404).json({ error: 'User not found' });
    return;
  }

  res.json({ user });
});

/**
 * PATCH /api/users/me
 * Update own profile (name, bio, profilePic).
 */
router.patch('/me', async (req: Request, res: Response): Promise<void> => {
  const parsed = UpdateProfileBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.errors[0].message });
    return;
  }

  const { name, bio, profilePic } = parsed.data;
  if (!name && !bio && !profilePic) {
    res.status(400).json({ error: 'Provide at least one field to update' });
    return;
  }

  const userId = req.user!.userId;
  const fields: string[] = [];
  const values: unknown[] = [];
  let idx = 1;

  if (name       !== undefined) { fields.push(`name = $${idx++}`);        values.push(name); }
  if (bio        !== undefined) { fields.push(`bio = $${idx++}`);         values.push(bio); }
  if (profilePic !== undefined) { fields.push(`profile_pic = $${idx++}`); values.push(profilePic); }

  values.push(userId);
  const [user] = await query(
    `UPDATE users SET ${fields.join(', ')} WHERE id = $${idx} RETURNING id, name, bio, profile_pic`,
    values
  );

  res.json({ user });
});

/**
 * GET /api/users/leaderboard
 * Top users ranked by karma_points. Must be defined before /:id.
 */
router.get('/leaderboard', async (req: Request, res: Response): Promise<void> => {
  const limit = Math.min(Number(req.query.limit) || 50, 100);

  const users = await query(
    `SELECT u.id, u.name, u.profile_pic, u.karma_points, u.is_verified_donor,
            COALESCE(mp.total_confirmed_donations, 0) AS total_confirmed_donations
     FROM users u
     LEFT JOIN medal_progress mp ON mp.user_id = u.id
     ORDER BY u.karma_points DESC
     LIMIT $1`,
    [limit]
  );

  res.json({ users });
});

/**
 * GET /api/users/:id
 * Public profile — exposes only non-sensitive fields.
 */
router.get('/:id', async (req: Request, res: Response): Promise<void> => {
  const user = await queryOne(
    `SELECT u.id, u.name, u.bio, u.profile_pic, u.karma_points,
            u.is_verified_donor, u.created_at,
            mp.total_confirmed_donations
     FROM users u
     LEFT JOIN medal_progress mp ON mp.user_id = u.id
     WHERE u.id = $1`,
    [req.params.id]
  );

  if (!user) {
    res.status(404).json({ error: 'User not found' });
    return;
  }

  res.json({ user });
});

export default router;
