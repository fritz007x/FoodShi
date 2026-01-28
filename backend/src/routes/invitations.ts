import { Router } from 'express';
import { z } from 'zod';
import { v4 as uuidv4 } from 'uuid';
import { query, queryOne } from '../db';
import { authenticate } from '../middleware/auth';
import { AppError } from '../middleware/errorHandler';

const router = Router();

const sendInvitationSchema = z.object({
  email: z.string().email(),
});

function generateInviteCode(): string {
  return uuidv4().slice(0, 8).toUpperCase();
}

// POST /invitations - Send invitation
router.post('/', authenticate, async (req, res, next) => {
  try {
    const { email } = sendInvitationSchema.parse(req.body);

    // Check if user already exists
    const existingUser = await queryOne('SELECT id FROM users WHERE email = $1', [email]);
    if (existingUser) {
      throw new AppError('User with this email already exists', 400);
    }

    // Check for existing pending invitation
    const existingInvite = await queryOne(
      `SELECT id FROM invitations
       WHERE email = $1 AND inviter_id = $2 AND status = 'pending'`,
      [email, req.user!.id]
    );

    if (existingInvite) {
      throw new AppError('Invitation already sent to this email', 400);
    }

    const inviteCode = generateInviteCode();

    const result = await query(
      `INSERT INTO invitations (inviter_id, email, invite_code)
       VALUES ($1, $2, $3)
       RETURNING id, email, invite_code, status, created_at`,
      [req.user!.id, email, inviteCode]
    );

    // In production, send email with invite link
    // For now, return the invite code

    res.status(201).json({
      invitation: result[0],
      inviteUrl: `${process.env.FRONTEND_URL}/signup?invite=${inviteCode}`,
      message: 'Invitation sent successfully',
    });
  } catch (error) {
    next(error);
  }
});

// GET /invitations - Get user's sent invitations
router.get('/', authenticate, async (req, res, next) => {
  try {
    const { status, limit = '20', offset = '0' } = req.query;

    let whereClause = 'inviter_id = $1';
    const params: any[] = [req.user!.id];
    let paramIndex = 2;

    if (status) {
      whereClause += ` AND status = $${paramIndex++}`;
      params.push(status);
    }

    params.push(parseInt(limit as string), parseInt(offset as string));

    const invitations = await query(
      `SELECT id, email, invite_code, status, created_at, accepted_at
       FROM invitations
       WHERE ${whereClause}
       ORDER BY created_at DESC
       LIMIT $${paramIndex++} OFFSET $${paramIndex}`,
      params
    );

    // Count stats
    const stats = await queryOne<{
      total: string;
      pending: string;
      accepted: string;
    }>(
      `SELECT
         COUNT(*) as total,
         COUNT(*) FILTER (WHERE status = 'pending') as pending,
         COUNT(*) FILTER (WHERE status = 'accepted') as accepted
       FROM invitations
       WHERE inviter_id = $1`,
      [req.user!.id]
    );

    res.json({
      invitations,
      stats: {
        total: parseInt(stats?.total || '0'),
        pending: parseInt(stats?.pending || '0'),
        accepted: parseInt(stats?.accepted || '0'),
      },
    });
  } catch (error) {
    next(error);
  }
});

// GET /invitations/verify/:code - Verify invite code
router.get('/verify/:code', async (req, res, next) => {
  try {
    const { code } = req.params;

    const invitation = await queryOne<{
      id: string;
      email: string;
      status: string;
      inviter_id: string;
    }>(
      `SELECT i.id, i.email, i.status, i.inviter_id, u.name as inviter_name
       FROM invitations i
       JOIN users u ON i.inviter_id = u.id
       WHERE i.invite_code = $1`,
      [code.toUpperCase()]
    );

    if (!invitation) {
      throw new AppError('Invalid invite code', 404);
    }

    if (invitation.status !== 'pending') {
      throw new AppError('This invitation has already been used', 400);
    }

    res.json({
      valid: true,
      email: invitation.email,
      inviterName: (invitation as any).inviter_name,
    });
  } catch (error) {
    next(error);
  }
});

// DELETE /invitations/:id - Cancel invitation
router.delete('/:id', authenticate, async (req, res, next) => {
  try {
    const { id } = req.params;

    const invitation = await queryOne<{ inviter_id: string; status: string }>(
      'SELECT inviter_id, status FROM invitations WHERE id = $1',
      [id]
    );

    if (!invitation) {
      throw new AppError('Invitation not found', 404);
    }

    if (invitation.inviter_id !== req.user!.id) {
      throw new AppError('Not authorized', 403);
    }

    if (invitation.status !== 'pending') {
      throw new AppError('Cannot cancel non-pending invitation', 400);
    }

    await query(
      "UPDATE invitations SET status = 'expired' WHERE id = $1",
      [id]
    );

    res.json({ message: 'Invitation cancelled' });
  } catch (error) {
    next(error);
  }
});

export default router;
