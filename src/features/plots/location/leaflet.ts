import type * as Leaflet from "leaflet";

import { publicEnv } from "@/lib/env";

// Leaflet reads `window` when imported, so it is only loaded in the browser, inside effects.

export type L = typeof Leaflet;

export function loadLeaflet(): Promise<L> {
  return import("leaflet").then((m) => (m.default ?? m) as L);
}

/** Initial view when nothing is known yet: Bihar. */
export const BIHAR_VIEW = { lat: 25.9, lng: 85.8, zoom: 7 };

export const FIELD_ZOOM = 17;

export function addBaseLayer(L: L, map: Leaflet.Map) {
  L.tileLayer(publicEnv.mapTileUrl, {
    attribution: publicEnv.mapTileAttribution,
    maxZoom: 19,
  }).addTo(map);
}

/** A plain CSS pin: Leaflet's default marker images do not survive bundling. */
export function pinIcon(L: L) {
  return L.divIcon({
    className: "kisan-pin",
    html: '<span class="kisan-pin__dot"></span>',
    iconSize: [28, 28],
    iconAnchor: [14, 14],
  });
}

export const BOUNDARY_STYLE = { color: "#15803d", weight: 3, fillColor: "#22c55e", fillOpacity: 0.25 };
