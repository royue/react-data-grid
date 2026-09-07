import { page, userEvent } from 'vitest/browser';

import type { Column } from '../../../src';
import { getCellsAtRowIndex, scrollGrid, setup, validateCellPosition } from '../utils';

describe('rowSpan', () => {
  it('keeps a merged cell visible as its active row leaves and reenters the viewport', async () => {
    const columns: readonly Column<number>[] = [
      {
        key: 'merged',
        name: 'Merged',
        width: 100,
        rowSpan: ({ row }) => (row === 0 ? 50 : undefined),
        renderCell: () => 'merged'
      },
      { key: 'value', name: 'Value', width: 100, renderCell: ({ row }) => String(row) }
    ];
    await setup({
      columns,
      rows: Array.from({ length: 100 }, (_, index) => index),
      style: { width: 250, height: 200 }
    });
    const mergedCell = getCellsAtRowIndex(0).nth(0);
    await userEvent.click(mergedCell);
    scrollGrid({ top: 700 });
    await expect.element(getCellsAtRowIndex(20)).toHaveLength(1);
    await expect.element(getCellsAtRowIndex(0)).toHaveLength(1);
    await expect.element(mergedCell).toHaveStyle({ blockSize: '1750px' });
    await expect.element(page.getActiveCell()).toHaveTextContent('merged');

    scrollGrid({ top: 0 });
    await expect.element(getCellsAtRowIndex(0)).toHaveLength(2);
    await expect.element(mergedCell).toHaveAttribute('aria-rowspan', '50');
    await expect.element(mergedCell).toHaveStyle({ blockSize: '1750px' });
  });

  function setupRowSpan() {
    interface Row {
      readonly id: number;
      readonly group: string;
      readonly value: string;
    }

    const columns: readonly Column<Row>[] = [
      {
        key: 'group',
        name: 'Group',
        width: 80,
        rowSpan({ row }) {
          if (row.id === 0) return 3;
          return undefined;
        },
        renderCell({ row }) {
          return row.group;
        }
      },
      {
        key: 'value',
        name: 'Value',
        width: 80,
        renderCell({ row }) {
          return row.value;
        }
      },
      {
        key: 'id',
        name: 'ID',
        width: 80,
        renderCell({ row }) {
          return row.id;
        }
      }
    ];
    const rows: readonly Row[] = [
      { id: 0, group: 'A', value: 'A0' },
      { id: 1, group: 'A', value: 'A1' },
      { id: 2, group: 'A', value: 'A2' },
      { id: 3, group: 'B', value: 'B3' }
    ];

    return setup({ columns, rows, rowHeight: 35 });
  }

  it('should merge cells vertically', async () => {
    await setupRowSpan();

    const row1 = getCellsAtRowIndex(0);
    await expect.element(row1).toHaveLength(3);
    await expect.element(row1.nth(0)).toHaveAttribute('aria-colindex', '1');
    await expect.element(row1.nth(0)).toHaveAttribute('aria-rowspan', '3');
    await expect.element(row1.nth(0)).toHaveStyle({ blockSize: '105px' });

    await expect.element(getCellsAtRowIndex(1)).toHaveLength(2);
    await expect.element(getCellsAtRowIndex(1).nth(0)).toHaveAttribute('aria-colindex', '2');
    await expect.element(getCellsAtRowIndex(2)).toHaveLength(2);
    await expect.element(getCellsAtRowIndex(2).nth(0)).toHaveAttribute('aria-colindex', '2');
    await expect.element(getCellsAtRowIndex(3)).toHaveLength(3);
  });

  it('should navigate over vertically merged cells', async () => {
    await setupRowSpan();

    await userEvent.click(getCellsAtRowIndex(0).nth(0));
    await validateCellPosition(0, 1);
    await userEvent.keyboard('{arrowdown}');
    await validateCellPosition(0, 4);
    await userEvent.keyboard('{arrowup}');
    await validateCellPosition(0, 1);
  });

  it('should not merge cells across frozen column boundaries', async () => {
    interface Row {
      readonly id: number;
    }

    const columns: readonly Column<Row>[] = [
      {
        key: 'frozen',
        name: 'Frozen',
        frozen: true,
        rowSpan({ row }) {
          return row.id === 0 ? 2 : undefined;
        },
        colSpan(args) {
          return args.type === 'ROW' && args.row.id === 0 ? 2 : undefined;
        }
      },
      {
        key: 'regular1',
        name: 'Regular 1'
      },
      {
        key: 'regular2',
        name: 'Regular 2',
        rowSpan({ row }) {
          return row.id === 0 ? 2 : undefined;
        },
        colSpan(args) {
          return args.type === 'ROW' && args.row.id === 0 ? 2 : undefined;
        }
      },
      {
        key: 'rightFrozen',
        name: 'Right Frozen',
        frozenRight: true
      }
    ];

    await setup({
      columns,
      rows: [{ id: 0 }, { id: 1 }],
      rowHeight: 35
    });

    const firstRow = getCellsAtRowIndex(0);
    await expect.element(firstRow).toHaveLength(4);
    await expect.element(firstRow.nth(0)).toHaveAttribute('aria-rowspan', '2');
    await expect.element(firstRow.nth(0)).not.toHaveAttribute('aria-colspan');
    await expect.element(firstRow.nth(2)).toHaveAttribute('aria-rowspan', '2');
    await expect.element(firstRow.nth(2)).not.toHaveAttribute('aria-colspan');

    const secondRow = getCellsAtRowIndex(1);
    await expect.element(secondRow).toHaveLength(2);
    await expect.element(secondRow.nth(0)).toHaveAttribute('aria-colindex', '2');
    await expect.element(secondRow.nth(1)).toHaveAttribute('aria-colindex', '4');
  });
});
