// GET /api/reports/inventory (MF-16): who may open it, which filters it accepts, and the CSV
// download. The database and the report service are mocked, so this runs anywhere, including CI.
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../src/db.js', () => ({ prisma: { user: { findUnique: vi.fn() } } }));
vi.mock('../src/services/reportService.js', () => ({
  inventoryReport: vi.fn(),
  inventoryCsv: vi.fn(),
}));

const { prisma } = await import('../src/db.js');
const { inventoryCsv, inventoryReport } = await import('../src/services/reportService.js');
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

function getInventory(query, cookie) {
  const req = request(createApp()).get('/api/reports/inventory').query(query);
  return cookie ? req.set('Cookie', cookie) : req;
}

const DEFAULTS = { sort: 'code', order: 'asc', page: 1, pageSize: 25 };

beforeEach(() => {
  vi.clearAllMocks();
  inventoryReport.mockResolvedValue({ data: [], total: 0 });
  inventoryCsv.mockResolvedValue('\uFEFFCode;Category\r\nMP-00123;Chair\r\n');
});

describe('GET /api/reports/inventory: access', () => {
  it('returns 401 without a session', async () => {
    const res = await getInventory({});
    expect(res.status).toBe(401);
    expect(inventoryReport).not.toHaveBeenCalled();
  });

  it('returns 403 for a student', async () => {
    const res = await getInventory({}, loginAs('USER'));
    expect(res.status).toBe(403);
    expect(inventoryReport).not.toHaveBeenCalled();
  });

  it.each(['MODERATOR', 'ADMIN'])('lets a %s open the report', async (role) => {
    const res = await getInventory({}, loginAs(role));
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ data: [], total: 0 });
  });
});

describe('GET /api/reports/inventory: filters', () => {
  it('uses page 1, 25 rows and code order when nothing is chosen', async () => {
    await getInventory({}, loginAs('MODERATOR'));
    expect(inventoryReport).toHaveBeenCalledWith(DEFAULTS);
  });

  it('passes the M9 filters on as numbers and a status', async () => {
    const query = { campus: '1', building: '2', room: '3', category: '4', status: 'NEEDS_REPAIR' };
    await getInventory({ ...query, sort: 'homeRoom', order: 'desc', page: '2' }, loginAs('ADMIN'));
    expect(inventoryReport).toHaveBeenCalledWith({
      campus: 1,
      building: 2,
      room: 3,
      category: 4,
      status: 'NEEDS_REPAIR',
      sort: 'homeRoom',
      order: 'desc',
      page: 2,
      pageSize: 25,
    });
  });

  it('drops fields that are not part of the report', async () => {
    await getInventory({ showDisposed: 'true', q: 'chair' }, loginAs('MODERATOR'));
    expect(inventoryReport).toHaveBeenCalledWith(DEFAULTS);
  });

  it.each([
    ['an unknown status', { status: 'MISSING' }],
    ['a room id that is not a number', { room: 'D569' }],
    ['an unknown sort column', { sort: 'price' }],
    ['a page size over 100', { pageSize: '1000' }],
    ['an unknown format', { format: 'xlsx' }],
  ])('returns 400 for %s', async (_, query) => {
    const res = await getInventory(query, loginAs('MODERATOR'));
    expect(res.status).toBe(400);
    expect(inventoryReport).not.toHaveBeenCalled();
    expect(inventoryCsv).not.toHaveBeenCalled();
  });
});

describe('GET /api/reports/inventory?format=csv', () => {
  it('downloads the CSV file with the same filters', async () => {
    const res = await getInventory({ format: 'csv', category: '4' }, loginAs('MODERATOR'));

    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toBe('text/csv; charset=utf-8');
    expect(res.headers['content-disposition']).toMatch(
      /^attachment; filename="?inventory-\d{4}-\d{2}-\d{2}\.csv"?$/,
    );
    expect(res.text).toBe('\uFEFFCode;Category\r\nMP-00123;Chair\r\n');
    expect(inventoryCsv).toHaveBeenCalledWith({ ...DEFAULTS, category: 4 });
    expect(inventoryReport).not.toHaveBeenCalled();
  });

  it('returns 403 for a student', async () => {
    const res = await getInventory({ format: 'csv' }, loginAs('USER'));
    expect(res.status).toBe(403);
    expect(inventoryCsv).not.toHaveBeenCalled();
  });
});
