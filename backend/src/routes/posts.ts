import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { query, queryOne, transaction } from '../db/index';
import { verifyJWT } from '../middleware/auth';

const router = Router();

router.use(verifyJWT);

const CreateBody = z.object({
  content:  z.string().min(1).max(2000),
  imageUrl: z.string().url().optional(),
});

/**
 * POST /api/posts
 * Publish a new microblog post.
 */
router.post('/', async (req: Request, res: Response): Promise<void> => {
  const parsed = CreateBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.errors[0].message });
    return;
  }

  const { content, imageUrl } = parsed.data;
  const userId = req.user!.userId;

  const [post] = await query(
    `INSERT INTO posts (user_id, content, image_url)
     VALUES ($1, $2, $3)
     RETURNING *`,
    [userId, content, imageUrl ?? null]
  );

  res.status(201).json({ post });
});

/**
 * GET /api/posts
 * Paginated feed. Includes liked_by_me flag for the requesting user.
 */
router.get('/', async (req: Request, res: Response): Promise<void> => {
  const limit  = Math.min(Number(req.query.limit)  || 20, 100);
  const offset = Number(req.query.offset) || 0;
  const userId = req.user!.userId;

  const posts = await query(
    `SELECT p.id, p.content, p.image_url, p.likes_count, p.created_at,
            u.id AS author_id, u.name AS author_name, u.profile_pic AS author_pic,
            EXISTS (
              SELECT 1 FROM likes l
              WHERE l.post_id = p.id AND l.user_id = $1
            ) AS liked_by_me
     FROM posts p
     JOIN users u ON u.id = p.user_id
     WHERE p.is_deleted = false
     ORDER BY p.created_at DESC
     LIMIT $2 OFFSET $3`,
    [userId, limit, offset]
  );

  res.json({ posts });
});

/**
 * GET /api/posts/:id
 * Single post with liked_by_me flag.
 */
router.get('/:id', async (req: Request, res: Response): Promise<void> => {
  const userId = req.user!.userId;

  const post = await queryOne(
    `SELECT p.id, p.content, p.image_url, p.likes_count, p.created_at,
            u.id AS author_id, u.name AS author_name, u.profile_pic AS author_pic,
            EXISTS (
              SELECT 1 FROM likes l
              WHERE l.post_id = p.id AND l.user_id = $1
            ) AS liked_by_me
     FROM posts p
     JOIN users u ON u.id = p.user_id
     WHERE p.id = $2 AND p.is_deleted = false`,
    [userId, req.params.id]
  );

  if (!post) {
    res.status(404).json({ error: 'Post not found' });
    return;
  }

  res.json({ post });
});

/**
 * DELETE /api/posts/:id
 * Soft-delete a post (author only).
 */
router.delete('/:id', async (req: Request, res: Response): Promise<void> => {
  const userId = req.user!.userId;

  const post = await queryOne<{ id: string; user_id: string; is_deleted: boolean }>(
    'SELECT id, user_id, is_deleted FROM posts WHERE id = $1',
    [req.params.id]
  );

  if (!post || post.is_deleted) {
    res.status(404).json({ error: 'Post not found' });
    return;
  }
  if (post.user_id !== userId) {
    res.status(403).json({ error: 'You can only delete your own posts' });
    return;
  }

  await query('UPDATE posts SET is_deleted = true WHERE id = $1', [post.id]);

  res.status(204).send();
});

/**
 * POST /api/posts/:id/like
 * Like a post. Idempotent — returns 200 if already liked.
 */
router.post('/:id/like', async (req: Request, res: Response): Promise<void> => {
  const userId = req.user!.userId;
  const postId = req.params.id;

  const post = await queryOne<{ id: string }>(
    'SELECT id FROM posts WHERE id = $1 AND is_deleted = false',
    [postId]
  );
  if (!post) {
    res.status(404).json({ error: 'Post not found' });
    return;
  }

  await transaction(async (client) => {
    // ON CONFLICT DO NOTHING keeps this idempotent
    const result = await client.query(
      'INSERT INTO likes (post_id, user_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
      [postId, userId]
    );
    if (result.rowCount && result.rowCount > 0) {
      await client.query(
        'UPDATE posts SET likes_count = likes_count + 1 WHERE id = $1',
        [postId]
      );
    }
  });

  res.json({ liked: true });
});

/**
 * DELETE /api/posts/:id/like
 * Remove a like.
 */
router.delete('/:id/like', async (req: Request, res: Response): Promise<void> => {
  const userId = req.user!.userId;
  const postId = req.params.id;

  await transaction(async (client) => {
    const result = await client.query(
      'DELETE FROM likes WHERE post_id = $1 AND user_id = $2',
      [postId, userId]
    );
    if (result.rowCount && result.rowCount > 0) {
      await client.query(
        'UPDATE posts SET likes_count = GREATEST(likes_count - 1, 0) WHERE id = $1',
        [postId]
      );
    }
  });

  res.json({ liked: false });
});

export default router;
