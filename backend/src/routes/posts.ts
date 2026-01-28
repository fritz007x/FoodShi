import { Router } from 'express';
import { z } from 'zod';
import { query, queryOne, transaction } from '../db';
import { authenticate, optionalAuth } from '../middleware/auth';
import { AppError } from '../middleware/errorHandler';

const router = Router();

const createPostSchema = z.object({
  content: z.string().min(1).max(500),
  imageUrl: z.string().url().optional(),
});

// POST /posts - Create post
router.post('/', authenticate, async (req, res, next) => {
  try {
    const { content, imageUrl } = createPostSchema.parse(req.body);

    const result = await query(
      `INSERT INTO posts (user_id, content, image_url)
       VALUES ($1, $2, $3)
       RETURNING id, content, image_url, likes_count, created_at`,
      [req.user!.id, content, imageUrl]
    );

    const post = result[0];

    res.status(201).json({
      post: {
        ...post,
        user: {
          id: req.user!.id,
          name: req.user!.name,
        },
      },
    });
  } catch (error) {
    next(error);
  }
});

// GET /posts - Feed
router.get('/', optionalAuth, async (req, res, next) => {
  try {
    const { limit = '20', offset = '0', userId } = req.query;

    let whereClause = 'p.is_deleted = false';
    const params: any[] = [];
    let paramIndex = 1;

    if (userId) {
      whereClause += ` AND p.user_id = $${paramIndex++}`;
      params.push(userId);
    }

    params.push(parseInt(limit as string), parseInt(offset as string));

    const posts = await query(
      `SELECT p.id, p.content, p.image_url, p.likes_count, p.created_at,
              u.id as user_id, u.name, u.profile_pic, u.is_verified_donor,
              ${req.user ? `EXISTS(SELECT 1 FROM likes WHERE post_id = p.id AND user_id = $${paramIndex + 2}) as is_liked` : 'false as is_liked'}
       FROM posts p
       JOIN users u ON p.user_id = u.id
       WHERE ${whereClause}
       ORDER BY p.created_at DESC
       LIMIT $${paramIndex++} OFFSET $${paramIndex}`,
      req.user ? [...params, req.user.id] : params
    );

    res.json({ posts });
  } catch (error) {
    next(error);
  }
});

// GET /posts/:id
router.get('/:id', optionalAuth, async (req, res, next) => {
  try {
    const { id } = req.params;

    const post = await queryOne(
      `SELECT p.id, p.content, p.image_url, p.likes_count, p.created_at,
              u.id as user_id, u.name, u.profile_pic, u.is_verified_donor,
              ${req.user ? `EXISTS(SELECT 1 FROM likes WHERE post_id = p.id AND user_id = $2) as is_liked` : 'false as is_liked'}
       FROM posts p
       JOIN users u ON p.user_id = u.id
       WHERE p.id = $1 AND p.is_deleted = false`,
      req.user ? [id, req.user.id] : [id]
    );

    if (!post) {
      throw new AppError('Post not found', 404);
    }

    res.json({ post });
  } catch (error) {
    next(error);
  }
});

// DELETE /posts/:id
router.delete('/:id', authenticate, async (req, res, next) => {
  try {
    const { id } = req.params;

    const post = await queryOne<{ user_id: string }>(
      'SELECT user_id FROM posts WHERE id = $1 AND is_deleted = false',
      [id]
    );

    if (!post) {
      throw new AppError('Post not found', 404);
    }

    if (post.user_id !== req.user!.id) {
      throw new AppError('Not authorized', 403);
    }

    await query(
      'UPDATE posts SET is_deleted = true WHERE id = $1',
      [id]
    );

    res.json({ message: 'Post deleted' });
  } catch (error) {
    next(error);
  }
});

// POST /posts/:id/like
router.post('/:id/like', authenticate, async (req, res, next) => {
  try {
    const { id } = req.params;

    const post = await queryOne<{ id: string }>(
      'SELECT id FROM posts WHERE id = $1 AND is_deleted = false',
      [id]
    );

    if (!post) {
      throw new AppError('Post not found', 404);
    }

    // Check if already liked
    const existingLike = await queryOne(
      'SELECT id FROM likes WHERE post_id = $1 AND user_id = $2',
      [id, req.user!.id]
    );

    if (existingLike) {
      // Unlike
      await transaction(async (client) => {
        await client.query(
          'DELETE FROM likes WHERE post_id = $1 AND user_id = $2',
          [id, req.user!.id]
        );
        await client.query(
          'UPDATE posts SET likes_count = GREATEST(0, likes_count - 1) WHERE id = $1',
          [id]
        );
      });

      res.json({ liked: false });
    } else {
      // Like
      await transaction(async (client) => {
        await client.query(
          'INSERT INTO likes (post_id, user_id) VALUES ($1, $2)',
          [id, req.user!.id]
        );
        await client.query(
          'UPDATE posts SET likes_count = likes_count + 1 WHERE id = $1',
          [id]
        );
      });

      res.json({ liked: true });
    }
  } catch (error) {
    next(error);
  }
});

export default router;
