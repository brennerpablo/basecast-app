import assert from "node:assert/strict";
import { test } from "node:test";

import {
  folderPrefix,
  isFileKey,
  keyFromSegments,
  lakeCrumbs,
  lakeHref,
  parseKey,
} from "./lake-path";

const GIS =
  "raw/source=ercot_gis/dt=2026-08-01/RPT.00015933.0000000000000000.20260901.143805843.GIS_Report_August2026.xlsx";

test("lakeHref mirrors the bucket path and keeps = readable", () => {
  assert.equal(lakeHref("raw/source=ercot_gis/"), "/data/lake/raw/source=ercot_gis");
  assert.equal(lakeHref(""), "/data/lake");
  assert.equal(
    lakeHref("raw/source=puct_filings/dt=2026-09-26/a b#c.pdf", { page: 3, member: undefined }),
    "/data/lake/raw/source=puct_filings/dt=2026-09-26/a%20b%23c.pdf?page=3",
  );
});

test("keyFromSegments undoes lakeHref", () => {
  const href = lakeHref("raw/source=x/dt=2026-01-01/a b#c.pdf");
  const segments = href.replace("/data/lake/", "").split("/");
  assert.equal(keyFromSegments(segments), "raw/source=x/dt=2026-01-01/a b#c.pdf");
  assert.equal(keyFromSegments(undefined), "");
});

test("files versus folders", () => {
  assert.equal(isFileKey(GIS), true);
  assert.equal(isFileKey("raw/source=ercot_gis"), false);
  assert.equal(isFileKey("raw/source=ercot_gis/dt=2026-08-01"), false);
  assert.equal(isFileKey("parquet/noaa_ghcnh_hourly"), false);
  assert.equal(folderPrefix("raw/source=ercot_gis"), "raw/source=ercot_gis/");
  assert.equal(folderPrefix(""), "");
});

test("crumbs and key parts", () => {
  assert.deepEqual(
    lakeCrumbs("raw/source=ercot_gis").map((c) => c.key),
    ["", "raw", "raw/source=ercot_gis"],
  );
  assert.deepEqual(parseKey(GIS), {
    layer: "raw",
    sourceId: "ercot_gis",
    dt: "2026-08-01",
    file: GIS.split("/").at(-1),
  });
});
