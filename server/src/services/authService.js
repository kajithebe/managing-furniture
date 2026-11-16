// Login with a one-time code (02 › Login security).
import { randomInt } from 'node:crypto';
import bcrypt from 'bcrypt';
import { env } from '../config/env.js';
import { prisma } from '../db.js';
import { loginCodeMail } from '../mail/loginCode.js';
import { AppError } from '../middleware/error.js';
import { sendMail } from './mailService.js';

const MINUTE = 60 * 1000;
const CODE_VALID_MINUTES = 10;
const MAX_CODES_PER_WINDOW = 3;
const CODE_WINDOW_MINUTES = 15;
const MAX_ATTEMPTS = 5;
const BCRYPT_ROUNDS = 10;

function isAllowedEmail(email) {
  return email.endsWith(`@${env.ALLOWED_EMAIL_DOMAIN}`);
}

function assertAllowedEmail(email) {
  if (!isAllowedEmail(email)) {
    throw new AppError(
      400,
      'EMAIL_DOMAIN_NOT_ALLOWED',
      `Use your @${env.ALLOWED_EMAIL_DOMAIN} address`,
    );
  }
}

// 6 digits from a cryptographically secure random number, e.g. "048213".
function newCode() {
  return String(randomInt(0, 1_000_000)).padStart(6, '0');
}

// "anna.virtanen@metropolia.fi" → "Anna Virtanen" (users can correct it on their profile).
function nameFromEmail(email) {
  return email
    .split('@')[0]
    .split(/[._-]+/)
    .filter(Boolean)
    .map((part) => part[0].toUpperCase() + part.slice(1))
    .join(' ');
}

// The user as the API returns it: never more than the client needs.
export function publicUser(user) {
  return { id: user.id, email: user.email, name: user.name, role: user.role };
}

// Sends a login code. Does not look up the user: the reply is the same
// whether the email has an account or not.
export async function requestCode(email) {
  assertAllowedEmail(email);

  const since = new Date(Date.now() - CODE_WINDOW_MINUTES * MINUTE);
  const recentCodes = await prisma.otpCode.count({ where: { email, createdAt: { gte: since } } });
  if (recentCodes >= MAX_CODES_PER_WINDOW) {
    throw new AppError(
      429,
      'TOO_MANY_CODES',
      `Too many codes requested. Try again in ${CODE_WINDOW_MINUTES} minutes.`,
    );
  }

  const code = newCode();
  const otp = await prisma.otpCode.create({
    data: {
      email,
      codeHash: await bcrypt.hash(code, BCRYPT_ROUNDS),
      expiresAt: new Date(Date.now() + CODE_VALID_MINUTES * MINUTE),
    },
  });

  // Demo only (env.js refuses this on a Metropolia server): show the code on the page.
  if (env.OTP_DELIVERY === 'screen') {
    return { ok: true, code };
  }

  try {
    await sendMail({ to: email, ...loginCodeMail(code, CODE_VALID_MINUTES) });
  } catch (err) {
    // The unsent code must not count against the user's limit.
    await prisma.otpCode.delete({ where: { id: otp.id } });
    console.error(`Sending the login code failed: ${err.message}`);
    throw new AppError(503, 'MAIL_FAILED', 'The email could not be sent. Please try again.');
  }

  return { ok: true };
}

// First login creates the user (name from the email). INITIAL_ADMIN_EMAIL becomes ADMIN
// when no active admin exists yet (02 › User safety rules: "first start or first login").
async function findOrCreateUser(email) {
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing && !existing.active) {
    throw new AppError(
      403,
      'ACCOUNT_DEACTIVATED',
      'This account is deactivated. Please contact a Metropolia Furniture admin.',
    );
  }

  const isFirstAdmin =
    email === env.INITIAL_ADMIN_EMAIL &&
    (await prisma.user.count({ where: { role: 'ADMIN', active: true } })) === 0;

  if (!existing) {
    return prisma.user.create({
      data: {
        email,
        name: nameFromEmail(email),
        role: isFirstAdmin ? 'ADMIN' : 'USER',
        lastLoginAt: new Date(),
      },
    });
  }

  return prisma.user.update({
    where: { id: existing.id },
    data: {
      lastLoginAt: new Date(),
      ...(existing.name ? {} : { name: nameFromEmail(email) }),
      ...(isFirstAdmin ? { role: 'ADMIN' } : {}),
    },
  });
}

// S2 (design-screens): "Wrong code. 3 tries left." The plural is fixed for one try left.
function wrongCode(triesLeft) {
  const tries = triesLeft === 1 ? 'try' : 'tries';
  return new AppError(400, 'CODE_WRONG', `Wrong code. ${triesLeft} ${tries} left.`, { triesLeft });
}

// S2 (design-screens): used for an expired code, a used-up code (no tries left, already used)
// and when no code was requested. The user's next step is the same: send a new code.
function expiredCode() {
  return new AppError(400, 'CODE_EXPIRED', 'This code has expired. Send a new code.');
}

// Checks the code and returns the logged-in user. The route then starts the session.
export async function verifyCode(email, code) {
  assertAllowedEmail(email);

  // Only the newest unused code counts; an older code is replaced by a new request.
  const otp = await prisma.otpCode.findFirst({
    where: { email, usedAt: null },
    orderBy: { createdAt: 'desc' },
  });
  if (!otp || otp.expiresAt <= new Date() || otp.attempts >= MAX_ATTEMPTS) {
    throw expiredCode();
  }

  if (!(await bcrypt.compare(code, otp.codeHash))) {
    const { attempts } = await prisma.otpCode.update({
      where: { id: otp.id },
      data: { attempts: { increment: 1 } },
    });
    const triesLeft = MAX_ATTEMPTS - attempts;
    // The last wrong try uses the code up: the screen then asks for a new code.
    throw triesLeft > 0 ? wrongCode(triesLeft) : expiredCode();
  }

  // Single use: mark this code as used, only if nobody used it a moment ago (two tabs).
  const { count } = await prisma.otpCode.updateMany({
    where: { id: otp.id, usedAt: null },
    data: { usedAt: new Date() },
  });
  if (count === 0) {
    throw expiredCode();
  }
  // Older open codes for this email are no longer needed either.
  await prisma.otpCode.updateMany({
    where: { email, usedAt: null },
    data: { usedAt: new Date() },
  });

  return publicUser(await findOrCreateUser(email));
}
