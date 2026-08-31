import { css } from 'ecij';

export const cell = css`
  @layer rdg.Cell {
    /* max-content does not work with size containment
     * dynamically switching between different containment styles incurs a heavy relayout penalty
     * Chromium bug: at odd zoom levels or subpixel positioning,
     * layout/paint/style containment can make cell borders disappear
     *   https://issues.chromium.org/issues/40840864
     */
    position: relative; /* needed for absolute positioning to work */
    padding-block: 0;
    padding-inline: 8px;
    border-inline-end: var(--rdg-border-width) solid var(--rdg-border-color);
    border-block-end: var(--rdg-border-width) solid var(--rdg-border-color);
    align-content: center;
    background-color: inherit;

    white-space: nowrap;
    overflow: clip;
    text-overflow: ellipsis;
    outline: none;

    &[aria-selected='true'] {
      outline: var(--rdg-selection-width) solid var(--rdg-selection-color);
      outline-offset: calc(var(--rdg-selection-width) * -1);
    }
  }
`;

export const cellClassname = `rdg-cell ${cell}`;

export const cellWrap = css`
  @layer rdg.Cell {
    white-space: normal;
    overflow-wrap: anywhere;
  }
`;

export const cellWrapClassname = `rdg-cell-wrap ${cellWrap}`;

export const cellContent = css`
  @layer rdg.Cell {
    min-inline-size: 0;
  }
`;

export const cellContentClassname = `rdg-cell-content ${cellContent}`;

export const cellContentMeasuring = css`
  @layer rdg.Cell {
    display: flow-root;
    block-size: max-content;
  }
`;

export const cellContentMeasuringClassname = `rdg-cell-content-measuring ${cellContentMeasuring}`;

export const cellFrozen = css`
  @layer rdg.Cell {
    position: sticky;
    /* Should have a higher value than 0 to show up above unfrozen cells */
    z-index: 1;
  }
`;

export const cellFrozenClassname = `rdg-cell-frozen ${cellFrozen}`;

export const cellRightFrozen = css`
  @layer rdg.Cell {
    position: sticky;
    /* Should have a higher value than 0 to show up above unfrozen cells */
    z-index: 1;
  }
`;

export const cellRightFrozenClassname = `rdg-cell-frozen-right ${cellRightFrozen}`;

const cellDragHandle = css`
  @layer rdg.DragHandle {
    --rdg-drag-handle-size: 8px;
    z-index: 0;
    cursor: move;
    inline-size: var(--rdg-drag-handle-size);
    block-size: var(--rdg-drag-handle-size);
    background-color: var(--rdg-selection-color);
    place-self: end;

    &:hover {
      --rdg-drag-handle-size: 16px;
      border: 2px solid var(--rdg-selection-color);
      background-color: var(--rdg-background-color);
    }
  }
`;

export const cellDragHandleFrozenClassname = css`
  @layer rdg.DragHandle {
    z-index: 1;
    position: sticky;
  }
`;

export const cellDragHandleClassname = `rdg-cell-drag-handle ${cellDragHandle}`;
