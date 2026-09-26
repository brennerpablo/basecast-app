import type { DateRange } from "react-day-picker";

/** Valor de intervalo em strings civis `yyyy-MM-dd` (uso em URL e API). */
export type DateRangeValue = { from: string; to: string };

/** Faixa rápida; `getRange` pode devolver `null` para limpar (ex.: todo o período). */
export type DateRangePreset = {
  id: string;
  label: string;
  getRange: () => DateRange | null;
};
