// Sends email through the transport chosen by MAIL_TRANSPORT:
// mailpit (local development), smtp (Metropolia's mail server) or mailgun (Render demo).
// Callers never log the mail content: it can contain login codes.
import nodemailer from 'nodemailer';
import { env } from '../config/env.js';

const MAILPIT_PORT = 1025;
const MAILGUN_API = 'https://api.mailgun.net/v3';

let smtpTransport;

// One SMTP connection setup for the whole server, created on first use.
function getSmtpTransport() {
  if (!smtpTransport) {
    smtpTransport =
      env.MAIL_TRANSPORT === 'mailpit'
        ? nodemailer.createTransport({
            host: env.SMTP_HOST ?? 'localhost',
            port: MAILPIT_PORT,
            secure: false,
            ignoreTLS: true,
          })
        : nodemailer.createTransport({
            host: env.SMTP_HOST,
            port: env.SMTP_PORT,
            secure: env.SMTP_PORT === 465,
            auth: env.SMTP_USER ? { user: env.SMTP_USER, pass: env.SMTP_PASS } : undefined,
          });
  }
  return smtpTransport;
}

// Mailgun's HTTP API: no extra package needed, Node's fetch is enough.
async function sendWithMailgun({ to, subject, text, html }) {
  const body = new URLSearchParams({ from: env.MAIL_FROM, to, subject, text });
  if (html) {
    body.set('html', html);
  }
  const credentials = Buffer.from(`api:${env.MAILGUN_API_KEY}`).toString('base64');

  const response = await fetch(`${MAILGUN_API}/${env.MAILGUN_DOMAIN}/messages`, {
    method: 'POST',
    headers: { Authorization: `Basic ${credentials}` },
    body,
  });
  if (!response.ok) {
    throw new Error(`Mailgun answered with status ${response.status}`);
  }
}

export async function sendMail({ to, subject, text, html }) {
  if (env.MAIL_TRANSPORT === 'mailgun') {
    await sendWithMailgun({ to, subject, text, html });
    return;
  }
  await getSmtpTransport().sendMail({ from: env.MAIL_FROM, to, subject, text, html });
}
