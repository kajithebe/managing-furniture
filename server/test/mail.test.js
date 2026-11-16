// Tests for the email templates (MF-14). No database and no mail server needed:
// each template is a function that returns { subject, text, html }.
import { describe, expect, it } from 'vitest';
import { loginCodeMail } from '../src/mail/loginCode.js';
import { notYetReturnedMail, stillNotReturnedMail } from '../src/mail/notYetReturned.js';
import { reminderMail } from '../src/mail/reminder.js';
import { requestDecidedMail } from '../src/mail/requestDecided.js';

// 9 Nov 2026 at 14:00 in Helsinki (UTC+2 in winter).
const DUE_AT = new Date('2026-11-09T12:00:00Z');
const SCRIPT = '<script>alert(1)</script>';
const ESCAPED_SCRIPT = '&lt;script&gt;alert(1)&lt;/script&gt;';

const chair = { code: 'MP-00126', categoryName: 'Chair' };
const table = { code: 'MP-02210', categoryName: 'Table' };

const decided = {
  userName: 'Aino Virtanen',
  item: table,
  fromRoom: 'D569',
  toRoom: 'D751',
  homeRoom: 'D569',
  reason: 'Group work',
  dueAt: DUE_AT,
};

// Every email must have all three parts and the shared layout.
function expectCompleteMail(mail) {
  expect(mail.subject).not.toBe('');
  expect(mail.text).toContain('Metropolia University of Applied Sciences · Metropolia Furniture');
  expect(mail.html).toMatch(/^<!doctype html>/);
  expect(mail.html).toContain('Metropolia Furniture');
  expect(mail.html).not.toContain('undefined');
  expect(mail.text).not.toContain('undefined');
}

describe('loginCodeMail', () => {
  const mail = loginCodeMail('482913', 10);

  it('has a subject, text and HTML', () => {
    expectCompleteMail(mail);
  });

  it('shows the code in two groups', () => {
    expect(mail.subject).toBe('Your login code: 482 913');
    expect(mail.text).toContain('482 913');
    expect(mail.html).toContain('482&nbsp;&nbsp;913');
  });

  it('says how long the code is valid', () => {
    expect(mail.text).toContain('Valid for 10 minutes.');
    expect(mail.html).toContain('Valid for 10 minutes.');
  });
});

describe('requestDecidedMail', () => {
  it('approved: tells where and when to bring the item back', () => {
    const mail = requestDecidedMail({ ...decided, approved: true });
    expectCompleteMail(mail);
    expect(mail.subject).toBe('Your table request is approved');
    expect(mail.text).toContain('Hello Aino,');
    expect(mail.text).toContain('Table MP-02210');
    expect(mail.text).toContain('D569 → D751 · Group work');
    expect(mail.text).toContain('Please bring it back to D569 by 14:00');
    expect(mail.html).toContain('/loans"');
  });

  it('declined: shows the note and what is still approved', () => {
    const mail = requestDecidedMail({
      ...decided,
      approved: false,
      note: 'All tables are booked for an exam',
      moderatorName: 'Mikko Laine',
      otherApprovedCount: 4,
    });
    expectCompleteMail(mail);
    expect(mail.subject).toBe('Your table request was declined');
    expect(mail.text).toContain('Note from Mikko Laine:');
    expect(mail.text).toContain('All tables are booked for an exam');
    expect(mail.text).toContain('4 other items in this request are still approved.');
    expect(mail.text).not.toContain('Please bring it back');
    expect(mail.html).toContain('Note from Mikko Laine');
  });

  it('declined without a note or other items leaves those parts out', () => {
    const mail = requestDecidedMail({ ...decided, approved: false });
    expectCompleteMail(mail);
    expect(mail.text).not.toContain('Note from');
    expect(mail.text).not.toContain('still approved');
  });

  it('greets without a name when the user has none', () => {
    const mail = requestDecidedMail({ ...decided, approved: true, userName: null });
    expect(mail.text).toContain('Hello,');
  });

  it('escapes user text in the HTML but keeps it as typed in the text version', () => {
    const mail = requestDecidedMail({
      ...decided,
      approved: false,
      userName: SCRIPT,
      reason: SCRIPT,
      note: SCRIPT,
      moderatorName: SCRIPT,
      fromRoom: SCRIPT,
      toRoom: SCRIPT,
      item: { code: 'MP-02210', categoryName: SCRIPT },
    });
    expect(mail.html).not.toContain('<script>');
    expect(mail.html).toContain(ESCAPED_SCRIPT);
    expect(mail.text).toContain(SCRIPT);
  });
});

describe('reminderMail', () => {
  it('lists the items and links to the return page of the loan', () => {
    const mail = reminderMail({
      loanId: 12,
      homeRoom: 'D569',
      dueAt: DUE_AT,
      items: [chair, table],
    });
    expectCompleteMail(mail);
    expect(mail.subject).toBe('Reminder: return 2 items to D569 by 14:00');
    expect(mail.text).toContain('Please return these 2 items to D569 by 14:00:');
    expect(mail.text).toContain('• Chair MP-00126');
    expect(mail.text).toContain('• Table MP-02210');
    expect(mail.text).toContain("Go to D569, scan the room's QR sticker, then scan each item.");
    expect(mail.html).toContain('/return/12"');
    expect(mail.html).toContain('Start return');
  });

  it('uses singular wording for one item', () => {
    const mail = reminderMail({ loanId: 12, homeRoom: 'D569', dueAt: DUE_AT, items: [chair] });
    expect(mail.subject).toBe('Reminder: return 1 item to D569 by 14:00');
    expect(mail.text).toContain('Please return this item to D569 by 14:00:');
  });

  it('escapes category and room names in the HTML', () => {
    const mail = reminderMail({
      loanId: 12,
      homeRoom: SCRIPT,
      dueAt: DUE_AT,
      items: [{ code: 'MP-00126', categoryName: SCRIPT }],
    });
    expect(mail.html).not.toContain('<script>');
    expect(mail.html).toContain(ESCAPED_SCRIPT);
  });
});

describe('notYetReturnedMail and stillNotReturnedMail', () => {
  const one = { homeRoom: 'D569', dueAt: DUE_AT, items: [chair] };
  const two = { homeRoom: 'D569', dueAt: DUE_AT, items: [chair, table] };

  it('first email: one item', () => {
    const mail = notYetReturnedMail(one);
    expectCompleteMail(mail);
    expect(mail.subject).toBe('1 item is not yet returned');
    expect(mail.text).toContain(
      "Chair MP-00126 was due back in D569 at 14:00 and hasn't been scanned in yet.",
    );
    expect(mail.text).toContain('reply to this email and a moderator will check.');
  });

  it('first email: several items are listed', () => {
    const mail = notYetReturnedMail(two);
    expectCompleteMail(mail);
    expect(mail.subject).toBe('2 items are not yet returned');
    expect(mail.text).toContain('• Chair MP-00126');
    expect(mail.text).toContain('• Table MP-02210');
  });

  it('repeat email: different wording with the due date', () => {
    const mail = stillNotReturnedMail(one);
    expectCompleteMail(mail);
    expect(mail.subject).toBe('Still not returned: Chair MP-00126 (due 9 Nov)');
    expect(mail.text).toContain('Chair MP-00126 was due back in D569 on 9 Nov at 14:00.');
    expect(mail.text).not.toBe(notYetReturnedMail(one).text);
  });

  it('repeat email: several items', () => {
    const mail = stillNotReturnedMail(two);
    expectCompleteMail(mail);
    expect(mail.subject).toBe('Still not returned: 2 items (due 9 Nov)');
    expect(mail.text).toContain('These 2 items were due back in D569 on 9 Nov at 14:00:');
  });

  it('never says "missing"', () => {
    for (const mail of [notYetReturnedMail(two), stillNotReturnedMail(two)]) {
      expect(`${mail.subject} ${mail.text} ${mail.html}`.toLowerCase()).not.toContain('missing');
    }
  });

  it('escapes category and room names in the HTML', () => {
    const input = {
      homeRoom: SCRIPT,
      dueAt: DUE_AT,
      items: [{ code: 'MP-00126', categoryName: SCRIPT }],
    };
    for (const mail of [notYetReturnedMail(input), stillNotReturnedMail(input)]) {
      expect(mail.html).not.toContain('<script>');
      expect(mail.html).toContain(ESCAPED_SCRIPT);
    }
  });
});
