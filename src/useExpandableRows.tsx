import { useCallback, useMemo } from 'react';
import type { Key } from 'react';

import { assertIsValidKeyGetter } from './utils';
import type {
  CellClipboardEvent,
  CellCopyArgs,
  CellKeyboardEvent,
  CellKeyDownArgs,
  CellPasteArgs,
  ColSpanArgs,
  ColumnGroup,
  ColumnOrColumnGroup,
  PositionChangeArgs,
  RenderRowProps,
  RowsChangeData
} from './types';
import type { DataGridProps, ExpandableOptions } from './DataGrid';
import { useDefaultRenderers } from './DataGridDefaultRenderersContext';
import { ExpandedRow } from './ExpandedRow';
import { defaultRenderRow } from './Row';

interface ExpandedRowData<R> {
  readonly row: R;
  readonly rowIdx: number;
  readonly key: string;
}

interface ExpandableDataGridProps<R, SR, K extends Key> extends DataGridProps<R, SR, K> {
  expandable: ExpandableOptions<R, K>;
}

const navigationKeys = new Set([
  'ArrowUp',
  'ArrowDown',
  'ArrowLeft',
  'ArrowRight',
  'Tab',
  'Home',
  'End',
  'PageUp',
  'PageDown'
]);

export function useExpandableRows<R, SR = unknown, K extends Key = Key>({
  expandable,
  columns: rawColumns,
  rows: rawRows,
  rowKeyGetter: rawRowKeyGetter,
  rowHeight: rawRowHeight,
  headerRowHeight: rawHeaderRowHeight,
  summaryRowHeight: rawSummaryRowHeight,
  onRowsChange,
  onCellKeyDown: rawOnCellKeyDown,
  onCellCopy: rawOnCellCopy,
  onCellPaste: rawOnCellPaste,
  onActivePositionChange: rawOnActivePositionChange,
  onSelectedRowsChange: rawOnSelectedRowsChange,
  isRowSelectionDisabled: rawIsRowSelectionDisabled,
  renderers,
  ...props
}: ExpandableDataGridProps<R, SR, K>): DataGridProps<R, SR, K> {
  const { expandedRowKeys, rowExpandable, renderExpandedRow, expandedRowHeight } = expandable;
  const defaultRenderers = useDefaultRenderers<R, SR>();

  assertIsValidKeyGetter<R, K>(rawRowKeyGetter);

  const [rows, isExpandedRow] = useMemo((): [
    readonly (R | ExpandedRowData<R>)[],
    (row: R | ExpandedRowData<R>) => row is ExpandedRowData<R>
  ] => {
    const expandedRows = new Set<ExpandedRowData<R>>();
    const rows: (R | ExpandedRowData<R>)[] = [];

    rawRows.forEach((row, rowIdx) => {
      rows.push(row);

      const key = rawRowKeyGetter(row);
      if (expandedRowKeys.has(key) && rowExpandable?.(row) !== false) {
        const expandedRow = {
          row,
          rowIdx,
          key: `__rdg_expanded_${String(key)}`
        };
        rows.push(expandedRow);
        expandedRows.add(expandedRow);
      }
    });

    return [rows, isExpandedRow];

    function isExpandedRow(row: R | ExpandedRowData<R>): row is ExpandedRowData<R> {
      return expandedRows.has(row as ExpandedRowData<R>);
    }
  }, [expandedRowKeys, rawRowKeyGetter, rawRows, rowExpandable]);

  const columns = useMemo((): readonly ColumnOrColumnGroup<R, SR>[] => {
    return rawColumns.map((column) => wrapColumn(column));

    function wrapColumn(column: ColumnOrColumnGroup<R, SR>): ColumnOrColumnGroup<R, SR> {
      if (isColumnGroup(column)) {
        return {
          ...column,
          children: column.children.map((child) => wrapColumn(child))
        };
      }

      if (typeof column.colSpan !== 'function' && typeof column.editable !== 'function') {
        return column;
      }

      const { colSpan, editable } = column;
      return {
        ...column,
        ...(typeof colSpan === 'function'
          ? {
              colSpan(args: ColSpanArgs<R, SR>) {
                if (args.type === 'ROW' && isExpandedRow(args.row)) {
                  return undefined;
                }
                return colSpan(args);
              }
            }
          : undefined),
        ...(typeof editable === 'function'
          ? {
              editable(row: R) {
                return !isExpandedRow(row) && editable(row);
              }
            }
          : undefined)
      };
    }
  }, [isExpandedRow, rawColumns]);

  const rowHeight = useMemo(() => {
    return (row: R | ExpandedRowData<R>): number => {
      if (isExpandedRow(row)) {
        if (typeof expandedRowHeight === 'function') {
          return expandedRowHeight(row.row);
        }
        return expandedRowHeight ?? 250;
      }

      if (typeof rawRowHeight === 'function') {
        return rawRowHeight(row);
      }
      return rawRowHeight ?? 35;
    };
  }, [expandedRowHeight, isExpandedRow, rawRowHeight]);

  const rowKeyGetter = useCallback(
    (row: R | ExpandedRowData<R>) => {
      if (isExpandedRow(row)) {
        return row.key;
      }
      return rawRowKeyGetter(row);
    },
    [isExpandedRow, rawRowKeyGetter]
  );

  function handleRowsChange(updatedRows: R[], { indexes, column }: RowsChangeData<R, SR>) {
    if (!onRowsChange) return;

    const updatedRawRows = [...rawRows];
    const rawIndexes: number[] = [];
    for (const index of indexes) {
      const row = rows[index];
      if (isExpandedRow(row)) continue;

      const rawIndex = rawRows.indexOf(row);
      updatedRawRows[rawIndex] = updatedRows[index];
      rawIndexes.push(rawIndex);
    }

    if (rawIndexes.length > 0) {
      onRowsChange(updatedRawRows, { indexes: rawIndexes, column });
    }
  }

  function handleSelectedRowsChange(selectedRows: Set<K>) {
    if (!rawOnSelectedRowsChange) return;

    const selectedRowKeys = new Set(selectedRows);
    for (const row of rows) {
      if (isExpandedRow(row)) {
        selectedRowKeys.delete(rowKeyGetter(row) as K);
      }
    }
    rawOnSelectedRowsChange(selectedRowKeys);
  }

  function handleCellKeyDown(args: CellKeyDownArgs<R, SR>, event: CellKeyboardEvent) {
    if (isExpandedRow(rows[args.rowIdx])) {
      if (!navigationKeys.has(event.key)) {
        event.preventGridDefault();
      }
      return;
    }

    rawOnCellKeyDown?.(args, event);
  }

  function handleCellCopy(args: CellCopyArgs<NoInfer<R>, NoInfer<SR>>, event: CellClipboardEvent) {
    if (!isExpandedRow(args.row)) {
      rawOnCellCopy?.(args, event);
    }
  }

  function handleCellPaste(
    args: CellPasteArgs<NoInfer<R>, NoInfer<SR>>,
    event: CellClipboardEvent
  ): NoInfer<R> {
    if (isExpandedRow(args.row)) return args.row;
    return rawOnCellPaste!({ row: args.row, column: args.column }, event);
  }

  function handleActivePositionChange(args: PositionChangeArgs<R, SR>) {
    if (args.row === undefined || !isExpandedRow(args.row)) {
      rawOnActivePositionChange?.(args);
    }
  }

  function isRowSelectionDisabled(row: R) {
    return isExpandedRow(row) || rawIsRowSelectionDisabled?.(row) === true;
  }

  const rawRenderRow = renderers?.renderRow ?? defaultRenderers?.renderRow ?? defaultRenderRow;
  const headerRowHeight =
    rawHeaderRowHeight ?? (typeof rawRowHeight === 'number' ? rawRowHeight : undefined);
  const summaryRowHeight =
    rawSummaryRowHeight ?? (typeof rawRowHeight === 'number' ? rawRowHeight : undefined);

  function renderRow(
    key: Key,
    {
      row,
      rowIdx,
      gridRowStart,
      activeCellIdx,
      setActivePosition,
      ...rowProps
    }: RenderRowProps<R, SR>
  ) {
    if (isExpandedRow(row)) {
      return (
        <ExpandedRow
          key={key}
          aria-rowindex={rowProps['aria-rowindex'] ?? gridRowStart}
          columnsCount={rawColumns.length}
          gridRowStart={gridRowStart}
          row={row.row}
          rowIdx={rowIdx}
          activeCellIdx={activeCellIdx}
          renderExpandedRow={renderExpandedRow}
          setActivePosition={setActivePosition}
        />
      );
    }

    return rawRenderRow(key, {
      ...rowProps,
      row,
      rowIdx,
      gridRowStart,
      activeCellIdx,
      setActivePosition
    });
  }

  return {
    ...props,
    columns,
    rows: rows as R[],
    rowHeight,
    headerRowHeight,
    summaryRowHeight,
    rowKeyGetter: rowKeyGetter as (row: NoInfer<R>) => K,
    onRowsChange: handleRowsChange,
    onSelectedRowsChange: rawOnSelectedRowsChange ? handleSelectedRowsChange : undefined,
    isRowSelectionDisabled,
    onCellKeyDown: handleCellKeyDown,
    onCellCopy: rawOnCellCopy ? handleCellCopy : undefined,
    onCellPaste: rawOnCellPaste ? handleCellPaste : undefined,
    onActivePositionChange: rawOnActivePositionChange ? handleActivePositionChange : undefined,
    renderers: {
      ...renderers,
      renderRow
    }
  };
}

function isColumnGroup<R, SR>(column: ColumnOrColumnGroup<R, SR>): column is ColumnGroup<R, SR> {
  return 'children' in column;
}
