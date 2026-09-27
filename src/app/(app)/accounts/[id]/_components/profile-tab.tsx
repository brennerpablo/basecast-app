"use client";

import { IdCard, Landmark } from "lucide-react";

import { AppBadge } from "@/components/components-app/ui/badge";
import { FactGrid } from "@/components/product/fact-grid";
import { formatPercent } from "@/components/product/format";
import { SectionCard } from "@/components/product/section-card";
import type { components } from "@/lib/api/get-data";
import type { Fact } from "@/lib/bff/envelope";

type City = components["schemas"]["CityFacts"];

const FIT_LABEL: Record<string, string> = {
  same: "City ≈ territory",
  city_larger: "City > territory",
  territory_larger: "Territory > city",
};

/** Census facts of the muni's city, labelled as the city and not the territory, with how well they fit. */
function CityCard({ city }: { city: City }) {
  return (
    <SectionCard
      title={`City facts · ${city.place_name}`}
      icon={Landmark}
      subtitle={
        <span className="flex flex-wrap items-center gap-1.5">
          <AppBadge state={city.fit === "same" ? "active" : "alert"}>{FIT_LABEL[city.fit] ?? city.fit}</AppBadge>
          {city.place_in_territory != null && <span>{formatPercent(city.place_in_territory, { ratio: true })} of the city is in the territory</span>}
          {city.territory_in_place != null && (
            <span>· {formatPercent(city.territory_in_place, { ratio: true })} of the territory is in the city</span>
          )}
        </span>
      }
    >
      <FactGrid facts={city.facts} />
    </SectionCard>
  );
}

/** Profile: the header facts outside the KPI strip (registry ids, G&T, counties, market roles), and the city of a muni. */
export function ProfileTab({ facts, city }: { facts: Fact[]; city?: City | null }) {
  return (
    <div className="space-y-4">
      {facts.length > 0 && (
        <SectionCard title="Registry" icon={IdCard}>
          <FactGrid facts={facts} />
        </SectionCard>
      )}
      {city && <CityCard city={city} />}
    </div>
  );
}
