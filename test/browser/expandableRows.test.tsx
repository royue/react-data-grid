import { page, userEvent } from 'vitest/browser';

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

  expect(page.getGrid().element().style.gridTemplateRows).toMatch(
    /^(?:40px|repeat\(1, 40px\)) 40px 250px 40px$/
  );
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

test('supports the antd-style uncontrolled master/detail API', async () => {
  const onExpand = vi.fn();
  const onExpandedRowsChange = vi.fn();

  await setup({
    columns: [{ key: 'name', name: 'Name' }],
    rows,
    rowKeyGetter,
    expandable: {
      defaultExpandedRowKeys: new Set([2]),
      onExpand,
      onExpandedRowsChange,
      expandedRowRender({ row, rowIdx, depth, isExpanded }) {
        return (
          <span>
            detail {row.id} {rowIdx} {depth} {String(isExpanded)}
          </span>
        );
      }
    }
  });

  await expect.element(page.getByText('detail 2 1 0 true')).toBeInTheDocument();
  await userEvent.click(page.getByRole('button', { name: 'Expand row' }).first());
  await expect.element(page.getByText('detail 1 0 0 true')).toBeInTheDocument();
  expect(onExpand).toHaveBeenCalledWith(true, rows[0]);
  expect(onExpandedRowsChange).toHaveBeenCalledWith(new Set([1, 2]));
});

test('renders nested rows as tree data', async () => {
  interface TreeRow extends Row {
    children?: readonly TreeRow[];
  }

  const treeRows: readonly TreeRow[] = [
    {
      id: 1,
      name: 'parent',
      children: [{ id: 2, name: 'child', children: [{ id: 3, name: 'grandchild' }] }]
    },
    { id: 4, name: 'sibling' }
  ];

  await setup({
    columns: [{ key: 'name', name: 'Name' }],
    rows: treeRows,
    rowKeyGetter,
    expandable: {
      defaultExpandAllRows: true
    }
  });

  await expect.element(page.getTreeGrid()).toBeInTheDocument();
  await expect.element(page.getRow({ name: /parent/ })).toHaveAttribute('aria-level', '1');
  await expect.element(page.getRow({ name: /child/ }).first()).toHaveAttribute('aria-level', '2');
  await expect.element(page.getRow({ name: /grandchild/ })).toHaveAttribute('aria-level', '3');

  const childExpandButton = page
    .getRow()
    .filter({ has: page.getCell({ name: 'child' }) })
    .getByRole('button', { name: 'Collapse row' });
  const buttonRect = childExpandButton.element().getBoundingClientRect();
  const expandCellRect = childExpandButton
    .element()
    .closest('[role="gridcell"]')!
    .getBoundingClientRect();
  expect(buttonRect.left).toBeGreaterThanOrEqual(expandCellRect.left);
  expect(buttonRect.right).toBeLessThanOrEqual(expandCellRect.right);

  await userEvent.click(page.getByRole('button', { name: 'Collapse row' }).first());
  await expect.element(page.getCell({ name: 'child' })).not.toBeInTheDocument();
  await expect.element(page.getCell({ name: 'grandchild' })).not.toBeInTheDocument();
});

test('reports the top-level ancestor index when a nested row changes', async () => {
  interface TreeRow extends Row {
    children?: readonly TreeRow[];
  }

  const treeRows: readonly TreeRow[] = [
    { id: 1, name: 'parent', children: [{ id: 2, name: 'child' }] }
  ];
  const onRowsChange = vi.fn();

  await setup({
    columns: [
      {
        key: 'name',
        name: 'Name',
        renderCell({ row, onRowChange }) {
          return (
            <button type="button" onClick={() => onRowChange({ ...row, name: 'updated child' })}>
              Update {row.name}
            </button>
          );
        }
      }
    ],
    rows: treeRows,
    rowKeyGetter,
    onRowsChange,
    expandable: {
      defaultExpandAllRows: true
    }
  });

  await userEvent.click(page.getByRole('button', { name: 'Update child' }));

  expect(onRowsChange).toHaveBeenCalledOnce();
  const [updatedRows, data] = onRowsChange.mock.calls[0];
  expect(updatedRows).toStrictEqual([
    { id: 1, name: 'parent', children: [{ id: 2, name: 'updated child' }] }
  ]);
  expect(data.indexes).toStrictEqual([0]);
});

test('supports expanding a row by clicking a cell', async () => {
  await setup({
    columns: [{ key: 'name', name: 'Name' }],
    rows,
    rowKeyGetter,
    expandable: {
      expandRowByClick: true,
      showExpandColumn: false,
      expandedRowRender({ row }) {
        return <span>detail {row.id}</span>;
      }
    }
  });

  await userEvent.click(page.getCell({ name: 'one' }));
  await expect.element(page.getByText('detail 1')).toBeInTheDocument();
});
