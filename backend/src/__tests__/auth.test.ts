import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import express from 'express';
import jwt from 'jsonwebtoken';

vi.mock('../db/index', () => ({
  query:       vi.fn(),
  queryOne:    vi.fn(),
  transaction: vi.fn(),
}));

vi.mock('../lib/firebase', () => ({
  firebaseAuth: { verifyIdToken: vi.fn() },
}));

import authRouter from '../routes/auth';
import { query, queryOne } from '../db/index';
import { firebaseAuth } from '../lib/firebase';

const mockQuery    = vi.mocked(query);
const mockQueryOne = vi.mocked(queryOne);
const mockVerify   = vi.mocked(firebaseAuth.verifyIdToken);

const JWT_SECRET = 'test-secret';

const app = express();
app.use(express.json());
app.use('/api/auth', authRouter);

function makeToken(userId = 'user-uuid', email = 'test@example.com') {
  return jwt.sign({ userId, email }, JWT_SECRET);
}

describe('POST /api/auth/signup', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.JWT_SECRET = JWT_SECRET;
  });

  it('creates a user and returns a JWT on success', async () => {
    mockQueryOne.mockResolvedValueOnce(null); // no existing user
    mockQuery.mockResolvedValueOnce([{ id: 'user-uuid', email: 'new@example.com' }]);

    const res = await request(app)
      .post('/api/auth/signup')
      .send({ email: 'new@example.com', password: 'securepass' });

    expect(res.status).toBe(201);
    expect(res.body.token).toBeDefined();
    expect(res.body.user.email).toBe('new@example.com');
  });

  it('returns 409 when the email is already registered', async () => {
    mockQueryOne.mockResolvedValueOnce({ id: 'existing' });

    const res = await request(app)
      .post('/api/auth/signup')
      .send({ email: 'taken@example.com', password: 'securepass' });

    expect(res.status).toBe(409);
  });

  it('returns 400 for a password shorter than 8 characters', async () => {
    const res = await request(app)
      .post('/api/auth/signup')
      .send({ email: 'test@example.com', password: 'short' });

    expect(res.status).toBe(400);
  });

  it('returns 400 for a malformed email', async () => {
    const res = await request(app)
      .post('/api/auth/signup')
      .send({ email: 'not-an-email', password: 'securepass' });

    expect(res.status).toBe(400);
  });
});

describe('POST /api/auth/login', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.JWT_SECRET = JWT_SECRET;
  });

  it('returns 401 for an unknown email', async () => {
    mockQueryOne.mockResolvedValueOnce(null);

    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'nobody@example.com', password: 'pass' });

    expect(res.status).toBe(401);
  });

  it('returns 401 when the account has no password (Firebase-only)', async () => {
    mockQueryOne.mockResolvedValueOnce({ id: 'u', email: 'fb@example.com', password_hash: null });

    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'fb@example.com', password: 'any' });

    expect(res.status).toBe(401);
  });
});

describe('POST /api/auth/link-wallet', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.JWT_SECRET = JWT_SECRET;
  });

  it('returns 401 without a JWT', async () => {
    const res = await request(app)
      .post('/api/auth/link-wallet')
      .send({ walletAddress: '0x1234567890123456789012345678901234567890' });

    expect(res.status).toBe(401);
  });

  it('returns 400 for an invalid Ethereum address', async () => {
    const res = await request(app)
      .post('/api/auth/link-wallet')
      .set('Authorization', `Bearer ${makeToken()}`)
      .send({ walletAddress: 'not-an-address' });

    expect(res.status).toBe(400);
  });

  it('links a wallet address and returns it', async () => {
    mockQueryOne.mockResolvedValueOnce(null); // no conflict
    mockQuery.mockResolvedValueOnce([]);      // UPDATE

    const wallet = '0x1234567890123456789012345678901234567890';
    const res = await request(app)
      .post('/api/auth/link-wallet')
      .set('Authorization', `Bearer ${makeToken()}`)
      .send({ walletAddress: wallet });

    expect(res.status).toBe(200);
    expect(res.body.walletAddress).toBe(wallet);
  });

  it('returns 409 when the wallet is already linked to another account', async () => {
    mockQueryOne.mockResolvedValueOnce({ id: 'other-user' }); // conflict

    const res = await request(app)
      .post('/api/auth/link-wallet')
      .set('Authorization', `Bearer ${makeToken()}`)
      .send({ walletAddress: '0x1234567890123456789012345678901234567890' });

    expect(res.status).toBe(409);
  });
});

describe('POST /api/auth/firebase', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.JWT_SECRET = JWT_SECRET;
  });

  it('returns 400 when idToken is missing', async () => {
    const res = await request(app).post('/api/auth/firebase').send({});
    expect(res.status).toBe(400);
  });

  it('returns 401 for an invalid Firebase token', async () => {
    mockVerify.mockRejectedValueOnce(new Error('invalid token'));

    const res = await request(app)
      .post('/api/auth/firebase')
      .send({ idToken: 'bad-token' });

    expect(res.status).toBe(401);
  });

  it('creates a new user and returns a JWT for an unknown Firebase UID', async () => {
    mockVerify.mockResolvedValueOnce({
      uid: 'firebase-uid-1',
      email: 'google@example.com',
      name: 'Test User',
    } as any);
    mockQueryOne
      .mockResolvedValueOnce(null)  // no user by firebase_uid
      .mockResolvedValueOnce(null); // no user by email
    mockQuery.mockResolvedValueOnce([{ id: 'new-uuid', email: 'google@example.com' }]);

    const res = await request(app)
      .post('/api/auth/firebase')
      .send({ idToken: 'valid-firebase-token' });

    expect(res.status).toBe(200);
    expect(res.body.token).toBeDefined();
  });
});
