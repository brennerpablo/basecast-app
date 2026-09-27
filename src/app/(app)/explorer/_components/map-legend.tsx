"use client";

import { channelColor, HATCH, type Mode, OUTSIDE } from "@/lib/explorer/colors";
import { CHANNEL_LABEL, type LegendItem } from "@/lib/explorer/layers";

const CHANNELS = ["retail_direct", "partnership", "mixed"] as const;

function Swatch({ color, hatched, mode }: { color: string; hatched?: boolean; mode: Mode }) {
  return (
    <span
      className="inline-block size-3.5 shrink-0 rounded-[3px] border border-border"
      style={{
        background: hatched
          ? `repeating-linear-gradient(135deg, ${HATCH[mode]} 0 1px, ${color} 1px 4px)`
          : color,
      }}
    />
  );
}

/** Outside ERCOT, hatched: every layer shows it. */
export function OutsideErcot({ mode }: { mode: Mode }) {
  return (
    <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
      <Swatch color={OUTSIDE[mode]} hatched mode={mode} /> Outside ERCOT
    </span>
  );
}

/**
 * The acquisition legend: one row per channel (the hue), the five priority classes across (the lightness),
 * with the class breaks the API sends.
 */
export function AcquisitionLegend({ breaks, mode }: { breaks: number[]; mode: Mode }) {
  const edges = [null, ...breaks, null];
  const range = (i: number) => {
    const low = edges[i];
    const high = edges[i + 1];
    if (low === null) return `< ${high?.toFixed(2)}`;
    if (high === null) return `≥ ${low.toFixed(2)}`;
    return `${low.toFixed(2)}–${high.toFixed(2)}`;
  };
  return (
    <div className="flex flex-wrap items-end gap-x-8 gap-y-3">
      <table className="text-xs">
        <thead>
          <tr className="text-muted-foreground">
            <th className="pr-3 text-left font-medium">Priority</th>
            {[1, 2, 3, 4, 5].map((c) => (
              <th key={c} className="px-1 text-center font-normal tabular-nums">
                {range(c - 1)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {CHANNELS.map((channel) => (
            <tr key={channel}>
              <td className="py-0.5 pr-3 whitespace-nowrap">{CHANNEL_LABEL[channel]}</td>
              {[1, 2, 3, 4, 5].map((c) => (
                <td key={c} className="px-1 py-0.5 text-center">
                  <span
                    className="inline-block h-3.5 w-10 rounded-[3px] border border-border"
                    style={{ background: channelColor(channel, c, mode) }}
                    title={`${CHANNEL_LABEL[channel]}, class ${c} (${range(c - 1)})`}
                  />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      <OutsideErcot mode={mode} />
    </div>
  );
}

/** A legend of swatches in a row. */
export function SwatchLegend({ items, mode }: { items: LegendItem[]; mode: Mode }) {
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
      {items.map((item) => (
        <span key={item.label} className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <Swatch color={item.color} mode={mode} />
          {item.label}
        </span>
      ))}
      <OutsideErcot mode={mode} />
    </div>
  );
}
