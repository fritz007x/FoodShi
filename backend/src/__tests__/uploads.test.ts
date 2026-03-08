import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import express from 'express';
import jwt from 'jsonwebtoken';

// Mock cloudinary before importing the router
vi.mock('cloudinary', () => {
  const uploadStream = vi.fn();
  return {
    v2: {
      config: vi.fn(),
      uploader: { upload_stream: uploadStream },
    },
  };
});

import uploadsRouter from '../routes/uploads';
import { v2 } from 'cloudinary';

const mockUploadStream = vi.mocked(v2.uploader.upload_stream);

const JWT_SECRET = 'test-secret';
const USER_ID = 'user-uuid';

const app = express();
app.use(express.json());
app.use('/api/uploads', uploadsRouter);

function makeToken(userId = USER_ID) {
  return jwt.sign({ userId, email: 'test@example.com' }, JWT_SECRET);
}

describe('POST /api/uploads/image', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.JWT_SECRET = JWT_SECRET;
  });

  it('returns 401 without a JWT', async () => {
    const res = await request(app).post('/api/uploads/image');
    expect(res.status).toBe(401);
  });

  it('returns 400 when no file is provided', async () => {
    const res = await request(app)
      .post('/api/uploads/image')
      .set('Authorization', `Bearer ${makeToken()}`);

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('No image file provided');
  });

  it('uploads an image and returns the URL', async () => {
    const fakeUrl = 'https://res.cloudinary.com/demo/image/upload/foodshi/test.jpg';

    mockUploadStream.mockImplementation((_opts: unknown, cb: Function) => {
      // Simulate a writable stream — call the callback immediately, then
      // return an object with an `end` method.
      setTimeout(() => cb(null, { secure_url: fakeUrl }), 0);
      return { end: vi.fn() };
    });

    // 1x1 red PNG (smallest valid PNG)
    const pixel = Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg==',
      'base64'
    );

    const res = await request(app)
      .post('/api/uploads/image')
      .set('Authorization', `Bearer ${makeToken()}`)
      .attach('image', pixel, 'test.png');

    expect(res.status).toBe(200);
    expect(res.body.url).toBe(fakeUrl);
  });

  it('returns 502 when cloudinary fails', async () => {
    mockUploadStream.mockImplementation((_opts: unknown, cb: Function) => {
      setTimeout(() => cb(new Error('Cloudinary down')), 0);
      return { end: vi.fn() };
    });

    const pixel = Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg==',
      'base64'
    );

    const res = await request(app)
      .post('/api/uploads/image')
      .set('Authorization', `Bearer ${makeToken()}`)
      .attach('image', pixel, 'test.png');

    expect(res.status).toBe(502);
    expect(res.body.error).toBe('Image upload failed');
  });
});
