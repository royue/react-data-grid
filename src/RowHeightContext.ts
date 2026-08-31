import { createContext, useContext } from 'react';

import type { Maybe } from './types';

export interface RowHeightContextValue {
  observe: (rowIdx: number, columnKey: string, element: HTMLDivElement) => () => void;
}

export const RowHeightContext = createContext<Maybe<RowHeightContextValue>>(undefined);
RowHeightContext.displayName = 'RowHeightContext';

export function useRowHeightContext(): Maybe<RowHeightContextValue> {
  return useContext(RowHeightContext);
}
