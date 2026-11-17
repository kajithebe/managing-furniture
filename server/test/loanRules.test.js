// Borrowing rules (MF-10) with the messages from S3 and S4 in design-screens.
import { describe, expect, it } from 'vitest';
import {
  checkBorrowable,
  checkDueAt,
  initialStatus,
  isBorrowable,
  itemNotFound,
  shownStatus,
} from '../src/services/loanRules.js';

const HOUR = 60 * 60 * 1000;
const NOW = new Date('2026-11-09T09:30:00Z');

function item(overrides = {}) {
  return {
    code: 'MP-00123',
    onLoan: false,
    condition: 'GOOD',
    category: { autoApprove: true },
    ...overrides,
  };
}

// Runs fn and returns the error it throws.
function errorOf(fn) {
  try {
    fn();
  } catch (error) {
    return error;
  }
  throw new Error('Expected an error');
}

describe('shownStatus and isBorrowable (02 › status table)', () => {
  it.each([
    [{ condition: 'GOOD' }, 'AVAILABLE', true],
    [{ condition: 'NEEDS_REPAIR' }, 'NEEDS_REPAIR', true],
    [{ condition: 'BROKEN' }, 'BROKEN', false],
    [{ condition: 'IN_REPAIR' }, 'IN_REPAIR', false],
    [{ condition: 'DISPOSED' }, 'DISPOSED', false],
    [{ onLoan: true, condition: 'GOOD' }, 'ON_LOAN', false],
    [{ onLoan: true, condition: 'NEEDS_REPAIR' }, 'ON_LOAN', false],
  ])('%o is %s, borrowable: %s', (fields, status, borrowable) => {
    expect(shownStatus(item(fields))).toBe(status);
    expect(isBorrowable(item(fields))).toBe(borrowable);
  });
});

describe('initialStatus', () => {
  it('is APPROVED when the category approves automatically', () => {
    expect(initialStatus(item({ category: { autoApprove: true } }))).toBe('APPROVED');
  });

  it('is PENDING when the category needs a moderator', () => {
    expect(initialStatus(item({ category: { autoApprove: false } }))).toBe('PENDING');
  });
});

describe('checkDueAt', () => {
  it('accepts exactly the longest loan time', () => {
    expect(() => checkDueAt(new Date(NOW.getTime() + 4 * HOUR), 4, NOW)).not.toThrow();
  });

  it('refuses a longer loan with the setting in the message', () => {
    const error = errorOf(() => checkDueAt(new Date(NOW.getTime() + 4.5 * HOUR), 4, NOW));
    expect(error.status).toBe(400);
    expect(error.code).toBe('LOAN_TOO_LONG');
    expect(error.message).toBe('Until time is longer than 4 hours.');
    expect(error.details).toEqual({ maxLoanHours: 4 });
  });

  it('says "1 hour" when the setting is one hour', () => {
    const error = errorOf(() => checkDueAt(new Date(NOW.getTime() + 2 * HOUR), 1, NOW));
    expect(error.message).toBe('Until time is longer than 1 hour.');
  });

  it('refuses an until time that has already passed', () => {
    const error = errorOf(() => checkDueAt(new Date(NOW.getTime() - 1000), 4, NOW));
    expect(error.code).toBe('DUE_IN_PAST');
  });
});

describe('itemNotFound', () => {
  it('uses the S3 wording', () => {
    const error = itemNotFound('MP-99999');
    expect(error.status).toBe(404);
    expect(error.code).toBe('ITEM_NOT_FOUND');
    expect(error.message).toBe("We couldn't find item MP-99999. Check the code on the sticker.");
    expect(error.details).toEqual({ code: 'MP-99999' });
  });
});

describe('checkBorrowable', () => {
  it('accepts available and needs repair items', () => {
    expect(() =>
      checkBorrowable([item(), item({ code: 'MP-00124', condition: 'NEEDS_REPAIR' })]),
    ).not.toThrow();
  });

  it('S4: one item borrowed by someone else meanwhile', () => {
    const error = errorOf(() =>
      checkBorrowable([item(), item({ code: 'MP-00125', onLoan: true })]),
    );
    expect(error.status).toBe(409);
    expect(error.code).toBe('ITEM_NOT_AVAILABLE');
    expect(error.message).toBe('One item was borrowed by someone else meanwhile: MP-00125');
    expect(error.details).toEqual({ items: [{ code: 'MP-00125', status: 'ON_LOAN' }] });
  });

  it('S4 with several items on loan', () => {
    const error = errorOf(() =>
      checkBorrowable([
        item({ code: 'MP-00125', onLoan: true }),
        item({ code: 'MP-00126', onLoan: true }),
      ]),
    );
    expect(error.message).toBe(
      '2 items were borrowed by someone else meanwhile: MP-00125, MP-00126',
    );
  });

  it('S3: an item that cannot be borrowed right now', () => {
    const error = errorOf(() => checkBorrowable([item({ condition: 'BROKEN' })]));
    expect(error.code).toBe('ITEM_NOT_BORROWABLE');
    expect(error.message).toBe("This item can't be borrowed right now (Broken)");
    expect(error.details).toEqual({ items: [{ code: 'MP-00123', status: 'BROKEN' }] });
  });

  it('lists every blocked item when there are several', () => {
    const error = errorOf(() =>
      checkBorrowable([
        item({ condition: 'IN_REPAIR' }),
        item({ code: 'MP-00124', condition: 'DISPOSED' }),
      ]),
    );
    expect(error.message).toBe(
      "2 items can't be borrowed right now: MP-00123 (In repair), MP-00124 (Disposed)",
    );
  });

  it('reports items on loan before items in bad condition', () => {
    const error = errorOf(() =>
      checkBorrowable([item({ condition: 'BROKEN' }), item({ code: 'MP-00125', onLoan: true })]),
    );
    expect(error.code).toBe('ITEM_NOT_AVAILABLE');
  });
});
