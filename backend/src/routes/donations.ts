import { Router } from 'express';
import { z } from 'zod';
import { query, queryOne, transaction } from '../db';
import { authenticate } from '../middleware/auth';
import { AppError } from '../middleware/errorHandler';
import { isWithinGeofence, validateCoordinates, GPS_CONFIG } from '../services/gps';
import { addPendingKarma, confirmKarma, cancelKarma, KARMA_CONFIG } from '../services/karma';

const router = Router();

const createDonationSchema = z.object({
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  description: z.string().min(10).max(1000),
  photoUrl: z.string().url().optional(),
});

const confirmDonationSchema = z.object({
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
});

// POST /donations - Create donation
router.post('/', authenticate, async (req, res, next) => {
  try {
    const { latitude, longitude, description, photoUrl } = createDonationSchema.parse(req.body);

    if (!validateCoordinates({ latitude, longitude })) {
      throw new AppError('Invalid coordinates', 400);
    }

    // Calculate challenge deadline (3 days from now)
    const challengeDeadline = new Date();
    challengeDeadline.setDate(challengeDeadline.getDate() + KARMA_CONFIG.CHALLENGE_PERIOD_DAYS);

    const result = await query(
      `INSERT INTO donations (donor_id, latitude, longitude, description, photo_url, challenge_deadline, points_awarded)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING id, status, created_at, challenge_deadline`,
      [req.user!.id, latitude, longitude, description, photoUrl, challengeDeadline, KARMA_CONFIG.POINTS_PER_DONATION]
    );

    const donation = result[0];

    // Add pending karma
    await addPendingKarma(req.user!.id, donation.id, KARMA_CONFIG.POINTS_PER_DONATION);

    res.status(201).json({
      donation: {
        ...donation,
        latitude,
        longitude,
        description,
        photoUrl,
      },
      message: `Donation created. Points will be confirmed after ${KARMA_CONFIG.CHALLENGE_PERIOD_DAYS} days if not disputed.`,
    });
  } catch (error) {
    next(error);
  }
});

// GET /donations - List donations
router.get('/', async (req, res, next) => {
  try {
    const { status, limit = '20', offset = '0', latitude, longitude, radius = '5000' } = req.query;

    let whereClause = "d.status != 'cancelled'";
    const params: any[] = [];
    let paramIndex = 1;

    if (status) {
      whereClause += ` AND d.status = $${paramIndex++}`;
      params.push(status);
    }

    // If location provided, filter by distance (simplified - not using PostGIS)
    let orderBy = 'd.created_at DESC';

    params.push(parseInt(limit as string), parseInt(offset as string));

    const donations = await query(
      `SELECT d.id, d.description, d.photo_url, d.status, d.points_awarded,
              d.latitude, d.longitude, d.created_at, d.challenge_deadline,
              donor.id as donor_id, donor.name as donor_name, donor.profile_pic as donor_pic,
              receiver.id as receiver_id, receiver.name as receiver_name
       FROM donations d
       JOIN users donor ON d.donor_id = donor.id
       LEFT JOIN users receiver ON d.receiver_id = receiver.id
       WHERE ${whereClause}
       ORDER BY ${orderBy}
       LIMIT $${paramIndex++} OFFSET $${paramIndex}`,
      params
    );

    res.json({ donations });
  } catch (error) {
    next(error);
  }
});

// GET /donations/:id
router.get('/:id', async (req, res, next) => {
  try {
    const { id } = req.params;

    const donation = await queryOne(
      `SELECT d.*,
              donor.id as donor_id, donor.name as donor_name, donor.profile_pic as donor_pic,
              receiver.id as receiver_id, receiver.name as receiver_name, receiver.profile_pic as receiver_pic
       FROM donations d
       JOIN users donor ON d.donor_id = donor.id
       LEFT JOIN users receiver ON d.receiver_id = receiver.id
       WHERE d.id = $1`,
      [id]
    );

    if (!donation) {
      throw new AppError('Donation not found', 404);
    }

    res.json({ donation });
  } catch (error) {
    next(error);
  }
});

// POST /donations/:id/confirm - Receiver confirms
router.post('/:id/confirm', authenticate, async (req, res, next) => {
  try {
    const { id } = req.params;
    const { latitude, longitude } = confirmDonationSchema.parse(req.body);

    const donation = await queryOne<{
      id: string;
      donor_id: string;
      receiver_id: string;
      status: string;
      latitude: number;
      longitude: number;
      points_awarded: number;
    }>(
      'SELECT * FROM donations WHERE id = $1',
      [id]
    );

    if (!donation) {
      throw new AppError('Donation not found', 404);
    }

    if (donation.status !== 'pending') {
      throw new AppError('Donation is not pending', 400);
    }

    if (donation.donor_id === req.user!.id) {
      throw new AppError('Cannot confirm your own donation', 400);
    }

    // Check GPS geofence
    const gpsCheck = isWithinGeofence(
      { latitude: donation.latitude, longitude: donation.longitude },
      { latitude, longitude }
    );

    if (!gpsCheck.isValid) {
      throw new AppError(
        `You must be within ${GPS_CONFIG.MAX_DISTANCE_METERS}m of the donation location. Current distance: ${gpsCheck.distance}m`,
        400
      );
    }

    await transaction(async (client) => {
      // Update donation
      await client.query(
        `UPDATE donations SET
           status = 'confirmed',
           receiver_id = $1,
           receiver_latitude = $2,
           receiver_longitude = $3,
           confirmed_at = CURRENT_TIMESTAMP
         WHERE id = $4`,
        [req.user!.id, latitude, longitude, id]
      );

      // Confirm karma for donor
      await confirmKarma(donation.donor_id, id, donation.points_awarded);

      // Give some karma to receiver too
      await client.query(
        'UPDATE users SET karma_points = karma_points + $1 WHERE id = $2',
        [Math.floor(donation.points_awarded / 2), req.user!.id]
      );
    });

    res.json({
      message: 'Donation confirmed',
      distance: gpsCheck.distance,
    });
  } catch (error) {
    next(error);
  }
});

// POST /donations/:id/dispute - Receiver disputes
router.post('/:id/dispute', authenticate, async (req, res, next) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;

    const donation = await queryOne<{
      id: string;
      donor_id: string;
      status: string;
      points_awarded: number;
      challenge_deadline: Date;
    }>(
      'SELECT * FROM donations WHERE id = $1',
      [id]
    );

    if (!donation) {
      throw new AppError('Donation not found', 404);
    }

    if (donation.status !== 'pending') {
      throw new AppError('Donation is not pending', 400);
    }

    if (new Date() > new Date(donation.challenge_deadline)) {
      throw new AppError('Challenge period has expired', 400);
    }

    await transaction(async (client) => {
      // Update donation status
      await client.query(
        "UPDATE donations SET status = 'disputed' WHERE id = $1",
        [id]
      );

      // Cancel karma for donor
      await cancelKarma(donation.donor_id, id, donation.points_awarded);

      // Add fraud strike to donor
      await client.query(
        'UPDATE users SET fraud_strikes = fraud_strikes + 1 WHERE id = $1',
        [donation.donor_id]
      );

      // Create report
      await client.query(
        `INSERT INTO reports (reporter_id, reported_user_id, reported_donation_id, reason)
         VALUES ($1, $2, $3, $4)`,
        [req.user!.id, donation.donor_id, id, reason || 'Donation disputed']
      );
    });

    res.json({ message: 'Donation disputed successfully' });
  } catch (error) {
    next(error);
  }
});

// DELETE /donations/:id - Cancel own donation
router.delete('/:id', authenticate, async (req, res, next) => {
  try {
    const { id } = req.params;

    const donation = await queryOne<{
      id: string;
      donor_id: string;
      status: string;
      points_awarded: number;
    }>(
      'SELECT * FROM donations WHERE id = $1',
      [id]
    );

    if (!donation) {
      throw new AppError('Donation not found', 404);
    }

    if (donation.donor_id !== req.user!.id) {
      throw new AppError('Not authorized', 403);
    }

    if (donation.status !== 'pending') {
      throw new AppError('Can only cancel pending donations', 400);
    }

    await transaction(async (client) => {
      await client.query(
        "UPDATE donations SET status = 'cancelled' WHERE id = $1",
        [id]
      );

      // Remove pending karma
      await client.query(
        'UPDATE users SET pending_karma = GREATEST(0, pending_karma - $1) WHERE id = $2',
        [donation.points_awarded, req.user!.id]
      );
    });

    res.json({ message: 'Donation cancelled' });
  } catch (error) {
    next(error);
  }
});

export default router;
