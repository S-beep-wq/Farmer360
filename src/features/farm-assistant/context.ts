import type { ForecastDay, RecentRain } from "@/features/weather/forecast";
import type { ImdWarnings } from "@/features/weather/imd";
import type { ImdRainfall, ImdRainPeriod } from "@/features/weather/imd-rainfall";
import type { WeatherPoint } from "@/features/weather/location";
import type { Locale } from "@/lib/i18n";

// The farm facts sent with a question (SYSTEM_ARCHITECTURE.md section 11): only what the task
// needs, from the farmer's own records. No name, phone, village or map location.

export type ContextCrop = {
  crop: string;
  season: string;
  status: string;
  plot: string;
  plannedSowing: string | null;
  sowing: string | null;
  expectedHarvest: string | null;
  harvest: string | null;
  daysSinceSowing: number | null;
  spentRupees: number;
  harvestedKg: number;
  soldKg: number;
  salesRupees: number;
};

export type FarmContext = {
  locale: Locale;
  today: string;
  district: string;
  state: string;
  /** `point` is used to fetch the weather and is never sent to the AI. */
  plots: { name: string; farm: string; area: string | null; soil: string | null; irrigation: string | null; point: WeatherPoint | null }[];
  /** Forecasts (and estimated recent rain) for the plots in question; empty when there are none. */
  weather: { plot: string; days: ForecastDay[]; recent?: RecentRain | null }[];
  /** IMD's official warnings for the farmer's district, when available. */
  imd?: ImdWarnings | null;
  /** IMD's measured rainfall for the farmer's district, when available (then `recent` is left out). */
  imdRain?: ImdRainfall | null;
  crops: ContextCrop[];
  activities: { date: string; crop: string; type: string }[];
  observations: { date: string; crop: string; status: string; note: string | null }[];
  /** True when the question is about one crop and only its records are included. */
  oneCrop: boolean;
};

const LANGUAGE: Record<Locale, string> = { hi: "Hindi (Devanagari script)", en: "simple English" };
const MAX_NOTE = 200;

const clip = (s: string) => (s.length > MAX_NOTE ? `${s.slice(0, MAX_NOTE - 1)}…` : s);
const opt = (label: string, value: string | number | null) => (value === null || value === "" ? null : `${label} ${value}`);

function cropLine(c: ContextCrop): string {
  const parts = [
    `${c.crop} (${c.season}) on plot "${c.plot}" — status: ${c.status}`,
    opt("planned sowing", c.plannedSowing),
    opt("sown", c.sowing),
    opt("days since sowing:", c.daysSinceSowing),
    opt("expected harvest", c.expectedHarvest),
    opt("harvest finished", c.harvest),
    c.spentRupees > 0 ? `spent so far ₹${c.spentRupees}` : "no costs recorded",
    c.harvestedKg > 0 ? `harvested ${c.harvestedKg} kg, sold ${c.soldKg} kg for ₹${c.salesRupees}` : null,
  ];
  return `- ${parts.filter(Boolean).join("; ")}`;
}

function weatherLine(d: ForecastDay): string {
  const rain = d.rainMm === null ? "rain unknown" : d.rainMm < 0.1 ? "no rain" : `rain ${d.rainMm} mm`;
  const chance = d.rainChance === null ? "" : ` (${d.rainChance}% chance of rain)`;
  const temp = d.tMinC === null || d.tMaxC === null ? "" : `, ${d.tMinC}–${d.tMaxC}°C`;
  const wind = d.windMaxKmh === null ? "" : `, wind up to ${d.windMaxKmh} km/h`;
  return `${d.date}: ${d.kind.toLowerCase().replace("_", " ")}, ${rain}${chance}${temp}${wind}`;
}

function recentLine(r: RecentRain): string {
  const days = r.days.map((d) => `${d.date} ${d.rainMm === null ? "unknown" : `${d.rainMm} mm`}`).join(", ");
  const total = r.totalMm === null ? "total unknown" : `total ${r.totalMm} mm, ${r.rainyDays} rainy days (2.5 mm or more)`;
  return `  - Estimated rain in the last ${r.days.length} days (weather-model estimate for the area, not measured in the field): ${total}; ${days}`;
}

function imdSection(c: FarmContext): string[] {
  if (!c.imd) return [];
  return [
    `Official IMD (India Meteorological Department) warnings for ${c.imd.district} district, issued ${c.imd.issuedOn}. These are official and take priority over the model forecast:`,
    ...c.imd.days.map((d) => `- ${d.date}: ${d.level.toLowerCase()}${d.hazards.length > 0 ? ` — ${d.hazards.map((h) => h.toLowerCase().replaceAll("_", " ")).join(", ")}` : " — no warning"}`),
  ];
}

function rainPeriodLine(label: string, p: ImdRainPeriod): string {
  const parts = [
    `${p.actualMm} mm`,
    p.normalMm !== null ? `normal ${p.normalMm} mm` : null,
    p.departurePct !== null ? `${p.departurePct > 0 ? "+" : ""}${p.departurePct}% compared with normal` : null,
    p.category ? `IMD category ${p.category}` : null,
  ];
  return `- ${label}: ${parts.filter(Boolean).join(", ")}`;
}

function imdRainSection(c: FarmContext): string[] {
  const r = c.imdRain;
  if (!r) return [];
  return [
    `Rain measured by IMD rain gauges, averaged over ${r.district} district (the farmer's field may differ). Categories: LE large excess, E excess, N normal, D deficient, LD large deficient, NR no rain:`,
    ...(r.day ? [rainPeriodLine(`24 hours to 08:30 on ${r.date}`, r.day)] : []),
    ...(r.week ? [rainPeriodLine(r.week.from && r.week.to ? `Week ${r.week.from} to ${r.week.to}` : "Last reported week", r.week)] : []),
    ...(r.season ? [rainPeriodLine(r.season.from ? `Since ${r.season.from}` : "Season so far", r.season)] : []),
  ];
}

function weatherSection(c: FarmContext): string[] {
  if (c.weather.length === 0) {
    return c.imd || c.imdRain
      ? [...imdSection(c), ...imdRainSection(c), "Model forecast: not available to you. Do not guess the weather beyond the IMD information."]
      : ["Weather: not available to you. Do not guess today's weather or forecast."];
  }
  return [
    ...imdSection(c),
    ...imdRainSection(c),
    "Weather forecast from weather models (Open-Meteo). It is a forecast for the area, not a measurement, and can be wrong, especially beyond 3 days:",
    ...c.weather.flatMap((w) => [`- Plot "${w.plot}":`, ...(w.recent ? [recentLine(w.recent)] : []), ...w.days.map((d) => `  - ${weatherLine(d)}`)]),
  ];
}

/** The facts, as plain text, ending with the question (marked as the farmer's words). */
export function contextText(c: FarmContext, question: string): string {
  const sections = [
    `Today's date: ${c.today}`,
    `Place: ${c.district} district, ${c.state}, India`,
    ...weatherSection(c),
    "",
    c.oneCrop ? "The question is about this crop:" : "Crops (planned, in the field or just harvested):",
    ...(c.crops.length ? c.crops.map(cropLine) : ["- none recorded"]),
    "",
    "Plots:",
    ...(c.plots.length
      ? c.plots.map((p) => `- "${p.name}" on farm "${p.farm}"${[opt(", area", p.area), opt(", soil", p.soil), opt(", irrigation", p.irrigation)].filter(Boolean).join("")}`)
      : ["- none recorded"]),
    "",
    "Work recorded in the last 30 days:",
    ...(c.activities.length ? c.activities.map((a) => `- ${a.date}: ${a.type} (${a.crop})`) : ["- none recorded"]),
    "",
    "Crop observations in the last 30 days (the farmer's own):",
    ...(c.observations.length
      ? c.observations.map((o) => `- ${o.date}, ${o.crop}: ${o.status}${o.note ? ` — <farmer_note>${clip(o.note)}</farmer_note>` : ""}`)
      : ["- none recorded"]),
    "",
    `<farmer_question>${question}</farmer_question>`,
    "",
    `Answer in ${LANGUAGE[c.locale]}.`,
  ];
  return sections.join("\n");
}
