import type { CalculatedColumn, RowSpanArgs } from '../types';

export function getRowSpan<R, SR>(
  column: CalculatedColumn<R, SR>,
  args: RowSpanArgs<R>,
  maxRowSpan: number
): number | undefined {
  if (typeof column.rowSpan !== 'function') return undefined;

  const rowSpan = column.rowSpan(args);

  if (Number.isInteger(rowSpan) && rowSpan! > 1) {
    return Math.min(rowSpan!, maxRowSpan);
  }

  return undefined;
}
