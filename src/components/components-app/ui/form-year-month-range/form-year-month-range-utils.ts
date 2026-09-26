/** YYYYMM mínimo usado nos filtros de registro CVM (listagens Mercado). */
export const FORM_YEARMONTH_RANGE_CVM_REGISTRO_MIN_API = "200001";

/** YYYYMM do mês civil atual. */
export function yearMonthApiNow(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  return `${y}${m}`;
}

/** YYYYMM → valor de `<input type="month">` (YYYY-MM). */
export function ymToMonthInput(ym: string): string {
  const d = ym.replace(/\D/g, "").slice(0, 6);
  if (d.length < 6) return "";
  return `${d.slice(0, 4)}-${d.slice(4, 6)}`;
}

export function monthInputToYm(v: string): string {
  return v.replace(/\D/g, "").slice(0, 6);
}

/** Limites padrão dos inputs (YYYY-MM): 2000-01 … mês atual. */
export function formYearMonthRangeCvmRegistroBoundsNow(): {
  minMonth: string;
  maxMonth: string;
} {
  return {
    minMonth: ymToMonthInput(FORM_YEARMONTH_RANGE_CVM_REGISTRO_MIN_API),
    maxMonth: ymToMonthInput(yearMonthApiNow()),
  };
}

/** Valores iniciais de filtro (YYYY-MM) para API `anomes_registro_min` / `max`. */
export function getDefaultMercadoRegistroYearMonthFilterInputs(): {
  from: string;
  to: string;
} {
  const b = formYearMonthRangeCvmRegistroBoundsNow();
  return { from: b.minMonth, to: b.maxMonth };
}

/** Months 01–12 with English labels (filter selects). */
export const FORM_YEARMONTH_MONTHS: readonly { value: string; label: string }[] = [
  { value: "01", label: "January" },
  { value: "02", label: "February" },
  { value: "03", label: "March" },
  { value: "04", label: "April" },
  { value: "05", label: "May" },
  { value: "06", label: "June" },
  { value: "07", label: "July" },
  { value: "08", label: "August" },
  { value: "09", label: "September" },
  { value: "10", label: "October" },
  { value: "11", label: "November" },
  { value: "12", label: "December" },
] as const;

/** Interpreta `YYYY-MM`; retorna `null` se inválido. */
export function parseYearMonthDash(v: string): { year: number; month: string } | null {
  const m = v.trim().match(/^(\d{4})-(\d{2})$/);
  if (!m) return null;
  const year = Number(m[1]);
  const month = m[2];
  if (!Number.isFinite(year) || month < "01" || month > "12") return null;
  return { year, month };
}

/** Anos inteiros entre os anos de `minMonth` e `maxMonth` (`YYYY-MM`), inclusive. */
export function formYearMonthRangeYearOptions(minMonth: string, maxMonth: string): number[] {
  const y0 = Number.parseInt(minMonth.slice(0, 4), 10);
  const y1 = Number.parseInt(maxMonth.slice(0, 4), 10);
  if (!Number.isFinite(y0) || !Number.isFinite(y1)) {
    const y = new Date().getFullYear();
    return [y];
  }
  const lo = Math.min(y0, y1);
  const hi = Math.max(y0, y1);
  return Array.from({ length: hi - lo + 1 }, (_, i) => lo + i);
}
