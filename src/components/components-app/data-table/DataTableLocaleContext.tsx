"use client"

import React from "react"

import { DataTableLocale, dataTableLocales } from "./i18n"

export const DataTableLocaleContext = React.createContext<DataTableLocale>(
  dataTableLocales.en,
)

export function useDataTableLocale(): DataTableLocale {
  return React.useContext(DataTableLocaleContext)
}
