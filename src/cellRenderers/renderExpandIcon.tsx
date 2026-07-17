import { css } from 'ecij';

import type { ExpandIconProps } from '../DataGrid';

const expandButton = css`
  @layer rdg.ExpandButton {
    position: relative;
    display: inline-block;
    inline-size: 17px;
    block-size: 17px;
    padding: 0;
    color: inherit;
    background-color: var(--rdg-background-color);
    border: var(--rdg-border-width) solid var(--rdg-border-color);
    border-radius: 2px;
    cursor: pointer;
    vertical-align: middle;
    transition:
      color 0.2s,
      border-color 0.2s;

    &::before,
    &::after {
      content: '';
      position: absolute;
      inset-block-start: 50%;
      left: 50%;
      background-color: currentColor;
      transform: translate(-50%, -50%);
      transition:
        transform 0.2s,
        opacity 0.2s;
    }

    &::before {
      inline-size: 7px;
      block-size: 1px;
    }

    &::after {
      inline-size: 1px;
      block-size: 7px;
    }

    &[aria-expanded='true']::after {
      opacity: 0;
      transform: translate(-50%, -50%) rotate(90deg);
    }

    &:enabled:hover {
      color: var(--rdg-selection-color);
      border-color: var(--rdg-selection-color);
    }

    &:focus-visible {
      outline: 2px solid var(--rdg-selection-color);
      outline-offset: 1px;
    }

    &:disabled {
      cursor: default;
      visibility: hidden;
    }
  }
`;

const expandButtonClassname = `rdg-expand-button ${expandButton}`;

export function renderExpandIcon<R>(props: ExpandIconProps<R>) {
  return <ExpandIcon {...props} />;
}

export function ExpandIcon<R>({ isExpanded, expandable, tabIndex, onExpand }: ExpandIconProps<R>) {
  return (
    <button
      type="button"
      aria-label={isExpanded ? 'Collapse row' : 'Expand row'}
      aria-expanded={expandable ? isExpanded : undefined}
      tabIndex={expandable ? tabIndex : -1}
      disabled={!expandable}
      className={expandButtonClassname}
      onClick={(event) => {
        event.stopPropagation();
        onExpand();
      }}
    />
  );
}
