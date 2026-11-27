// GET /api/reports/loans (MF-32): who may open it and which filters it accepts.
// The database and the report service are mocked, so this runs anywhere, including CI.
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../src/db.js', () => ({ prisma: { user: { findUnique: vi.fn() } } }));
vi.mock('../src/services/reportService.js', () => ({
  inventoryReport: vi.fn(),
  inventoryCsv: vi.fn(),
  loansReport: vi.fn(),
  loansCsv: vi.fn(),
}));

const { prisma } = await import('../src/db.js');
const { loansCsv, loansReport } = await import('../src/services/reportService.js');
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

function getLoans(query, cookie) {
  const req = request(createApp()).get('/api/reports/loans').query(query);
  return cookie ? req.set('Cookie', cookie) : req;
}

beforeEach(() => {
  vi.clearAllMocks();
  loansReport.mockResolvedValue({ data: [], total: 0 });
  loansCsv.mockResolvedValue('\uFEFFLoan date\r\n');
});

describe('GET /api/reports/loans – access', () => {
  it('refuses a request without a session (401)', async () => {
    const res = await getLoans({});
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('NOT_LOGGED_IN');
    expect(loansReport).not.toHaveBeenCalled();
  });

  it('refuses a student (403)', async () => {
    const res = await getLoans({}, loginAs('USER'));
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('FORBIDDEN');
    expect(loansReport).not.toHaveBeenCalled();
  });

  it.each(['MODERATOR', 'ADMIN'])('lets a %s open the report', async (role) => {
    const res = await getLoans({}, loginAs(role));
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ data: [], total: 0 });
  });
});

describe('GET /api/reports/loans – filters', () => {
  it('uses page 1 and 25 rows when nothing is chosen', async () => {
    await getLoans({}, loginAs('MODERATOR'));
    expect(loansReport).toHaveBeenCalledWith({ page: 1, pageSize: 25 });
  });

  it('passes the filters as numbers and drops unknown fields', async () => {
    await getLoans(
      {
        from: '2026-11-01',
        to: '2026-11-30',
        category: '4',
        room: '1',
        status: 'OPEN',
        page: '2',
        q: 'chair',
      },
      loginAs('MODERATOR'),
    );
    expect(loansReport).toHaveBeenCalledWith({
      from: '2026-11-01',
      to: '2026-11-30',
      category: 4,
      room: 1,
      status: 'OPEN',
      page: 2,
      pageSize: 25,
    });
  });

  it('accepts the same day as start and end', async () => {
    const res = await getLoans({ from: '2026-11-20', to: '2026-11-20' }, loginAs('MODERATOR'));
    expect(res.status).toBe(200);
  });

  it.each([
    ['a day that does not exist', { from: '2026-02-31' }],
    ['a date in another format', { to: '20.11.2026' }],
    ['a start date after the end date', { from: '2026-11-30', to: '2026-11-01' }],
    ['an unknown status', { status: 'LATE' }],
    ['a room that is not a number', { room: 'D569' }],
    ['more than 100 rows per page', { pageSize: '500' }],
  ])('refuses %s (400)', async (_name, query) => {
    const res = await getLoans(query, loginAs('MODERATOR'));
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
    expect(loansReport).not.toHaveBeenCalled();
  });
});

describe('GET /api/reports/loans?format=csv', () => {
  it('downloads all matching loans as a CSV file, without paging', async () => {
    const res = await getLoans(
      { format: 'csv', status: 'CLOSED', page: '3' },
      loginAs('MODERATOR'),
    );
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toBe('text/csv; charset=utf-8');
    expect(res.headers['content-disposition']).toMatch(
      /^attachment; filename="?loans-\d{4}-\d{2}-\d{2}\.csv"?$/,
    );
    expect(loansCsv).toHaveBeenCalledWith({ status: 'CLOSED' });
    expect(loansReport).not.toHaveBeenCalled();
  });

  it('refuses a student (403)', async () => {
    const res = await getLoans({ format: 'csv' }, loginAs('USER'));
    expect(res.status).toBe(403);
    expect(loansCsv).not.toHaveBeenCalled();
  });

  it('refuses an unknown format (400)', async () => {
    const res = await getLoans({ format: 'xlsx' }, loginAs('MODERATOR'));
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });
});
