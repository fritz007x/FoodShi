import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { query, queryOne, transaction } from '../db/index';
import { verifyJWT } from '../middleware/auth';
import { distanceKm } from '../lib/geo';

const router = Router();

// All donation routes require authentication
router.use(verifyJWT);

/** Maximum distance (km) between donor and receiver to confirm a donation */
const MAX_CONFIRM_DISTANCE_KM = 5;

/** Karma points awarded on confirmation */
const POINTS_DONOR = 100;
const POINTS_RECEIVER = 50;

/** How long a donation listing stays open before expiring */
const CHALLENGE_HOURS = 24;

const CreateBody = z.object({
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  description: z.string().min(1).max(1000),
  photoUrl: z.string().url().optional(),
});

const ConfirmBody = z.object({
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
});

/**
 * Upsert points into daily_points for today and bump users.karma_points.
 * Also logs a karma_transactions entry.
 * Called inside a transaction client.
 */
async function awardPoints(
  client: Parameters<Parameters<typeof transaction>[0]>[0],
  userId: string,
  points: number,
  type: 'donation_given' | 'donation_received',
  referenceId: string
): Promise<void> {
  const today = new Date().toISOString().split('T')[0];

  // Accumulate in daily_points (CRE picks this up at midnight)
  await client.query(
    `INSERT INTO daily_points (user_id, day_date, points)
     VALUES ($1, $2, $3)
     ON CONFLICT (user_id, day_date)
     DO UPDATE SET points = daily_points.points + EXCLUDED.points`,
    [userId, today, points]
  );

  // Running karma total on the user record
  await client.query(
    'UPDATE users SET karma_points = karma_points + $1 WHERE id = $2',
    [points, userId]
  );

  // Audit log
  await client.query(
    `INSERT INTO karma_transactions (user_id, amount, transaction_type, reference_id, description)
     VALUES ($1, $2, $3, $4, $5)`,
    [userId, points, type, referenceId, `${type.replace('_', ' ')} — donation ${referenceId}`]
  );
}

/**
 * POST /api/donations
 * Create a new donation listing.
 */
router.post('/', async (req: Request, res: Response): Promise<void> => {
  const parsed = CreateBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.errors[0].message });
    return;
  }

  const { latitude, longitude, description, photoUrl } = parsed.data;
  const donorId = req.user!.userId;
  const deadline = new Date(Date.now() + CHALLENGE_HOURS * 3600 * 1000);

  const [donation] = await query(
    `INSERT INTO donations (donor_id, latitude, longitude, description, photo_url, challenge_deadline)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING *`,
    [donorId, latitude, longitude, description, photoUrl ?? null, deadline]
  );

  res.status(201).json({ donation });
});

/**
 * GET /api/donations
 * List donations. Optional filters: status, lat+lng+radius (km).
 */
router.get('/', async (req: Request, res: Response): Promise<void> => {
  const status = typeof req.query.status === 'string' ? req.query.status : 'pending';
  const limit = Math.min(Number(req.query.limit) || 20, 100);
  const offset = Number(req.query.offset) || 0;

  const rows = await query(
    `SELECT d.*, u.name AS donor_name
     FROM donations d
     JOIN users u ON d.donor_id = u.id
     WHERE d.status = $1
     ORDER BY d.created_at DESC
     LIMIT $2 OFFSET $3`,
    [status, limit, offset]
  );

  res.json({ donations: rows });
});

/**
 * GET /api/donations/:id
 * Get a single donation by ID.
 */
router.get('/:id', async (req: Request, res: Response): Promise<void> => {
  const donation = await queryOne(
    `SELECT d.*, u.name AS donor_name
     FROM donations d
     JOIN users u ON d.donor_id = u.id
     WHERE d.id = $1`,
    [req.params.id]
  );

  if (!donation) {
    res.status(404).json({ error: 'Donation not found' });
    return;
  }

  res.json({ donation });
});

/**
 * POST /api/donations/:id/confirm
 * Receiver confirms pickup. Geofence check: receiver must be within
 * MAX_CONFIRM_DISTANCE_KM of the donor's listed coordinates.
 * On success, awards karma points to both donor and receiver; those
 * points accumulate in daily_points and are emitted on-chain nightly
 * by the Chainlink CRE workflow.
 */
router.post('/:id/confirm', async (req: Request, res: Response): Promise<void> => {
  const parsed = ConfirmBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.errors[0].message });
    return;
  }

  const { latitude, longitude } = parsed.data;
  const receiverId = req.user!.userId;

  const donation = await queryOne<{
    id: string; donor_id: string; status: string;
    latitude: number; longitude: number; challenge_deadline: Date;
  }>(
    'SELECT id, donor_id, status, latitude, longitude, challenge_deadline FROM donations WHERE id = $1',
    [req.params.id]
  );

  if (!donation) {
    res.status(404).json({ error: 'Donation not found' });
    return;
  }
  if (donation.donor_id === receiverId) {
    res.status(400).json({ error: 'Donor cannot confirm their own donation' });
    return;
  }
  if (donation.status !== 'pending') {
    res.status(409).json({ error: `Donation is already ${donation.status}` });
    return;
  }
  if (new Date() > new Date(donation.challenge_deadline)) {
    res.status(409).json({ error: 'Donation listing has expired' });
    return;
  }

  // Geofence check
  const distance = distanceKm(
    Number(donation.latitude), Number(donation.longitude),
    latitude, longitude
  );
  if (distance > MAX_CONFIRM_DISTANCE_KM) {
    res.status(422).json({
      error: `You must be within ${MAX_CONFIRM_DISTANCE_KM} km of the donation location (currently ${distance.toFixed(2)} km away)`,
    });
    return;
  }

  // Confirm and award points atomically
  const updated = await transaction(async (client) => {
    const [row] = await client.query(
      `UPDATE donations
       SET status = 'confirmed',
           receiver_id = $1,
           receiver_latitude = $2,
           receiver_longitude = $3,
           confirmed_at = NOW(),
           points_awarded = $4
       WHERE id = $5
       RETURNING *`,
      [receiverId, latitude, longitude, POINTS_DONOR, donation.id]
    );

    await awardPoints(client, donation.donor_id, POINTS_DONOR, 'donation_given', donation.id);
    await awardPoints(client, receiverId, POINTS_RECEIVER, 'donation_received', donation.id);

    return row.rows[0];
  });

  res.json({ donation: updated });
});

/**
 * POST /api/donations/:id/dispute
 * Flag a donation as disputed (any authenticated user other than donor).
 */
router.post('/:id/dispute', async (req: Request, res: Response): Promise<void> => {
  const userId = req.user!.userId;

  const donation = await queryOne<{ id: string; donor_id: string; status: string }>(
    'SELECT id, donor_id, status FROM donations WHERE id = $1',
    [req.params.id]
  );

  if (!donation) {
    res.status(404).json({ error: 'Donation not found' });
    return;
  }
  if (donation.donor_id === userId) {
    res.status(400).json({ error: 'Donor cannot dispute their own donation' });
    return;
  }
  if (donation.status !== 'pending' && donation.status !== 'confirmed') {
    res.status(409).json({ error: `Cannot dispute a ${donation.status} donation` });
    return;
  }

  const [updated] = await query(
    `UPDATE donations SET status = 'disputed' WHERE id = $1 RETURNING *`,
    [donation.id]
  );

  res.json({ donation: updated });
});

/**
 * POST /api/donations/:id/cancel
 * Donor cancels a pending donation.
 */
router.post('/:id/cancel', async (req: Request, res: Response): Promise<void> => {
  const userId = req.user!.userId;

  const donation = await queryOne<{ id: string; donor_id: string; status: string }>(
    'SELECT id, donor_id, status FROM donations WHERE id = $1',
    [req.params.id]
  );

  if (!donation) {
    res.status(404).json({ error: 'Donation not found' });
    return;
  }
  if (donation.donor_id !== userId) {
    res.status(403).json({ error: 'Only the donor can cancel this donation' });
    return;
  }
  if (donation.status !== 'pending') {
    res.status(409).json({ error: `Cannot cancel a ${donation.status} donation` });
    return;
  }

  const [updated] = await query(
    `UPDATE donations SET status = 'cancelled' WHERE id = $1 RETURNING *`,
    [donation.id]
  );

  res.json({ donation: updated });
});

export default router;
