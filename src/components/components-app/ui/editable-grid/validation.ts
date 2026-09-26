import type { EditableGridLocale } from "./i18n"
import type { ValidationRule } from "./types"

export function validateCell<TData = Record<string, unknown>>(
  value: unknown,
  rule: ValidationRule<TData> | undefined,
  row: TData,
  locale: EditableGridLocale
): string | null {
  if (!rule) return null

  if (rule.required) {
    if (value === undefined || value === null || value === "") {
      return locale.validationRequired
    }
  }

  if (typeof value === "number") {
    if (rule.min !== undefined && value < rule.min) {
      return locale.validationMin(rule.min)
    }
    if (rule.max !== undefined && value > rule.max) {
      return locale.validationMax(rule.max)
    }
  }

  if (typeof value === "string") {
    if (rule.minLength !== undefined && value.length < rule.minLength) {
      return locale.validationMinLength(rule.minLength)
    }
    if (rule.maxLength !== undefined && value.length > rule.maxLength) {
      return locale.validationMaxLength(rule.maxLength)
    }
    if (rule.pattern && !rule.pattern.test(value)) {
      return locale.validationPattern
    }
  }

  if (rule.custom) {
    return rule.custom(value, row)
  }

  return null
}
