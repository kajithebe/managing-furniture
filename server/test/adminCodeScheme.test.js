// GET / PUT /api/admin/code-scheme (MF-21, A1 Settings → Asset codes).
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
  prisma.setting.findUnique.mockResolvedValue({ codeScheme: MP });
  prisma.auditLog.findFirst.mockResolvedValue(null);
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
    expect(res.body).toEqual({ scheme: MP, defaultScheme: MP, lastChanged: null });
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

  it('refuses a scheme without the running number and saves nothing', async () => {
    const res = await put({ ...KAR_CHR, segments: [{ type: 'campus' }] });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
    expect(prisma.setting.update).not.toHaveBeenCalled();
    expect(prisma.auditLog.create).not.toHaveBeenCalled();
  });
});
