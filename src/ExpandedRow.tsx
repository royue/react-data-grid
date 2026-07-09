import { useRovingTabIndex } from './hooks';
import { classnames } from './utils';
import { expandedRowCellClassname, expandedRowClassname } from './style/row';

interface ExpandedRowProps<R> {
  'aria-rowindex': number;
  columnsCount: number;
  gridRowStart: number;
  row: R;
  rowIdx: number;
  activeCellIdx: number | undefined;
  renderExpandedRow: (props: { row: R; rowIdx: number }) => React.ReactNode;
  setActivePosition: (position: { idx: number; rowIdx: number }) => void;
}

export function ExpandedRow<R>({
  'aria-rowindex': ariaRowIndex,
  columnsCount,
  gridRowStart,
  row,
  rowIdx,
  activeCellIdx,
  renderExpandedRow,
  setActivePosition
}: ExpandedRowProps<R>) {
  const isCellActive = activeCellIdx !== undefined;
  const { tabIndex, onFocus } = useRovingTabIndex(isCellActive);

  return (
    <div
      role="row"
      className={classnames(expandedRowClassname, `rdg-row-${rowIdx % 2 === 0 ? 'even' : 'odd'}`)}
      aria-rowindex={ariaRowIndex}
      style={{ gridRowStart }}
    >
      <div
        role="gridcell"
        aria-colindex={1}
        aria-colspan={columnsCount}
        aria-selected={isCellActive}
        tabIndex={tabIndex}
        className={expandedRowCellClassname}
        onFocus={onFocus}
        onMouseDown={() => setActivePosition({ idx: 0, rowIdx })}
      >
        {renderExpandedRow({ row, rowIdx })}
      </div>
    </div>
  );
}
