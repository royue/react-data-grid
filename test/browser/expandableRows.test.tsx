import { page } from 'vitest/browser';

import type { Column } from '../../src';
import { scrollGrid, setup } from './utils';

interface Row {
  id: number;
  name: string;
}

const rows: readonly Row[] = [
  { id: 1, name: 'one' },
  { id: 2, name: 'two' }
];

function rowKeyGetter(row: Row) {
  return row.id;
}

test('numeric rowHeight is used as the expandable grid header default', async () => {
  const columns: readonly Column<Row>[] = [{ key: 'name', name: 'Name' }];

  await setup({
    columns,
    rows,
    rowKeyGetter,
    rowHeight: 40,
    expandable: {
      expandedRowKeys: new Set([1]),
      onExpandedRowKeysChange() {},
      renderExpandedRow({ row }) {
        return <span>expanded {row.id}</span>;
      }
    }
  });

  expect(page.getGrid().element().style.gridTemplateRows).toBe('40px 40px 250px 40px');
});

test('expanded detail rows are not passed to column callbacks', async () => {
  const callbackRows: unknown[] = [];
  const columns: Column<Row>[] = [
    {
      key: 'name',
      name: 'Name',
      width: 100,
      colSpan(args) {
        if (args.type === 'ROW') {
          callbackRows.push(args.row);
        }
        return 2;
      },
      renderEditCell() {
        return null;
      },
      editable(row) {
        callbackRows.push(row);
        return true;
      }
    }
  ];

  for (let i = 0; i < 10; i++) {
    columns.push({ key: `extra-${i}`, name: `Extra ${i}`, width: 100 });
  }

  await setup({
    columns,
    rows,
    rowKeyGetter,
    style: { width: 200, height: 200 },
    expandable: {
      expandedRowKeys: new Set([1]),
      onExpandedRowKeysChange() {},
      renderExpandedRow({ row }) {
        return <span>expanded {row.id}</span>;
      }
    }
  });

  scrollGrid({ left: 200 });
  await new Promise(requestAnimationFrame);

  expect(callbackRows.length).toBeGreaterThan(0);
  expect(callbackRows.every((row) => typeof row === 'object' && row != null && 'id' in row)).toBe(
    true
  );
});
