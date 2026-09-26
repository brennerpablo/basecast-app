"use client";

import { createContext, type ReactNode,use, useCallback, useMemo, useState } from "react";

export interface BreadcrumbEntry {
  label: string;
  href?: string;
}

interface BreadcrumbContextValue {
  items: BreadcrumbEntry[];
  setItems: (items: BreadcrumbEntry[]) => void;
}

const BreadcrumbContext = createContext<BreadcrumbContextValue>({
  items: [],
  setItems: () => {}});

export function BreadcrumbProvider({ children }: { children: ReactNode }) {
  const [items, setItemsState] = useState<BreadcrumbEntry[]>([]);
  const setItems = useCallback((newItems: BreadcrumbEntry[]) => {
    setItemsState(newItems);
  }, []);
  const value = useMemo(() => ({ items, setItems }), [items, setItems]);

  return (
    <BreadcrumbContext.Provider value={value}>
      {children}
    </BreadcrumbContext.Provider>
  );
}

export function useBreadcrumbContext() {
  return use(BreadcrumbContext);
}
