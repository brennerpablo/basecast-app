"use client";

import "maplibre-gl/dist/maplibre-gl.css";

import type { FeatureCollection, Geometry, Position } from "geojson";
import type { Map as MapLibreMap, StyleImageInterface } from "maplibre-gl";
import { useEffect, useRef, useState } from "react";

import { BORDER, HATCH, HIGHLIGHT, type Mode, NO_DATA, ZONE_LINE } from "@/lib/explorer/colors";
import type { CountyStyle } from "@/lib/explorer/layers";
import { cn } from "@/lib/utils";

export type CountyHover = { fips: string; x: number; y: number };

type Bounds = [[number, number], [number, number]];

/** The bounding box of a feature collection, to frame Texas without a hard-coded extent. */
function bboxOf(collection: FeatureCollection): Bounds {
  let [minX, minY, maxX, maxY] = [Infinity, Infinity, -Infinity, -Infinity];
  const walk = (coords: unknown): void => {
    if (typeof (coords as Position)[0] === "number") {
      const [x, y] = coords as Position;
      minX = Math.min(minX, x);
      maxX = Math.max(maxX, x);
      minY = Math.min(minY, y);
      maxY = Math.max(maxY, y);
    } else (coords as unknown[]).forEach(walk);
  };
  for (const feature of collection.features) {
    const geometry = feature.geometry as Geometry;
    if ("coordinates" in geometry) walk(geometry.coordinates);
  }
  return [
    [minX, minY],
    [maxX, maxY],
  ];
}

/** A 45° line texture for the counties outside ERCOT (drawn at twice the pixel density). */
function hatch(mode: Mode): StyleImageInterface & { width: number; height: number; data: Uint8Array } {
  const size = 16;
  const data = new Uint8Array(size * size * 4);
  const n = Number.parseInt(HATCH[mode].slice(1), 16);
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      if ((x + y) % 8 > 1) continue;
      const i = (y * size + x) * 4;
      data.set([(n >> 16) & 255, (n >> 8) & 255, n & 255, 255], i);
    }
  }
  return { width: size, height: size, data };
}

async function geojson(url: string): Promise<FeatureCollection> {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Could not load ${url} (${response.status})`);
  return (await response.json()) as FeatureCollection;
}

/**
 * The Texas counties in MapLibre, polygons only (no basemap, no token): each county's fill and fade come
 * through `feature-state`, keyed by `county_fips`, so switching layers repaints without reloading the
 * geometry. The weather zones are outlined, counties outside ERCOT hatched.
 */
export function CountyMap({
  styles,
  mode,
  selected,
  onHover,
  onSelect,
  className,
}: {
  styles: Map<string, CountyStyle>;
  mode: Mode;
  selected: string | null;
  onHover: (hover: CountyHover | null) => void;
  onSelect: (fips: string) => void;
  className?: string;
}) {
  const container = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const callbacks = useRef({ onHover, onSelect });
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState<string | null>(null);

  useEffect(() => {
    callbacks.current = { onHover, onSelect };
  }, [onHover, onSelect]);

  // The map and its sources, once. Colors come later through feature-state.
  useEffect(() => {
    let cancelled = false;
    let observer: ResizeObserver | undefined;
    const initialMode = mode;
    (async () => {
      const maplibre = await import("maplibre-gl");
      maplibre.setWorkerUrl("/maplibre/maplibre-gl-worker.mjs");
      const [counties, zones] = await Promise.all([
        geojson("/geo/tx-counties.geojson"),
        geojson("/geo/ercot-weather-zones.geojson"),
      ]);
      if (cancelled || !container.current) return;
      const map = new maplibre.Map({
        container: container.current,
        style: { version: 8, sources: {}, layers: [] },
        bounds: bboxOf(counties),
        fitBoundsOptions: { padding: 12 },
        dragRotate: false,
        pitchWithRotate: false,
        touchPitch: false,
        attributionControl: false,
        renderWorldCopies: false,
      });
      mapRef.current = map;
      map.touchZoomRotate.disableRotation();
      observer = new ResizeObserver(() => map.resize());
      observer.observe(container.current);

      map.on("load", () => {
        map.addImage("hatch", hatch(initialMode), { pixelRatio: 2 });
        map.addSource("counties", { type: "geojson", data: counties, promoteId: "county_fips" });
        map.addSource("zones", { type: "geojson", data: zones });
        map.addLayer({
          id: "county-fill",
          type: "fill",
          source: "counties",
          paint: {
            "fill-color": ["coalesce", ["feature-state", "color"], NO_DATA[initialMode]],
            "fill-opacity": ["case", ["boolean", ["feature-state", "dim"], false], 0.22, 1],
          },
        });
        map.addLayer({
          id: "county-hatch",
          type: "fill",
          source: "counties",
          filter: ["==", ["get", "in_ercot"], false],
          paint: { "fill-pattern": "hatch" },
        });
        map.addLayer({
          id: "county-line",
          type: "line",
          source: "counties",
          paint: { "line-color": BORDER[initialMode], "line-width": 0.6 },
        });
        map.addLayer({
          id: "zone-line",
          type: "line",
          source: "zones",
          paint: { "line-color": ZONE_LINE[initialMode], "line-width": 1.4 },
        });
        map.addLayer({
          id: "county-named",
          type: "line",
          source: "counties",
          paint: {
            "line-color": ZONE_LINE[initialMode],
            "line-width": ["case", ["boolean", ["feature-state", "named"], false], 2.2, 0],
            "line-dasharray": [2, 1],
          },
        });
        map.addLayer({
          id: "county-highlight",
          type: "line",
          source: "counties",
          paint: {
            "line-color": HIGHLIGHT[initialMode],
            "line-width": [
              "case",
              ["boolean", ["feature-state", "selected"], false],
              2.5,
              ["boolean", ["feature-state", "hover"], false],
              1.5,
              0,
            ],
          },
        });
        setReady(true);
      });

      let hovered: string | null = null;
      const setHover = (fips: string | null) => {
        if (hovered === fips) return;
        if (hovered) map.setFeatureState({ source: "counties", id: hovered }, { hover: false });
        if (fips) map.setFeatureState({ source: "counties", id: fips }, { hover: true });
        hovered = fips;
      };
      map.on("mousemove", "county-fill", (event) => {
        const fips = event.features?.[0]?.properties?.county_fips as string | undefined;
        if (!fips) return;
        setHover(fips);
        map.getCanvas().style.cursor = "pointer";
        callbacks.current.onHover({ fips, x: event.point.x, y: event.point.y });
      });
      map.on("mouseleave", "county-fill", () => {
        setHover(null);
        map.getCanvas().style.cursor = "";
        callbacks.current.onHover(null);
      });
      map.on("click", "county-fill", (event) => {
        const fips = event.features?.[0]?.properties?.county_fips as string | undefined;
        if (fips) callbacks.current.onSelect(fips);
      });
    })().catch((error: unknown) => {
      if (!cancelled) setFailed(error instanceof Error ? error.message : String(error));
    });
    return () => {
      cancelled = true;
      observer?.disconnect();
      mapRef.current?.remove();
      mapRef.current = null;
    };
    // The map is built once; mode and styles have their own effects below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Theme: the chrome colors and the hatch.
  useEffect(() => {
    const map = mapRef.current;
    if (!ready || !map) return;
    map.updateImage("hatch", hatch(mode));
    map.setPaintProperty("county-line", "line-color", BORDER[mode]);
    map.setPaintProperty("zone-line", "line-color", ZONE_LINE[mode]);
    map.setPaintProperty("county-named", "line-color", ZONE_LINE[mode]);
    map.setPaintProperty("county-highlight", "line-color", HIGHLIGHT[mode]);
    map.setPaintProperty("county-fill", "fill-color", ["coalesce", ["feature-state", "color"], NO_DATA[mode]]);
  }, [ready, mode]);

  // The layer's fill of every county.
  useEffect(() => {
    const map = mapRef.current;
    if (!ready || !map) return;
    for (const [fips, style] of styles) {
      map.setFeatureState({ source: "counties", id: fips }, { color: style.color, dim: style.dim, named: style.named ?? false });
    }
  }, [ready, styles]);

  // The selected county's outline.
  useEffect(() => {
    const map = mapRef.current;
    if (!ready || !map || !selected) return;
    map.setFeatureState({ source: "counties", id: selected }, { selected: true });
    return () => {
      if (mapRef.current) mapRef.current.setFeatureState({ source: "counties", id: selected }, { selected: false });
    };
  }, [ready, selected]);

  return (
    <div className={cn("relative", className)}>
      {/* Sized by its parent: MapLibre's stylesheet makes the container `position: relative`. */}
      <div ref={container} className="h-full w-full" aria-label="Map of the Texas counties" role="application" />
      {failed && (
        <p className="absolute inset-x-0 top-1/2 text-center text-sm text-muted-foreground">The map could not load: {failed}.</p>
      )}
    </div>
  );
}
