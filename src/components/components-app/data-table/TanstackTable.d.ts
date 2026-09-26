import "@tanstack/react-table"

import { CellContext, HeaderContext, RowData } from "@tanstack/react-table"
import type { ReactNode } from "react"

declare module "@tanstack/react-table" {
   
  interface ColumnMeta<TData extends RowData, TValue> {
    className?: string
    displayName: string
    filterOnly?: boolean
    /** The metadata column's renderers, called by the stable cell/header of `columnBuilder`. */
    renderCell?: (props: CellContext<TData, TValue>) => ReactNode
    renderHeader?: (props: HeaderContext<TData, TValue>) => ReactNode
  }
}
