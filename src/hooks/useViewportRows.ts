import { useCallback, useMemo, useRef, useState, type Key, type RefObject } from 'react';

import { max, min } from '../utils';
import { RowHeightIndex } from '../utils/RowHeightIndex';
import type { Maybe } from '../types';
import { useLatestFunc } from './useLatestFunc';
import { useLayoutEffect } from './useLayoutEffect';

type RowKey = Key | number;

interface ViewportRowsArgs<R> {
  rows: readonly R[];
  rowHeight: number | ((row: R) => number);
  rowKeyGetter: Maybe<(row: R) => Key>;
  autoHeightColumnWidths: ReadonlyMap<string, string>;
  clientHeight: number;
  scrollTop: number;
  enableVirtualization: boolean;
  gridRef: RefObject<HTMLDivElement | null>;
}

interface RowHeightLayout<R> {
  rows: readonly R[];
  rowHeight: number | ((row: R) => number);
  rowKeyGetter: Maybe<(row: R) => Key>;
  autoHeightColumnWidths: ReadonlyMap<string, string>;
  rowKeys: readonly RowKey[];
  keyToIndex: ReadonlyMap<RowKey, number>;
  baseHeights: readonly number[];
  cellHeights: Map<RowKey, Map<string, number>>;
  index: RowHeightIndex;
  previousLayout:
    | {
        rowKeys: readonly RowKey[];
        index: RowHeightIndex;
      }
    | undefined;
}

interface ScrollAnchor {
  rowKey: RowKey;
  offset: number;
  scrollTop: number;
}

interface MeasuredElementMetadata {
  rowIdx: number;
  columnKey: string;
}

export interface ViewportRowsLayout {
  gridTemplateRows: string;
  gridRowStartByRowIdx: ReadonlyMap<number, number>;
  rowTrackCount: number;
}

export function useViewportRows<R>({
  rows,
  rowHeight,
  rowKeyGetter,
  autoHeightColumnWidths,
  clientHeight,
  scrollTop,
  enableVirtualization,
  gridRef
}: ViewportRowsArgs<R>) {
  const pendingScrollAnchorRef = useRef<ScrollAnchor | undefined>(undefined);
  const resizeObserverRef = useRef<ResizeObserver | null>(null);
  const observedElementsRef = useRef(new Set<HTMLDivElement>());
  const elementMetadataRef = useRef(new WeakMap<HTMLDivElement, MeasuredElementMetadata>());
  const [layoutVersion, setLayoutVersion] = useState(0);
  const hasAutoHeightColumns = autoHeightColumnWidths.size > 0;
  const [layoutState, setLayoutState] = useState(() =>
    createRowHeightLayout(undefined, rows, rowHeight, rowKeyGetter, autoHeightColumnWidths)
  );
  let layout = layoutState;

  if (
    layout.rows !== rows ||
    layout.rowHeight !== rowHeight ||
    layout.rowKeyGetter !== rowKeyGetter ||
    !areColumnWidthsEqual(layout.autoHeightColumnWidths, autoHeightColumnWidths)
  ) {
    layout = createRowHeightLayout(layout, rows, rowHeight, rowKeyGetter, autoHeightColumnWidths);
    setLayoutState(layout);
  }

  const handleResizeEntries = useLatestFunc((entries: readonly ResizeObserverEntry[]) => {
    const grid = gridRef.current;
    if (grid === null || layout.rows.length === 0) return;

    const anchorRowIdx = layout.index.findIndex(grid.scrollTop);
    const anchor: ScrollAnchor = {
      rowKey: layout.rowKeys[anchorRowIdx],
      offset: grid.scrollTop - layout.index.getTop(anchorRowIdx),
      scrollTop: grid.scrollTop
    };
    const affectedRowKeys = new Set<RowKey>();

    for (const entry of entries) {
      const element = entry.target as HTMLDivElement;
      const metadata = elementMetadataRef.current.get(element);
      if (metadata === undefined) continue;
      const { rowIdx, columnKey } = metadata;
      const rowKey = layout.rowKeys[rowIdx];
      if (!layout.keyToIndex.has(rowKey)) continue;

      const cell = element.parentElement!;
      const cellStyle = getComputedStyle(cell);
      const contentHeight =
        entry.borderBoxSize[0]?.blockSize ?? element.getBoundingClientRect().height;
      const cellChromeHeight =
        parseCssPixelValue(cellStyle.paddingTop) +
        parseCssPixelValue(cellStyle.paddingBottom) +
        parseCssPixelValue(cellStyle.borderTopWidth) +
        parseCssPixelValue(cellStyle.borderBottomWidth);
      let rowCellHeights = layout.cellHeights.get(rowKey);
      if (rowCellHeights === undefined) {
        rowCellHeights = new Map();
        layout.cellHeights.set(rowKey, rowCellHeights);
      }
      rowCellHeights.set(columnKey, Math.ceil(contentHeight + cellChromeHeight));
      affectedRowKeys.add(rowKey);
    }

    let didChange = false;
    for (const rowKey of affectedRowKeys) {
      const rowIdx = layout.keyToIndex.get(rowKey)!;
      let measuredHeight = 0;
      for (const height of layout.cellHeights.get(rowKey)!.values()) {
        measuredHeight = max(measuredHeight, height);
      }
      didChange =
        layout.index.update(rowIdx, max(layout.baseHeights[rowIdx], measuredHeight)) || didChange;
    }

    if (didChange) {
      pendingScrollAnchorRef.current = anchor;
      setLayoutVersion((version) => version + 1);
    }
  });

  const getResizeObserver = useCallback((): ResizeObserver | null => {
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
    if (globalThis.ResizeObserver == null) return null;
    resizeObserverRef.current ??= new globalThis.ResizeObserver(handleResizeEntries);
    return resizeObserverRef.current;
  }, [handleResizeEntries]);

  const observe = useCallback(
    (rowIdx: number, columnKey: string, element: HTMLDivElement) => {
      elementMetadataRef.current.set(element, { rowIdx, columnKey });
      observedElementsRef.current.add(element);
      getResizeObserver()?.observe(element);

      return () => {
        observedElementsRef.current.delete(element);
        elementMetadataRef.current.delete(element);
        resizeObserverRef.current?.unobserve(element);
      };
    },
    [getResizeObserver]
  );

  const rowHeightContextValue = useMemo(
    () => (hasAutoHeightColumns ? { observe } : undefined),
    [hasAutoHeightColumns, observe]
  );

  useLayoutEffect(() => {
    const { previousLayout } = layout;
    if (previousLayout === undefined) return;

    const grid = gridRef.current;
    if (grid === null || previousLayout.rowKeys.length === 0 || layout.rows.length === 0) return;

    const previousScrollTop = grid.scrollTop;
    const previousAnchorRowIdx = previousLayout.index.findIndex(previousScrollTop);
    const anchorRowKey = previousLayout.rowKeys[previousAnchorRowIdx];
    const anchorRowIdx = layout.keyToIndex.get(anchorRowKey);
    if (anchorRowIdx === undefined) return;

    const anchorOffset = previousScrollTop - previousLayout.index.getTop(previousAnchorRowIdx);
    grid.scrollTop = layout.index.getTop(anchorRowIdx) + anchorOffset;
  }, [gridRef, layout]);

  useLayoutEffect(() => {
    if (!hasAutoHeightColumns) return;
    const resizeObserver = getResizeObserver();
    if (resizeObserver === null) return;
    for (const element of observedElementsRef.current) {
      resizeObserver.observe(element);
    }

    return () => resizeObserver.disconnect();
  }, [getResizeObserver, hasAutoHeightColumns, layout]);

  useLayoutEffect(() => {
    const anchor = pendingScrollAnchorRef.current;
    const grid = gridRef.current;
    if (anchor === undefined || grid === null) return;
    pendingScrollAnchorRef.current = undefined;

    const anchorRowIdx = layout.keyToIndex.get(anchor.rowKey);
    if (anchorRowIdx === undefined || Math.abs(grid.scrollTop - anchor.scrollTop) > 1) return;
    grid.scrollTop = layout.index.getTop(anchorRowIdx) + anchor.offset;
  }, [gridRef, layout, layoutVersion]);

  function getRowTop(rowIdx: number) {
    return layout.index.getTop(max(0, min(rows.length, rowIdx)));
  }

  function getRowHeight(rowIdx: number) {
    return layout.index.getHeight(max(0, min(rows.length - 1, rowIdx)));
  }

  function findRowIdx(offset: number) {
    return layout.index.findIndex(offset);
  }

  function getViewportRowsLayout(rowIndexes: readonly number[]): ViewportRowsLayout {
    const gridRowStartByRowIdx = new Map<number, number>();
    const templateParts: string[] = [];
    let rowTrackCount = 0;
    let nextRowIdx = 0;
    let repeatedHeight: number | undefined;
    let repeatCount = 0;

    function flushRepeatedRows() {
      if (repeatedHeight === undefined) return;

      templateParts.push(
        repeatCount === 1 ? `${repeatedHeight}px` : `repeat(${repeatCount}, ${repeatedHeight}px)`
      );
      repeatedHeight = undefined;
      repeatCount = 0;
    }

    function appendGap(height: number) {
      if (height <= 0) return;
      flushRepeatedRows();
      templateParts.push(`${height}px`);
      rowTrackCount++;
    }

    for (const rowIdx of rowIndexes) {
      if (rowIdx > nextRowIdx) {
        appendGap(getRowTop(rowIdx) - getRowTop(nextRowIdx));
      }

      const height = getRowHeight(rowIdx);
      if (height === repeatedHeight) {
        repeatCount++;
      } else {
        flushRepeatedRows();
        repeatedHeight = height;
        repeatCount = 1;
      }

      rowTrackCount++;
      gridRowStartByRowIdx.set(rowIdx, rowTrackCount);
      nextRowIdx = rowIdx + 1;
    }

    flushRepeatedRows();
    appendGap(layout.index.getTotalHeight() - getRowTop(nextRowIdx));

    return {
      gridTemplateRows: templateParts.join(' '),
      gridRowStartByRowIdx,
      rowTrackCount
    };
  }

  const totalRowHeight = layout.index.getTotalHeight();
  // The index is updated in place by measurement, so consumers also need its version.
  const rowHeightSnapshot = useMemo(
    () => ({ index: layout.index, version: layoutVersion }),
    [layout.index, layoutVersion]
  );
  let rowOverscanStartIdx = 0;
  let rowOverscanEndIdx = rows.length - 1;

  if (enableVirtualization) {
    const overscanThreshold = 4;
    const rowVisibleStartIdx = findRowIdx(scrollTop);
    const rowVisibleEndIdx = findRowIdx(scrollTop + clientHeight);
    rowOverscanStartIdx = max(0, rowVisibleStartIdx - overscanThreshold);
    rowOverscanEndIdx = min(rows.length - 1, rowVisibleEndIdx + overscanThreshold);
  }

  return {
    rowOverscanStartIdx,
    rowOverscanEndIdx,
    totalRowHeight,
    rowHeightSnapshot,
    getRowTop,
    getRowHeight,
    findRowIdx,
    getViewportRowsLayout,
    rowHeightContextValue
  };
}

function createRowHeightLayout<R>(
  previousLayout: RowHeightLayout<R> | undefined,
  rows: readonly R[],
  rowHeight: number | ((row: R) => number),
  rowKeyGetter: Maybe<(row: R) => Key>,
  autoHeightColumnWidths: ReadonlyMap<string, string>
): RowHeightLayout<R> {
  const previousLayoutSnapshot =
    previousLayout === undefined
      ? undefined
      : { rowKeys: previousLayout.rowKeys, index: previousLayout.index };

  if (autoHeightColumnWidths.size === 0) {
    const index =
      typeof rowHeight === 'number'
        ? new RowHeightIndex(rows.length, rowHeight)
        : new RowHeightIndex(rows.map((row) => rowHeight(row)));

    return {
      rows,
      rowHeight,
      rowKeyGetter,
      autoHeightColumnWidths,
      rowKeys: [],
      keyToIndex: new Map(),
      baseHeights: [],
      cellHeights: new Map(),
      index,
      previousLayout: previousLayoutSnapshot
    };
  }

  const rowKeys: RowKey[] = [];
  const keyToIndex = new Map<RowKey, number>();
  const baseHeights: number[] = [];
  const cellHeights = new Map<RowKey, Map<string, number>>();
  const indexedHeights: number[] = [];

  for (let rowIdx = 0; rowIdx < rows.length; rowIdx++) {
    const row = rows[rowIdx];
    const rowKey = rowKeyGetter?.(row) ?? rowIdx;
    const baseHeight = typeof rowHeight === 'number' ? rowHeight : rowHeight(row);
    rowKeys.push(rowKey);
    keyToIndex.set(rowKey, rowIdx);
    baseHeights.push(baseHeight);

    let indexedHeight = baseHeight;
    const previousRowIdx = previousLayout?.keyToIndex.get(rowKey);
    const previousRow =
      previousRowIdx === undefined ? undefined : previousLayout?.rows[previousRowIdx];
    // A stable key does not guarantee stable rendered content. Immutable row updates replace
    // the row object, so measurements from the old object must not be carried to the new one.
    const previousCellHeights =
      previousRow === row ? previousLayout?.cellHeights.get(rowKey) : undefined;
    if (previousCellHeights !== undefined) {
      const retainedCellHeights = new Map<string, number>();
      for (const [columnKey, height] of previousCellHeights) {
        const width = autoHeightColumnWidths.get(columnKey);
        if (
          width === undefined ||
          previousLayout?.autoHeightColumnWidths.get(columnKey) !== width
        ) {
          continue;
        }
        retainedCellHeights.set(columnKey, height);
        indexedHeight = max(indexedHeight, height);
      }
      if (retainedCellHeights.size > 0) {
        cellHeights.set(rowKey, retainedCellHeights);
      }
    }
    indexedHeights.push(indexedHeight);
  }

  return {
    rows,
    rowHeight,
    rowKeyGetter,
    autoHeightColumnWidths,
    rowKeys,
    keyToIndex,
    baseHeights,
    cellHeights,
    index:
      typeof rowHeight === 'number' && indexedHeights.every((height) => height === rowHeight)
        ? new RowHeightIndex(rows.length, rowHeight)
        : new RowHeightIndex(indexedHeights),
    previousLayout: previousLayoutSnapshot
  };
}

function areColumnWidthsEqual(
  previousWidths: ReadonlyMap<string, string>,
  nextWidths: ReadonlyMap<string, string>
): boolean {
  if (previousWidths === nextWidths) return true;
  if (previousWidths.size !== nextWidths.size) return false;

  for (const [key, width] of previousWidths) {
    if (nextWidths.get(key) !== width) return false;
  }
  return true;
}

function parseCssPixelValue(value: string): number {
  return Number.parseFloat(value) || 0;
}
