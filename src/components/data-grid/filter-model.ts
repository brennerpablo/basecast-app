import type {
  GridColumnFilter,
  GridColumnFilterConfig,
  GridConditionOp,
} from "./types";

/**
 * What a column filter CAN say, in one place: which conditions a column
 * accepts (only the ones its `paramMap` reaches on the server) and what a
 * typed value means. Pure, so the column menu stays a view and the rules stay
 * testable.
 */

export type GridCondition = NonNullable<GridColumnFilter["condition"]>;

/** Below this the "contains" condition does not apply (no index serves it). */
export const CONTAINS_MIN_CHARS = 3;

/** The conditions the column serves — only the ones its `paramMap` reaches. */
export function conditionOps(
  conf: GridColumnFilterConfig | undefined,
): GridConditionOp[] {
  if (!conf?.conditions) return [];
  const pm = conf.paramMap;
  const list: GridConditionOp[] = [];
  if (pm.startsWith) list.push("startsWith");
  if (pm.contains) list.push("contains");
  if (pm.equals || (pm.range?.min && pm.range?.max)) list.push("eq");
  if (pm.range?.min) list.push("gte");
  if (pm.range?.max) list.push("lte");
  if (pm.range?.min && pm.range?.max) list.push("between");
  return list;
}

/**
 * The condition a fresh draft opens with. A date column is always From–To,
 * both sides optional — "from" and "until" are the same range with one side
 * empty, and that is how the column menu draws it.
 */
export function defaultConditionOp(
  conf: GridColumnFilterConfig | undefined,
): GridConditionOp | "" {
  const ops = conditionOps(conf);
  if (conf?.conditions === "date") return ops.length ? "between" : "";
  return ops[0] ?? "";
}

/** "Contains" with 1 or 2 characters: the menu warns and the condition does not apply. */
export function containsTooShort(op: GridConditionOp | "", value: string) {
  const n = value.trim().length;
  return op === "contains" && n > 0 && n < CONTAINS_MIN_CHARS;
}

/**
 * A grouped number typed into an `<input type="number">`.
 *
 * In a locale that groups with a dot, "150.000" is a VALID HTML floating-point
 * number — it means one hundred and fifty. So the field accepts it, `value`
 * comes back with the dot, and the server filters on `>= 150`. Someone who
 * typed the amount the way their locale writes it sees a grid that excluded
 * nothing and reads that as a broken filter; there is no error anywhere.
 * (A comma the field already refuses: `type="number"` drops it.)
 *
 * Only applied where the active locale's grouping separator IS the dot — in
 * `en-US`, "150.000" means 150 and stripping the dot would change what the
 * user asked for. And the pattern is deliberately STRICT: groups of exactly
 * three digits after the first dot ("1.500", "150.000", "1.250.000"), which is
 * the only shape where the grouped reading is unambiguous. "0.5" and "1.25"
 * don't match and stay decimals, as whoever typed them meant.
 */
const GROUPED = /^\d{1,3}(\.\d{3})+$/;

export function dotGroupsDigits(locale: string): boolean {
  return new Intl.NumberFormat(locale)
    .formatToParts(1_000_000)
    .some((part) => part.type === "group" && part.value === ".");
}

export function stripGrouping(v: string, dotGroups: boolean): string {
  return dotGroups && GROUPED.test(v) ? v.replaceAll(".", "") : v;
}

/** The condition as the menu's fields hold it, before it applies. */
export type ConditionDraft = {
  op: GridConditionOp | "";
  value: string;
  value2: string;
};

/**
 * The condition a draft produces, or `null` when it filters nothing: no
 * condition, an empty value, or a "contains" that is too short. "Between"
 * applies with one side only (From without To, To without From). Only a
 * numeric column loses a grouping dot — in a text field the dot belongs to the
 * text.
 */
export function conditionFromDraft(
  conf: GridColumnFilterConfig | undefined,
  draft: ConditionDraft,
  opts: { dotGroups?: boolean } = {},
): GridCondition | null {
  const { op } = draft;
  if (!op) return null;
  const numeric = conf?.conditions === "number";
  const clean = (x: string) =>
    numeric ? stripGrouping(x.trim(), !!opts.dotGroups) : x.trim();
  const value = clean(draft.value);
  const value2 = clean(draft.value2);
  if (containsTooShort(op, value)) return null;
  const between = op === "between";
  if (!value && !(between && value2)) return null;
  return { op, value, ...(between && value2 ? { value2 } : {}) };
}
