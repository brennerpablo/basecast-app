import { dataUrl, type Params } from "./url";

/*
 * The v2 envelope of get-data's product endpoints (accounts, geo, forecasts, backtest, insights): `data`
 * plus a `meta` with the provenance and the caveats. These types mirror the contract v2 draft
 * (basecast-get-data `schemas/common.py`) until its openapi.json lands; then they come from
 * `src/lib/api/get-data.d.ts`.
 */

/** A caveat from the contract's closed list: `label` goes on the badge, `text` in its tooltip. */
export type Caveat = { code: string; label: string; text: string };

export type Meta = {
  generated_at: string;
  data_as_of?: string | null;
  /** Short commit sha plus the mart's version. */
  model_version?: string | null;
  /** True when any value comes from a fixture or a simulated private-data adapter. */
  simulated: boolean;
  /** False when any value was machine-read and not checked by a person. */
  verified: boolean;
  sources: string[];
  caveats: Caveat[];
};

export type Envelope<T> = { data: T; meta: Meta };

/** One sourced scalar of a diagnosis or a card. A `null` value is a gap, never a zero. */
export type Fact = {
  key: string;
  label: string;
  value: number | string | boolean | null;
  unit?: string | null;
  source?: string | null;
  as_of?: string | null;
  note?: string | null;
  simulated: boolean;
  verified: boolean;
};

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

/** GET a product resource through the BFF: its `data` and `meta`. */
export async function fetchEnvelope<T>(path: string, params?: Params, signal?: AbortSignal): Promise<Envelope<T>> {
  const response = await fetch(dataUrl(path, params), { signal });
  const body = (await response.json().catch(() => null)) as Partial<Envelope<T>> | null;
  if (!response.ok) throw bffError(response.status, body);
  if (!body || body.data === undefined || !body.meta) {
    throw new BffError("The data API answered without data", response.status);
  }
  return body as Envelope<T>;
}
