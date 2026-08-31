import { page, userEvent } from 'vitest/browser';

import type { Column, DataGridProps } from '../../src';
import { safeTab, setup, testRowCount } from './utils';

const grid = page.getGrid();

type Row = number;

function setupGrid(rowHeight: DataGridProps<Row>['rowHeight']) {
  const columns: Column<Row>[] = [];
  const rows: readonly Row[] = Array.from({ length: 50 }, (_, i) => i);

  for (let i = 0; i < 5; i++) {
    const key = String(i);
    columns.push({
      key,
      name: key,
      width: 80
    });
  }
  return setup({ columns, rows, rowHeight });
}

async function expectGridHeight(rowHeightFn: (row: number) => number, expected: number) {
  await setupGrid(rowHeightFn);

  const computedRows = getComputedStyle(grid.element()).gridTemplateRows;
  const totalHeight = computedRows
    .split(' ')
    .reduce((total, height) => total + Number.parseFloat(height), 0);
  expect(totalHeight).toBe(expected);
}

test('rowHeight is number', async () => {
  await setupGrid(40);

  await expect.element(page.getRow().first()).toHaveStyle({ height: '40px' });
  expect(grid.element().scrollHeight).toBe(2040);
  await testRowCount(30);
  await safeTab();
  await expect.element(grid).toHaveProperty('scrollTop', 0);
  await userEvent.keyboard('{Control>}{end}');
  const gridEl = grid.element();
  expect(gridEl.scrollTop + gridEl.clientHeight).toBe(gridEl.scrollHeight);
});

test('rowHeight is function', async () => {
  await setupGrid((row) => [40, 60, 80][row % 3]);

  const renderedRows = page.getRow();
  await expect.element(renderedRows.nth(0)).toHaveStyle({ height: '40px' });
  await expect.element(renderedRows.nth(1)).toHaveStyle({ height: '60px' });
  await expect.element(renderedRows.nth(2)).toHaveStyle({ height: '80px' });
  expect(grid.element().scrollHeight).toBe(3015);
  await testRowCount(22);

  await safeTab();
  await expect.element(grid).toHaveProperty('scrollTop', 0);
  await userEvent.keyboard('{Control>}{end}');
  const gridEl = grid.element();
  expect(gridEl.scrollTop + gridEl.clientHeight).toBe(gridEl.scrollHeight);
});

test('rowHeight with repeat pattern - multiple identical heights', async () => {
  await expectGridHeight(() => 40, 2035);
});

test('rowHeight with mixed heights - one unique in middle', async () => {
  await expectGridHeight((row) => (row === 25 ? 40 : 50), 2525);
});

test('rowHeight with unique heights', async () => {
  await expectGridHeight((row) => row + 1, 1310);
});

test('rowHeight with unique first and unique last heights', async () => {
  await expectGridHeight((row) => {
    if (row === 0) {
      return 10;
    }

    if (row === 49) {
      return 20;
    }

    return 50;
  }, 2465);
});

test('rowHeight with unique last height', async () => {
  await expectGridHeight((row) => {
    return row === 49 ? 50 : 20;
  }, 1065);
});

test('rowHeight with unique first height', async () => {
  await expectGridHeight((row) => {
    return row === 0 ? 45 : 50;
  }, 2530);
});
