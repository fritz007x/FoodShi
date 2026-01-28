import { Router } from 'express';
import { z } from 'zod';
import { query, queryOne } from '../db';
import { authenticate, optionalAuth } from '../middleware/auth';
import { AppError } from '../middleware/errorHandler';

const router = Router();

const updateProfileSchema = z.object({
  name: z.string().min(2).max(100).optional(),
  bio: z.string().max(500).optional(),
  profilePic: z.string().url().optional(),
});

// GET /users/:id
router.get('/:id', optionalAuth, async (req, res, next) => {
  try {
    const { id } = req.params;

    const user = await queryOne(
      `SELECT u.id, u.name, u.bio, u.profile_pic, u.karma_points,
              u.is_verified_donor, u.created_at,
              mp.total_confirmed_donations,
              (SELECT COUNT(*) FROM donations WHERE donor_id = u.id AND status = 'confirmed') as donations_given,
              (SELECT COUNT(*) FROM donations WHERE receiver_id = u.id AND status = 'confirmed') as donations_received,
              (SELECT COUNT(*) FROM posts WHERE user_id = u.id AND is_deleted = false) as posts_count
       FROM users u
       LEFT JOIN medal_progress mp ON u.id = mp.user_id
       WHERE u.id = $1`,
      [id]
    );

    if (!user) {
      throw new AppError('User not found', 404);
    }

    // Only include email for own profile
    if (req.user?.id === id) {
      const fullUser = await queryOne('SELECT email, wallet_address, pending_karma FROM users WHERE id = $1', [id]);
      Object.assign(user, fullUser);
    }

    res.json({ user });
  } catch (error) {
    next(error);
  }
});

// PUT /users/me
router.put('/me', authenticate, async (req, res, next) => {
  try {
    const updates = updateProfileSchema.parse(req.body);

    const setClauses: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;

    if (updates.name !== undefined) {
      setClauses.push(`name = $${paramIndex++}`);
      values.push(updates.name);
    }
    if (updates.bio !== undefined) {
      setClauses.push(`bio = $${paramIndex++}`);
      values.push(updates.bio);
    }
    if (updates.profilePic !== undefined) {
      setClauses.push(`profile_pic = $${paramIndex++}`);
      values.push(updates.profilePic);
    }

    if (setClauses.length === 0) {
      throw new AppError('No fields to update', 400);
    }

    values.push(req.user!.id);

    await query(
      `UPDATE users SET ${setClauses.join(', ')} WHERE id = $${paramIndex}`,
      values
    );

    const user = await queryOne(
      'SELECT id, name, bio, profile_pic, email, wallet_address FROM users WHERE id = $1',
      [req.user!.id]
    );

    res.json({ user });
  } catch (error) {
    next(error);
  }
});

// GET /users/leaderboard
router.get('/', async (req, res, next) => {
  try {
    const { type = 'karma', limit = '20', offset = '0' } = req.query;

    let orderBy = 'karma_points DESC';
    if (type === 'donations') {
      orderBy = 'donations_count DESC';
    }

    const users = await query(
      `SELECT u.id, u.name, u.profile_pic, u.karma_points, u.is_verified_donor,
              COALESCE(mp.total_confirmed_donations, 0) as donations_count
       FROM users u
       LEFT JOIN medal_progress mp ON u.id = mp.user_id
       WHERE u.karma_points > 0 OR mp.total_confirmed_donations > 0
       ORDER BY ${orderBy}
       LIMIT $1 OFFSET $2`,
      [parseInt(limit as string), parseInt(offset as string)]
    );

    res.json({ users });
  } catch (error) {
    next(error);
  }
});

// GET /users/:id/donations
router.get('/:id/donations', async (req, res, next) => {
  try {
    const { id } = req.params;
    const { type = 'given', limit = '20', offset = '0' } = req.query;

    const column = type === 'received' ? 'receiver_id' : 'donor_id';

    const donations = await query(
      `SELECT d.id, d.description, d.photo_url, d.status, d.points_awarded,
              d.created_at, d.confirmed_at,
              donor.id as donor_id, donor.name as donor_name, donor.profile_pic as donor_pic,
              receiver.id as receiver_id, receiver.name as receiver_name, receiver.profile_pic as receiver_pic
       FROM donations d
       LEFT JOIN users donor ON d.donor_id = donor.id
       LEFT JOIN users receiver ON d.receiver_id = receiver.id
       WHERE d.${column} = $1 AND d.status != 'cancelled'
       ORDER BY d.created_at DESC
       LIMIT $2 OFFSET $3`,
      [id, parseInt(limit as string), parseInt(offset as string)]
    );

    res.json({ donations });
  } catch (error) {
    next(error);
  }
});

// GET /users/:id/posts
router.get('/:id/posts', async (req, res, next) => {
  try {
    const { id } = req.params;
    const { limit = '20', offset = '0' } = req.query;

    const posts = await query(
      `SELECT p.id, p.content, p.image_url, p.likes_count, p.created_at,
              u.id as user_id, u.name, u.profile_pic
       FROM posts p
       JOIN users u ON p.user_id = u.id
       WHERE p.user_id = $1 AND p.is_deleted = false
       ORDER BY p.created_at DESC
       LIMIT $2 OFFSET $3`,
      [id, parseInt(limit as string), parseInt(offset as string)]
    );

    res.json({ posts });
  } catch (error) {
    next(error);
  }
});

export default router;
