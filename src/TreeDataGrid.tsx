import type { Key } from 'react';

import type { Column, Maybe, Omit, RowHeightArgs } from './types';
import { DataGrid } from './DataGrid';
import type { DataGridProps, RowGroupingOptions } from './DataGrid';

export interface TreeDataGridProps<R, SR = unknown, K extends Key = Key> extends Omit<
  DataGridProps<R, SR, K>,
  | 'columns'
  | 'role'
  | 'aria-rowcount'
  | 'rowHeight'
  | 'onFill'
  | 'isRowSelectionDisabled'
  | 'rowGrouping'
> {
  columns: readonly Column<NoInfer<R>, NoInfer<SR>>[];
  rowHeight?: Maybe<number | ((args: RowHeightArgs<NoInfer<R>>) => number)>;
  groupBy: readonly string[];
  rowGrouper: (
    rows: readonly NoInfer<R>[],
    columnKey: string
  ) => Record<string, readonly NoInfer<R>[]>;
  expandedGroupIds: ReadonlySet<unknown>;
  onExpandedGroupIdsChange: (expandedGroupIds: Set<unknown>) => void;
  groupIdGetter?: Maybe<(groupKey: string, parentId?: string) => string>;
}

export function TreeDataGrid<R, SR = unknown, K extends Key = Key>({
  groupBy,
  rowGrouper,
  expandedGroupIds,
  onExpandedGroupIdsChange,
  groupIdGetter,
  rowHeight,
  ...props
}: TreeDataGridProps<R, SR, K>) {
  const rowGrouping: RowGroupingOptions<R> = {
    groupBy,
    rowGrouper,
    expandedGroupIds,
    onExpandedGroupIdsChange,
    groupIdGetter,
    rowHeight
  };

  return <DataGrid {...props} rowGrouping={rowGrouping} />;
}
