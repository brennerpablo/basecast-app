import type { EditableGridLanguage } from "./types"

export type EditableGridLocale = {
  noData: string
  addRow: string
  deleteRow: string
  deleteSelected: string
  selected: string
  validationRequired: string
  validationMin: (min: number) => string
  validationMax: (max: number) => string
  validationMinLength: (min: number) => string
  validationMaxLength: (max: number) => string
  validationPattern: string
}

const en: EditableGridLocale = {
  noData: "No data.",
  addRow: "Add row",
  deleteRow: "Delete",
  deleteSelected: "Delete selected",
  selected: "selected",
  validationRequired: "This field is required.",
  validationMin: (min) => `Must be at least ${min}.`,
  validationMax: (max) => `Must be at most ${max}.`,
  validationMinLength: (min) => `Must be at least ${min} characters.`,
  validationMaxLength: (max) => `Must be at most ${max} characters.`,
  validationPattern: "Invalid format.",
}

const pt: EditableGridLocale = {
  noData: "Sem dados.",
  addRow: "Adicionar linha",
  deleteRow: "Excluir",
  deleteSelected: "Excluir selecionados",
  selected: "selecionado(s)",
  validationRequired: "Este campo é obrigatório.",
  validationMin: (min) => `Deve ser no mínimo ${min}.`,
  validationMax: (max) => `Deve ser no máximo ${max}.`,
  validationMinLength: (min) => `Deve ter no mínimo ${min} caracteres.`,
  validationMaxLength: (max) => `Deve ter no máximo ${max} caracteres.`,
  validationPattern: "Formato inválido.",
}

const locales: Record<EditableGridLanguage, EditableGridLocale> = { en, pt }

export function getLocale(language: EditableGridLanguage): EditableGridLocale {
  return locales[language]
}
