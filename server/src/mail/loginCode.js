// Email 1: the one-time login code (design: figma-4-emails, "Email 1").
// The code is shown in two groups, e.g. "482 913", so it is easy to read and type.
// Nothing here is typed by a user: the code is made by the server.
import { COLOR, FONT_MONO, htmlEmail, paragraph, textEmail } from './layout.js';

export function loginCodeMail(code, validMinutes) {
  const grouped = `${code.slice(0, 3)} ${code.slice(3)}`;
  const title = 'Your login code';
  const hint = `Valid for ${validMinutes} minutes. If you didn't ask for it, you can ignore this email.`;

  // &nbsp; keeps the two groups on one line and gives the wide gap from the design.
  const codeHtml = `<p style="margin:0 0 16px;font-family:${FONT_MONO};font-size:48px;line-height:56px;font-weight:600;color:${COLOR.ink};">${code.slice(0, 3)}&nbsp;&nbsp;${code.slice(3)}</p>`;

  return {
    subject: `Your login code: ${grouped}`,
    text: textEmail({ lines: [title, '', grouped, '', hint] }),
    html: htmlEmail({ title, bodyHtml: `${codeHtml}${paragraph(hint)}` }),
  };
}
