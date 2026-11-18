// Inventory report (MF-16). The items list from MF-08 is mocked, so these tests check only
// what the report adds: the filter rules and the CSV columns.
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../src/services/itemService.js', () => ({ listItems: vi.fn() }));

const { listItems } = await import('../src/services/itemService.js');
const { INVENTORY_CSV_MAX_ROWS, inventoryCsv, inventoryReport } =
  await import('../src/services/reportService.js');

// An item as the items list returns it.
function item(overrides = {}) {
  return {
    code: 'MP-00123',
    name: 'Chair',
    category: { name: 'Chair' },
    brand: { name: 'Isku' },
    colour: { name: 'Grey' },
    hasWheels: false,
    wheelCount: null,
    homeRoom: { name: 'D569' },
    currentRoom: { name: 'D569' },
    status: 'AVAILABLE',
    ...overrides,
  };
}

const filters = { campus: 1, status: undefined, sort: 'code', order: 'asc', page: 2, pageSize: 25 };

beforeEach(() => {
  listItems.mockReset();
});

describe('inventoryReport', () => {
  it('returns one page from the items list, without disposed items and without search', async () => {
    listItems.mockResolvedValue({ data: [item()], total: 1 });

    const result = await inventoryReport({ ...filters, q: 'chair' });

    expect(result).toEqual({ data: [item()], total: 1 });
    expect(listItems).toHaveBeenCalledWith({
      ...filters,
      showDisposed: false,
      q: undefined,
    });
  });
});

describe('inventoryCsv', () => {
  it('asks for all matching items, not only the current page', async () => {
    listItems.mockResolvedValue({ data: [], total: 0 });

    await inventoryCsv(filters);

    expect(listItems).toHaveBeenCalledWith(
      expect.objectContaining({ campus: 1, page: 1, pageSize: INVENTORY_CSV_MAX_ROWS }),
    );
  });

  it('writes the M9 columns in screen order', async () => {
    listItems.mockResolvedValue({ data: [item()], total: 1 });

    // slice(1) drops the BOM at the start of the file.
    const csv = await inventoryCsv(filters);
    const [header, row] = csv.slice(1).split('\r\n');

    expect(header).toBe('Code;Category;Name;Brand;Colour;Wheels;Home room;Current room;Status');
    expect(row).toBe('MP-00123;Chair;Chair;Isku;Grey;No;D569;D569;Available');
  });

  it('shows the number of wheels, an empty brand and colour, and the status word', async () => {
    listItems.mockResolvedValue({
      data: [
        item({
          code: 'MP-00124',
          brand: null,
          colour: null,
          hasWheels: true,
          wheelCount: 5,
          currentRoom: { name: 'D751' },
          status: 'ON_LOAN',
        }),
      ],
      total: 1,
    });

    const csv = await inventoryCsv(filters);

    expect(csv).toContain('MP-00124;Chair;Chair;;;5;D569;D751;On loan\r\n');
  });

  it('guards user text against formulas through the shared CSV writer', async () => {
    listItems.mockResolvedValue({ data: [item({ name: '=HYPERLINK("x")' })], total: 1 });

    const csv = await inventoryCsv(filters);

    expect(csv).toContain(';"\'=HYPERLINK(""x"")";');
  });
});
