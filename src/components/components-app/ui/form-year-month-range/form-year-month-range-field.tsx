"use client";

import { MonthPicker } from "@/components/components-app/ui/month-picker";
import { Label } from "@/components/ui/label";

import {
  formYearMonthRangeCvmRegistroBoundsNow,
  parseYearMonthDash} from "./form-year-month-range-utils";

export type FormYearMonthRangeFieldProps = {
  idPrefix: string;
  valueFrom: string;
  valueTo: string;
  onValueFromChange: (monthInputValue: string) => void;
  onValueToChange: (monthInputValue: string) => void;
  /** YYYY-MM; omissão = limites padrão CVM (2000-01 … mês atual). */
  minMonth?: string;
  maxMonth?: string;
  labelFrom?: string;
  labelTo?: string;
};

// MonthPicker takes month as 0-indexed; our YYYY-MM strings use 1-indexed
// months. Convert at the boundary so the rest of the app keeps the same shape.
function ymStringToPicker(value: string): { year: number; month: number } | undefined {
  const p = parseYearMonthDash(value);
  if (!p) return undefined;
  const monthNum = Number(p.month);
  if (!Number.isFinite(monthNum) || monthNum < 1 || monthNum > 12) return undefined;
  return { year: p.year, month: monthNum - 1 };
}

function pickerToYmString(v: { year: number; month: number } | undefined): string {
  if (!v) return "";
  return `${v.year}-${String(v.month + 1).padStart(2, "0")}`;
}

function YearMonthPickerField({
  idPrefix,
  legendId,
  label,
  value,
  fallbackValue,
  onChange,
  minDate,
  maxDate}: {
  idPrefix: string;
  legendId: string;
  label: string;
  value: string;
  fallbackValue: string;
  onChange: (ym: string) => void;
  minDate?: { year: number; month: number };
  maxDate?: { year: number; month: number };
}) {
  const pickerValue = ymStringToPicker(value) ?? ymStringToPicker(fallbackValue);
  return (
    <div className="flex flex-col gap-1.5">
      <Label id={legendId} className="text-xs font-medium">
        {label}
      </Label>
      <MonthPicker
        value={pickerValue}
        onChange={(v) => onChange(pickerToYmString(v))}
        language="en"
        minDate={minDate}
        maxDate={maxDate}
        triggerClassName="min-w-[12rem]"
        wrapperClassName="w-fit"
        // forwards as an aria-label-friendly id prefix for the popover trigger
        // (MonthPicker doesn't accept id directly; rely on Label association)
      />
      <span id={`${idPrefix}-picker-helper`} className="sr-only">
        {label}
      </span>
    </div>
  );
}

/**
 * Par Mês inicial / Mês final: dois MonthPicker popovers, valor composto
 * `YYYY-MM` para paridade com a API (`anomes_registro_min` / `max`).
 */
export function FormYearMonthRangeField({
  idPrefix,
  valueFrom,
  valueTo,
  onValueFromChange,
  onValueToChange,
  minMonth,
  maxMonth,
  labelFrom = "Start month",
  labelTo = "End month"}: FormYearMonthRangeFieldProps) {
  const bounds = formYearMonthRangeCvmRegistroBoundsNow();
  const min = minMonth ?? bounds.minMonth;
  const max = maxMonth ?? bounds.maxMonth;

  const minPicker = ymStringToPicker(min);
  const maxPicker = ymStringToPicker(max);
  // Cross-clamp: "from" cannot exceed current "to"; "to" cannot precede current "from".
  const fromPicker = ymStringToPicker(valueFrom);
  const toPicker = ymStringToPicker(valueTo);

  return (
    <>
      <YearMonthPickerField
        idPrefix={`${idPrefix}-ym-from`}
        legendId={`${idPrefix}-ym-from-legend`}
        label={labelFrom}
        value={valueFrom}
        fallbackValue={min}
        onChange={onValueFromChange}
        minDate={minPicker}
        maxDate={toPicker ?? maxPicker}
      />
      <YearMonthPickerField
        idPrefix={`${idPrefix}-ym-to`}
        legendId={`${idPrefix}-ym-to-legend`}
        label={labelTo}
        value={valueTo}
        fallbackValue={max}
        onChange={onValueToChange}
        minDate={fromPicker ?? minPicker}
        maxDate={maxPicker}
      />
    </>
  );
}
