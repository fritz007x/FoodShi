import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import express from 'express';
import jwt from 'jsonwebtoken';

vi.mock('../db/index', () => ({
  query:       vi.fn(),
  queryOne:    vi.fn(),
  transaction: vi.fn(),
}));

vi.mock('../lib/geo', () => ({
  distanceKm: vi.fn(),
}));

vi.mock('../services/karma', () => ({
  recordKarma: vi.fn(),
}));

import donationsRouter from '../routes/donations';
import { query, queryOne, transaction } from '../db/index';
import { distanceKm } from '../lib/geo';

const mockQuery       = vi.mocked(query);
const mockQueryOne    = vi.mocked(queryOne);
const mockTransaction = vi.mocked(transaction);
const mockDistance    = vi.mocked(distanceKm);

const JWT_SECRET = 'test-secret';
const DONOR_ID   = 'donor-uuid';
const OTHER_ID   = 'other-uuid';

const app = express();
app.use(express.json());
app.use('/api/donations', donationsRouter);

function makeToken(userId = DONOR_ID, email = 'test@example.com') {
  return jwt.sign({ userId, email }, JWT_SECRET);
}

/** A minimal donation row as returned from the DB */
function makeDonation(overrides: Record<string, unknown> = {}) {
  return {
    id: 'don-uuid',
    donor_id: DONOR_ID,
    status: 'pending',
    latitude: 48.8566,
    longitude: 2.3522,
    challenge_deadline: new Date(Date.now() + 3_600_000), // 1 h from now
    description: 'Fresh bread',
    ...overrides,
  };
}

describe('POST /api/donations', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.JWT_SECRET = JWT_SECRET;
  });

  it('returns 401 without a JWT', async () => {
    const res = await request(app).post('/api/donations').send({
      latitude: 48.8, longitude: 2.3, description: 'Food',
    });
    expect(res.status).toBe(401);
  });

  it('returns 400 when body is missing required fields', async () => {
    const res = await request(app)
      .post('/api/donations')
      .set('Authorization', `Bearer ${makeToken()}`)
      .send({ latitude: 48.8 }); // missing longitude and description

    expect(res.status).toBe(400);
  });

  it('returns 400 when latitude is out of range', async () => {
    const res = await request(app)
      .post('/api/donations')
      .set('Authorization', `Bearer ${makeToken()}`)
      .send({ latitude: 999, longitude: 2.3, description: 'Food' });

    expect(res.status).toBe(400);
  });

  it('creates a donation and returns 201 on success', async () => {
    const created = makeDonation({ id: 'new-don' });
    mockQuery.mockResolvedValueOnce([created]);

    const res = await request(app)
      .post('/api/donations')
      .set('Authorization', `Bearer ${makeToken()}`)
      .send({ latitude: 48.8566, longitude: 2.3522, description: 'Fresh bread' });

    expect(res.status).toBe(201);
    expect(res.body.donation.id).toBe('new-don');
  });

  it('accepts an optional photoUrl', async () => {
    mockQuery.mockResolvedValueOnce([makeDonation()]);

    const res = await request(app)
      .post('/api/donations')
      .set('Authorization', `Bearer ${makeToken()}`)
      .send({
        latitude: 48.8566,
        longitude: 2.3522,
        description: 'Food',
        photoUrl: 'https://example.com/photo.jpg',
      });

    expect(res.status).toBe(201);
  });
});

describe('GET /api/donations', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.JWT_SECRET = JWT_SECRET;
  });

  it('returns 401 without a JWT', async () => {
    const res = await request(app).get('/api/donations');
    expect(res.status).toBe(401);
  });

  it('returns a donations array', async () => {
    mockQuery.mockResolvedValueOnce([makeDonation(), makeDonation({ id: 'don-2' })]);

    const res = await request(app)
      .get('/api/donations')
      .set('Authorization', `Bearer ${makeToken()}`);

    expect(res.status).toBe(200);
    expect(res.body.donations).toHaveLength(2);
  });

  it('passes status query param to the DB', async () => {
    mockQuery.mockResolvedValueOnce([]);

    await request(app)
      .get('/api/donations?status=confirmed')
      .set('Authorization', `Bearer ${makeToken()}`);

    const [, params] = mockQuery.mock.calls[0] as [string, unknown[]];
    expect(params[0]).toBe('confirmed');
  });
});

describe('GET /api/donations/:id', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.JWT_SECRET = JWT_SECRET;
  });

  it('returns 401 without a JWT', async () => {
    const res = await request(app).get('/api/donations/don-uuid');
    expect(res.status).toBe(401);
  });

  it('returns 404 when donation does not exist', async () => {
    mockQueryOne.mockResolvedValueOnce(null);

    const res = await request(app)
      .get('/api/donations/nonexistent')
      .set('Authorization', `Bearer ${makeToken()}`);

    expect(res.status).toBe(404);
  });

  it('returns the donation on success', async () => {
    mockQueryOne.mockResolvedValueOnce(makeDonation());

    const res = await request(app)
      .get('/api/donations/don-uuid')
      .set('Authorization', `Bearer ${makeToken()}`);

    expect(res.status).toBe(200);
    expect(res.body.donation.id).toBe('don-uuid');
  });
});

describe('POST /api/donations/:id/confirm', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.JWT_SECRET = JWT_SECRET;
  });

  it('returns 401 without a JWT', async () => {
    const res = await request(app)
      .post('/api/donations/don-uuid/confirm')
      .send({ latitude: 48.8566, longitude: 2.3522 });

    expect(res.status).toBe(401);
  });

  it('returns 400 for a missing lat/lng body', async () => {
    const res = await request(app)
      .post('/api/donations/don-uuid/confirm')
      .set('Authorization', `Bearer ${makeToken(OTHER_ID)}`)
      .send({});

    expect(res.status).toBe(400);
  });

  it('returns 404 when donation does not exist', async () => {
    mockQueryOne.mockResolvedValueOnce(null);

    const res = await request(app)
      .post('/api/donations/nonexistent/confirm')
      .set('Authorization', `Bearer ${makeToken(OTHER_ID)}`)
      .send({ latitude: 48.8566, longitude: 2.3522 });

    expect(res.status).toBe(404);
  });

  it('returns 400 when donor tries to confirm their own donation', async () => {
    mockQueryOne.mockResolvedValueOnce(makeDonation());

    const res = await request(app)
      .post('/api/donations/don-uuid/confirm')
      .set('Authorization', `Bearer ${makeToken(DONOR_ID)}`) // same as donor_id
      .send({ latitude: 48.8566, longitude: 2.3522 });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/cannot confirm/i);
  });

  it('returns 409 when donation is not pending', async () => {
    mockQueryOne.mockResolvedValueOnce(makeDonation({ status: 'confirmed' }));

    const res = await request(app)
      .post('/api/donations/don-uuid/confirm')
      .set('Authorization', `Bearer ${makeToken(OTHER_ID)}`)
      .send({ latitude: 48.8566, longitude: 2.3522 });

    expect(res.status).toBe(409);
  });

  it('returns 409 when donation listing has expired', async () => {
    mockQueryOne.mockResolvedValueOnce(
      makeDonation({ challenge_deadline: new Date(Date.now() - 1000) })
    );

    const res = await request(app)
      .post('/api/donations/don-uuid/confirm')
      .set('Authorization', `Bearer ${makeToken(OTHER_ID)}`)
      .send({ latitude: 48.8566, longitude: 2.3522 });

    expect(res.status).toBe(409);
    expect(res.body.error).toMatch(/expired/i);
  });

  it('returns 422 when receiver is farther than 5 km', async () => {
    mockQueryOne.mockResolvedValueOnce(makeDonation());
    mockDistance.mockReturnValueOnce(10); // 10 km — outside geofence

    const res = await request(app)
      .post('/api/donations/don-uuid/confirm')
      .set('Authorization', `Bearer ${makeToken(OTHER_ID)}`)
      .send({ latitude: 49.0, longitude: 2.3522 });

    expect(res.status).toBe(422);
    expect(res.body.error).toMatch(/5 km/);
  });

  it('confirms the donation and awards karma when within geofence', async () => {
    const confirmed = { ...makeDonation(), status: 'confirmed', receiver_id: OTHER_ID };
    mockQueryOne.mockResolvedValueOnce(makeDonation());
    mockDistance.mockReturnValueOnce(1); // 1 km — inside geofence
    mockTransaction.mockImplementation(async (cb) => {
      const client = {
        query: vi.fn().mockResolvedValue({ rows: [confirmed], rowCount: 1 }),
      };
      return cb(client as any);
    });

    const res = await request(app)
      .post('/api/donations/don-uuid/confirm')
      .set('Authorization', `Bearer ${makeToken(OTHER_ID)}`)
      .send({ latitude: 48.86, longitude: 2.35 });

    expect(res.status).toBe(200);
    expect(res.body.donation.status).toBe('confirmed');
  });
});

describe('POST /api/donations/:id/dispute', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.JWT_SECRET = JWT_SECRET;
  });

  it('returns 401 without a JWT', async () => {
    const res = await request(app).post('/api/donations/don-uuid/dispute');
    expect(res.status).toBe(401);
  });

  it('returns 404 when donation does not exist', async () => {
    mockQueryOne.mockResolvedValueOnce(null);

    const res = await request(app)
      .post('/api/donations/nonexistent/dispute')
      .set('Authorization', `Bearer ${makeToken(OTHER_ID)}`);

    expect(res.status).toBe(404);
  });

  it('returns 400 when donor disputes their own donation', async () => {
    mockQueryOne.mockResolvedValueOnce(makeDonation());

    const res = await request(app)
      .post('/api/donations/don-uuid/dispute')
      .set('Authorization', `Bearer ${makeToken(DONOR_ID)}`);

    expect(res.status).toBe(400);
  });

  it('returns 409 when donation is already cancelled', async () => {
    mockQueryOne.mockResolvedValueOnce(makeDonation({ status: 'cancelled' }));

    const res = await request(app)
      .post('/api/donations/don-uuid/dispute')
      .set('Authorization', `Bearer ${makeToken(OTHER_ID)}`);

    expect(res.status).toBe(409);
  });

  it('disputes a pending donation successfully', async () => {
    const disputed = { ...makeDonation(), status: 'disputed' };
    mockQueryOne.mockResolvedValueOnce(makeDonation());
    mockQuery.mockResolvedValueOnce([disputed]);

    const res = await request(app)
      .post('/api/donations/don-uuid/dispute')
      .set('Authorization', `Bearer ${makeToken(OTHER_ID)}`);

    expect(res.status).toBe(200);
    expect(res.body.donation.status).toBe('disputed');
  });
});

describe('POST /api/donations/:id/cancel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.JWT_SECRET = JWT_SECRET;
  });

  it('returns 401 without a JWT', async () => {
    const res = await request(app).post('/api/donations/don-uuid/cancel');
    expect(res.status).toBe(401);
  });

  it('returns 404 when donation does not exist', async () => {
    mockQueryOne.mockResolvedValueOnce(null);

    const res = await request(app)
      .post('/api/donations/nonexistent/cancel')
      .set('Authorization', `Bearer ${makeToken(DONOR_ID)}`);

    expect(res.status).toBe(404);
  });

  it('returns 403 when a non-donor tries to cancel', async () => {
    mockQueryOne.mockResolvedValueOnce(makeDonation());

    const res = await request(app)
      .post('/api/donations/don-uuid/cancel')
      .set('Authorization', `Bearer ${makeToken(OTHER_ID)}`); // not the donor

    expect(res.status).toBe(403);
  });

  it('returns 409 when donation is not pending', async () => {
    mockQueryOne.mockResolvedValueOnce(makeDonation({ status: 'confirmed' }));

    const res = await request(app)
      .post('/api/donations/don-uuid/cancel')
      .set('Authorization', `Bearer ${makeToken(DONOR_ID)}`);

    expect(res.status).toBe(409);
  });

  it('cancels a pending donation successfully', async () => {
    const cancelled = { ...makeDonation(), status: 'cancelled' };
    mockQueryOne.mockResolvedValueOnce(makeDonation());
    mockQuery.mockResolvedValueOnce([cancelled]);

    const res = await request(app)
      .post('/api/donations/don-uuid/cancel')
      .set('Authorization', `Bearer ${makeToken(DONOR_ID)}`);

    expect(res.status).toBe(200);
    expect(res.body.donation.status).toBe('cancelled');
  });
});
