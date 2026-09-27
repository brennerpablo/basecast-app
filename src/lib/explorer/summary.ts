import {
  type ChannelList,
  type CountyRow,
  dataCenterCount,
  inList,
  type Layer,
  type QueueMetric,
  queueValue,
} from "./layers";

/**
 * The statewide numbers above the map, as sums and counts of the API's county rows (the queue's add up to the
 * statewide totals the insights quote). Display only: nothing here ranks a county.
 */
export function acquisitionSummary(rows: CountyRow[]) {
  const scored = rows.filter((r) => r.in_ercot && r.acquisition);
  return {
    scored: scored.length,
    retail: scored.filter((r) => inList(r, "retail")).length,
    partnership: scored.filter((r) => inList(r, "partnership")).length,
    topClass: scored.filter((r) => r.acquisition?.priority_class === 5).length,
  };
}

/** Every county's queue, those flagged outside ERCOT too: their projects are in ERCOT's queue, and the sum is its total. */
export function queueSummary(rows: CountyRow[]) {
  let rawMw = 0;
  let adjMw = 0;
  let projects = 0;
  for (const row of rows) {
    if (!row.queue) continue;
    rawMw += row.queue.raw_mw;
    adjMw += row.queue.adj_mw;
    projects += row.queue.projects;
  }
  return { rawMw, adjMw, projects, ratio: rawMw > 0 ? adjMw / rawMw : null };
}

export function dataCenterSummary(rows: CountyRow[], naics: boolean) {
  let sites = 0;
  let counties = 0;
  let naicsOnly = 0;
  let outside = 0;
  for (const row of rows) {
    outside += row.data_centers.sites_outside_ercot;
    if (!row.in_ercot) continue;
    const n = dataCenterCount(row, naics);
    sites += n;
    if (n > 0) counties += 1;
    naicsOnly += row.data_centers.sites_naics_only;
  }
  return { sites, counties, naicsOnly, outside };
}

/**
 * The counties the table below the map lists, in the layer's order: acquisition by rank (the list's own
 * rank on a channel list), the queue by the chosen metric from the top, data centers by their count. Counties
 * with no value for the layer are left out; the zone layer has its own table.
 */
export function rankedCounties(
  rows: CountyRow[],
  options: { layer: Layer; list: ChannelList; metric: QueueMetric; naics: boolean },
): CountyRow[] {
  const { layer, list, metric, naics } = options;
  if (layer === "acquisition") {
    const rank = (r: CountyRow) =>
      (list === "retail" ? r.acquisition?.retail_rank : list === "partnership" ? r.acquisition?.partner_rank : r.acquisition?.rank) ??
      Number.POSITIVE_INFINITY;
    return rows.filter((r) => r.in_ercot && r.acquisition && inList(r, list)).sort((a, b) => rank(a) - rank(b));
  }
  if (layer === "queue") {
    return rows
      .filter((r) => queueValue(r, metric) !== null)
      .sort((a, b) => (queueValue(b, metric) ?? 0) - (queueValue(a, metric) ?? 0));
  }
  if (layer === "data-centers") {
    return rows.filter((r) => r.in_ercot && dataCenterCount(r, naics) > 0).sort((a, b) => dataCenterCount(b, naics) - dataCenterCount(a, naics));
  }
  return [];
}
