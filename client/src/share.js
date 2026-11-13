// Compartilhamento: gera uma "foto" da viagem (pontos, categorias e, se o usuário quiser,
// hospedagem e rotas) que pode virar link ou arquivo, e lê esse formato de volta.

import { formatDistance, formatDuration } from "./lib.js";

const round = (value) => Math.round(value * 1e5) / 1e5;
const isHex = (value) => /^#[0-9a-f]{6}$/i.test(value);
const str = (value, max) => (typeof value === "string" ? value.slice(0, max) : "");
const modes = new Set(["drive", "walk", "bicycle"]);

// options: { notes, base, routes } (o que incluir)
// context: { mode, routes: [{ from, to, time, distance, path }] } (rotas já traçadas na tela)
export function buildSnapshot(trip, options, context) {
  return {
    version: 1,
    name: trip.name,
    mode: context.mode,
    categories: trip.categories.map(({ id, name, color, hidden }) => ({
      id,
      name,
      color,
      hidden: Boolean(hidden),
    })),
    places: trip.places.map((place) => ({
      id: place.id,
      name: place.name,
      address: place.address ?? "",
      description: place.description ?? "",
      lat: place.lat,
      lon: place.lon,
      categoryId: place.categoryId ?? "",
      notes: options.notes ? place.notes ?? "" : "",
      visited: Boolean(place.visited),
      priority: Boolean(place.priority),
      manual: Boolean(place.manual),
    })),
    baseId: options.base ? trip.baseId ?? null : null,
    routes: options.routes
      ? context.routes.map((route) => ({
          from: route.from,
          to: route.to,
          time: route.time,
          distance: route.distance,
          // 5 casas decimais (~1 m) deixam o arquivo bem menor
          path: route.path.map((line) => line.map(([lat, lon]) => [round(lat), round(lon)])),
        }))
      : [],
  };
}

// Valida o que veio de um link ou arquivo antes de usar; devolve null se não for uma viagem.
export function cleanSnapshot(input) {
  if (!input || typeof input !== "object" || !Array.isArray(input.places)) return null;

  const categories = (Array.isArray(input.categories) ? input.categories : [])
    .slice(0, 50)
    .map((category) => ({
      id: str(category?.id, 60),
      name: str(category?.name, 80),
      color: isHex(category?.color) ? category.color : "#5b8def",
      hidden: Boolean(category?.hidden),
    }))
    .filter((category) => category.id && category.name);

  const places = input.places
    .slice(0, 300)
    .map((place) => ({
      id: str(place?.id, 120),
      name: str(place?.name, 160) || "Ponto no mapa",
      address: str(place?.address, 300),
      description: str(place?.description, 400),
      lat: place?.lat,
      lon: place?.lon,
      categoryId: str(place?.categoryId, 60),
      notes: str(place?.notes, 2000),
      visited: Boolean(place?.visited),
      priority: Boolean(place?.priority),
      manual: Boolean(place?.manual),
    }))
    .filter(
      (place) =>
        place.id &&
        Number.isFinite(place.lat) &&
        Number.isFinite(place.lon) &&
        Math.abs(place.lat) <= 90 &&
        Math.abs(place.lon) <= 180,
    );

  if (!places.length) return null;
  const ids = new Set(places.map((place) => place.id));

  const routes = (Array.isArray(input.routes) ? input.routes : [])
    .slice(0, 100)
    .filter((route) => ids.has(route?.from) && ids.has(route?.to) && Array.isArray(route.path))
    .map((route) => ({
      from: route.from,
      to: route.to,
      time: Number.isFinite(route.time) ? route.time : 0,
      distance: Number.isFinite(route.distance) ? route.distance : 0,
      path: route.path
        .filter(Array.isArray)
        .map((line) =>
          line
            .filter((point) => Array.isArray(point) && Number.isFinite(point[0]) && Number.isFinite(point[1]))
            .map((point) => [point[0], point[1]]),
        ),
    }));

  return {
    name: str(input.name, 120) || "Viagem compartilhada",
    mode: modes.has(input.mode) ? input.mode : "drive",
    categories,
    places,
    baseId: ids.has(input.baseId) ? input.baseId : null,
    routes,
  };
}

const fileSafe = (name) => name.replace(/[^p{L}p{N}]+/gu, "-").replace(/^-|-$/g, "") || "viagem";

function saveFile(content, filename, mime) {
  const url = URL.createObjectURL(new Blob([content], { type: mime }));
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

export function downloadSnapshot(snapshot) {
  saveFile(JSON.stringify(snapshot), `${fileSafe(snapshot.name)}.rota.json`, "application/json");
}

// ---------- KML (Google My Maps, Google Earth, apps de GPS) ----------
const xml = (value) =>
  String(value).replace(/[<>&"']/g, (char) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", '"': "&quot;", "'": "&apos;" })[char]);

// KML usa cor no formato aabbggrr
const kmlColor = (hex) => `ff${hex.slice(5, 7)}${hex.slice(3, 5)}${hex.slice(1, 3)}`;

const lodgingStyle = (color) =>
  `<Style id="base"><IconStyle><color>${kmlColor(color)}</color><scale>1.3</scale><Icon><href>http://maps.google.com/mapfiles/kml/shapes/lodging.png</href></Icon></IconStyle></Style>`;

const pinStyle = (id, color) =>
  `<Style id="${id}"><IconStyle><color>${kmlColor(color)}</color><scale>1.1</scale><Icon><href>http://maps.google.com/mapfiles/kml/paddle/wht-blank.png</href></Icon></IconStyle></Style>`;

export function buildKml(snapshot) {
  const BASE = "#8a7ad6";
  const placeMark = (place, style) => {
    const description = [place.address, place.notes].filter(Boolean).join("\n\n");
    const label = style === "base" ? `Hospedagem: ${place.name}` : place.name;
    return `<Placemark><name>${xml(label)}</name>${
      description ? `<description>${xml(description)}</description>` : ""
    }<styleUrl>#${style}</styleUrl><Point><coordinates>${place.lon},${place.lat},0</coordinates></Point></Placemark>`;
  };

  const base = snapshot.places.find((place) => place.id === snapshot.baseId);
  const others = snapshot.places.filter((place) => place.id !== snapshot.baseId);
  const folders = [];

  // a hospedagem vem sempre primeiro
  if (base) folders.push(`<Folder><name>Hospedagem</name>${placeMark(base, "base")}</Folder>`);

  snapshot.categories.forEach((category, index) => {
    const items = others.filter((place) => place.categoryId === category.id);
    if (items.length) {
      folders.push(
        `<Folder><name>${xml(category.name)}</name>${items.map((place) => placeMark(place, `cat${index}`)).join("")}</Folder>`,
      );
    }
  });

  const known = new Set(snapshot.categories.map((category) => category.id));
  const loose = others.filter((place) => !known.has(place.categoryId));
  if (loose.length) {
    folders.push(`<Folder><name>Sem categoria</name>${loose.map((place) => placeMark(place, "plain")).join("")}</Folder>`);
  }

  const byId = new Map(snapshot.places.map((place) => [place.id, place]));
  const routes = snapshot.routes
    .map((route) => {
      const from = byId.get(route.from);
      const to = byId.get(route.to);
      const lines = route.path
        .filter((line) => line.length > 1)
        .map((line) => `<LineString><tessellate>1</tessellate><coordinates>${line.map(([lat, lon]) => `${lon},${lat},0`).join(" ")}</coordinates></LineString>`)
        .join("");
      return `<Placemark><name>${xml(`${from.name} → ${to.name}`)}</name><description>${xml(
        `${formatDuration(route.time)} · ${formatDistance(route.distance)}`,
      )}</description><styleUrl>#route</styleUrl><MultiGeometry>${lines}</MultiGeometry></Placemark>`;
    })
    .join("");
  if (routes) folders.push(`<Folder><name>Rotas</name>${routes}</Folder>`);

  const styles = [
    lodgingStyle(BASE),
    pinStyle("plain", "#5b8def"),
    ...snapshot.categories.map((category, index) => pinStyle(`cat${index}`, category.color)),
    `<Style id="route"><LineStyle><color>${kmlColor("#5b8def")}</color><width>4</width></LineStyle></Style>`,
  ].join("");

  return `<?xml version="1.0" encoding="UTF-8"?>\n<kml xmlns="http://www.opengis.net/kml/2.2"><Document><name>${xml(
    snapshot.name,
  )}</name>${styles}${folders.join("")}</Document></kml>`;
}

export function downloadKml(snapshot) {
  saveFile(buildKml(snapshot), `${fileSafe(snapshot.name)}.kml`, "application/vnd.google-earth.kml+xml");
}
