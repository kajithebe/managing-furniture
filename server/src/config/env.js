// Reads the environment variables once at startup and checks them.
// If something is missing or wrong, the server stops with a clear list
// instead of failing later in a random place.
import { z } from 'zod';

// In .env, "SMTP_HOST=" gives an empty string: treat it as "not set".
const blankToUndefined = (value) => (value === '' ? undefined : value);

const optionalText = z.preprocess(blankToUndefined, z.string().optional());

const port = (fallback) =>
  z.preprocess(blankToUndefined, z.coerce.number().int().min(1).max(65535).default(fallback));

const schema = z
  .object({
    // App
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
    PORT: port(3000),
    BASE_URL: z.url(),
    TZ: z.string().default('Europe/Helsinki'),

    // Database
    DATABASE_URL: z.string().regex(/^postgres(ql)?:\/\//, 'must start with postgresql://'),

    // Login
    SESSION_SECRET: z.string().min(32, 'must be at least 32 characters'),
    ALLOWED_EMAIL_DOMAIN: z
      .string()
      .trim()
      .toLowerCase()
      .regex(/^[a-z0-9.-]+\.[a-z]{2,}$/, 'must be a domain like metropolia.fi (without @)'),
    INITIAL_ADMIN_EMAIL: z.string().trim().toLowerCase().pipe(z.email()),
    OTP_DELIVERY: z.enum(['email', 'screen']).default('email'),

    // Email
    MAIL_TRANSPORT: z.enum(['mailpit', 'mailgun', 'smtp']).default('mailpit'),
    MAIL_FROM: z.string().min(1),
    SMTP_HOST: optionalText,
    SMTP_PORT: port(587),
    SMTP_USER: optionalText,
    SMTP_PASS: optionalText,
    MAILGUN_API_KEY: optionalText,
    MAILGUN_DOMAIN: optionalText,
  })
  .superRefine((env, ctx) => {
    if (!env.INITIAL_ADMIN_EMAIL.endsWith(`@${env.ALLOWED_EMAIL_DOMAIN}`)) {
      ctx.addIssue({
        code: 'custom',
        path: ['INITIAL_ADMIN_EMAIL'],
        message: `must end with @${env.ALLOWED_EMAIL_DOMAIN}`,
      });
    }
    if (env.MAIL_TRANSPORT === 'smtp' && !env.SMTP_HOST) {
      ctx.addIssue({
        code: 'custom',
        path: ['SMTP_HOST'],
        message: 'is required when MAIL_TRANSPORT=smtp',
      });
    }
    if (env.MAIL_TRANSPORT === 'mailgun') {
      for (const name of ['MAILGUN_API_KEY', 'MAILGUN_DOMAIN']) {
        if (!env[name]) {
          ctx.addIssue({
            code: 'custom',
            path: [name],
            message: 'is required when MAIL_TRANSPORT=mailgun',
          });
        }
      }
    }
  });

const result = schema.safeParse(process.env);

if (!result.success) {
  const problems = result.error.issues
    .map((issue) => `  - ${issue.path.join('.') || 'env'}: ${issue.message}`)
    .join('\n');
  // Only variable names and messages are printed, never the values (they can be secrets).
  console.error(`Invalid environment variables:\n${problems}`);
  process.exit(1);
}

export const env = Object.freeze(result.data);
export const isProduction = env.NODE_ENV === 'production';
