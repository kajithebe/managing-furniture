// GET / PUT /api/admin/code-scheme and POST /api/admin/code-scheme/preview
// (MF-21, A1 Settings → Asset codes).
// The database is mocked, so these tests run anywhere, including CI.
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../src/db.js', () => {
  const setting = { findUnique: vi.fn(), update: vi.fn() };
  const auditLog = { findFirst: vi.fn(), create: vi.fn() };
  return {
    prisma: {
      user: { findUnique: vi.fn() },
      setting,
      auditLog,
      item: { findMany: vi.fn() },
      category: { findMany: vi.fn() },
      campus: { findMany: vi.fn(), findFirst: vi.fn() },
      brand: { findMany: vi.fn() },
      colour: { findMany: vi.fn() },
      // The service's transaction callback gets the same mocks as tx.
      $transaction: vi.fn((callback) => callback({ setting, auditLog })),
    },
  };
});

const { prisma } = await import('../src/db.js');
const { createApp } = await import('../src/app.js');
const { startSession } = await import('../src/services/sessionService.js');

const ORIGIN = 'http://localhost:5173';
const ADMIN_ID = 1;

const SEBASTIAN = {
  id: ADMIN_ID,
  email: 'sebastian.lindsten@metropolia.fi',
  name: 'Sebastian Lindsten',
  role: 'ADMIN',
  active: true,
};

const MP = {
  segments: [{ type: 'text', value: 'MP' }, { type: 'number' }],
  separator: '-',
  numberLength: 5,
};
const KAR_CHR = {
  segments: [{ type: 'campus' }, { type: 'category' }, { type: 'number' }],
  separator: '-',
  numberLength: 5,
};

// Items as the preview query returns them (newest first, one per category).
function previewItem(category, brand = null, colour = null) {
  return {
    category: { code: category },
    brand: brand && { code: brand },
    colour: colour && { code: colour },
    homeRoom: { building: { campus: { code: 'KAR' } } },
  };
}
const ITEMS = [previewItem('CHR', 'ISK', 'GRY'), previewItem('TBL'), previewItem('SF')];

// The short codes in the lists, for the 30-character check: all 3 characters long.
const codes = (...list) => list.map((code) => ({ code }));

// Campus, category, brand and colour with 3-character short codes: at most 32 characters
// with METROPOLIA in front (the Figma example), so over the limit of 30.
const FIGMA_LONG = {
  separator: '-',
  numberLength: 5,
  segments: [
    { type: 'text', value: 'METROPOLIA' },
    { type: 'campus' },
    { type: 'category' },
    { type: 'brand' },
    { type: 'colour' },
    { type: 'number' },
  ],
};

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
  // The first call is the session check; later calls read the actor's name.
  prisma.user.findUnique.mockResolvedValue({ ...SEBASTIAN, role });
  return sessionCookie(ADMIN_ID);
}

beforeEach(() => {
  vi.clearAllMocks();
  prisma.setting.findUnique.mockResolvedValue({ codeScheme: MP, nextNumber: 124 });
  prisma.auditLog.findFirst.mockResolvedValue(null);
  prisma.item.findMany.mockResolvedValue(ITEMS);
  prisma.campus.findMany.mockResolvedValue(codes('KAR'));
  prisma.category.findMany.mockResolvedValue(codes('CHR', 'TBL', 'SF'));
  prisma.brand.findMany.mockResolvedValue(codes('ISK'));
  prisma.colour.findMany.mockResolvedValue(codes('GRY'));
});

describe('GET /api/admin/code-scheme', () => {
  it('needs a session', async () => {
    const res = await request(createApp()).get('/api/admin/code-scheme');
    expect(res.status).toBe(401);
  });

  it('is for admins only', async () => {
    const res = await request(createApp())
      .get('/api/admin/code-scheme')
      .set('Cookie', loginAs('MODERATOR'));
    expect(res.status).toBe(403);
  });

  it('returns the scheme, the default and no last change on a new install', async () => {
    const res = await request(createApp())
      .get('/api/admin/code-scheme')
      .set('Cookie', loginAs('ADMIN'));

    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      scheme: MP,
      format: 'MP-00001',
      defaultScheme: MP,
      lastChanged: null,
    });
  });

  it('returns who changed the scheme last and when', async () => {
    prisma.auditLog.findFirst.mockResolvedValue({
      actorId: ADMIN_ID,
      createdAt: new Date('2026-11-05T10:00:00Z'),
    });

    const res = await request(createApp())
      .get('/api/admin/code-scheme')
      .set('Cookie', loginAs('ADMIN'));

    expect(res.body.lastChanged).toEqual({
      at: '2026-11-05T10:00:00.000Z',
      by: { id: ADMIN_ID, name: 'Sebastian Lindsten' },
    });
    expect(prisma.auditLog.findFirst.mock.calls[0][0].where).toEqual({
      entity: 'Setting',
      action: 'code_scheme_change',
    });
  });
});

describe('PUT /api/admin/code-scheme', () => {
  function put(body, role = 'ADMIN') {
    return request(createApp())
      .put('/api/admin/code-scheme')
      .set('Cookie', loginAs(role))
      .set('Origin', ORIGIN)
      .send(body);
  }

  it('is for admins only', async () => {
    const res = await put(KAR_CHR, 'MODERATOR');
    expect(res.status).toBe(403);
    expect(prisma.setting.update).not.toHaveBeenCalled();
  });

  it('saves the scheme and logs the change with the old and new scheme', async () => {
    prisma.setting.findUnique
      .mockResolvedValueOnce({ codeScheme: MP }) // before, inside the transaction
      .mockResolvedValueOnce({ codeScheme: KAR_CHR }); // the reply

    const res = await put(KAR_CHR);

    expect(res.status).toBe(200);
    expect(res.body.scheme).toEqual(KAR_CHR);
    expect(res.body.format).toBe('KAR-CHR-00001');
    expect(prisma.setting.update).toHaveBeenCalledWith({
      where: { id: 1 },
      data: { codeScheme: KAR_CHR },
    });
    expect(prisma.auditLog.create).toHaveBeenCalledWith({
      data: {
        actorId: ADMIN_ID,
        entity: 'Setting',
        entityId: 1,
        action: 'code_scheme_change',
        before: MP,
        after: KAR_CHR,
      },
    });
  });

  it('never changes the running number', async () => {
    await put(KAR_CHR);
    const { data } = prisma.setting.update.mock.calls[0][0];
    expect(data).not.toHaveProperty('nextNumber');
  });

  it('saves fixed text in upper case', async () => {
    await put({ ...MP, segments: [{ type: 'text', value: 'metropolia' }, { type: 'number' }] });
    const { data } = prisma.setting.update.mock.calls[0][0];
    expect(data.codeScheme.segments[0]).toEqual({ type: 'text', value: 'METROPOLIA' });
  });

  it('refuses a format whose codes could be longer than 30 characters', async () => {
    const res = await put(FIGMA_LONG);

    expect(res.status).toBe(400);
    expect(res.body.error).toEqual({
      code: 'CODE_TOO_LONG',
      message: 'Codes can be at most 30 characters. Remove a segment or shorten the fixed text.',
    });
    expect(prisma.setting.update).not.toHaveBeenCalled();
  });

  it('saves a long format with the warning when it stays within 30 characters', async () => {
    // MP-KAR-CHR-ISK-GRY-00001: 24 characters
    const res = await put({
      ...FIGMA_LONG,
      segments: [{ type: 'text', value: 'MP' }, ...FIGMA_LONG.segments.slice(1)],
    });
    expect(res.status).toBe(200);
    expect(prisma.setting.update).toHaveBeenCalled();
  });

  it('refuses a scheme without the running number and saves nothing', async () => {
    const res = await put({ ...KAR_CHR, segments: [{ type: 'campus' }] });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
    expect(prisma.setting.update).not.toHaveBeenCalled();
    expect(prisma.auditLog.create).not.toHaveBeenCalled();
  });
});

describe('POST /api/admin/code-scheme/preview', () => {
  function preview(body, role = 'ADMIN') {
    return request(createApp())
      .post('/api/admin/code-scheme/preview')
      .set('Cookie', loginAs(role))
      .set('Origin', ORIGIN)
      .send(body);
  }

  it('is for admins only', async () => {
    const res = await preview(KAR_CHR, 'MODERATOR');
    expect(res.status).toBe(403);
  });

  it('builds the sample and three example codes from real items, codes only', async () => {
    const res = await preview(KAR_CHR);

    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      sample: 'KAR-CHR-00001',
      examples: ['KAR-CHR-00124', 'KAR-TBL-00125', 'KAR-SF-00126'],
      tooLong: false,
      overLimit: false,
    });
  });

  it('shows only one example when all items are in one category', async () => {
    prisma.item.findMany.mockResolvedValue([previewItem('CHR')]);
    const res = await preview(KAR_CHR);
    expect(res.body.examples).toEqual(['KAR-CHR-00124']);
  });

  it('asks for items with different categories, newest first, without Disposed', async () => {
    await preview(KAR_CHR);
    const query = prisma.item.findMany.mock.calls[0][0];
    expect(query.where).toEqual({ condition: { not: 'DISPOSED' } });
    expect(query.distinct).toEqual(['categoryId']);
    expect(query.orderBy).toEqual({ id: 'desc' });
    expect(query.take).toBe(3);
  });

  it('leaves out brand and colour for items without them', async () => {
    const res = await preview({
      ...KAR_CHR,
      segments: [{ type: 'category' }, { type: 'brand' }, { type: 'colour' }, { type: 'number' }],
    });
    expect(res.body.examples).toEqual(['CHR-ISK-GRY-00124', 'TBL-00125', 'SF-00126']);
  });

  it('warns when a code is longer than 20 characters (A1 length warning)', async () => {
    const res = await preview({
      ...FIGMA_LONG,
      segments: [{ type: 'text', value: 'MP' }, ...FIGMA_LONG.segments.slice(1)],
    });
    expect(res.body.sample).toBe('MP-KAR-CHR-ISK-GRY-00001');
    expect(res.body.tooLong).toBe(true);
    expect(res.body.overLimit).toBe(false);
  });

  it('tells when a code could be longer than 30 characters', async () => {
    const res = await preview(FIGMA_LONG);
    expect(res.body.sample).toBe('METROPOLIA-KAR-CHR-ISK-GRY-00001');
    expect(res.body.overLimit).toBe(true);
  });

  it('counts the longest short code of a list, not only the ones in the examples', async () => {
    // A 5-character brand code in the list, even though no example item uses it.
    prisma.brand.findMany.mockResolvedValue(codes('ISK', 'LONGB'));
    const scheme = {
      ...FIGMA_LONG,
      segments: [{ type: 'text', value: 'MP/26.1' }, ...FIGMA_LONG.segments.slice(1)],
    };
    // MP/26.1 (7) + 3 + 3 + 5 + 3 + 5 + 5 separators = 31
    const res = await preview(scheme);
    expect(res.body.overLimit).toBe(true);
  });

  it('uses the year the item would be added', async () => {
    const res = await preview({ ...MP, segments: [{ type: 'year' }, { type: 'number' }] });
    expect(res.body.sample).toMatch(/^\d{2}-00001$/);
  });

  it('uses the first categories and campus on a new install without items', async () => {
    prisma.item.findMany.mockResolvedValue([]);
    prisma.category.findMany.mockResolvedValue(codes('CHR', 'STL'));
    prisma.campus.findFirst.mockResolvedValue({ code: 'KAR' });

    const res = await preview(KAR_CHR);
    expect(res.body.examples).toEqual(['KAR-CHR-00124', 'KAR-STL-00125']);
  });

  it('refuses an invalid scheme', async () => {
    const res = await preview({ ...KAR_CHR, numberLength: 9 });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('saves nothing', async () => {
    await preview(KAR_CHR);
    expect(prisma.setting.update).not.toHaveBeenCalled();
    expect(prisma.auditLog.create).not.toHaveBeenCalled();
  });
});
