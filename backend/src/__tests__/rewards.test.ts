import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import express from 'express';
import jwt from 'jsonwebtoken';

vi.mock('../db/index', () => ({
  query:       vi.fn(),
  queryOne:    vi.fn(),
  transaction: vi.fn(),
}));

vi.mock('../services/karma', () => ({
  getKarmaHistory:          vi.fn(),
  getPendingEmissionPoints: vi.fn(),
  recordKarma:              vi.fn(),
}));

import rewardsRouter from '../routes/rewards';
import { query, queryOne, transaction } from '../db/index';
import { getKarmaHistory, getPendingEmissionPoints, recordKarma } from '../services/karma';

const mockQuery       = vi.mocked(query);
const mockQueryOne    = vi.mocked(queryOne);
const mockTransaction = vi.mocked(transaction);
const mockHistory     = vi.mocked(getKarmaHistory);
const mockPending     = vi.mocked(getPendingEmissionPoints);
const mockRecordKarma = vi.mocked(recordKarma);

const JWT_SECRET = 'test-secret';
const USER_ID    = 'user-uuid';

const app = express();
app.use(express.json());
app.use('/api/rewards', rewardsRouter);

function makeToken(userId = USER_ID, email = 'test@example.com') {
  return jwt.sign({ userId, email }, JWT_SECRET);
}

describe('GET /api/rewards/karma', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.JWT_SECRET = JWT_SECRET;
  });

  it('returns 401 without a JWT', async () => {
    const res = await request(app).get('/api/rewards/karma');
    expect(res.status).toBe(401);
  });

  it('returns karma balance, pending points, and history', async () => {
    mockQueryOne.mockResolvedValueOnce({ karma_points: 500 });
    mockPending.mockResolvedValueOnce(120);
    mockHistory.mockResolvedValueOnce([
      { id: 'tx-1', amount: 100, transaction_type: 'donation_given' },
    ]);

    const res = await request(app)
      .get('/api/rewards/karma')
      .set('Authorization', `Bearer ${makeToken()}`);

    expect(res.status).toBe(200);
    expect(res.body.karmaPoints).toBe(500);
    expect(res.body.pendingEmissionPoints).toBe(120);
    expect(res.body.history).toHaveLength(1);
  });

  it('returns 0 for karma when user row is missing', async () => {
    mockQueryOne.mockResolvedValueOnce(null);
    mockPending.mockResolvedValueOnce(0);
    mockHistory.mockResolvedValueOnce([]);

    const res = await request(app)
      .get('/api/rewards/karma')
      .set('Authorization', `Bearer ${makeToken()}`);

    expect(res.status).toBe(200);
    expect(res.body.karmaPoints).toBe(0);
  });
});

describe('GET /api/rewards/medals', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.JWT_SECRET = JWT_SECRET;
  });

  it('returns 401 without a JWT', async () => {
    const res = await request(app).get('/api/rewards/medals');
    expect(res.status).toBe(401);
  });

  it('returns 4 medal tiers', async () => {
    mockQueryOne.mockResolvedValueOnce(null); // no medal progress yet

    const res = await request(app)
      .get('/api/rewards/medals')
      .set('Authorization', `Bearer ${makeToken()}`);

    expect(res.status).toBe(200);
    expect(res.body.tiers).toHaveLength(4);
  });

  it('reports no eligibility when progress is null', async () => {
    mockQueryOne.mockResolvedValueOnce(null);

    const res = await request(app)
      .get('/api/rewards/medals')
      .set('Authorization', `Bearer ${makeToken()}`);

    expect(res.status).toBe(200);
    expect(res.body.tiers.every((t: { eligible: boolean }) => !t.eligible)).toBe(true);
    expect(res.body.totalConfirmedDonations).toBe(0);
    expect(res.body.firstDonationDate).toBeNull();
  });

  it('marks Bronze eligible when user meets time + donation thresholds', async () => {
    const firstDonation = new Date(Date.now() - 31 * 86_400_000); // 31 days ago
    mockQueryOne.mockResolvedValueOnce({
      first_donation_date: firstDonation,
      total_confirmed_donations: 25, // ≥ 20 required
      bronze_earned_at:   null,
      silver_earned_at:   null,
      gold_earned_at:     null,
      platinum_earned_at: null,
    });

    const res = await request(app)
      .get('/api/rewards/medals')
      .set('Authorization', `Bearer ${makeToken()}`);

    expect(res.status).toBe(200);
    const bronze = res.body.tiers.find((t: { name: string }) => t.name === 'Bronze');
    expect(bronze.eligible).toBe(true);
    // Silver+ should not be eligible
    const silver = res.body.tiers.find((t: { name: string }) => t.name === 'Silver');
    expect(silver.eligible).toBe(false);
  });

  it('includes progress counters for each tier', async () => {
    mockQueryOne.mockResolvedValueOnce({
      first_donation_date: new Date(Date.now() - 10 * 86_400_000),
      total_confirmed_donations: 5,
      bronze_earned_at: null, silver_earned_at: null,
      gold_earned_at: null, platinum_earned_at: null,
    });

    const res = await request(app)
      .get('/api/rewards/medals')
      .set('Authorization', `Bearer ${makeToken()}`);

    const bronze = res.body.tiers[0];
    expect(bronze.progress.donations.current).toBe(5);
    expect(bronze.progress.donations.required).toBe(20);
    expect(bronze.progress.days.required).toBe(30);
    expect(bronze.burnCostShare).toBe(50);
  });
});

describe('POST /api/rewards/exchange', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.JWT_SECRET = JWT_SECRET;
  });

  // Helper: mock the requireVerified middleware's queryOne call
  function mockVerified(verified = true) {
    mockQueryOne.mockResolvedValueOnce({ is_verified_donor: verified });
  }

  it('returns 401 without a JWT', async () => {
    const res = await request(app)
      .post('/api/rewards/exchange')
      .send({ karmaAmount: 100 });

    expect(res.status).toBe(401);
  });

  it('returns 403 when user is not World ID verified', async () => {
    mockVerified(false);

    const res = await request(app)
      .post('/api/rewards/exchange')
      .set('Authorization', `Bearer ${makeToken()}`)
      .send({ karmaAmount: 100 });

    expect(res.status).toBe(403);
    expect(res.body.error).toMatch(/verification/i);
  });

  it('returns 400 when karmaAmount is below 100', async () => {
    mockVerified();

    const res = await request(app)
      .post('/api/rewards/exchange')
      .set('Authorization', `Bearer ${makeToken()}`)
      .send({ karmaAmount: 50 });

    expect(res.status).toBe(400);
  });

  it('returns 400 when karmaAmount is missing', async () => {
    mockVerified();

    const res = await request(app)
      .post('/api/rewards/exchange')
      .set('Authorization', `Bearer ${makeToken()}`)
      .send({});

    expect(res.status).toBe(400);
  });

  it('returns 422 when user has no linked wallet', async () => {
    mockVerified();
    mockQueryOne.mockResolvedValueOnce({ karma_points: 500, wallet_address: null });

    const res = await request(app)
      .post('/api/rewards/exchange')
      .set('Authorization', `Bearer ${makeToken()}`)
      .send({ karmaAmount: 100 });

    expect(res.status).toBe(422);
    expect(res.body.error).toMatch(/wallet/i);
  });

  it('returns 422 when user has insufficient karma', async () => {
    mockVerified();
    mockQueryOne.mockResolvedValueOnce({
      karma_points: 50,
      wallet_address: '0x1234567890123456789012345678901234567890',
    });

    const res = await request(app)
      .post('/api/rewards/exchange')
      .set('Authorization', `Bearer ${makeToken()}`)
      .send({ karmaAmount: 100 });

    expect(res.status).toBe(422);
    expect(res.body.error).toMatch(/insufficient/i);
  });

  it('deducts karma and creates an exchange request on success', async () => {
    const wallet = '0x1234567890123456789012345678901234567890';
    const exchangeRow = {
      id: 'req-uuid', karma_amount: 100, token_amount: 10,
      status: 'pending', created_at: new Date().toISOString(),
    };
    mockVerified();
    mockQueryOne.mockResolvedValueOnce({ karma_points: 500, wallet_address: wallet });
    mockTransaction.mockImplementation(async (cb) => {
      const client = {
        query: vi.fn().mockResolvedValue({ rows: [exchangeRow], rowCount: 1 }),
      };
      return cb(client as any);
    });

    const res = await request(app)
      .post('/api/rewards/exchange')
      .set('Authorization', `Bearer ${makeToken()}`)
      .send({ karmaAmount: 100 });

    expect(res.status).toBe(201);
    expect(res.body.exchangeRequest.karma_amount).toBe(100);
    expect(res.body.exchangeRequest.token_amount).toBe(10);
    expect(res.body.instruction).toContain(wallet);
  });

  it('applies the 10:1 exchange rate (100 karma → 10 SHARE)', async () => {
    const wallet = '0xAAAA000000000000000000000000000000000001';
    const exchangeRow = {
      id: 'req-2', karma_amount: 200, token_amount: 20,
      status: 'pending', created_at: new Date().toISOString(),
    };
    mockVerified();
    mockQueryOne.mockResolvedValueOnce({ karma_points: 1000, wallet_address: wallet });
    mockTransaction.mockImplementation(async (cb) => {
      const client = {
        query: vi.fn().mockResolvedValue({ rows: [exchangeRow], rowCount: 1 }),
      };
      return cb(client as any);
    });

    const res = await request(app)
      .post('/api/rewards/exchange')
      .set('Authorization', `Bearer ${makeToken()}`)
      .send({ karmaAmount: 200 });

    expect(res.status).toBe(201);
    expect(res.body.instruction).toContain('20 SHARE');
  });
});
