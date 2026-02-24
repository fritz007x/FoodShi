import { Router, Request, Response } from 'express';
import { randomBytes } from 'crypto';
import { z } from 'zod';
import { query, queryOne, transaction } from '../db/index';
import { verifyJWT } from '../middleware/auth';

const router = Router();

const CreateBody = z.object({
  email: z.string().email(),
});

const AcceptBody = z.object({
  code: z.string().min(1),
});

function generateInviteCode(): string {
  return randomBytes(6).toString('base64url').slice(0, 10).toUpperCase();
}

/**
 * POST /api/invitations
 * Send an invitation to an email address. Generates a unique invite code.
 * (Email delivery is handled out-of-band; the code is returned in the response
 * so it can be forwarded by the caller.)
 */
router.post('/', verifyJWT, async (req: Request, res: Response): Promise<void> => {
  const parsed = CreateBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.errors[0].message });
    return;
  }

  const { email } = parsed.data;
  const inviterId = req.user!.userId;

  // Prevent inviting already-registered emails
  const existing = await queryOne('SELECT id FROM users WHERE email = $1', [email]);
  if (existing) {
    res.status(409).json({ error: 'This email is already registered' });
    return;
  }

  // Prevent duplicate pending invitations to the same address
  const pending = await queryOne(
    `SELECT id FROM invitations WHERE email = $1 AND status = 'pending'`,
    [email]
  );
  if (pending) {
    res.status(409).json({ error: 'A pending invitation already exists for this email' });
    return;
  }

  const code = generateInviteCode();

  const [invitation] = await query(
    `INSERT INTO invitations (inviter_id, email, invite_code)
     VALUES ($1, $2, $3)
     RETURNING id, email, invite_code, status, created_at`,
    [inviterId, email, code]
  );

  res.status(201).json({ invitation });
});

/**
 * GET /api/invitations
 * List invitations sent by the authenticated user.
 */
router.get('/', verifyJWT, async (req: Request, res: Response): Promise<void> => {
  const inviterId = req.user!.userId;

  const invitations = await query(
    `SELECT id, email, invite_code, status, created_at, accepted_at
     FROM invitations
     WHERE inviter_id = $1
     ORDER BY created_at DESC`,
    [inviterId]
  );

  res.json({ invitations });
});

/**
 * GET /api/invitations/:code
 * Check whether an invite code is valid and still pending.
 * Public endpoint — no auth required (used on the signup page).
 */
router.get('/:code', async (req: Request, res: Response): Promise<void> => {
  const invitation = await queryOne<{ id: string; email: string; status: string }>(
    `SELECT id, email, status FROM invitations WHERE invite_code = $1`,
    [req.params.code]
  );

  if (!invitation) {
    res.status(404).json({ error: 'Invitation not found' });
    return;
  }
  if (invitation.status !== 'pending') {
    res.status(409).json({ error: `Invitation is already ${invitation.status}` });
    return;
  }

  res.json({ valid: true, email: invitation.email });
});

/**
 * POST /api/invitations/accept
 * Mark an invitation as accepted. Called after the invitee completes signup.
 * Body: { code }
 */
router.post('/accept', verifyJWT, async (req: Request, res: Response): Promise<void> => {
  const parsed = AcceptBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.errors[0].message });
    return;
  }

  const { code } = parsed.data;
  const userId = req.user!.userId;

  // Run inside a transaction with SELECT FOR UPDATE so that concurrent
  // requests for the same invite code cannot both pass the status check
  // and both mark the invitation as accepted (TOCTOU race).
  const result = await transaction(async (client) => {
    const userRow = await client.query<{ email: string }>(
      'SELECT email FROM users WHERE id = $1',
      [userId]
    );
    const userEmail = userRow.rows[0]?.email;

    // Lock the invitation row for the duration of this transaction
    const invRow = await client.query<{ id: string; email: string; status: string }>(
      `SELECT id, email, status FROM invitations WHERE invite_code = $1 FOR UPDATE`,
      [code]
    );
    const invitation = invRow.rows[0] ?? null;

    if (!invitation) return { status: 404, body: { error: 'Invitation not found' } };
    if (invitation.status !== 'pending') {
      return { status: 409, body: { error: `Invitation is already ${invitation.status}` } };
    }
    if (invitation.email !== userEmail) {
      return { status: 403, body: { error: 'This invitation was not issued to your email address' } };
    }

    await client.query(
      `UPDATE invitations SET status = 'accepted', accepted_at = NOW() WHERE id = $1`,
      [invitation.id]
    );

    return { status: 200, body: { accepted: true } };
  });

  res.status(result.status).json(result.body);
});

export default router;
