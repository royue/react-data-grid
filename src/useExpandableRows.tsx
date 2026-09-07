import { useCallback, useMemo, useState } from 'react';
import type { Key } from 'react';

import { assertIsValidKeyGetter } from './utils';
import type {
  CellClipboardEvent,
  CellCopyArgs,
  CellKeyboardEvent,
  CellKeyDownArgs,
  CellMouseArgs,
  CellMouseEvent,
  CellPasteArgs,
  ColSpanArgs,
  Column,
  ColumnGroup,
  ColumnOrColumnGroup,
  Maybe,
  PositionChangeArgs,
  RenderRowProps,
  RowSpanArgs,
  RowsChangeData
} from './types';
import { renderExpandIcon } from './cellRenderers';
import type { DataGridProps, ExpandableOptions } from './DataGrid';
import { useDefaultRenderers } from './DataGridDefaultRenderersContext';
import { ExpandedRow } from './ExpandedRow';
import { defaultRenderRow } from './Row';

export const EXPAND_COLUMN_KEY = 'rdg-expand-column';

interface RowMeta {
  readonly depth: number;
  readonly posInSet: number;
  readonly setSize: number;
  readonly rowIdx: number;
  readonly path: readonly number[];
  readonly hasChildren: boolean;
}

interface ExpandedRowData<R> {
  readonly row: R;
  readonly rowIdx: number;
  readonly depth: number;
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
  onCellClick: rawOnCellClick,
  onCellKeyDown: rawOnCellKeyDown,
  onCellCopy: rawOnCellCopy,
  onCellPaste: rawOnCellPaste,
  onActivePositionChange: rawOnActivePositionChange,
  onSelectedRowsChange: rawOnSelectedRowsChange,
  isRowSelectionDisabled: rawIsRowSelectionDisabled,
  renderers,
  ...props
}: ExpandableDataGridProps<R, SR, K>): DataGridProps<R, SR, K> {
  const {
    expandedRowKeys: controlledExpandedRowKeys,
    defaultExpandedRowKeys,
    defaultExpandAllRows,
    onExpand,
    onExpandedRowsChange,
    rowExpandable,
    childrenColumnName: rawChildrenColumnName,
    expandedRowRender,
    expandedRowHeight,
    expandRowByClick,
    expandIcon,
    showExpandColumn,
    columnTitle,
    columnWidth,
    indentSize
  } = expandable;
  const {
    // eslint-disable-next-line @typescript-eslint/no-deprecated
    onExpandedRowKeysChange,
    // eslint-disable-next-line @typescript-eslint/no-deprecated
    renderExpandedRow
  } = expandable;
  const defaultRenderers = useDefaultRenderers<R, SR>();
  const childrenColumnName = (rawChildrenColumnName ?? 'children') as keyof R & string;
  const detailRenderer = expandedRowRender ?? renderExpandedRow;

  assertIsValidKeyGetter<R, K>(rawRowKeyGetter);
  const getRowKey = rawRowKeyGetter;
  const renderIcon = expandIcon ?? renderExpandIcon;
  const treeIndentSize = indentSize ?? 24;

  const getChildren = useCallback(
    (row: R): readonly R[] => {
      const children = row[childrenColumnName];
      return Array.isArray(children) ? (children as readonly R[]) : [];
    },
    [childrenColumnName]
  );

  const [uncontrolledExpandedRowKeys, setUncontrolledExpandedRowKeys] = useState<ReadonlySet<K>>(
    () => {
      if (defaultExpandedRowKeys != null) return new Set(defaultExpandedRowKeys);
      if (defaultExpandAllRows !== true) return new Set();

      const keys = new Set<K>();
      visitRows(rawRows);
      return keys;

      function visitRows(rows: readonly R[]) {
        for (const row of rows) {
          const children = getChildren(row);
          if (rowExpandable?.(row) !== false && (children.length > 0 || detailRenderer != null)) {
            keys.add(getRowKey(row));
          }
          visitRows(children);
        }
      }
    }
  );
  const expandedRowKeys = controlledExpandedRowKeys ?? uncontrolledExpandedRowKeys;

  const maxTreeDepth = useMemo(() => {
    let maxDepth = 0;
    visitRows(rawRows, 0);
    return maxDepth;

    function visitRows(siblingRows: readonly R[], depth: number) {
      for (const row of siblingRows) {
        maxDepth = Math.max(maxDepth, depth);
        visitRows(getChildren(row), depth + 1);
      }
    }
  }, [getChildren, rawRows]);

  const [rows, rowMeta, isExpandedRow, hasTreeRows] = useMemo((): [
    readonly (R | ExpandedRowData<R>)[],
    ReadonlyMap<R, RowMeta>,
    (row: R | ExpandedRowData<R>) => row is ExpandedRowData<R>,
    boolean
  ] => {
    const expandedRows = new Set<ExpandedRowData<R>>();
    const rowMeta = new Map<R, RowMeta>();
    const rows: (R | ExpandedRowData<R>)[] = [];
    let flatRowIdx = 0;
    let hasTreeRows = false;

    appendRows(rawRows, 0, []);
    return [rows, rowMeta, isExpandedRow, hasTreeRows];

    function appendRows(siblingRows: readonly R[], depth: number, parentPath: readonly number[]) {
      siblingRows.forEach((row, posInSet) => {
        const rowIdx = flatRowIdx;
        flatRowIdx += 1;
        const path = [...parentPath, posInSet];
        const children = getChildren(row);
        const hasChildren = children.length > 0;
        hasTreeRows ||= hasChildren;
        rowMeta.set(row, {
          depth,
          posInSet,
          setSize: siblingRows.length,
          rowIdx,
          path,
          hasChildren
        });
        rows.push(row);

        const key = getRowKey(row);
        const canExpand = rowExpandable?.(row) !== false;
        if (!expandedRowKeys.has(key) || !canExpand) return;

        if (detailRenderer != null) {
          const expandedRow = {
            row,
            rowIdx,
            depth,
            key: `__rdg_expanded_${String(key)}`
          };
          rows.push(expandedRow);
          expandedRows.add(expandedRow);
        }
        if (hasChildren) {
          appendRows(children, depth + 1, path);
        }
      });
    }

    function isExpandedRow(row: R | ExpandedRowData<R>): row is ExpandedRowData<R> {
      return expandedRows.has(row as ExpandedRowData<R>);
    }
  }, [detailRenderer, expandedRowKeys, getChildren, getRowKey, rawRows, rowExpandable]);

  const rowSpanLimits = useMemo(() => {
    const limits = new Map<R, number>();
    if (detailRenderer == null) return limits;

    let nextDetailRowIdx = rows.length;
    for (let index = rows.length - 1; index >= 0; index--) {
      const row = rows[index];
      if (isExpandedRow(row)) {
        nextDetailRowIdx = index;
      } else if (nextDetailRowIdx < rows.length) {
        limits.set(row, nextDetailRowIdx - index);
      }
    }
    return limits;
  }, [detailRenderer, isExpandedRow, rows]);

  const useExpandColumn =
    showExpandColumn ?? (expandedRowRender != null || rawChildrenColumnName != null || hasTreeRows);
  const expandColumnWidth = columnWidth ?? 35 + maxTreeDepth * treeIndentSize;

  const toggleRow = useCallback(
    (row: R) => {
      const key = getRowKey(row);
      const expanded = !expandedRowKeys.has(key);
      const nextExpandedRowKeys = new Set(expandedRowKeys);
      if (expanded) {
        nextExpandedRowKeys.add(key);
      } else {
        nextExpandedRowKeys.delete(key);
      }

      if (controlledExpandedRowKeys == null) {
        setUncontrolledExpandedRowKeys(nextExpandedRowKeys);
      }
      onExpand?.(expanded, row);
      onExpandedRowsChange?.(nextExpandedRowKeys);
      onExpandedRowKeysChange?.(nextExpandedRowKeys);
    },
    [
      controlledExpandedRowKeys,
      expandedRowKeys,
      onExpand,
      onExpandedRowKeysChange,
      onExpandedRowsChange,
      getRowKey
    ]
  );

  const columns = useMemo((): readonly ColumnOrColumnGroup<R, SR>[] => {
    const columns = rawColumns.map((column) => wrapColumn(column));
    if (!useExpandColumn) return columns;

    const expandColumn: Column<R, SR> = {
      key: EXPAND_COLUMN_KEY,
      name: typeof columnTitle === 'string' ? columnTitle : '',
      width: expandColumnWidth,
      minWidth: 35,
      frozen: true,
      resizable: false,
      sortable: false,
      renderHeaderCell: columnTitle == null ? undefined : () => columnTitle,
      renderCell({ row, tabIndex }) {
        const meta = rowMeta.get(row)!;
        const expandable =
          rowExpandable?.(row) !== false && (meta.hasChildren || detailRenderer != null);
        const isExpanded = expandable && expandedRowKeys.has(getRowKey(row));
        return (
          <div style={{ paddingInlineStart: meta.depth * treeIndentSize }}>
            {renderIcon({
              row,
              rowIdx: meta.rowIdx,
              depth: meta.depth,
              isExpanded,
              expandable,
              onExpand: () => toggleRow(row),
              tabIndex
            })}
          </div>
        );
      }
    };

    return [expandColumn, ...columns];

    function wrapColumn(column: ColumnOrColumnGroup<R, SR>): ColumnOrColumnGroup<R, SR> {
      if (isColumnGroup(column)) {
        return {
          ...column,
          children: column.children.map((child) => wrapColumn(child))
        };
      }

      if (
        typeof column.colSpan !== 'function' &&
        typeof column.rowSpan !== 'function' &&
        typeof column.editable !== 'function'
      ) {
        return column;
      }

      const { colSpan, rowSpan, editable } = column;
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
        ...(typeof rowSpan === 'function'
          ? {
              rowSpan(args: RowSpanArgs<R>) {
                if (isExpandedRow(args.row)) return undefined;

                const span = rowSpan(args);
                return span != null && Number.isInteger(span) && span > 1
                  ? Math.min(span, rowSpanLimits.get(args.row) ?? span)
                  : span;
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
  }, [
    columnTitle,
    detailRenderer,
    expandColumnWidth,
    getRowKey,
    expandedRowKeys,
    isExpandedRow,
    rawColumns,
    renderIcon,
    rowExpandable,
    rowMeta,
    rowSpanLimits,
    toggleRow,
    treeIndentSize,
    useExpandColumn
  ]);

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
      return getRowKey(row);
    },
    [getRowKey, isExpandedRow]
  );

  function handleRowsChange(updatedRows: R[], { indexes, column }: RowsChangeData<R, SR>) {
    if (!onRowsChange) return;

    let updatedRawRows: Maybe<R[]>;
    const rawIndexes = new Set<number>();
    const copiedArrays = new Map<readonly R[], R[]>();
    for (const index of indexes) {
      const row = rows[index];
      if (isExpandedRow(row)) continue;

      const meta = rowMeta.get(row)!;
      updatedRawRows = replaceRowAtPath(updatedRawRows ?? rawRows, meta.path, updatedRows[index]);
      rawIndexes.add(meta.path[0]);
    }

    if (updatedRawRows != null) {
      onRowsChange(updatedRawRows, { indexes: [...rawIndexes], column });
    }

    function replaceRowAtPath(
      sourceRows: readonly R[],
      path: readonly number[],
      nextRow: R,
      depth = 0
    ): R[] {
      let nextRows = copiedArrays.get(sourceRows);
      if (nextRows === undefined) {
        nextRows = [...sourceRows];
        copiedArrays.set(sourceRows, nextRows);
        // Later updates can reach this copy through an already updated ancestor.
        copiedArrays.set(nextRows, nextRows);
      }

      const index = path[depth];
      if (depth === path.length - 1) {
        nextRows[index] = nextRow;
        return nextRows;
      }

      const parentRow = nextRows[index];
      const children = replaceRowAtPath(getChildren(parentRow), path, nextRow, depth + 1);
      nextRows[index] = { ...parentRow, [childrenColumnName]: children };
      return nextRows;
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

  function handleCellClick(args: CellMouseArgs<R, SR>, event: CellMouseEvent) {
    rawOnCellClick?.(args, event);
    if (
      event.isGridDefaultPrevented() ||
      expandRowByClick !== true ||
      args.column.key === EXPAND_COLUMN_KEY
    ) {
      return;
    }

    const meta = rowMeta.get(args.row);
    if (
      meta !== undefined &&
      rowExpandable?.(args.row) !== false &&
      (meta.hasChildren || detailRenderer != null)
    ) {
      toggleRow(args.row);
    }
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
          columnsCount={countLeafColumns(columns)}
          gridRowStart={gridRowStart}
          row={row.row}
          rowIdx={rowIdx}
          sourceRowIdx={row.rowIdx}
          depth={row.depth}
          activeCellIdx={activeCellIdx}
          renderExpandedRow={detailRenderer!}
          setActivePosition={setActivePosition}
        />
      );
    }

    const meta = rowMeta.get(row)!;
    return rawRenderRow(key, {
      ...rowProps,
      'aria-level': hasTreeRows ? meta.depth + 1 : undefined,
      'aria-setsize': hasTreeRows ? meta.setSize : undefined,
      'aria-posinset': hasTreeRows ? meta.posInSet + 1 : undefined,
      'aria-expanded':
        meta.hasChildren && rowExpandable?.(row) !== false
          ? expandedRowKeys.has(getRowKey(row))
          : undefined,
      row,
      rowIdx,
      gridRowStart,
      activeCellIdx,
      setActivePosition
    });
  }

  return {
    ...props,
    role: hasTreeRows ? 'treegrid' : props.role,
    columns,
    rows: rows as R[],
    rowHeight,
    headerRowHeight,
    summaryRowHeight,
    rowKeyGetter: rowKeyGetter as (row: NoInfer<R>) => K,
    onRowsChange: handleRowsChange,
    onSelectedRowsChange: rawOnSelectedRowsChange ? handleSelectedRowsChange : undefined,
    isRowSelectionDisabled,
    onCellClick: rawOnCellClick != null || expandRowByClick === true ? handleCellClick : undefined,
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

function countLeafColumns<R, SR>(columns: readonly ColumnOrColumnGroup<R, SR>[]): number {
  let count = 0;
  for (const column of columns) {
    count += isColumnGroup(column) ? countLeafColumns(column.children) : 1;
  }
  return count;
}
