import type { components } from "@/lib/api/get-data";

export type AccountSummary = components["schemas"]["AccountSummary"];
export type AccountsData = components["schemas"]["AccountsData"];
export type NextAction = AccountSummary["next_action"];
export type AccountFlag = AccountSummary["flags"][number];

/** The kinds of code whose label and definition come from get-data's glossary (requested; not in the contract yet). */
export type CodeKind = "trigger" | "flag" | "next_action";

/**
 * The label of a trigger, flag or next-action code. Their labels and definitions belong to the models
 * (thresholds and strengths live in the airflow config), so the app writes none: until get-data serves
 * the glossary, the code shows as is.
 */
export function codeLabel(_kind: CodeKind, code: string): string {
  return code;
}

export const ACCOUNT_TYPE_LABEL: Record<AccountSummary["account_type"], string> = { coop: "Co-op", muni: "Muni" };
