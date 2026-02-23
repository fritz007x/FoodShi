import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../db/index', () => ({
  query:       vi.fn(),
  queryOne:    vi.fn(),
  transaction: vi.fn(),
}));

import { awardKarma, deductKarma, getPendingEmissionPoints, getKarmaHistory } from '../services/karma';
import { query, queryOne, transaction } from '../db/index';

const mockTransaction = vi.mocked(transaction);
const mockQuery       = vi.mocked(query);
const mockQueryOne    = vi.mocked(queryOne);

function makeMockClient() {
  return { query: vi.fn().mockResolvedValue({ rows: [], rowCount: 0 }) };
}

describe('awardKarma', () => {
  beforeEach(() => vi.clearAllMocks());

  it('writes to daily_points, users, and karma_transactions', async () => {
    const client = makeMockClient();
    mockTransaction.mockImplementation(async (cb) => cb(client as any));

    await awardKarma('user-1', 100, 'donation_given', 'ref-1');

    expect(client.query).toHaveBeenCalledTimes(3);
    expect(client.query.mock.calls[0][0]).toContain('INSERT INTO daily_points');
    expect(client.query.mock.calls[1][0]).toContain('UPDATE users SET karma_points');
    expect(client.query.mock.calls[2][0]).toContain('INSERT INTO karma_transactions');
  });

  it('passes the correct positive amount to users UPDATE', async () => {
    const client = makeMockClient();
    mockTransaction.mockImplementation(async (cb) => cb(client as any));

    await awardKarma('user-1', 150, 'bonus');

    const args = client.query.mock.calls[1][1] as unknown[];
    expect(args[0]).toBe(150);
  });
});

describe('deductKarma', () => {
  beforeEach(() => vi.clearAllMocks());

  it('does NOT write to daily_points (penalties are not emitted on-chain)', async () => {
    const client = makeMockClient();
    mockTransaction.mockImplementation(async (cb) => cb(client as any));

    await deductKarma('user-1', 50, 'penalty');

    // Only 2 calls: UPDATE users + INSERT karma_transactions (no daily_points)
    expect(client.query).toHaveBeenCalledTimes(2);
    expect(client.query.mock.calls[0][0]).toContain('UPDATE users SET karma_points');
    expect(client.query.mock.calls[1][0]).toContain('INSERT INTO karma_transactions');
  });

  it('stores a negative amount in users.karma_points', async () => {
    const client = makeMockClient();
    mockTransaction.mockImplementation(async (cb) => cb(client as any));

    await deductKarma('user-1', 75, 'dispute_lost');

    const args = client.query.mock.calls[0][1] as unknown[];
    expect(args[0]).toBe(-75);
  });
});

describe('getPendingEmissionPoints', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns 0 when no unsynced row exists for today', async () => {
    mockQueryOne.mockResolvedValue(null);
    expect(await getPendingEmissionPoints('user-1')).toBe(0);
  });

  it('returns the points value from the row', async () => {
    mockQueryOne.mockResolvedValue({ points: 350 });
    expect(await getPendingEmissionPoints('user-1')).toBe(350);
  });

  it('queries only synced_to_chain = false rows', async () => {
    mockQueryOne.mockResolvedValue(null);
    await getPendingEmissionPoints('user-1');
    const [sql] = mockQueryOne.mock.calls[0] as [string, unknown[]];
    expect(sql).toContain('synced_to_chain = false');
  });
});

describe('getKarmaHistory', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns query results', async () => {
    const rows = [{ id: 'tx-1', amount: 100, transaction_type: 'donation_given' }];
    mockQuery.mockResolvedValue(rows);
    const result = await getKarmaHistory('user-1');
    expect(result).toEqual(rows);
  });

  it('applies default limit of 20', async () => {
    mockQuery.mockResolvedValue([]);
    await getKarmaHistory('user-1');
    const params = mockQuery.mock.calls[0][1] as unknown[];
    expect(params[1]).toBe(20);
  });
});
