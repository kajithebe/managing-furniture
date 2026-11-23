// GET /api/rooms/by-qr/:qrToken (MF-19): the room behind a door QR, for S8 and S12.
// The database is mocked, so these tests run anywhere, including CI.
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../src/db.js', () => ({
  prisma: {
    user: { findUnique: vi.fn() },
    room: { findUnique: vi.fn() },
  },
}));

const { prisma } = await import('../src/db.js');
const { createApp } = await import('../src/app.js');
const { startSession } = await import('../src/services/sessionService.js');

const TOKEN = 'k3J9xQ2mP7vL1aZ8';

function sessionCookie(userId) {
  const res = {
    cookie(name, value) {
      this.value = `${name}=${value}`;
    },
  };
  startSession(res, userId);
  return res.value;
}

function get(token, cookie = sessionCookie(7)) {
  return request(createApp()).get(`/api/rooms/by-qr/${token}`).set('Cookie', cookie);
}

beforeEach(() => {
  vi.clearAllMocks();
  prisma.user.findUnique.mockResolvedValue({
    id: 7,
    email: 'aino.virtanen@metropolia.fi',
    name: 'Aino Virtanen',
    role: 'USER',
    active: true,
  });
  prisma.room.findUnique.mockResolvedValue({
    id: 1,
    name: 'D569',
    building: { id: 4, name: 'D', campus: { id: 2, name: 'Karaportti' } },
  });
});

describe('GET /api/rooms/by-qr/:qrToken', () => {
  it('needs a session', async () => {
    const res = await request(createApp()).get(`/api/rooms/by-qr/${TOKEN}`);
    expect(res.status).toBe(401);
  });

  it('returns the room with its building and campus (S12), never the token', async () => {
    const res = await get(TOKEN);

    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      id: 1,
      name: 'D569',
      building: { id: 4, name: 'D' },
      campus: { id: 2, name: 'Karaportti' },
    });
    expect(prisma.room.findUnique.mock.calls[0][0].where).toEqual({ qrToken: TOKEN });
  });

  it('gives ROOM_NOT_FOUND for an unknown token', async () => {
    prisma.room.findUnique.mockResolvedValue(null);
    const res = await get('unknownToken123');

    expect(res.status).toBe(404);
    expect(res.body.error).toEqual({ code: 'ROOM_NOT_FOUND', message: 'Room not found.' });
  });

  it('refuses a token with characters a door QR never has', async () => {
    const res = await get('abc%20def');

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
    expect(prisma.room.findUnique).not.toHaveBeenCalled();
  });
});
