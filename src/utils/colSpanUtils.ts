import type { CalculatedColumn, ColSpanArgs } from '../types';

export function getColSpan<R, SR>(
  column: CalculatedColumn<R, SR>,
  lastFrozenColumnIndex: number,
  firstRightFrozenColumnIndex: number,
  args: ColSpanArgs<R, SR>
): number | undefined {
  if (typeof column.colSpan !== 'function') return undefined;

  const colSpan = column.colSpan(args);
  const lastSpannedColumnIndex = column.idx + colSpan! - 1;

  if (
    Number.isInteger(colSpan) &&
    colSpan! > 1 &&
    // ignore colSpan if it spans over multiple sticky/non-sticky column regions
    (column.frozen
      ? lastSpannedColumnIndex <= lastFrozenColumnIndex
      : column.frozenRight || lastSpannedColumnIndex < firstRightFrozenColumnIndex)
  ) {
    return colSpan!;
  }

  return undefined;
}
