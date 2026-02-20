import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { query, queryOne } from '../db/index';
import { verifyJWT, signToken } from '../middleware/auth';

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

  const [user] = await query<{ id: string; email: string }>(
    `INSERT INTO users (email, password_hash, name)
     VALUES ($1, $2, $3)
     RETURNING id, email`,
    [email, passwordHash, name ?? null]
  );

  const token = signToken({ userId: user.id, email: user.email });
  res.status(201).json({ token, user: { id: user.id, email: user.email } });
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

  const user = await queryOne<{ id: string; email: string; password_hash: string | null }>(
    'SELECT id, email, password_hash FROM users WHERE email = $1',
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
  res.json({ token, user: { id: user.id, email: user.email } });
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
