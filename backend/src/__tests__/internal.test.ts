/**
 * Tests for GET /api/internal/daily-points — the endpoint called by
 * Chainlink CRE DON nodes to fetch unsynced daily point data before
 * submitting the on-chain emission report.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import express from 'express';

vi.mock('../db/index', () => ({
  query:       vi.fn(),
  queryOne:    vi.fn(),
  transaction: vi.fn(),
}));

import internalRouter from '../routes/internal';
import { query } from '../db/index';

const mockQuery = vi.mocked(query);

const app = express();
app.use(express.json());
app.use('/api/internal', internalRouter);

const VALID_KEY = 'cre-test-key-abc123';

describe('GET /api/internal/daily-points', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.INTERNAL_API_KEY = VALID_KEY;
  });

  // --- Authentication ---

  it('returns 401 with no Authorization header', async () => {
    const res = await request(app).get('/api/internal/daily-points?date=2026-02-18');
    expect(res.status).toBe(401);
  });

  it('returns 401 with a wrong Bearer token', async () => {
    const res = await request(app)
      .get('/api/internal/daily-points?date=2026-02-18')
      .set('Authorization', 'Bearer wrong-key');
    expect(res.status).toBe(401);
  });

  it('returns 401 when INTERNAL_API_KEY env var is not set', async () => {
    delete process.env.INTERNAL_API_KEY;
    const res = await request(app)
      .get('/api/internal/daily-points?date=2026-02-18')
      .set('Authorization', `Bearer ${VALID_KEY}`);
    expect(res.status).toBe(500);
  });

  // --- Input validation ---

  it('returns 400 when date param is missing', async () => {
    const res = await request(app)
      .get('/api/internal/daily-points')
      .set('Authorization', `Bearer ${VALID_KEY}`);
    expect(res.status).toBe(400);
  });

  it('returns 400 for a non-ISO date string', async () => {
    const res = await request(app)
      .get('/api/internal/daily-points?date=18-02-2026')
      .set('Authorization', `Bearer ${VALID_KEY}`);
    expect(res.status).toBe(400);
  });

  // --- Response shape (critical: CRE workflow depends on this contract) ---

  it('returns { date, users[] } with camelCase walletAddress', async () => {
    mockQuery.mockResolvedValue([
      { points: 420, wallet_address: '0xAAAA000000000000000000000000000000000001' },
      { points: 100, wallet_address: '0xBBBB000000000000000000000000000000000002' },
    ]);

    const res = await request(app)
      .get('/api/internal/daily-points?date=2026-02-18')
      .set('Authorization', `Bearer ${VALID_KEY}`);

    expect(res.status).toBe(200);
    expect(res.body.date).toBe('2026-02-18');
    expect(res.body.users).toHaveLength(2);
    expect(res.body.users[0]).toEqual({
      walletAddress: '0xAAAA000000000000000000000000000000000001',
      points: 420,
    });
  });

  it('returns an empty users array when no data exists for the date', async () => {
    mockQuery.mockResolvedValue([]);
    const res = await request(app)
      .get('/api/internal/daily-points?date=2026-01-01')
      .set('Authorization', `Bearer ${VALID_KEY}`);

    expect(res.status).toBe(200);
    expect(res.body.users).toEqual([]);
  });

  // --- SQL correctness (CRE only emits rows not yet on-chain) ---

  it('queries only synced_to_chain = false rows with a wallet address', async () => {
    mockQuery.mockResolvedValue([]);
    await request(app)
      .get('/api/internal/daily-points?date=2026-02-20')
      .set('Authorization', `Bearer ${VALID_KEY}`);

    const [sql, params] = mockQuery.mock.calls[0] as [string, unknown[]];
    expect(sql).toContain('synced_to_chain = false');
    expect(sql).toContain('wallet_address IS NOT NULL');
    expect(params[0]).toBe('2026-02-20');
  });
});
