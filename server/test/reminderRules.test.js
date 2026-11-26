// Reminder and "not yet returned" rules (MF-20).
import { describe, expect, it } from 'vitest';
import {
  approvedAt,
  groupForEmail,
  isPastDue,
  needsReminder,
  overdueEmailKind,
  reminderStart,
} from '../src/services/reminderRules.js';

const MINUTE = 60 * 1000;
const HOUR = 60 * MINUTE;
const DUE = new Date('2026-11-09T12:00:00Z'); // 14:00 in Helsinki
const REMINDER_MINUTES = 30;

// A chair borrowed at 10:00 (Helsinki), due at 14:00, auto-approved.
function loanItem(overrides = {}) {
  return {
    status: 'APPROVED',
    reminderSentAt: null,
    lastOverdueEmailAt: null,
    decidedAt: null,
    ...overrides,
    loan: { dueAt: DUE, createdAt: new Date(DUE - 4 * HOUR), ...overrides.loan },
  };
}

describe('approvedAt', () => {
  it('is the decision time for an item a moderator approved', () => {
    const decidedAt = new Date(DUE - 2 * HOUR);
    expect(approvedAt(loanItem({ decidedAt }))).toEqual(decidedAt);
  });

  it('is the request time for an auto-approved item', () => {
    expect(approvedAt(loanItem())).toEqual(new Date(DUE - 4 * HOUR));
  });
});

describe('reminderStart', () => {
  it('is reminderMinutes before the due time', () => {
    expect(reminderStart(DUE, 30)).toEqual(new Date(DUE - 30 * MINUTE));
  });
});

describe('needsReminder', () => {
  it('is false before the reminder time', () => {
    expect(needsReminder(loanItem(), new Date(DUE - 31 * MINUTE), REMINDER_MINUTES)).toBe(false);
  });

  it('is true from the reminder time until the due time', () => {
    expect(needsReminder(loanItem(), new Date(DUE - 30 * MINUTE), REMINDER_MINUTES)).toBe(true);
    expect(needsReminder(loanItem(), new Date(DUE - 1 * MINUTE), REMINDER_MINUTES)).toBe(true);
  });

  it('is false at or after the due time (the late email comes instead)', () => {
    expect(needsReminder(loanItem(), DUE, REMINDER_MINUTES)).toBe(false);
    expect(needsReminder(loanItem(), new Date(DUE.getTime() + HOUR), REMINDER_MINUTES)).toBe(false);
  });

  it('is false when the reminder was already sent (no duplicate after a restart)', () => {
    const item = loanItem({ reminderSentAt: new Date(DUE - 29 * MINUTE) });
    expect(needsReminder(item, new Date(DUE - 10 * MINUTE), REMINDER_MINUTES)).toBe(false);
  });

  it.each(['PENDING', 'DECLINED', 'RETURNED', 'OVERDUE'])('is false for a %s item', (status) => {
    expect(needsReminder(loanItem({ status }), new Date(DUE - 10 * MINUTE), REMINDER_MINUTES)).toBe(
      false,
    );
  });

  it('is false for a short loan approved after the reminder time started', () => {
    const item = loanItem({ loan: { createdAt: new Date(DUE - 20 * MINUTE) } });
    expect(needsReminder(item, new Date(DUE - 15 * MINUTE), REMINDER_MINUTES)).toBe(false);
  });

  it('is false when a moderator approved inside the reminder time', () => {
    const item = loanItem({ decidedAt: new Date(DUE - 25 * MINUTE) });
    expect(needsReminder(item, new Date(DUE - 20 * MINUTE), REMINDER_MINUTES)).toBe(false);
  });

  it('is true when the item went on loan exactly at the reminder time', () => {
    const item = loanItem({ decidedAt: new Date(DUE - 30 * MINUTE) });
    expect(needsReminder(item, new Date(DUE - 25 * MINUTE), REMINDER_MINUTES)).toBe(true);
  });
});

describe('isPastDue', () => {
  it('is true for an item on loan at or after the due time', () => {
    expect(isPastDue(loanItem(), DUE)).toBe(true);
  });

  it('is false before the due time', () => {
    expect(isPastDue(loanItem(), new Date(DUE - MINUTE))).toBe(false);
  });

  it.each(['PENDING', 'DECLINED', 'RETURNED', 'OVERDUE'])('is false for a %s item', (status) => {
    expect(isPastDue(loanItem({ status }), DUE)).toBe(false);
  });
});

describe('overdueEmailKind', () => {
  const now = new Date(DUE.getTime() + 5 * MINUTE);

  it('is "first" for a late item that has had no email yet', () => {
    expect(overdueEmailKind(loanItem({ status: 'OVERDUE' }), now, true)).toBe('first');
  });

  it('sends the first email even when the repeat setting is off', () => {
    expect(overdueEmailKind(loanItem({ status: 'OVERDUE' }), now, false)).toBe('first');
  });

  it('is null less than 24 h after the last email', () => {
    const item = loanItem({ status: 'OVERDUE', lastOverdueEmailAt: now });
    const later = new Date(now.getTime() + 24 * HOUR - MINUTE);
    expect(overdueEmailKind(item, later, true)).toBe(null);
  });

  it('is "repeat" 24 h after the last email', () => {
    const item = loanItem({ status: 'OVERDUE', lastOverdueEmailAt: now });
    const later = new Date(now.getTime() + 24 * HOUR);
    expect(overdueEmailKind(item, later, true)).toBe('repeat');
  });

  it('is null after 24 h when the repeat setting is off', () => {
    const item = loanItem({ status: 'OVERDUE', lastOverdueEmailAt: now });
    const later = new Date(now.getTime() + 48 * HOUR);
    expect(overdueEmailKind(item, later, false)).toBe(null);
  });

  it.each(['APPROVED', 'RETURNED', 'PENDING', 'DECLINED'])('is null for a %s item', (status) => {
    expect(overdueEmailKind(loanItem({ status }), now, true)).toBe(null);
  });
});

describe('groupForEmail', () => {
  const D569 = { id: 1, name: 'D569' };
  const D512 = { id: 2, name: 'D512' };

  function row(id, loanId, code, category, homeRoom) {
    return {
      id,
      loanId,
      item: { code, category: { name: category }, homeRoom },
      loan: { dueAt: DUE, user: { email: 'aino.virtanen@metropolia.fi' } },
    };
  }

  it('puts the items of one loan and one home room into one email', () => {
    const groups = groupForEmail([
      row(11, 5, 'MP-00123', 'Chair', D569),
      row(12, 5, 'MP-02210', 'Table', D569),
      row(13, 5, 'MP-03015', 'Chair', D512),
      row(14, 6, 'MP-00124', 'Chair', D569),
    ]);

    expect(groups).toEqual([
      {
        loanId: 5,
        email: 'aino.virtanen@metropolia.fi',
        dueAt: DUE,
        homeRoom: 'D569',
        loanItemIds: [11, 12],
        items: [
          { code: 'MP-00123', categoryName: 'Chair' },
          { code: 'MP-02210', categoryName: 'Table' },
        ],
      },
      {
        loanId: 5,
        email: 'aino.virtanen@metropolia.fi',
        dueAt: DUE,
        homeRoom: 'D512',
        loanItemIds: [13],
        items: [{ code: 'MP-03015', categoryName: 'Chair' }],
      },
      {
        loanId: 6,
        email: 'aino.virtanen@metropolia.fi',
        dueAt: DUE,
        homeRoom: 'D569',
        loanItemIds: [14],
        items: [{ code: 'MP-00124', categoryName: 'Chair' }],
      },
    ]);
  });

  it('gives no groups for no items', () => {
    expect(groupForEmail([])).toEqual([]);
  });
});
