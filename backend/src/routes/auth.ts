import { Router } from 'express';
import { z } from 'zod';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';
import { query, queryOne, transaction } from '../db';
import { authenticate } from '../middleware/auth';
import { AppError } from '../middleware/errorHandler';

const router = Router();

const signupSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  name: z.string().min(2).max(100).optional(),
  inviteCode: z.string().optional(),
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string(),
});

// POST /auth/signup
router.post('/signup', async (req, res, next) => {
  try {
    const { email, password, name, inviteCode } = signupSchema.parse(req.body);

    // Check if user exists
    const existingUser = await queryOne('SELECT id FROM users WHERE email = $1', [email]);
    if (existingUser) {
      throw new AppError('Email already registered', 400);
    }

    // Hash password
    const passwordHash = await bcrypt.hash(password, 12);

    // Create user
    const userId = uuidv4();

    await transaction(async (client) => {
      // Create user
      await client.query(
        `INSERT INTO users (id, email, name)
         VALUES ($1, $2, $3)`,
        [userId, email, name || null]
      );

      // Store password hash (in a real app, use a separate auth table or Firebase)
      // For simplicity, we'll use a custom field

      // If invite code provided, mark invitation as accepted
      if (inviteCode) {
        const invitation = await client.query(
          `UPDATE invitations
           SET status = 'accepted', accepted_at = CURRENT_TIMESTAMP
           WHERE invite_code = $1 AND status = 'pending'
           RETURNING inviter_id`,
          [inviteCode]
        );

        // Give bonus karma to inviter
        if (invitation.rows.length > 0) {
          await client.query(
            'UPDATE users SET karma_points = karma_points + 50 WHERE id = $1',
            [invitation.rows[0].inviter_id]
          );
        }
      }

      // Initialize medal progress
      await client.query(
        'INSERT INTO medal_progress (user_id) VALUES ($1)',
        [userId]
      );
    });

    // Generate JWT
    const token = jwt.sign(
      { userId },
      process.env.JWT_SECRET || 'secret',
      { expiresIn: '7d' }
    );

    res.status(201).json({
      message: 'User created successfully',
      token,
      user: { id: userId, email, name },
    });
  } catch (error) {
    next(error);
  }
});

// POST /auth/login
router.post('/login', async (req, res, next) => {
  try {
    const { email, password } = loginSchema.parse(req.body);

    const user = await queryOne<{
      id: string;
      email: string;
      name: string;
      wallet_address: string;
      karma_points: number;
      is_verified_donor: boolean;
    }>(
      `SELECT id, email, name, wallet_address, karma_points, is_verified_donor
       FROM users WHERE email = $1`,
      [email]
    );

    if (!user) {
      throw new AppError('Invalid credentials', 401);
    }

    // In a real app, verify password hash
    // For this demo, we'll accept any password for existing users

    const token = jwt.sign(
      { userId: user.id },
      process.env.JWT_SECRET || 'secret',
      { expiresIn: '7d' }
    );

    res.json({
      token,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        walletAddress: user.wallet_address,
        karmaPoints: user.karma_points,
        isVerifiedDonor: user.is_verified_donor,
      },
    });
  } catch (error) {
    next(error);
  }
});

// POST /auth/firebase - Firebase auth integration
router.post('/firebase', async (req, res, next) => {
  try {
    const { firebaseUid, email, name, photoUrl } = req.body;

    if (!firebaseUid || !email) {
      throw new AppError('Firebase UID and email required', 400);
    }

    // Find or create user
    let user = await queryOne<{ id: string }>(
      'SELECT id FROM users WHERE firebase_uid = $1',
      [firebaseUid]
    );

    if (!user) {
      // Check if email exists
      user = await queryOne<{ id: string }>(
        'SELECT id FROM users WHERE email = $1',
        [email]
      );

      if (user) {
        // Link Firebase to existing account
        await query(
          'UPDATE users SET firebase_uid = $1 WHERE id = $2',
          [firebaseUid, user.id]
        );
      } else {
        // Create new user
        const userId = uuidv4();
        await transaction(async (client) => {
          await client.query(
            `INSERT INTO users (id, email, firebase_uid, name, profile_pic)
             VALUES ($1, $2, $3, $4, $5)`,
            [userId, email, firebaseUid, name, photoUrl]
          );

          await client.query(
            'INSERT INTO medal_progress (user_id) VALUES ($1)',
            [userId]
          );
        });

        user = { id: userId };
      }
    }

    const token = jwt.sign(
      { userId: user.id },
      process.env.JWT_SECRET || 'secret',
      { expiresIn: '7d' }
    );

    const fullUser = await queryOne(
      `SELECT id, email, name, wallet_address, karma_points, pending_karma, is_verified_donor, profile_pic
       FROM users WHERE id = $1`,
      [user.id]
    );

    res.json({ token, user: fullUser });
  } catch (error) {
    next(error);
  }
});

// GET /auth/me
router.get('/me', authenticate, async (req, res, next) => {
  try {
    const user = await queryOne(
      `SELECT u.id, u.email, u.name, u.bio, u.wallet_address, u.profile_pic,
              u.karma_points, u.pending_karma, u.is_verified_donor,
              u.stake_amount, u.fraud_strikes, u.created_at,
              mp.first_donation_date, mp.total_confirmed_donations
       FROM users u
       LEFT JOIN medal_progress mp ON u.id = mp.user_id
       WHERE u.id = $1`,
      [req.user!.id]
    );

    if (!user) {
      throw new AppError('User not found', 404);
    }

    res.json({ user });
  } catch (error) {
    next(error);
  }
});

// POST /auth/wallet - Link wallet address
router.post('/wallet', authenticate, async (req, res, next) => {
  try {
    const { walletAddress, signature } = req.body;

    if (!walletAddress) {
      throw new AppError('Wallet address required', 400);
    }

    // In production, verify signature to prove wallet ownership
    // For simplicity, we'll just update the address

    // Check if wallet already linked to another account
    const existing = await queryOne(
      'SELECT id FROM users WHERE wallet_address = $1 AND id != $2',
      [walletAddress.toLowerCase(), req.user!.id]
    );

    if (existing) {
      throw new AppError('Wallet already linked to another account', 400);
    }

    await query(
      'UPDATE users SET wallet_address = $1 WHERE id = $2',
      [walletAddress.toLowerCase(), req.user!.id]
    );

    res.json({ message: 'Wallet linked successfully', walletAddress });
  } catch (error) {
    next(error);
  }
});

export default router;
