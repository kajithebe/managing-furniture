// Return rules (MF-19) with the messages from S8 and S9 in design-screens.
import { describe, expect, it } from 'vitest';
import { checkReturn, isReturnable, shouldClose } from '../src/services/returnRules.js';

const D569 = { id: 1, name: 'D569' };
const D512 = { id: 2, name: 'D512' };
const D751 = { id: 3, name: 'D751' };

function loanItem(id, code, status = 'APPROVED', homeRoom = D569) {
  return { id, status, item: { code, homeRoom } };
}

function loan(items, status = 'OPEN') {
  return { status, items };
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

describe('isReturnable', () => {
  it.each([
    ['APPROVED', true],
    ['OVERDUE', true],
    ['PENDING', false],
    ['DECLINED', false],
    ['RETURNED', false],
  ])('%s → %s', (status, expected) => {
    expect(isReturnable({ status })).toBe(expected);
  });
});

describe('shouldClose', () => {
  it('closes when every item is returned or declined', () => {
    expect(shouldClose(['RETURNED', 'DECLINED', 'RETURNED'])).toBe(true);
  });

  it.each(['PENDING', 'APPROVED', 'OVERDUE'])('stays open while an item is %s', (status) => {
    expect(shouldClose(['RETURNED', status])).toBe(false);
  });
});

describe('checkReturn', () => {
  it('returns the scanned items that belong in the room', () => {
    const items = [
      loanItem(11, 'MP-00123'),
      loanItem(12, 'MP-00124', 'OVERDUE'),
      loanItem(13, 'MP-00125'),
    ];
    const result = checkReturn(loan(items), D569, ['MP-00124', 'MP-00123']);
    expect(result.map((li) => li.id)).toEqual([12, 11]);
  });

  it('skips items that are already returned (double scan)', () => {
    const items = [loanItem(11, 'MP-00123', 'RETURNED'), loanItem(12, 'MP-00124')];
    const result = checkReturn(loan(items), D569, ['MP-00123', 'MP-00124']);
    expect(result.map((li) => li.id)).toEqual([12]);
  });

  it('refuses a closed loan', () => {
    const error = errorOf(() =>
      checkReturn(loan([loanItem(11, 'MP-00123', 'RETURNED')], 'CLOSED'), D569, ['MP-00123']),
    );
    expect(error).toMatchObject({
      status: 409,
      code: 'LOAN_CLOSED',
      message: 'This loan is already closed.',
    });
  });

  it('S8: refuses a room that is no open item’s home room', () => {
    const items = [loanItem(11, 'MP-00123'), loanItem(12, 'MP-00124')];
    const error = errorOf(() => checkReturn(loan(items), D751, ['MP-00123']));
    expect(error).toMatchObject({
      status: 409,
      code: 'WRONG_ROOM',
      message: 'This is D751. These items belong in D569.',
      details: { room: D751, homeRoom: D569 },
    });
  });

  it('S9: refuses a code that is not in the loan', () => {
    const error = errorOf(() => checkReturn(loan([loanItem(11, 'MP-00123')]), D569, ['MP-00456']));
    expect(error).toMatchObject({
      status: 409,
      code: 'ITEM_NOT_IN_LOAN',
      message: 'MP-00456 is not part of this loan',
      details: { itemCode: 'MP-00456' },
    });
  });

  it('S9: a declined item is not part of the loan', () => {
    const items = [loanItem(11, 'MP-00123'), loanItem(12, 'MP-00124', 'DECLINED')];
    const error = errorOf(() => checkReturn(loan(items), D569, ['MP-00124']));
    expect(error).toMatchObject({ code: 'ITEM_NOT_IN_LOAN', details: { itemCode: 'MP-00124' } });
  });

  it('refuses an item that is still waiting for approval', () => {
    const items = [loanItem(11, 'MP-00123'), loanItem(12, 'MP-00126', 'PENDING')];
    const error = errorOf(() => checkReturn(loan(items), D569, ['MP-00126']));
    expect(error).toMatchObject({
      status: 409,
      code: 'ITEM_NOT_ON_LOAN',
      message: 'MP-00126 is still waiting for approval',
      details: { itemCode: 'MP-00126' },
    });
  });

  it('S9: refuses an item whose home room is another room', () => {
    const items = [loanItem(11, 'MP-00123'), loanItem(12, 'MP-03015', 'APPROVED', D512)];
    const error = errorOf(() => checkReturn(loan(items), D569, ['MP-03015']));
    expect(error).toMatchObject({
      status: 409,
      code: 'ITEM_WRONG_HOME_ROOM',
      message: 'MP-03015 belongs in D512, not D569',
      details: { itemCode: 'MP-03015', homeRoom: D512, room: D569 },
    });
  });

  it('refuses the whole call when one item fails', () => {
    const items = [loanItem(11, 'MP-00123'), loanItem(12, 'MP-00124')];
    const error = errorOf(() => checkReturn(loan(items), D569, ['MP-00123', 'MP-00456']));
    expect(error.code).toBe('ITEM_NOT_IN_LOAN');
  });
});
