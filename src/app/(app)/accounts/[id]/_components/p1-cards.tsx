"use client";

import { AppBadge } from "@/components/components-app/ui/badge";
import { VerifiedBadge } from "@/components/product/caveat-badges";
import { FactGrid } from "@/components/product/fact-grid";
import { FactValue } from "@/components/product/fact-value";
import { formatDate, formatPercent, formatPower, formatWhole } from "@/components/product/format";
import { SectionCard } from "@/components/product/section-card";
import type { components } from "@/lib/api/get-data";
import type { Caveat, Meta } from "@/lib/bff/envelope";

type Supplier = components["schemas"]["SupplierCard"];
type FourCp = components["schemas"]["FourCpOffer"];
type City = components["schemas"]["CityFacts"];

function Label({ children }: { children: React.ReactNode }) {
  return <p className="text-[11px] font-medium tracking-wide text-muted-foreground uppercase">{children}</p>;
}

/** The wholesale supplier's large-load requests by year, as bars on the largest year's scale. */
function RequestPath({ path }: { path: Supplier["path"] }) {
  const max = Math.max(...path.map((p) => p.mw), 1);
  return (
    <ul className="space-y-1.5">
      {path.map((point) => (
        <li key={point.year} className="flex items-center gap-2 text-xs">
          <span className="w-9 shrink-0 text-muted-foreground tabular-nums">{point.year}</span>
          <span className="h-2 flex-1 overflow-hidden rounded-full bg-muted" aria-hidden>
            <span className="block h-full rounded-full bg-basecast-brand" style={{ width: `${(point.mw / max) * 100}%` }} />
          </span>
          <span className="w-16 shrink-0 text-right font-medium tabular-nums">{formatPower(point.mw)}</span>
        </li>
      ))}
    </ul>
  );
}

/** X13: the large loads the account's wholesale supplier asked for (requests, not forecasts). */
export function SupplierCards({ suppliers, meta, caveats }: { suppliers: Supplier[]; meta: Meta; caveats?: Caveat[] }) {
  return (
    <>
      {suppliers.map((s) => (
        <SectionCard
          key={`${s.gt}-${s.tsp ?? ""}`}
          title="Wholesale supplier"
          subtitle={`${s.gt}${s.via === "self" ? " (the account files itself)" : ""}`}
          action={<VerifiedBadge verified={s.verified} />}
          caveats={caveats}
          meta={meta}
        >
          <div className="space-y-4">
            <p className="text-sm">{s.fact}</p>
            <div>
              <Label>Requested large load, by year</Label>
              <div className="mt-2">
                <RequestPath path={s.path} />
              </div>
            </div>
            <p className="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
              {s.share_of_rfi != null && <AppBadge state="meta">{formatPercent(s.share_of_rfi, { ratio: true })} of the ERCOT RFI</AppBadge>}
              {s.n_accounts != null && <AppBadge state="meta">{formatWhole(s.n_accounts)} accounts share this supplier</AppBadge>}
              {s.fires_trigger && <AppBadge state="info">Counts as a context trigger</AppBadge>}
              <span>
                Filed {formatDate(s.filed_date)}
                {s.source_ref && <span className="font-mono"> · {s.source_ref}</span>}
              </span>
            </p>
          </div>
        </SectionCard>
      ))}
    </>
  );
}

const usdPerMwYr = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });

/** X3 + X15: what a 4CP discharge is worth to the co-op, at the transmission rates, and the account's own gap. */
export function FourCpCard({ offer, meta, caveats }: { offer: FourCp; meta: Meta; caveats?: Caveat[] }) {
  return (
    <SectionCard
      title="4CP offer"
      subtitle={`${offer.zone} · window ${offer.window_start_local}–${offer.window_end_local}${offer.dispatch_days != null ? ` · about ${formatWhole(offer.dispatch_days)} dispatch days a summer` : ""}`}
      action={<VerifiedBadge verified={offer.verified} />}
      caveats={caveats}
      meta={meta}
    >
      <div className="space-y-4">
        <table className="w-full text-xs">
          <thead className="text-left text-muted-foreground">
            <tr className="border-b border-border">
              <th className="py-1.5 pr-2 font-medium">Rate for</th>
              <th className="py-1.5 pr-2 text-right font-medium">Per MW-year</th>
              <th className="py-1.5 pr-2 font-medium">Status</th>
              <th className="py-1.5 font-medium">Docket</th>
            </tr>
          </thead>
          <tbody>
            {offer.rates.map((rate) => (
              <tr key={`${rate.charges_for_year}-${rate.docket}`} className="border-b border-border last:border-0">
                <td className="py-1.5 pr-2 tabular-nums">
                  {rate.charges_for_year}
                  <span className="text-muted-foreground"> · billed {rate.billed_year}</span>
                </td>
                <td className="py-1.5 pr-2 text-right font-medium tabular-nums">{usdPerMwYr.format(rate.usd_per_mw_yr)}</td>
                <td className="py-1.5 pr-2">
                  <AppBadge state={rate.status === "final" ? "active" : "alert"}>{rate.status}</AppBadge>
                </td>
                <td className="py-1.5 font-mono">{rate.docket}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="text-sm">{offer.note}</p>
        <div>
          <Label>{offer.account_4cp.label}</Label>
          <FactValue fact={offer.account_4cp} className="mt-0.5" valueClassName="text-sm font-medium" />
          <p className="mt-1 text-xs text-muted-foreground">
            Private data ({offer.account_4cp.source}){offer.account_4cp.note ? `: ${offer.account_4cp.note}` : ""}
          </p>
        </div>
        {offer.zone_line && <p className="text-xs text-foreground/80">{offer.zone_line}</p>}
      </div>
    </SectionCard>
  );
}

const FIT_LABEL: Record<string, string> = {
  same: "City ≈ territory",
  city_larger: "City larger than the territory",
  territory_larger: "Territory larger than the city",
};

/** X10: Census facts of the muni's city, labelled as the city and not the territory, with how well they fit. */
export function CityCard({ city, meta }: { city: City; meta: Meta }) {
  return (
    <SectionCard
      title={`City of ${city.place_name}`}
      subtitle={
        <span className="flex flex-wrap items-center gap-1.5">
          <AppBadge state={city.fit === "same" ? "active" : "alert"}>{FIT_LABEL[city.fit] ?? city.fit}</AppBadge>
          {city.place_in_territory != null && <span>{formatPercent(city.place_in_territory, { ratio: true })} of the city is in the territory</span>}
          {city.territory_in_place != null && (
            <span>· {formatPercent(city.territory_in_place, { ratio: true })} of the territory is in the city</span>
          )}
        </span>
      }
      meta={meta}
    >
      <FactGrid facts={city.facts} />
    </SectionCard>
  );
}
