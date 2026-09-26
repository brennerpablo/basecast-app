"use client";

import type { components } from "@/lib/api/get-data";
import { type GlossaryItem, useGlossary } from "@/lib/bff/queries";

export type AccountSummary = components["schemas"]["AccountSummary"];
export type AccountsData = components["schemas"]["AccountsData"];
export type NextAction = AccountSummary["next_action"];
export type AccountFlag = AccountSummary["flags"][number];
export type AccountDetail = components["schemas"]["AccountDetail"];
export type AccountEvent = components["schemas"]["Event"];
export type EventsPage = components["schemas"]["EventsPage"];

/** The kinds of code whose label and definition come from get-data's glossary. */
export type CodeKind = GlossaryItem["kind"];

/**
 * Labels of trigger, flag and next-action codes. Their labels and definitions belong to the models (the
 * thresholds and strengths live in the airflow config), so the app writes none: they come from
 * `GET /glossary`, and a code the glossary lacks (or before it answers) shows as is.
 */
export function useCodeLabels() {
  const glossary = useGlossary();
  const entry = (kind: CodeKind, code: string): GlossaryItem | undefined => glossary.data?.get(`${kind}:${code}`);
  return {
    entry,
    label: (kind: CodeKind, code: string): string => entry(kind, code)?.label ?? code,
  };
}

export const ACCOUNT_TYPE_LABEL: Record<AccountSummary["account_type"], string> = { coop: "Co-op", muni: "Muni" };
