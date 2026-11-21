// GET /api/labels/items and /api/labels/rooms (MF-09): data for the M8 "Print labels" page.
// The database is mocked, so these tests run anywhere, including CI.
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../src/db.js', () => ({
  prisma: {
    user: { findUnique: vi.fn() },
    item: { findMany: vi.fn() },
    room: { findMany: vi.fn() },
  },
}));

const { prisma } = await import('../src/db.js');
const { createApp } = await import('../src/app.js');
const { startSession } = await import('../src/services/sessionService.js');

function sessionCookie(userId) {
  const res = {
    cookie(name, value) {
      this.value = `${name}=${value}`;
    },
  };
  startSession(res, userId);
  return res.value;
}

function loginAs(role) {
  prisma.user.findUnique.mockResolvedValue({
    id: 9,
    email: 'mikko.laine@metropolia.fi',
    name: 'Mikko Laine',
    role,
    active: true,
  });
  return sessionCookie(9);
}

// Turns a qrImage data: URL back into the SVG text.
function svgOf(qrImage) {
  return Buffer.from(qrImage.split(',')[1], 'base64').toString('utf8');
}

const D569 = { id: 1, name: 'D569' };

const items = [
  { code: 'MP-00123', name: 'Chair', homeRoom: D569 },
  { code: 'MP-00124', name: 'Chair', homeRoom: D569 },
];

const buildingD = { id: 4, name: 'D', campus: { id: 1, name: 'Karaportti' } };
const rooms = [
  { id: 1, name: 'D569', qrToken: 'Ab3_x-9QwErTy1Z2', building: buildingD },
  { id: 2, name: 'D751', qrToken: 'Zz9-k_2LmNoPqRs3', building: buildingD },
];

beforeEach(() => {
  vi.clearAllMocks();
  prisma.item.findMany.mockResolvedValue(items);
  prisma.room.findMany.mockResolvedValue(rooms);
});

describe('GET /api/labels/items', () => {
  it('needs a session', async () => {
    const res = await request(createApp()).get('/api/labels/items?codes=MP-00123');
    expect(res.status).toBe(401);
  });

  it('is for moderators and admins only', async () => {
    const res = await request(createApp())
      .get('/api/labels/items?codes=MP-00123')
      .set('Cookie', loginAs('USER'));
    expect(res.status).toBe(403);
  });

  it('returns one label per code, in the selected order', async () => {
    const res = await request(createApp())
      .get('/api/labels/items?codes=MP-00124,mp-00123,MP-00124')
      .set('Cookie', loginAs('MODERATOR'));

    expect(res.status).toBe(200);
    expect(res.body.data.map((label) => label.code)).toEqual(['MP-00124', 'MP-00123']);
    expect(res.body.data[0]).toMatchObject({ name: 'Chair', homeRoom: D569 });
    expect(prisma.item.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { code: { in: ['MP-00124', 'MP-00123'] } } }),
    );
  });

  it('gives a QR image of the item page link on BASE_URL', async () => {
    const res = await request(createApp())
      .get('/api/labels/items?codes=MP-00123')
      .set('Cookie', loginAs('ADMIN'));

    expect(res.body.data[0].qrImage.startsWith('data:image/svg+xml;base64,')).toBe(true);
    expect(svgOf(res.body.data[0].qrImage)).toContain('<svg');
  });

  it('says which code does not exist', async () => {
    const res = await request(createApp())
      .get('/api/labels/items?codes=MP-00123,MP-99999')
      .set('Cookie', loginAs('MODERATOR'));

    expect(res.status).toBe(404);
    expect(res.body.error).toMatchObject({
      code: 'ITEM_NOT_FOUND',
      message: 'No item with code MP-99999',
    });
  });

  it('needs at least one code', async () => {
    const res = await request(createApp())
      .get('/api/labels/items?codes=,')
      .set('Cookie', loginAs('MODERATOR'));
    expect(res.status).toBe(400);
  });

  it('allows at most 200 labels', async () => {
    const codes = Array.from({ length: 201 }, (_, i) => `MP-${String(i + 1).padStart(5, '0')}`);
    const res = await request(createApp())
      .get(`/api/labels/items?codes=${codes.join(',')}`)
      .set('Cookie', loginAs('MODERATOR'));
    expect(res.status).toBe(400);
  });
});

describe('GET /api/labels/rooms', () => {
  it('needs a session', async () => {
    const res = await request(createApp()).get('/api/labels/rooms?ids=1');
    expect(res.status).toBe(401);
  });

  it('is for moderators and admins only', async () => {
    const res = await request(createApp())
      .get('/api/labels/rooms?ids=1')
      .set('Cookie', loginAs('USER'));
    expect(res.status).toBe(403);
  });

  it('returns room, building and campus names for the door label', async () => {
    const res = await request(createApp())
      .get('/api/labels/rooms?ids=2,1')
      .set('Cookie', loginAs('MODERATOR'));

    expect(res.status).toBe(200);
    expect(res.body.data.map((label) => label.name)).toEqual(['D751', 'D569']);
    expect(res.body.data[1]).toMatchObject({
      id: 1,
      name: 'D569',
      building: { id: 4, name: 'D' },
      campus: { id: 1, name: 'Karaportti' },
    });
  });

  it('never sends the qrToken as text, only inside the QR image', async () => {
    const res = await request(createApp())
      .get('/api/labels/rooms?ids=1')
      .set('Cookie', loginAs('MODERATOR'));

    expect(res.body.data[0].qrToken).toBeUndefined();
    expect(JSON.stringify(res.body)).not.toContain('Ab3_x-9QwErTy1Z2');
  });

  it('gives 404 for an unknown room', async () => {
    const res = await request(createApp())
      .get('/api/labels/rooms?ids=1,99')
      .set('Cookie', loginAs('MODERATOR'));

    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('ROOM_NOT_FOUND');
  });

  it('rejects ids that are not numbers', async () => {
    const res = await request(createApp())
      .get('/api/labels/rooms?ids=1,abc')
      .set('Cookie', loginAs('MODERATOR'));
    expect(res.status).toBe(400);
  });
});
