import type { components } from "@/lib/api/get-data";

import { dataUrl, type Params } from "./url";

type Schemas = components["schemas"];

/** A caveat from the contract's closed list: `label` goes on the badge, `text` in its tooltip. */
export type Caveat = Schemas["Caveat"];
export type CaveatCode = Caveat["code"];
/** Provenance and caveats of a product response. */
export type Meta = Schemas["Meta"];
/** One sourced scalar of a diagnosis or a card. A `null` value is a gap, never a zero. */
export type Fact = Schemas["Fact"];

/** The v2 envelope of get-data's product endpoints (accounts, geo, forecasts, backtest). */
export type Envelope<T> = { data: T; meta: Meta };

/** An error from the BFF or get-data. `mart` is set on a 503 `mart_not_built`: the view waits for that mart. */
export class BffError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly mart: string | null = null,
  ) {
    super(message);
  }
}

export function isMartNotBuilt(error: unknown): error is BffError & { mart: string } {
  return error instanceof BffError && error.mart !== null;
}

/** The error a failed BFF response stands for, from its status and JSON body. */
export function bffError(status: number, body: unknown): BffError {
  const { detail, mart } = (body ?? {}) as { detail?: unknown; mart?: unknown };
  if (status === 503 && detail === "mart_not_built" && typeof mart === "string") {
    return new BffError(`The ${mart} mart is not built yet`, status, mart);
  }
  return new BffError(typeof detail === "string" ? detail : `The data API answered ${status}`, status);
}

/** GET a get-data resource through the BFF: its JSON body as is. */
export async function fetchJson<T>(path: string, params?: Params, signal?: AbortSignal): Promise<T> {
  const response = await fetch(dataUrl(path, params), { signal });
  const body = (await response.json().catch(() => null)) as T | null;
  if (!response.ok) throw bffError(response.status, body);
  if (body === null) throw new BffError("The data API answered without a body", response.status);
  return body;
}

/** GET a product resource through the BFF: its `data` and `meta`. */
export async function fetchEnvelope<T>(path: string, params?: Params, signal?: AbortSignal): Promise<Envelope<T>> {
  const body = await fetchJson<Partial<Envelope<T>>>(path, params, signal);
  if (body.data === undefined || !body.meta) throw new BffError("The data API answered without data", 200);
  return body as Envelope<T>;
}
