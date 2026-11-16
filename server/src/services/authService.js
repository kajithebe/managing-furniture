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
const BCRYPT_ROUNDS = 10;

function isAllowedEmail(email) {
  return email.endsWith(`@${env.ALLOWED_EMAIL_DOMAIN}`);
}

// 6 digits from a cryptographically secure random number, e.g. "048213".
function newCode() {
  return String(randomInt(0, 1_000_000)).padStart(6, '0');
}

// Sends a login code. Does not look up the user: the reply is the same
// whether the email has an account or not.
export async function requestCode(email) {
  if (!isAllowedEmail(email)) {
    throw new AppError(
      400,
      'EMAIL_DOMAIN_NOT_ALLOWED',
      `Use your @${env.ALLOWED_EMAIL_DOMAIN} email address.`,
    );
  }

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
