import { useCallback, useMemo } from 'react';

import { getColSpan } from '../utils';
import type {
  CalculatedColumn,
  ColSpanArgs,
  IterateOverViewportColumns,
  IterateOverViewportColumnsForRow,
  Maybe,
  ViewportColumnWithColSpan
} from '../types';

interface ViewportColumnsArgs<R, SR> {
  columns: readonly CalculatedColumn<R, SR>[];
  colSpanColumns: readonly CalculatedColumn<R, SR>[];
  rows: readonly R[];
  topSummaryRows: Maybe<readonly SR[]>;
  bottomSummaryRows: Maybe<readonly SR[]>;
  colOverscanStartIdx: number;
  colOverscanEndIdx: number;
  lastFrozenColumnIndex: number;
  frozenRightColumnCount: number;
  rowOverscanStartIdx: number;
  rowOverscanEndIdx: number;
}

export function useViewportColumns<R, SR>({
  columns,
  colSpanColumns,
  rows,
  topSummaryRows,
  bottomSummaryRows,
  colOverscanStartIdx,
  colOverscanEndIdx,
  lastFrozenColumnIndex,
  frozenRightColumnCount,
  rowOverscanStartIdx,
  rowOverscanEndIdx
}: ViewportColumnsArgs<R, SR>) {
  const firstRightFrozenColumnIndex = columns.length - frozenRightColumnCount;

  // find the column that spans over a column within the visible columns range and adjust colOverscanStartIdx
  const startIdx = useMemo(() => {
    if (colOverscanStartIdx === 0) return 0;

    function* iterateOverRowsForColSpanArgs(): Generator<ColSpanArgs<R, SR>> {
      // check header row
      yield { type: 'HEADER' };

      // check top summary rows
      if (topSummaryRows != null) {
        for (const row of topSummaryRows) {
          yield { type: 'SUMMARY', row };
        }
      }

      // check viewport rows
      for (let rowIdx = rowOverscanStartIdx; rowIdx <= rowOverscanEndIdx; rowIdx++) {
        yield { type: 'ROW', row: rows[rowIdx] };
      }

      // check bottom summary rows
      if (bottomSummaryRows != null) {
        for (const row of bottomSummaryRows) {
          yield { type: 'SUMMARY', row };
        }
      }
    }

    for (const column of colSpanColumns) {
      if (column.frozen) continue;
      const colIdx = column.idx;
      if (colIdx >= colOverscanStartIdx) break;

      for (const args of iterateOverRowsForColSpanArgs()) {
        const colSpan = getColSpan(
          column,
          lastFrozenColumnIndex,
          firstRightFrozenColumnIndex,
          args
        );

        if (colSpan !== undefined && colIdx + colSpan > colOverscanStartIdx) {
          return colIdx;
        }
      }
    }

    return colOverscanStartIdx;
  }, [
    rowOverscanStartIdx,
    rowOverscanEndIdx,
    rows,
    topSummaryRows,
    bottomSummaryRows,
    colOverscanStartIdx,
    lastFrozenColumnIndex,
    firstRightFrozenColumnIndex,
    colSpanColumns
  ]);

  const iterateOverViewportColumns = useCallback<IterateOverViewportColumns<R, SR>>(
    function* (activeColumnIdx): Generator<CalculatedColumn<R, SR>> {
      for (let colIdx = 0; colIdx <= lastFrozenColumnIndex; colIdx++) {
        yield columns[colIdx];
      }

      if (columns.length === lastFrozenColumnIndex + 1) return;

      if (
        activeColumnIdx > lastFrozenColumnIndex &&
        activeColumnIdx < startIdx &&
        activeColumnIdx < firstRightFrozenColumnIndex
      ) {
        yield columns[activeColumnIdx];
      }

      for (let colIdx = startIdx; colIdx <= colOverscanEndIdx; colIdx++) {
        yield columns[colIdx];
      }

      if (activeColumnIdx > colOverscanEndIdx && activeColumnIdx < firstRightFrozenColumnIndex) {
        yield columns[activeColumnIdx];
      }

      for (let colIdx = firstRightFrozenColumnIndex; colIdx < columns.length; colIdx++) {
        yield columns[colIdx];
      }
    },
    [startIdx, colOverscanEndIdx, columns, lastFrozenColumnIndex, firstRightFrozenColumnIndex]
  );

  const iterateOverViewportColumnsForRow = useCallback<IterateOverViewportColumnsForRow<R, SR>>(
    function* (activeColumnIdx = -1, args): Generator<ViewportColumnWithColSpan<R, SR>> {
      const iterator = iterateOverViewportColumns(activeColumnIdx);

      for (const column of iterator) {
        let colSpan =
          args && getColSpan(column, lastFrozenColumnIndex, firstRightFrozenColumnIndex, args);

        yield [column, column.idx === activeColumnIdx, colSpan, undefined, undefined];

        // skip columns covered by colSpan
        while (colSpan !== undefined && colSpan > 1) {
          iterator.next();
          colSpan--;
        }
      }
    },
    [iterateOverViewportColumns, lastFrozenColumnIndex, firstRightFrozenColumnIndex]
  );

  const iterateOverViewportColumnsForRowOutsideOfViewport = useCallback<
    IterateOverViewportColumnsForRow<R, SR>
  >(
    function* (activeColumnIdx = -1, args): Generator<ViewportColumnWithColSpan<R, SR>> {
      if (activeColumnIdx >= 0 && activeColumnIdx < columns.length) {
        const column = columns[activeColumnIdx];
        yield [
          column,
          true,
          args && getColSpan(column, lastFrozenColumnIndex, firstRightFrozenColumnIndex, args),
          undefined,
          undefined
        ];
      }
    },
    [columns, lastFrozenColumnIndex, firstRightFrozenColumnIndex]
  );

  const viewportColumns = useMemo((): readonly CalculatedColumn<R, SR>[] => {
    return iterateOverViewportColumns(-1).toArray();
  }, [iterateOverViewportColumns]);

  return {
    viewportColumns,
    iterateOverViewportColumnsForRow,
    iterateOverViewportColumnsForRowOutsideOfViewport
  } as const;
}
