import { createFileRoute } from '@tanstack/react-router';
import { css } from 'ecij';

import { DataGrid, type Column } from '../../src';
import { renderCoordinates } from '../renderers';
import { useDirection } from '../directionContext';

export const Route = createFileRoute('/ColumnSpanning')({
  component: ColumnSpanning
});

type Row = number;
const rows: readonly Row[] = Array.from({ length: 100 }, (_, i) => i);
const columnCount = 50;
const frozenLeftColumnCount = 5;
const frozenRightColumnCount = 3;
const firstRightFrozenColumnIdx = columnCount - frozenRightColumnCount;
const beforeRightFrozenColumnKey = String(firstRightFrozenColumnIdx - 2);
const firstRightFrozenColumnKey = String(firstRightFrozenColumnIdx);
const secondRightFrozenColumnKey = String(firstRightFrozenColumnIdx + 1);

const rootClassname = css`
  display: flex;
  flex-direction: column;
  block-size: 100%;
  gap: 8px;

  > .rdg {
    flex: 1;
    min-block-size: 0;
  }
`;

const legendClassname = css`
  display: flex;
  flex-wrap: wrap;
  gap: 8px 16px;
  margin: 0;
  padding: 0;
  list-style: none;
  font-size: 14px;

  > li {
    display: flex;
    align-items: center;
    gap: 6px;
  }

  span {
    inline-size: 16px;
    block-size: 16px;
    border: 1px solid light-dark(#777, #aaa);
  }
`;

const frozenColumnsDescriptionClassname = css`
  margin: 0;
  font-size: 14px;
`;

const colSpanClassname = css`
  background-color: #ffb300;
  color: black;
  text-align: center;
`;

const rowSpanClassname = css`
  background-color: #8bc34a;
  color: black;
  text-align: center;
`;

const cellSpanClassname = css`
  background-color: #26c6da;
  color: black;
  text-align: center;
`;

const columns: Column<Row>[] = [];

for (let i = 0; i < columnCount; i++) {
  const key = String(i);
  columns.push({
    key,
    name: key,
    frozen: i < frozenLeftColumnCount,
    frozenRight: i >= firstRightFrozenColumnIdx,
    resizable: true,
    renderCell: renderCoordinates,
    colSpan(args) {
      if (args.type === 'ROW') {
        if (key === '2' && args.row === 2) return 3;
        if (key === '4' && args.row === 4) return 6; // Will not work as colspan includes both frozen and regular columns
        if (key === '0' && args.row === 5) return 5;
        if (key === firstRightFrozenColumnKey && args.row === 8) return 3;
        if (key === beforeRightFrozenColumnKey && args.row === 10) return 4; // Will not work as colspan includes both regular and right frozen columns
        if (key === '6' && args.row === 14) return 2;
        if (key === firstRightFrozenColumnKey && args.row === 18) return 3;
        if (key === '1' && args.row === 22) return 3;
        if (key === '6' && args.row < 8) return 2;
      }
      if (args.type === 'HEADER' && key === '8') {
        return 3;
      }
      return undefined;
    },
    rowSpan(args) {
      if (key === '4' && args.row === 4) return 3;
      if (key === '1' && args.row === 10) return 4;
      if (key === beforeRightFrozenColumnKey && args.row === 10) return 3;
      if (key === '6' && args.row === 14) return 3;
      if (key === firstRightFrozenColumnKey && args.row === 18) return 3;
      if (key === '1' && args.row === 22) return 3;
      if (key === secondRightFrozenColumnKey && args.row === 24) return 4;
      return undefined;
    },
    cellClass(row) {
      if (
        (key === '6' && row === 14) ||
        (key === firstRightFrozenColumnKey && row === 18) ||
        (key === '1' && row === 22)
      ) {
        return cellSpanClassname;
      }
      if (
        (key === '1' && row === 10) ||
        (key === '4' && row === 4) ||
        (key === beforeRightFrozenColumnKey && row === 10) ||
        (key === secondRightFrozenColumnKey && row === 24)
      ) {
        return rowSpanClassname;
      }
      if (
        (key === '0' && row === 5) ||
        (key === '2' && row === 2) ||
        (key === firstRightFrozenColumnKey && row === 8) ||
        (key === beforeRightFrozenColumnKey && row === 10) ||
        (key === '6' && row < 8)
      ) {
        return colSpanClassname;
      }
      return undefined;
    }
  });
}

function ColumnSpanning() {
  const direction = useDirection();

  return (
    <div className={rootClassname}>
      <ul className={legendClassname} aria-label="Cell spanning legend">
        <li>
          <span className={colSpanClassname} aria-hidden />
          colSpan
        </li>
        <li>
          <span className={rowSpanClassname} aria-hidden />
          rowSpan
        </li>
        <li>
          <span className={cellSpanClassname} aria-hidden />
          colSpan + rowSpan
        </li>
      </ul>
      <p className={frozenColumnsDescriptionClassname}>
        Columns 0–{frozenLeftColumnCount - 1} are frozen left and columns{' '}
        {firstRightFrozenColumnIdx}–{columnCount - 1} are frozen right. Scroll horizontally to
        compare spanning cells in frozen and scrollable regions.
      </p>
      <DataGrid
        aria-label="Cell Spanning Example"
        columns={columns}
        rows={rows}
        rowHeight={22}
        direction={direction}
      />
    </div>
  );
}
