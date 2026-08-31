import { commands, page } from 'vitest/browser';

import { DataGrid, type Column } from '../../src';
import { getCellsAtRowIndex, scrollGrid, setup } from './utils';

interface Row {
  id: number;
  description: string;
  span?: string;
}

const shortText = 'Short text';
const longText = 'Long text that wraps onto several lines when the description column is narrow.';

test('mounts without ResizeObserver when auto height is disabled', async () => {
  const resizeObserverDescriptor = Object.getOwnPropertyDescriptor(globalThis, 'ResizeObserver');
  Object.defineProperty(globalThis, 'ResizeObserver', {
    configurable: true,
    writable: true,
    value: undefined
  });

  try {
    await setup({
      columns: [{ key: 'description', name: 'Description' }],
      rows: [{ id: 1, description: shortText }]
    });

    await expect.element(page.getCell({ name: shortText })).toHaveLength(1);
  } finally {
    Object.defineProperty(globalThis, 'ResizeObserver', resizeObserverDescriptor!);
  }
});

test('only grows rows whose content wraps', async () => {
  const columns: readonly Column<Row>[] = [
    { key: 'id', name: 'ID', width: 50 },
    {
      key: 'description',
      name: 'Description',
      width: 100,
      wrapText: true,
      autoHeight: true
    }
  ];

  await setup({
    columns,
    rows: [
      { id: 1, description: shortText },
      { id: 2, description: longText }
    ],
    rowHeight: 35,
    style: { width: 200, height: 200 }
  });

  const rows = page.getRow();
  await expect.poll(() => rows.nth(0).element().getBoundingClientRect().height).toBe(35);
  await expect.poll(() => rows.nth(1).element().getBoundingClientRect().height).toBeGreaterThan(35);
  await expect.element(page.getCell({ name: longText })).toHaveClass(/rdg-cell-wrap/);
});

test('shrinks an auto-height row when the column becomes wide enough', async () => {
  const columns: readonly Column<Row>[] = [
    {
      key: 'description',
      name: 'Description',
      width: 100,
      resizable: true,
      wrapText: true,
      autoHeight: true
    }
  ];

  await setup({
    columns,
    rows: [{ id: 1, description: longText }],
    rowHeight: 35,
    style: { width: 500, height: 200 }
  });

  const row = page.getRow();
  await expect.poll(() => row.element().getBoundingClientRect().height).toBeGreaterThan(35);
  await commands.resizeColumn('Description', 300);
  await expect.poll(() => row.element().getBoundingClientRect().height).toBe(35);
});

test('measures auto-height columns outside the horizontal viewport', async () => {
  const columns: Column<Row>[] = Array.from({ length: 20 }, (_, index) => ({
    key: String(index),
    name: String(index),
    width: 100
  }));
  columns.push({
    key: 'description',
    name: 'Description',
    width: 100,
    wrapText: true,
    autoHeight: true
  });

  await setup({
    columns,
    rows: [{ id: 1, description: longText }],
    rowHeight: 35,
    style: { width: 300, height: 200 }
  });

  const autoHeightCell = getCellsAtRowIndex(0).and(page.getBySelector('[aria-colindex="21"]'));
  await expect.element(autoHeightCell).toHaveLength(1);
  await expect
    .poll(() => page.getRow().element().getBoundingClientRect().height)
    .toBeGreaterThan(35);
  await expect.element(page.getHeaderCell({ name: 'Description' })).toHaveLength(0);
});

test('measures an offscreen auto-height column at its max-content width', async () => {
  const columns: Column<Row>[] = Array.from({ length: 20 }, (_, index) => ({
    key: String(index),
    name: String(index),
    width: 100
  }));
  columns.push({
    key: 'description',
    name: 'Description',
    width: 'max-content',
    wrapText: true,
    autoHeight: true
  });

  await setup({
    columns,
    rows: [{ id: 1, description: longText }],
    rowHeight: 35,
    style: { width: 300, height: 200 }
  });

  const autoHeightCell = getCellsAtRowIndex(0).and(page.getBySelector('[aria-colindex="21"]'));
  await expect
    .poll(() => autoHeightCell.element().getBoundingClientRect().width)
    .toBeGreaterThan(100);
  await expect.poll(() => page.getRow().element().getBoundingClientRect().height).toBe(35);
});

test('does not measure an offscreen auto-height cell covered by colSpan', async () => {
  const columns: Column<Row>[] = Array.from({ length: 19 }, (_, index) => ({
    key: String(index),
    name: String(index),
    width: 100
  }));
  columns.push(
    {
      key: 'span',
      name: 'Span',
      width: 100,
      colSpan(args) {
        return args.type === 'ROW' ? 2 : undefined;
      }
    },
    {
      key: 'description',
      name: 'Description',
      width: 100,
      wrapText: true,
      autoHeight: true
    }
  );

  await setup<Row, unknown>({
    columns,
    rows: [{ id: 1, span: shortText, description: longText }],
    rowHeight: 35,
    style: { width: 300, height: 200 }
  });

  await expect
    .element(getCellsAtRowIndex(0).and(page.getBySelector('[aria-colindex="20"]')))
    .toHaveLength(1);
  await expect
    .element(getCellsAtRowIndex(0).and(page.getBySelector('[aria-colindex="21"]')))
    .toHaveLength(0);
  await expect.poll(() => page.getRow().element().getBoundingClientRect().height).toBe(35);
});

test('preserves the visible row anchor when measured heights change', async () => {
  const columns: readonly Column<Row>[] = [
    {
      key: 'description',
      name: 'Description',
      width: 400,
      resizable: true,
      wrapText: true,
      autoHeight: true
    }
  ];
  const rows = Array.from({ length: 100 }, (_, id) => ({
    id,
    description: `${id} ${longText}`
  }));

  await setup({
    columns,
    rows,
    rowHeight: 35,
    style: { width: 500, height: 300 }
  });

  scrollGrid({ top: 1000 });
  await expect.poll(getVisibleRowAnchor).toBeDefined();
  const previousAnchor = getVisibleRowAnchor()!;

  await commands.resizeColumn('Description', -300);
  await expect
    .poll(() => page.getRow().first().element().getBoundingClientRect().height)
    .toBeGreaterThan(35);
  const nextAnchor = getVisibleRowAnchor()!;

  expect(nextAnchor.ariaRowIndex).toBe(previousAnchor.ariaRowIndex);
  expect(nextAnchor.offset).toBeCloseTo(previousAnchor.offset, 0);
});

test('preserves measured heights and the scroll anchor across immutable row updates', async () => {
  const columns: readonly Column<Row>[] = [
    {
      key: 'description',
      name: 'Description',
      width: 100,
      wrapText: true,
      autoHeight: true
    }
  ];
  const rows = Array.from({ length: 100 }, (_, id) => ({
    id,
    description: `${id} ${longText}`
  }));
  const props = {
    columns,
    rowHeight: 35,
    style: { width: 300, height: 300 }
  } as const;
  const { rerender } = await setup({
    ...props,
    rows,
    rowKeyGetter: (row) => row.id
  });

  scrollGrid({ top: 1000 });
  await expect.poll(getVisibleRowAnchor).toBeDefined();
  const previousAnchor = getVisibleRowAnchor()!;
  const previousScrollHeight = page.getGrid().element().scrollHeight;

  await rerender(<DataGrid {...props} rows={[...rows]} rowKeyGetter={(row) => row.id} />);

  await expect.poll(() => page.getGrid().element().scrollHeight).toBe(previousScrollHeight);
  const nextAnchor = getVisibleRowAnchor()!;
  expect(nextAnchor.ariaRowIndex).toBe(previousAnchor.ariaRowIndex);
  expect(nextAnchor.offset).toBeCloseTo(previousAnchor.offset, 0);
});

test('invalidates an offscreen row measurement when its keyed row object changes', async () => {
  const columns: readonly Column<Row>[] = [
    {
      key: 'description',
      name: 'Description',
      width: 100,
      wrapText: true,
      autoHeight: true
    }
  ];
  const rows = Array.from({ length: 100 }, (_, id) => ({
    id,
    description: id === 50 ? longText : shortText
  }));
  const rowKeyGetter = (row: Row) => row.id;

  const { rerender } = await setup({
    columns,
    rows,
    rowKeyGetter,
    rowHeight: 35,
    style: { width: 300, height: 300 }
  });
  const grid = page.getGrid().element();

  scrollGrid({ top: 50 * 35 });
  await expect.element(getCellsAtRowIndex(50)).toHaveLength(1);
  await expect.poll(() => grid.scrollHeight).toBeGreaterThan(3535);
  scrollGrid({ top: 0 });

  const nextRows = [...rows];
  nextRows[50] = { id: 50, description: shortText };
  await rerender(
    <DataGrid
      columns={columns}
      rows={nextRows}
      rowKeyGetter={rowKeyGetter}
      rowHeight={35}
      style={{ width: 300, height: 300 }}
    />
  );

  await expect.poll(() => grid.scrollHeight).toBe(3535);
});

test('invalidates offscreen row measurements when an auto-height column width changes', async () => {
  const columns: readonly Column<Row>[] = [
    {
      key: 'description',
      name: 'Description',
      width: 100,
      resizable: true,
      wrapText: true,
      autoHeight: true
    }
  ];
  const rows = Array.from({ length: 100 }, (_, id) => ({
    id,
    description: `${id} ${longText}`
  }));

  await setup({
    columns,
    rows,
    rowKeyGetter: (row) => row.id,
    rowHeight: 35,
    style: { width: 500, height: 300 }
  });

  const grid = page.getGrid().element();
  await expect.poll(() => grid.scrollHeight).toBeGreaterThan(3535);
  scrollGrid({ top: grid.scrollHeight });
  await expect.poll(getVisibleRowAnchor).toBeDefined();

  await commands.resizeColumn('Description', 300);
  await expect.poll(() => grid.scrollHeight).toBe(3535);
});

function getVisibleRowAnchor() {
  const grid = page.getGrid().element();
  const viewportTop = grid.getBoundingClientRect().top + 35;
  const renderedRows = grid.querySelectorAll<HTMLDivElement>(
    ':scope > .rdg-row:not(.rdg-summary-row)'
  );

  for (const row of renderedRows) {
    const { top, bottom } = row.getBoundingClientRect();
    if (bottom > viewportTop) {
      return {
        ariaRowIndex: row.getAttribute('aria-rowindex'),
        offset: top - viewportTop
      };
    }
  }

  return undefined;
}
