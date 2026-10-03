"use client";

import "leaflet/dist/leaflet.css";

import { useEffect, useRef } from "react";

import type { LngLat } from "./geo";
import { addBaseLayer, BIHAR_VIEW, BOUNDARY_STYLE, FIELD_ZOOM, loadLeaflet, pinIcon } from "./leaflet";

export type MapPlot = {
  id: string;
  name: string;
  latitude: number | null;
  longitude: number | null;
  boundary: LngLat[] | null;
};

/** Read-only map of one or more plots: boundaries where drawn, otherwise a pin. */
export function PlotsMap({ plots, label }: { plots: MapPlot[]; label: string }) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;
    let cleanup: (() => void) | undefined;

    loadLeaflet().then((L) => {
      if (cancelled || !containerRef.current) return;
      const map = L.map(containerRef.current, { scrollWheelZoom: false });
      addBaseLayer(L, map);

      const bounds = L.latLngBounds([]);
      for (const plot of plots) {
        if (plot.boundary) {
          const latLngs = plot.boundary.map(([lng, lat]) => L.latLng(lat, lng));
          L.polygon(latLngs, BOUNDARY_STYLE).bindTooltip(plot.name).addTo(map);
          latLngs.forEach((p) => bounds.extend(p));
        } else if (plot.latitude !== null && plot.longitude !== null) {
          const p = L.latLng(plot.latitude, plot.longitude);
          L.marker(p, { icon: pinIcon(L), keyboard: false }).bindTooltip(plot.name).addTo(map);
          bounds.extend(p);
        }
      }

      if (bounds.isValid()) {
        map.fitBounds(bounds, { padding: [32, 32], maxZoom: FIELD_ZOOM });
      } else {
        map.setView([BIHAR_VIEW.lat, BIHAR_VIEW.lng], BIHAR_VIEW.zoom);
      }
      cleanup = () => map.remove();
    });

    return () => {
      cancelled = true;
      cleanup?.();
    };
  }, [plots]);

  return (
    <div
      ref={containerRef}
      role="img"
      aria-label={label}
      data-testid="plots-map"
      className="h-72 w-full overflow-hidden rounded-2xl border-2 border-stone-200 bg-stone-100"
    />
  );
}
