// Add item (M6) codes from the item's own data (MF-21 step 4, 02 › Asset codes):
// GET /api/items/next-code and POST /api/items build the code from the item's campus (of the
// home room), category, brand, colour and the year it is added (Helsinki time).
// The database is mocked, so these tests run anywhere, including CI.
import request from 'supertest';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../src/db.js', () => {
  const setting = { findUnique: vi.fn(), update: vi.fn() };
  const item = { findFirst: vi.fn(), createManyAndReturn: vi.fn() };
  const itemEvent = { createMany: vi.fn() };
  return {
    prisma: {
      user: { findUnique: vi.fn() },
      setting,
      item,
      itemEvent,
      category: { findUnique: vi.fn() },
      brand: { findUnique: vi.fn() },
      colour: { findUnique: vi.fn() },
      room: { findUnique: vi.fn() },
      // The service's transaction callback gets the same mocks as tx.
      $transaction: vi.fn((callback) => callback({ setting, item, itemEvent })),
    },
  };
});

const { prisma } = await import('../src/db.js');
const { createApp } = await import('../src/app.js');
const { startSession } = await import('../src/services/sessionService.js');

const ORIGIN = 'http://localhost:5173';
const MODERATOR_ID = 4;
const CHAIR = 1;
const D569 = 1; // a room at Karaportti
const ISKU = 2;
const GREY = 3;

function scheme(types) {
  return {
    segments: types.map((type) => (type === 'text' ? { type, value: 'MP' } : { type })),
    separator: '-',
    numberLength: 5,
  };
}
const MP = scheme(['text', 'number']);
const KAR_CHR = scheme(['campus', 'category', 'number']);

function sessionCookie(userId) {
  const res = {
    cookie(name, value) {
      this.value = `${name}=${value}`;
    },
  };
  startSession(res, userId);
  return res.value;
}

function loginAsModerator() {
  prisma.user.findUnique.mockResolvedValue({
    id: MODERATOR_ID,
    email: 'mikko.laine@metropolia.fi',
    name: 'Mikko Laine',
    role: 'MODERATOR',
    active: true,
  });
  return sessionCookie(MODERATOR_ID);
}

function useScheme(codeScheme, nextNumber = 127) {
  prisma.setting.findUnique.mockResolvedValue({ codeScheme, nextNumber });
}

function nextCode(query) {
  return request(createApp())
    .get(`/api/items/next-code?${new URLSearchParams(query)}`)
    .set('Cookie', loginAsModerator());
}

beforeEach(() => {
  vi.clearAllMocks();
  // Each lookup returns its short code (and, for checkActive, that it is not archived).
  prisma.category.findUnique.mockResolvedValue({ archived: false, name: 'Chair', code: 'CHR' });
  prisma.brand.findUnique.mockResolvedValue({ archived: false, name: 'Isku', code: 'ISK' });
  prisma.colour.findUnique.mockResolvedValue({ archived: false, name: 'Grey', code: 'GRY' });
  prisma.room.findUnique.mockResolvedValue({
    archived: false,
    building: { campus: { code: 'KAR' } },
  });
});

afterEach(() => {
  vi.useRealTimers();
});

describe('GET /api/items/next-code', () => {
  it('default scheme: "Next code: MP-00127" even before anything is chosen', async () => {
    useScheme(MP);
    const res = await nextCode({ quantity: 1 });
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ first: 'MP-00127', last: 'MP-00127' });
  });

  it('campus + category scheme: no code until category and home room are chosen', async () => {
    useScheme(KAR_CHR);

    const empty = await nextCode({ quantity: 1 });
    expect(empty.status).toBe(200);
    expect(empty.body).toEqual({ first: null, last: null });

    const categoryOnly = await nextCode({ quantity: 1, categoryId: CHAIR });
    expect(categoryOnly.body).toEqual({ first: null, last: null });
  });

  it('uses the chosen category and the campus of the home room (bulk: first – last)', async () => {
    useScheme(KAR_CHR);
    const res = await nextCode({ quantity: 30, categoryId: CHAIR, homeRoomId: D569 });
    expect(res.body).toEqual({ first: 'KAR-CHR-00127', last: 'KAR-CHR-00156' });
    expect(prisma.room.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: D569 } }),
    );
  });

  it('adds brand and colour when chosen and leaves them out when not', async () => {
    useScheme(scheme(['campus', 'category', 'brand', 'colour', 'number']));
    const base = { quantity: 1, categoryId: CHAIR, homeRoomId: D569 };

    const without = await nextCode(base);
    expect(without.body.first).toBe('KAR-CHR-00127');

    const withBoth = await nextCode({ ...base, brandId: ISKU, colourId: GREY });
    expect(withBoth.body.first).toBe('KAR-CHR-ISK-GRY-00127');
  });

  it('year added = the year in Helsinki time (22:30 UTC on 31 Dec is already 2027)', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-12-31T22:30:00Z'));
    useScheme(scheme(['year', 'number']));
    const res = await nextCode({ quantity: 1 });
    expect(res.body.first).toBe('27-00127');
  });

  it('students cannot use it', async () => {
    prisma.user.findUnique.mockResolvedValue({
      id: 9,
      email: 'aino.student@metropolia.fi',
      name: 'Aino',
      role: 'USER',
      active: true,
    });
    const res = await request(createApp())
      .get('/api/items/next-code')
      .set('Cookie', sessionCookie(9));
    expect(res.status).toBe(403);
  });
});

describe('POST /api/items', () => {
  function postItems(body) {
    return request(createApp())
      .post('/api/items')
      .set('Origin', ORIGIN)
      .set('Cookie', loginAsModerator())
      .send(body);
  }

  beforeEach(() => {
    prisma.setting.update.mockResolvedValue({ codeScheme: KAR_CHR, nextNumber: 14 });
    prisma.item.findFirst.mockResolvedValue(null);
    prisma.item.createManyAndReturn.mockImplementation(async ({ data }) =>
      data.map((row, i) => ({ id: 100 + i, ...row })),
    );
    prisma.itemEvent.createMany.mockResolvedValue({ count: 2 });
  });

  it('creates the codes from the item’s own campus and category', async () => {
    const res = await postItems({ categoryId: CHAIR, homeRoomId: D569, quantity: 2 });
    expect(res.status).toBe(201);
    expect(res.body.map((item) => item.code)).toEqual(['KAR-CHR-00012', 'KAR-CHR-00013']);
  });
});
