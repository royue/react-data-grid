import { useCallback, useMemo } from 'react';
import type { Key } from 'react';

import { useLatestFunc } from './hooks';
import { assertIsValidKeyGetter, getLeftRightKey } from './utils';
import type {
  CellClipboardEvent,
  CellCopyArgs,
  CellKeyboardEvent,
  CellKeyDownArgs,
  CellPasteArgs,
  Column,
  GroupRow,
  Maybe,
  RenderRowProps,
  RowsChangeData
} from './types';
import { renderToggleGroup } from './cellRenderers';
import { SELECT_COLUMN_KEY } from './Columns';
import type { DataGridProps, RowGroupingOptions } from './DataGrid';
import { useDefaultRenderers } from './DataGridDefaultRenderersContext';
import GroupedRow from './GroupRow';
import { defaultRenderRow } from './Row';

type GroupByDictionary<TRow> = Record<
  string,
  {
    readonly childRows: readonly TRow[];
    readonly childGroups: readonly TRow[] | Readonly<GroupByDictionary<TRow>>;
    readonly startRowIndex: number;
  }
>;

interface RowGroupingDataGridProps<R, SR, K extends Key> extends DataGridProps<R, SR, K> {
  rowGrouping: RowGroupingOptions<R>;
}

interface RowGroupMetadata<R> {
  readonly parent: Maybe<readonly [GroupRow<R>, number]>;
  readonly startRowIndex: number;
}

export function useRowGrouping<R, SR = unknown, K extends Key = Key>({
  rowGrouping,
  columns: rawColumns,
  rows: rawRows,
  rowHeight: rawRowHeight,
  rowKeyGetter: rawRowKeyGetter,
  onCellKeyDown: rawOnCellKeyDown,
  onCellCopy: rawOnCellCopy,
  onCellPaste: rawOnCellPaste,
  onRowsChange,
  selectedRows: rawSelectedRows,
  onSelectedRowsChange: rawOnSelectedRowsChange,
  renderers,
  topSummaryRows,
  bottomSummaryRows,
  direction,
  isRowSelectionDisabled: rawIsRowSelectionDisabled,
  ...props
}: RowGroupingDataGridProps<R, SR, K>): DataGridProps<R, SR, K> {
  const {
    groupBy: rawGroupBy,
    rowGrouper,
    expandedGroupIds,
    onExpandedGroupIdsChange,
    groupIdGetter: rawGroupIdGetter,
    rowHeight: rawGroupRowHeight
  } = rowGrouping;
  const defaultRenderers = useDefaultRenderers<R, SR>();
  const rawRenderRow = renderers?.renderRow ?? defaultRenderers?.renderRow ?? defaultRenderRow;
  const headerAndTopSummaryRowsCount = 1 + (topSummaryRows?.length ?? 0);
  const { leftKey, rightKey } = getLeftRightKey(direction);
  const toggleGroupLatest = useLatestFunc(toggleGroup);
  const groupIdGetter = rawGroupIdGetter ?? defaultGroupIdGetter;
  const columnsProp = rawColumns as readonly Column<R, SR>[];

  const { columns, groupBy } = useMemo(() => {
    const columns = columnsProp.toSorted(({ key: aKey }, { key: bKey }) => {
      // Sort select column first:
      if (aKey === SELECT_COLUMN_KEY) return -1;
      if (bKey === SELECT_COLUMN_KEY) return 1;

      // Sort grouped columns second, following the groupBy order:
      if (rawGroupBy.includes(aKey)) {
        if (rawGroupBy.includes(bKey)) {
          return rawGroupBy.indexOf(aKey) - rawGroupBy.indexOf(bKey);
        }
        return -1;
      }
      if (rawGroupBy.includes(bKey)) return 1;

      // Sort other columns last:
      return 0;
    });

    const groupBy: string[] = [];
    for (const [index, column] of columns.entries()) {
      if (rawGroupBy.includes(column.key)) {
        groupBy.push(column.key);
        columns[index] = {
          ...column,
          frozen: true,
          renderCell: () => null,
          renderGroupCell: column.renderGroupCell ?? renderToggleGroup,
          editable: false
        };
      }
    }

    return { columns, groupBy };
  }, [columnsProp, rawGroupBy]);

  const [groupedRows, rowsCount] = useMemo(() => {
    if (groupBy.length === 0) return [undefined, rawRows.length];

    const groupRows = (
      rows: readonly R[],
      [groupByKey, ...remainingGroupByKeys]: readonly string[],
      startRowIndex: number
    ): [Readonly<GroupByDictionary<R>>, number] => {
      let groupRowsCount = 0;
      const groups: GroupByDictionary<R> = {};
      for (const [key, childRows] of Object.entries(rowGrouper(rows, groupByKey))) {
        // Recursively group each parent group
        const [childGroups, childRowsCount] =
          remainingGroupByKeys.length === 0
            ? [childRows, childRows.length]
            : groupRows(childRows, remainingGroupByKeys, startRowIndex + groupRowsCount + 1); // 1 for parent row
        groups[key] = { childRows, childGroups, startRowIndex: startRowIndex + groupRowsCount };
        groupRowsCount += childRowsCount + 1; // 1 for parent row
      }

      return [groups, groupRowsCount];
    };

    return groupRows(rawRows, groupBy, 0);
  }, [groupBy, rowGrouper, rawRows]);

  const [rows, isGroupRow, rowMetadata] = useMemo((): [
    readonly (R | GroupRow<R>)[],
    (row: R | GroupRow<R>) => row is GroupRow<R>,
    ReadonlyMap<R | GroupRow<R>, RowGroupMetadata<R>>
  ] => {
    const allGroupRows = new Set<unknown>();
    const rowMetadata = new Map<R | GroupRow<R>, RowGroupMetadata<R>>();
    if (!groupedRows) {
      rawRows.forEach((row, startRowIndex) => {
        rowMetadata.set(row, { parent: undefined, startRowIndex });
      });
      return [rawRows, isGroupRow, rowMetadata];
    }

    const flattenedRows: (R | GroupRow<R>)[] = [];

    const expandGroup = (
      rows: GroupByDictionary<R> | readonly R[],
      parent: Maybe<readonly [GroupRow<R>, number]>,
      level: number
    ): void => {
      if (isReadonlyArray(rows)) {
        rows.forEach((row, index) => {
          rowMetadata.set(row, { parent, startRowIndex: parent![0].startRowIndex + index + 1 });
          flattenedRows.push(row);
        });
        return;
      }
      Object.keys(rows).forEach((groupKey, posInSet, keys) => {
        const parentId = parent?.[0].id;
        const id = groupIdGetter(groupKey, parentId);
        const isExpanded = expandedGroupIds.has(id);
        const { childRows, childGroups, startRowIndex } = rows[groupKey];

        const groupRow: GroupRow<R> = {
          id,
          parentId,
          groupKey,
          isExpanded,
          childRows,
          level,
          posInSet,
          startRowIndex,
          setSize: keys.length
        };
        const rowIdx = flattenedRows.length;
        flattenedRows.push(groupRow);
        allGroupRows.add(groupRow);
        rowMetadata.set(groupRow, { parent, startRowIndex });

        if (isExpanded) {
          expandGroup(childGroups, [groupRow, rowIdx], level + 1);
        }
      });
    };

    expandGroup(groupedRows, undefined, 0);
    return [flattenedRows, isGroupRow, rowMetadata];

    function isGroupRow(row: R | GroupRow<R>): row is GroupRow<R> {
      return allGroupRows.has(row);
    }
  }, [expandedGroupIds, groupedRows, rawRows, groupIdGetter]);

  const rowHeight = useMemo(() => {
    if (typeof rawGroupRowHeight === 'function') {
      return (row: R | GroupRow<R>): number => {
        if (isGroupRow(row)) {
          return rawGroupRowHeight({ type: 'GROUP', row });
        }
        return rawGroupRowHeight({ type: 'ROW', row });
      };
    }
    if (rawGroupRowHeight != null) return rawGroupRowHeight;

    if (typeof rawRowHeight === 'function') {
      return (row: R | GroupRow<R>): number => {
        return isGroupRow(row) ? 35 : rawRowHeight(row);
      };
    }

    return rawRowHeight;
  }, [isGroupRow, rawGroupRowHeight, rawRowHeight]);

  const getParentRowAndIndex = useCallback(
    (row: R | GroupRow<R>) => {
      return rowMetadata.get(row)?.parent;
    },
    [rowMetadata]
  );

  const rowKeyGetter = useCallback(
    (row: R | GroupRow<R>) => {
      if (isGroupRow(row)) {
        return row.id;
      }

      if (typeof rawRowKeyGetter === 'function') {
        return rawRowKeyGetter(row);
      }

      return rowMetadata.get(row)!.startRowIndex;
    },
    [isGroupRow, rawRowKeyGetter, rowMetadata]
  );

  const selectedRows = useMemo((): Maybe<ReadonlySet<Key>> => {
    if (rawSelectedRows == null) return null;

    assertIsValidKeyGetter<R, K>(rawRowKeyGetter);

    const selectedRows = new Set<Key>(rawSelectedRows);
    for (const row of rows) {
      if (isGroupRow(row)) {
        // Select parent row if all selectable children are selected.
        let hasSelectableChild = false;
        let isGroupRowSelected = true;
        for (const childRow of row.childRows) {
          if (rawIsRowSelectionDisabled?.(childRow) === true) continue;

          hasSelectableChild = true;
          if (!rawSelectedRows.has(rawRowKeyGetter(childRow))) {
            isGroupRowSelected = false;
            break;
          }
        }
        if (hasSelectableChild && isGroupRowSelected) {
          selectedRows.add(row.id);
        }
      }
    }

    return selectedRows;
  }, [isGroupRow, rawIsRowSelectionDisabled, rawRowKeyGetter, rawSelectedRows, rows]);

  function onSelectedRowsChange(newSelectedRows: Set<Key>) {
    if (!rawOnSelectedRowsChange) return;

    assertIsValidKeyGetter<R, K>(rawRowKeyGetter);

    const newRawSelectedRows = new Set(rawSelectedRows);
    for (const row of rows) {
      const key = rowKeyGetter(row);
      if (selectedRows?.has(key) && !newSelectedRows.has(key)) {
        if (isGroupRow(row)) {
          // unselect all selectable children if the parent row is unselected
          for (const cr of row.childRows) {
            if (isChildRowSelectionDisabled(cr)) continue;
            newRawSelectedRows.delete(rawRowKeyGetter(cr));
          }
        } else {
          newRawSelectedRows.delete(key as K);
        }
      } else if (!selectedRows?.has(key) && newSelectedRows.has(key)) {
        if (isGroupRow(row)) {
          // select all selectable children if the parent row is selected
          for (const cr of row.childRows) {
            if (isChildRowSelectionDisabled(cr)) continue;
            newRawSelectedRows.add(rawRowKeyGetter(cr));
          }
        } else {
          newRawSelectedRows.add(key as K);
        }
      }
    }

    rawOnSelectedRowsChange(newRawSelectedRows);
  }

  function handleKeyDown(args: CellKeyDownArgs<R, SR>, event: CellKeyboardEvent) {
    rawOnCellKeyDown?.(args, event);
    if (event.isGridDefaultPrevented()) return;

    if (args.mode === 'EDIT') return;
    const { column, rowIdx, setActivePosition } = args;
    const idx = column?.idx ?? -1;
    const row = rows[rowIdx];

    if (!isGroupRow(row)) return;
    if (
      idx === -1 &&
      // Collapse the current group row if it is focused and is in expanded state
      ((event.key === leftKey && row.isExpanded) ||
        // Expand the current group row if it is focused and is in collapsed state
        (event.key === rightKey && !row.isExpanded))
    ) {
      // prevent scrolling
      event.preventDefault();
      event.preventGridDefault();
      toggleGroup(row.id);
    }

    // If a group row is focused, and it is collapsed, move to the parent group row (if there is one).
    if (idx === -1 && event.key === leftKey && !row.isExpanded && row.level !== 0) {
      const parentRowAndIndex = getParentRowAndIndex(row);
      if (parentRowAndIndex != null) {
        event.preventGridDefault();
        setActivePosition({ idx, rowIdx: parentRowAndIndex[1] });
      }
    }
  }

  // Prevent copy/paste on group rows
  function handleCellCopy(
    { row, column }: CellCopyArgs<NoInfer<R>, NoInfer<SR>>,
    event: CellClipboardEvent
  ) {
    if (!isGroupRow(row)) {
      rawOnCellCopy?.({ row, column }, event);
    }
  }

  function handleCellPaste(
    { row, column }: CellPasteArgs<NoInfer<R>, NoInfer<SR>>,
    event: CellClipboardEvent
  ): NoInfer<R> {
    if (isGroupRow(row)) return row;
    return rawOnCellPaste!({ row, column }, event);
  }

  function handleRowsChange(updatedRows: R[], { indexes, column }: RowsChangeData<R, SR>) {
    if (!onRowsChange) return;
    const updatedRawRows = [...rawRows];
    const rawIndexes: number[] = [];
    for (const index of indexes) {
      const rawIndex = rawRows.indexOf(rows[index] as R);
      updatedRawRows[rawIndex] = updatedRows[index];
      rawIndexes.push(rawIndex);
    }
    onRowsChange(updatedRawRows, {
      indexes: rawIndexes,
      column
    });
  }

  function toggleGroup(groupId: unknown) {
    const newExpandedGroupIds = new Set(expandedGroupIds);
    if (newExpandedGroupIds.has(groupId)) {
      newExpandedGroupIds.delete(groupId);
    } else {
      newExpandedGroupIds.add(groupId);
    }
    onExpandedGroupIdsChange(newExpandedGroupIds);
  }

  function renderRow(
    key: Key,
    {
      row,
      rowClass,
      onCellMouseDown,
      onCellClick,
      onCellDoubleClick,
      onCellContextMenu,
      onRowChange,
      draggedOverCellIdx,
      activeCellEditor,
      isRowSelectionDisabled,
      isTreeGrid,
      ...rowProps
    }: RenderRowProps<R, SR>
  ) {
    if (isGroupRow(row)) {
      const { startRowIndex } = row;
      return (
        <GroupedRow
          key={key}
          {...rowProps}
          aria-rowindex={headerAndTopSummaryRowsCount + startRowIndex + 1}
          row={row}
          groupBy={groupBy}
          toggleGroup={toggleGroupLatest}
        />
      );
    }

    let ariaRowIndex = rowProps['aria-rowindex'];
    const metadata = rowMetadata.get(row)!;
    if (metadata.parent != null) {
      ariaRowIndex = metadata.startRowIndex + headerAndTopSummaryRowsCount + 1;
    }

    return rawRenderRow(key, {
      ...rowProps,
      'aria-rowindex': ariaRowIndex,
      row,
      rowClass,
      onCellMouseDown,
      onCellClick,
      onCellDoubleClick,
      onCellContextMenu,
      onRowChange,
      draggedOverCellIdx,
      activeCellEditor,
      isRowSelectionDisabled,
      isTreeGrid
    });
  }

  function isRowSelectionDisabled(row: R): boolean {
    return isGroupRow(row) ? false : rawIsRowSelectionDisabled?.(row) === true;
  }

  function isChildRowSelectionDisabled(row: R): boolean {
    return rawIsRowSelectionDisabled?.(row) === true;
  }

  return {
    ...props,
    topSummaryRows,
    bottomSummaryRows,
    role: 'treegrid',
    'aria-rowcount':
      rowsCount + 1 + (topSummaryRows?.length ?? 0) + (bottomSummaryRows?.length ?? 0),
    columns,
    rows: rows as R[],
    rowHeight,
    rowKeyGetter: rowKeyGetter as (row: NoInfer<R>) => K,
    onRowsChange: handleRowsChange,
    selectedRows: selectedRows as Maybe<ReadonlySet<K>>,
    onSelectedRowsChange,
    onCellKeyDown: handleKeyDown,
    onCellCopy: handleCellCopy,
    onCellPaste: rawOnCellPaste ? handleCellPaste : undefined,
    onFill: undefined,
    isRowSelectionDisabled,
    renderers: {
      ...renderers,
      renderRow
    }
  };
}

function defaultGroupIdGetter(groupKey: string, parentId: string | undefined) {
  return parentId !== undefined ? `${parentId}__${groupKey}` : groupKey;
}

function isReadonlyArray(arr: unknown): arr is readonly unknown[] {
  return Array.isArray(arr);
}
