// Login code checks (MF-07) with the messages from S2 in design-screens:
// "Wrong code. 3 tries left." and "This code has expired. Send a new code."
// The database is mocked, so these tests run anywhere, including CI.
import bcrypt from 'bcrypt';
import request from 'supertest';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../src/db.js', () => ({
  prisma: {
    otpCode: { findFirst: vi.fn(), update: vi.fn(), updateMany: vi.fn() },
    user: { findUnique: vi.fn(), count: vi.fn(), create: vi.fn(), update: vi.fn() },
  },
}));

const { prisma } = await import('../src/db.js');
const { createApp } = await import('../src/app.js');

const EMAIL = 'aino.virtanen@metropolia.fi';
const MINUTE = 60 * 1000;
let codeHash;

// A stored login code for "482913", valid for 10 more minutes unless changed.
function storedCode(overrides = {}) {
  return {
    id: 1,
    email: EMAIL,
    codeHash,
    attempts: 0,
    usedAt: null,
    expiresAt: new Date(Date.now() + 10 * MINUTE),
    ...overrides,
  };
}

function verify(code) {
  return request(createApp())
    .post('/api/auth/verify-code')
    .set('Origin', 'http://localhost:5173')
    .send({ email: EMAIL, code });
}

beforeAll(async () => {
  codeHash = await bcrypt.hash('482913', 4);
});

beforeEach(() => {
  vi.resetAllMocks();
  prisma.otpCode.updateMany.mockResolvedValue({ count: 1 });
});

describe('POST /api/auth/verify-code', () => {
  it('wrong code: CODE_WRONG with the tries left, as in S2', async () => {
    prisma.otpCode.findFirst.mockResolvedValue(storedCode({ attempts: 1 }));
    prisma.otpCode.update.mockResolvedValue(storedCode({ attempts: 2 }));

    const res = await verify('000000');

    expect(res.status).toBe(400);
    expect(res.body).toEqual({
      error: { code: 'CODE_WRONG', message: 'Wrong code. 3 tries left.', triesLeft: 3 },
    });
  });

  it('wrong code with one try left: "1 try left"', async () => {
    prisma.otpCode.findFirst.mockResolvedValue(storedCode({ attempts: 3 }));
    prisma.otpCode.update.mockResolvedValue(storedCode({ attempts: 4 }));

    const res = await verify('000000');

    expect(res.body.error).toEqual({
      code: 'CODE_WRONG',
      message: 'Wrong code. 1 try left.',
      triesLeft: 1,
    });
  });

  it('the last wrong try uses the code up: CODE_EXPIRED', async () => {
    prisma.otpCode.findFirst.mockResolvedValue(storedCode({ attempts: 4 }));
    prisma.otpCode.update.mockResolvedValue(storedCode({ attempts: 5 }));

    const res = await verify('000000');

    expect(res.body.error).toEqual({
      code: 'CODE_EXPIRED',
      message: 'This code has expired. Send a new code.',
    });
  });

  it.each([
    ['expired', storedCode({ expiresAt: new Date(Date.now() - MINUTE) })],
    ['no tries left', storedCode({ attempts: 5 })],
    ['never requested', null],
  ])('%s code: CODE_EXPIRED, as in S2', async (_, otp) => {
    prisma.otpCode.findFirst.mockResolvedValue(otp);

    const res = await verify('482913');

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('CODE_EXPIRED');
    expect(prisma.otpCode.update).not.toHaveBeenCalled();
  });

  it('code already used a moment ago (two tabs): CODE_EXPIRED', async () => {
    prisma.otpCode.findFirst.mockResolvedValue(storedCode());
    prisma.otpCode.updateMany.mockResolvedValue({ count: 0 });

    const res = await verify('482913');

    expect(res.body.error.code).toBe('CODE_EXPIRED');
  });

  it('right code: logs in and sets the session cookie', async () => {
    prisma.otpCode.findFirst.mockResolvedValue(storedCode());
    prisma.user.findUnique.mockResolvedValue(null);
    prisma.user.count.mockResolvedValue(1);
    prisma.user.create.mockResolvedValue({
      id: 9,
      email: EMAIL,
      name: 'Aino Virtanen',
      role: 'USER',
      active: true,
    });

    const res = await verify('482 913');

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ id: 9, email: EMAIL, name: 'Aino Virtanen', role: 'USER' });
    expect(res.headers['set-cookie'][0]).toMatch(/^mf_session=/);
  });
});

describe('POST /api/auth/request-code', () => {
  it('another domain: the S1 message "Use your @metropolia.fi address"', async () => {
    const res = await request(createApp())
      .post('/api/auth/request-code')
      .set('Origin', 'http://localhost:5173')
      .send({ email: 'aino@example.com' });

    expect(res.status).toBe(400);
    expect(res.body.error).toEqual({
      code: 'EMAIL_DOMAIN_NOT_ALLOWED',
      message: 'Use your @metropolia.fi address',
    });
  });
});
