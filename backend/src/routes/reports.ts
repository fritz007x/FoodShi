import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { query, queryOne } from '../db/index';
import { verifyJWT } from '../middleware/auth';

const router = Router();

router.use(verifyJWT);

const CreateBody = z.object({
  reason: z.string().min(10).max(1000),
  reportedUserId:     z.string().uuid().optional(),
  reportedPostId:     z.string().uuid().optional(),
  reportedDonationId: z.string().uuid().optional(),
}).refine(
  (d) => d.reportedUserId || d.reportedPostId || d.reportedDonationId,
  { message: 'Provide at least one of reportedUserId, reportedPostId, or reportedDonationId' }
);

/**
 * POST /api/reports
 * Submit an abuse report against a user, post, or donation.
 * A reporter cannot report themselves.
 */
router.post('/', async (req: Request, res: Response): Promise<void> => {
  const parsed = CreateBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.errors[0].message });
    return;
  }

  const { reason, reportedUserId, reportedPostId, reportedDonationId } = parsed.data;
  const reporterId = req.user!.userId;

  if (reportedUserId && reportedUserId === reporterId) {
    res.status(400).json({ error: 'You cannot report yourself' });
    return;
  }

  // Verify referenced entities exist
  if (reportedUserId) {
    const u = await queryOne('SELECT id FROM users WHERE id = $1', [reportedUserId]);
    if (!u) { res.status(404).json({ error: 'Reported user not found' }); return; }
  }
  if (reportedPostId) {
    const p = await queryOne('SELECT id FROM posts WHERE id = $1 AND is_deleted = false', [reportedPostId]);
    if (!p) { res.status(404).json({ error: 'Reported post not found' }); return; }
  }
  if (reportedDonationId) {
    const d = await queryOne('SELECT id FROM donations WHERE id = $1', [reportedDonationId]);
    if (!d) { res.status(404).json({ error: 'Reported donation not found' }); return; }
  }

  // Prevent duplicate pending reports from the same reporter against the same target
  const duplicate = await queryOne(
    `SELECT id FROM reports
     WHERE reporter_id = $1
       AND status = 'pending'
       AND (
         ($2::uuid IS NOT NULL AND reported_user_id     = $2)
         OR ($3::uuid IS NOT NULL AND reported_post_id  = $3)
         OR ($4::uuid IS NOT NULL AND reported_donation_id = $4)
       )`,
    [reporterId, reportedUserId ?? null, reportedPostId ?? null, reportedDonationId ?? null]
  );
  if (duplicate) {
    res.status(409).json({ error: 'You already have a pending report for this target' });
    return;
  }

  const [report] = await query(
    `INSERT INTO reports
       (reporter_id, reported_user_id, reported_post_id, reported_donation_id, reason)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING id, status, created_at`,
    [reporterId, reportedUserId ?? null, reportedPostId ?? null, reportedDonationId ?? null, reason]
  );

  res.status(201).json({ report });
});

/**
 * GET /api/reports
 * List reports submitted by the authenticated user.
 */
router.get('/', async (req: Request, res: Response): Promise<void> => {
  const reporterId = req.user!.userId;
  const limit  = Math.min(Number(req.query.limit)  || 20, 100);
  const offset = Number(req.query.offset) || 0;

  const reports = await query(
    `SELECT id, reported_user_id, reported_post_id, reported_donation_id,
            reason, status, created_at, resolved_at
     FROM reports
     WHERE reporter_id = $1
     ORDER BY created_at DESC
     LIMIT $2 OFFSET $3`,
    [reporterId, limit, offset]
  );

  res.json({ reports });
});

/**
 * GET /api/reports/:id
 * Get a single report (reporter can view their own; others get 403).
 */
router.get('/:id', async (req: Request, res: Response): Promise<void> => {
  const userId = req.user!.userId;

  const report = await queryOne<{ reporter_id: string }>(
    'SELECT * FROM reports WHERE id = $1',
    [req.params.id]
  );

  if (!report) {
    res.status(404).json({ error: 'Report not found' });
    return;
  }
  if ((report as any).reporter_id !== userId) {
    res.status(403).json({ error: 'Access denied' });
    return;
  }

  res.json({ report });
});

export default router;
