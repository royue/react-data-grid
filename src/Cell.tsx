import { memo, useCallback, useRef, type MouseEvent } from 'react';
import { css } from 'ecij';

import { useRovingTabIndex } from './hooks';
import { createCellEvent, getCellClassname, getCellStyle, isCellEditableUtil } from './utils';
import type { CellMouseEventHandler, CellRendererProps } from './types';
import { useRowHeightContext } from './RowHeightContext';
import {
  cellContentClassname,
  cellContentMeasuringClassname,
  cellWrapClassname
} from './style/cell';

const cellDraggedOver = css`
  @layer rdg.Cell {
    background-color: #ccccff;
  }
`;

const cellDraggedOverClassname = `rdg-cell-dragged-over ${cellDraggedOver}`;

function Cell<R, SR>({
  column,
  colSpan,
  rowSpan,
  rowSpanHeight,
  isCellActive,
  isDraggedOver,
  row,
  rowIdx,
  className,
  onMouseDown,
  onCellMouseDown,
  onClick,
  onCellClick,
  onDoubleClick,
  onCellDoubleClick,
  onContextMenu,
  onCellContextMenu,
  onRowChange,
  setActivePosition,
  style,
  ...props
}: CellRendererProps<R, SR>) {
  const { tabIndex, childTabIndex, onFocus } = useRovingTabIndex(isCellActive);
  const rowHeightContext = useRowHeightContext();
  const unobserveRef = useRef<(() => void) | undefined>(undefined);

  const { cellClass } = column;
  className = getCellClassname(
    column,
    isDraggedOver && cellDraggedOverClassname,
    typeof cellClass === 'function' ? cellClass(row) : cellClass,
    column.wrapText && cellWrapClassname,
    className
  );
  const isEditable = isCellEditableUtil(column, row);

  function setActivePositionWrapper(enableEditor = false) {
    setActivePosition({ rowIdx, idx: column.idx }, { enableEditor });
  }

  function handleMouseEvent(
    event: React.MouseEvent<HTMLDivElement>,
    eventHandler?: CellMouseEventHandler<R, SR>
  ) {
    let eventHandled = false;
    if (eventHandler) {
      const cellEvent = createCellEvent(event);
      eventHandler({ rowIdx, row, column, setActivePosition: setActivePositionWrapper }, cellEvent);
      eventHandled = cellEvent.isGridDefaultPrevented();
    }
    return eventHandled;
  }

  function handleMouseDown(event: MouseEvent<HTMLDivElement>) {
    onMouseDown?.(event);
    if (!handleMouseEvent(event, onCellMouseDown)) {
      // select cell if the event is not prevented
      setActivePositionWrapper();
    }
  }

  function handleClick(event: MouseEvent<HTMLDivElement>) {
    onClick?.(event);
    handleMouseEvent(event, onCellClick);
  }

  function handleDoubleClick(event: MouseEvent<HTMLDivElement>) {
    onDoubleClick?.(event);
    if (!handleMouseEvent(event, onCellDoubleClick)) {
      // go into edit mode if the event is not prevented
      setActivePositionWrapper(true);
    }
  }

  function handleContextMenu(event: MouseEvent<HTMLDivElement>) {
    onContextMenu?.(event);
    handleMouseEvent(event, onCellContextMenu);
  }

  function handleRowChange(newRow: R) {
    onRowChange(column, rowIdx, newRow);
  }

  const setContentRef = useCallback(
    (element: HTMLDivElement | null) => {
      unobserveRef.current?.();
      unobserveRef.current =
        element === null ? undefined : rowHeightContext?.observe(rowIdx, column.key, element);
    },
    [column.key, rowHeightContext, rowIdx]
  );

  const content = column.renderCell({
    column,
    row,
    rowIdx,
    isCellEditable: isEditable,
    tabIndex: childTabIndex,
    onRowChange: handleRowChange
  });

  return (
    <div
      role="gridcell"
      aria-colindex={column.idx + 1} // aria-colindex is 1-based
      aria-colspan={colSpan}
      aria-rowspan={rowSpan}
      aria-selected={isCellActive}
      aria-readonly={!isEditable || undefined}
      tabIndex={tabIndex}
      className={className}
      style={{
        ...getCellStyle(column, colSpan, rowSpanHeight),
        ...style
      }}
      onClick={handleClick}
      onMouseDown={handleMouseDown}
      onDoubleClick={handleDoubleClick}
      onContextMenu={handleContextMenu}
      onFocus={onFocus}
      {...props}
    >
      {column.autoHeight ? (
        <div
          ref={setContentRef}
          className={`${cellContentClassname} ${cellContentMeasuringClassname}`}
        >
          {content}
        </div>
      ) : (
        content
      )}
    </div>
  );
}

const CellComponent = memo(Cell) as <R, SR>(props: CellRendererProps<R, SR>) => React.JSX.Element;

export default CellComponent;

export function defaultRenderCell<R, SR>(key: React.Key, props: CellRendererProps<R, SR>) {
  return <CellComponent key={key} {...props} />;
}
