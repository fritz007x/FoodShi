import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { query, queryOne } from '../db/index';
import { verifyJWT, signToken } from '../middleware/auth';
import { firebaseAuth } from '../lib/firebase';

const router = Router();

const SignupBody = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  name: z.string().min(1).max(100).optional(),
});

const LoginBody = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

const LinkWalletBody = z.object({
  walletAddress: z.string().regex(/^0x[0-9a-fA-F]{40}$/, 'Invalid Ethereum address'),
});

/**
 * POST /api/auth/signup
 * Create a new account with email + password.
 */
router.post('/signup', async (req: Request, res: Response): Promise<void> => {
  const parsed = SignupBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.errors[0].message });
    return;
  }

  const { email, password, name } = parsed.data;

  const existing = await queryOne('SELECT id FROM users WHERE email = $1', [email]);
  if (existing) {
    res.status(409).json({ error: 'Email already registered' });
    return;
  }

  const passwordHash = await bcrypt.hash(password, 12);

  const [user] = await query<{ id: string; email: string; name: string | null }>(
    `INSERT INTO users (email, password_hash, name)
     VALUES ($1, $2, $3)
     RETURNING id, email, name`,
    [email, passwordHash, name ?? null]
  );

  const token = signToken({ userId: user.id, email: user.email });
  res.status(201).json({ token, user: { id: user.id, email: user.email, name: user.name } });
});

/**
 * POST /api/auth/login
 * Authenticate with email + password, returns JWT.
 */
router.post('/login', async (req: Request, res: Response): Promise<void> => {
  const parsed = LoginBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.errors[0].message });
    return;
  }

  const { email, password } = parsed.data;

  const user = await queryOne<{ id: string; email: string; name: string | null; password_hash: string | null }>(
    'SELECT id, email, name, password_hash FROM users WHERE email = $1',
    [email]
  );

  if (!user || !user.password_hash) {
    res.status(401).json({ error: 'Invalid credentials' });
    return;
  }

  const valid = await bcrypt.compare(password, user.password_hash);
  if (!valid) {
    res.status(401).json({ error: 'Invalid credentials' });
    return;
  }

  const token = signToken({ userId: user.id, email: user.email });
  res.json({ token, user: { id: user.id, email: user.email, name: user.name } });
});

/**
 * POST /api/auth/firebase
 * Verify a Firebase ID token and return an app-level JWT.
 * Creates the user if they don't exist; links firebase_uid if the email
 * is already registered via email/password. Firebase-authed users can
 * subsequently call /link-wallet to register a wallet_address for
 * Chainlink CRE on-chain emission routing.
 */
router.post('/firebase', async (req: Request, res: Response): Promise<void> => {
  const { idToken } = req.body;
  if (!idToken || typeof idToken !== 'string') {
    res.status(400).json({ error: 'idToken is required' });
    return;
  }

  let decoded: import('firebase-admin').auth.DecodedIdToken;
  try {
    decoded = await firebaseAuth.verifyIdToken(idToken);
  } catch {
    res.status(401).json({ error: 'Invalid or expired Firebase token' });
    return;
  }

  const { uid, email, name } = decoded;
  if (!email) {
    res.status(400).json({ error: 'Firebase account has no email address' });
    return;
  }

  // Try to find existing user by firebase_uid first, then by email
  let user = await queryOne<{ id: string; email: string; name: string | null }>(
    'SELECT id, email, name FROM users WHERE firebase_uid = $1',
    [uid]
  );

  if (!user) {
    const byEmail = await queryOne<{ id: string; email: string; name: string | null }>(
      'SELECT id, email, name FROM users WHERE email = $1',
      [email]
    );

    if (byEmail) {
      // Link firebase_uid to an existing email/password account; backfill name if missing
      await query(
        `UPDATE users SET firebase_uid = $1, name = COALESCE(name, $3) WHERE id = $2`,
        [uid, byEmail.id, name ?? null]
      );
      user = { ...byEmail, name: byEmail.name ?? name ?? null };
    } else {
      // New user — create account
      const [created] = await query<{ id: string; email: string; name: string | null }>(
        `INSERT INTO users (email, firebase_uid, name)
         VALUES ($1, $2, $3)
         RETURNING id, email, name`,
        [email, uid, name ?? null]
      );
      user = created;
    }
  }

  const token = signToken({ userId: user.id, email: user.email });
  res.json({ token, user: { id: user.id, email: user.email, name: user.name } });
});

/**
 * POST /api/auth/link-wallet
 * Link an Ethereum wallet address to the authenticated user.
 * This address is used by the Chainlink CRE workflow when emitting points on-chain.
 */
router.post('/link-wallet', verifyJWT, async (req: Request, res: Response): Promise<void> => {
  const parsed = LinkWalletBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.errors[0].message });
    return;
  }

  const { walletAddress } = parsed.data;
  const userId = req.user!.userId;

  // Ensure the wallet isn't already claimed by another user
  const conflict = await queryOne(
    'SELECT id FROM users WHERE wallet_address = $1 AND id != $2',
    [walletAddress, userId]
  );
  if (conflict) {
    res.status(409).json({ error: 'Wallet address already linked to another account' });
    return;
  }

  await query(
    'UPDATE users SET wallet_address = $1 WHERE id = $2',
    [walletAddress, userId]
  );

  res.json({ walletAddress });
});

export default router;
