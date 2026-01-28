import { Router } from 'express';
import { z } from 'zod';
import { query, queryOne } from '../db';
import { authenticate } from '../middleware/auth';
import { AppError } from '../middleware/errorHandler';

const router = Router();

const createReportSchema = z.object({
  reportedUserId: z.string().uuid().optional(),
  reportedPostId: z.string().uuid().optional(),
  reportedDonationId: z.string().uuid().optional(),
  reason: z.string().min(10).max(1000),
}).refine(
  (data) => data.reportedUserId || data.reportedPostId || data.reportedDonationId,
  { message: 'Must provide at least one of: reportedUserId, reportedPostId, or reportedDonationId' }
);

// POST /reports - Create report
router.post('/', authenticate, async (req, res, next) => {
  try {
    const { reportedUserId, reportedPostId, reportedDonationId, reason } = createReportSchema.parse(req.body);

    // Prevent self-reporting
    if (reportedUserId === req.user!.id) {
      throw new AppError('Cannot report yourself', 400);
    }

    // Verify reported entity exists
    if (reportedUserId) {
      const user = await queryOne('SELECT id FROM users WHERE id = $1', [reportedUserId]);
      if (!user) {
        throw new AppError('Reported user not found', 404);
      }
    }

    if (reportedPostId) {
      const post = await queryOne('SELECT id, user_id FROM posts WHERE id = $1', [reportedPostId]);
      if (!post) {
        throw new AppError('Reported post not found', 404);
      }
    }

    if (reportedDonationId) {
      const donation = await queryOne('SELECT id FROM donations WHERE id = $1', [reportedDonationId]);
      if (!donation) {
        throw new AppError('Reported donation not found', 404);
      }
    }

    // Check for duplicate reports
    const existingReport = await queryOne(
      `SELECT id FROM reports
       WHERE reporter_id = $1
         AND (reported_user_id = $2 OR ($2 IS NULL AND reported_user_id IS NULL))
         AND (reported_post_id = $3 OR ($3 IS NULL AND reported_post_id IS NULL))
         AND (reported_donation_id = $4 OR ($4 IS NULL AND reported_donation_id IS NULL))
         AND status = 'pending'`,
      [req.user!.id, reportedUserId, reportedPostId, reportedDonationId]
    );

    if (existingReport) {
      throw new AppError('You have already reported this', 400);
    }

    const result = await query(
      `INSERT INTO reports (reporter_id, reported_user_id, reported_post_id, reported_donation_id, reason)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id, status, created_at`,
      [req.user!.id, reportedUserId, reportedPostId, reportedDonationId, reason]
    );

    res.status(201).json({
      report: result[0],
      message: 'Report submitted successfully. Our team will review it.',
    });
  } catch (error) {
    next(error);
  }
});

// GET /reports - Get user's reports (admin only in production)
router.get('/', authenticate, async (req, res, next) => {
  try {
    const { status, limit = '20', offset = '0' } = req.query;

    let whereClause = 'reporter_id = $1';
    const params: any[] = [req.user!.id];
    let paramIndex = 2;

    if (status) {
      whereClause += ` AND status = $${paramIndex++}`;
      params.push(status);
    }

    params.push(parseInt(limit as string), parseInt(offset as string));

    const reports = await query(
      `SELECT r.id, r.reason, r.status, r.created_at, r.resolved_at,
              ru.id as reported_user_id, ru.name as reported_user_name,
              rp.id as reported_post_id, rp.content as reported_post_content
       FROM reports r
       LEFT JOIN users ru ON r.reported_user_id = ru.id
       LEFT JOIN posts rp ON r.reported_post_id = rp.id
       WHERE ${whereClause}
       ORDER BY r.created_at DESC
       LIMIT $${paramIndex++} OFFSET $${paramIndex}`,
      params
    );

    res.json({ reports });
  } catch (error) {
    next(error);
  }
});

export default router;
