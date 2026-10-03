"use client";

import "leaflet/dist/leaflet.css";

import type * as Leaflet from "leaflet";
import { useEffect, useRef, useState } from "react";

import { format, type Messages } from "@/lib/i18n";

import { checkBoundary, ringAreaSqM, type LngLat, type PlotPoint } from "./geo";
import { addBaseLayer, BOUNDARY_STYLE, FIELD_ZOOM, loadLeaflet, pinIcon, type L } from "./leaflet";

type Point = PlotPoint;

type Status =
  | { kind: "idle" }
  | { kind: "locating" }
  | { kind: "found"; accuracyM: number }
  | { kind: "pinned" }
  | { kind: "denied" }
  | { kind: "unavailable" };

type Props = {
  t: Messages;
  initialView: { lat: number; lng: number; zoom: number };
  /** Saved location when editing a plot. The map starts zoomed to it. */
  initialPoint?: PlotPoint | null;
  initialBoundary?: LngLat[];
  /** Called with the boundary's area in m², or null when there is no usable boundary. */
  onBoundaryAreaChange?: (sqM: number | null) => void;
  locationError?: string;
  boundaryError?: string;
};

const secondaryButton =
  "min-h-14 rounded-xl border-2 border-green-700 bg-white px-4 text-lg font-semibold text-green-800 " +
  "hover:bg-green-50 focus:outline-none focus:ring-4 focus:ring-green-300 disabled:opacity-50";

/**
 * Sets a plot's location in three ways (all optional, all combinable):
 * 1. the phone's location (when the farmer allows it),
 * 2. a pin placed by tapping the map,
 * 3. a boundary drawn by tapping the field's corners.
 * Writes the result into hidden form inputs for the plot Server Action.
 */
export function PlotLocationPicker({
  t,
  initialView,
  initialPoint = null,
  initialBoundary = [],
  onBoundaryAreaChange,
  locationError,
  boundaryError,
}: Props) {
  const [point, setPoint] = useState<Point | null>(initialPoint);
  const [boundary, setBoundary] = useState<LngLat[]>(initialBoundary);
  const [drawing, setDrawing] = useState(false);
  const [status, setStatus] = useState<Status>({ kind: "idle" });
  const [mapReady, setMapReady] = useState(false);

  const containerRef = useRef<HTMLDivElement>(null);
  const leafletRef = useRef<{ L: L; map: Leaflet.Map; layers: Leaflet.LayerGroup } | null>(null);
  const drawingRef = useRef(drawing);
  const initialLocationRef = useRef({ point: initialPoint, boundary: initialBoundary });

  useEffect(() => {
    drawingRef.current = drawing;
  }, [drawing]);

  // Create the map once.
  useEffect(() => {
    let cancelled = false;
    loadLeaflet().then((L) => {
      if (cancelled || !containerRef.current) return;
      const map = L.map(containerRef.current, { scrollWheelZoom: false });
      // Start on the saved boundary or pin when editing, otherwise on the given view.
      const start = initialLocationRef.current;
      if (start.boundary.length >= 3) {
        map.fitBounds(L.latLngBounds(start.boundary.map(([lng, lat]) => L.latLng(lat, lng))), {
          padding: [32, 32],
          maxZoom: FIELD_ZOOM,
        });
      } else if (start.point) {
        map.setView([start.point.lat, start.point.lng], FIELD_ZOOM);
      } else {
        map.setView([initialView.lat, initialView.lng], initialView.zoom);
      }
      addBaseLayer(L, map);
      const layers = L.layerGroup().addTo(map);
      map.on("click", (e: Leaflet.LeafletMouseEvent) => {
        const lat = e.latlng.lat;
        const lng = e.latlng.lng;
        if (drawingRef.current) {
          setBoundary((b) => [...b, [lng, lat]]);
        } else {
          setPoint({ lat, lng, source: "map_pin" });
          setStatus({ kind: "pinned" });
        }
      });
      leafletRef.current = { L, map, layers };
      setMapReady(true);
    });
    return () => {
      cancelled = true;
      leafletRef.current?.map.remove();
      leafletRef.current = null;
    };
  }, [initialView.lat, initialView.lng, initialView.zoom]);

  // Redraw the pin and boundary whenever they change. Shapes are not interactive, so a tap
  // inside the boundary still reaches the map and adds a corner or moves the pin.
  useEffect(() => {
    const current = leafletRef.current;
    if (!current) return;
    const { L, layers } = current;
    layers.clearLayers();

    if (point) {
      if (point.source === "device_gps" && point.accuracyM) {
        L.circle([point.lat, point.lng], { radius: point.accuracyM, color: "#2563eb", weight: 1, fillOpacity: 0.1, interactive: false }).addTo(layers);
      }
      L.marker([point.lat, point.lng], { icon: pinIcon(L), keyboard: false, interactive: false }).addTo(layers);
    }

    const latLngs = boundary.map(([lng, lat]) => L.latLng(lat, lng));
    if (latLngs.length >= 3) {
      L.polygon(latLngs, { ...BOUNDARY_STYLE, interactive: false }).addTo(layers);
    } else if (latLngs.length === 2) {
      L.polyline(latLngs, { color: BOUNDARY_STYLE.color, weight: 3, interactive: false }).addTo(layers);
    }
    if (drawing) {
      for (const p of latLngs) {
        L.circleMarker(p, { radius: 7, color: "#14532d", weight: 2, fillColor: "#ffffff", fillOpacity: 1, interactive: false }).addTo(layers);
      }
    }
  }, [mapReady, point, boundary, drawing]);

  const boundaryProblem = boundary.length ? checkBoundary(boundary) : null;
  const usableBoundary = boundary.length > 0 && boundaryProblem === null;
  const areaSqM = usableBoundary ? ringAreaSqM(boundary) : null;

  useEffect(() => {
    onBoundaryAreaChange?.(areaSqM);
  }, [areaSqM, onBoundaryAreaChange]);

  function useMyLocation() {
    if (!("geolocation" in navigator)) {
      setStatus({ kind: "unavailable" });
      return;
    }
    setStatus({ kind: "locating" });
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const next: Point = {
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          source: "device_gps",
          accuracyM: Math.round(pos.coords.accuracy),
        };
        setPoint(next);
        setStatus({ kind: "found", accuracyM: next.accuracyM ?? 0 });
        leafletRef.current?.map.setView([next.lat, next.lng], FIELD_ZOOM);
      },
      (err) => setStatus({ kind: err.code === err.PERMISSION_DENIED ? "denied" : "unavailable" }),
      { enableHighAccuracy: true, timeout: 20000, maximumAge: 0 },
    );
  }

  const statusText = {
    idle: null,
    locating: t.plots.locating,
    found: status.kind === "found" ? format(t.plots.locationFound, { meters: status.accuracyM }) : null,
    pinned: t.plots.pinPlaced,
    denied: t.plots.locationDenied,
    unavailable: t.plots.locationUnavailable,
  }[status.kind];

  const drawingProblemText =
    boundary.length > 0 && boundaryProblem
      ? boundaryProblem === "tooFewPoints"
        ? t.errors.boundaryTooFewPoints
        : t.errors.invalidBoundary
      : null;

  return (
    <fieldset className="flex flex-col gap-4">
      <legend className="mb-1 text-lg font-semibold text-stone-900">{t.plots.locationTitle}</legend>
      <p className="text-base text-stone-600">{t.plots.locationHelp}</p>

      <button type="button" onClick={useMyLocation} disabled={status.kind === "locating"} className={secondaryButton}>
        <span aria-hidden="true">📍 </span>
        {t.plots.useMyLocation}
      </button>

      <p aria-live="polite" className="min-h-6 text-base text-stone-700" data-testid="location-status">
        {statusText}
      </p>

      {point && !drawing ? (
        <button
          type="button"
          onClick={() => {
            setPoint(null);
            setStatus({ kind: "idle" });
          }}
          className="min-h-12 w-fit self-start rounded-lg px-1 text-lg font-medium text-red-700 underline underline-offset-4"
        >
          {t.plots.removePin}
        </button>
      ) : null}

      <div
        ref={containerRef}
        data-testid="plot-location-map"
        aria-label={t.plots.locationTitle}
        className={`h-80 w-full overflow-hidden rounded-2xl border-2 bg-stone-100 ${drawing ? "border-green-700 cursor-crosshair" : "border-stone-200"}`}
      />

      {drawing ? (
        <div className="flex flex-col gap-3 rounded-xl bg-green-50 p-4">
          <p className="text-lg text-green-900">{t.plots.drawHelp}</p>
          <p className="text-base font-medium text-green-900" data-testid="boundary-points">
            {format(t.plots.pointsMarked, { count: boundary.length })}
          </p>
          <div className="grid grid-cols-2 gap-3">
            <button type="button" className={secondaryButton} disabled={boundary.length === 0} onClick={() => setBoundary((b) => b.slice(0, -1))}>
              {t.plots.undoPoint}
            </button>
            <button type="button" className={secondaryButton} disabled={boundary.length === 0} onClick={() => setBoundary([])}>
              {t.plots.clearBoundary}
            </button>
          </div>
          <button
            type="button"
            onClick={() => setDrawing(false)}
            className="min-h-14 rounded-xl bg-green-700 px-4 text-lg font-semibold text-white hover:bg-green-800 focus:outline-none focus:ring-4 focus:ring-green-300"
          >
            {t.plots.finishBoundary}
          </button>
        </div>
      ) : (
        <button type="button" onClick={() => setDrawing(true)} className={secondaryButton}>
          {boundary.length ? t.plots.editBoundary : t.plots.drawBoundary}
        </button>
      )}

      {drawingProblemText ? (
        <p role="alert" className="text-base font-medium text-red-700">
          {drawingProblemText}
        </p>
      ) : null}
      {locationError ? (
        <p role="alert" className="text-base font-medium text-red-700">
          {locationError}
        </p>
      ) : null}
      {boundaryError ? (
        <p role="alert" className="text-base font-medium text-red-700">
          {boundaryError}
        </p>
      ) : null}

      <input type="hidden" name="latitude" value={point ? point.lat.toFixed(6) : ""} />
      <input type="hidden" name="longitude" value={point ? point.lng.toFixed(6) : ""} />
      <input type="hidden" name="location_source" value={point?.source ?? ""} />
      <input type="hidden" name="location_accuracy_m" value={point?.accuracyM ?? ""} />
      <input type="hidden" name="boundary" value={usableBoundary ? JSON.stringify(boundary) : ""} />
    </fieldset>
  );
}
