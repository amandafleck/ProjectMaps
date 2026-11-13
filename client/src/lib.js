const STORAGE_KEY = "rota.trips.v1";

// Categorias de busca na Geoapify (o que o usuário explora).
export const searchCategories = [
  { id: "tourism", label: "Atrações" },
  { id: "beach", label: "Praias" },
  { id: "catering.restaurant", label: "Restaurantes" },
  { id: "accommodation.hotel", label: "Hospedagem" },
  { id: "leisure.park", label: "Parques" },
  { id: "entertainment.museum", label: "Museus" },
];

// Sugestão de categoria salva a partir da categoria de busca.
export const searchToSavedCategory = {
  tourism: "passeios",
  beach: "praias",
  "catering.restaurant": "restaurantes",
  "accommodation.hotel": "hospedagem",
  "leisure.park": "passeios",
  "entertainment.museum": "passeios",
};

export const colorPalette = [
  "#e58a58",
  "#4f9d86",
  "#5b8def",
  "#c76bb0",
  "#e2b94a",
  "#d9534f",
  "#8a7ad6",
  "#6c7a74",
];

export function defaultCategories() {
  return [
    { id: "praias", name: "Praias", color: "#5b8def", hidden: false },
    { id: "restaurantes", name: "Restaurantes", color: "#e58a58", hidden: false },
    { id: "passeios", name: "Passeios", color: "#4f9d86", hidden: false },
    { id: "hospedagem", name: "Hospedagem", color: "#8a7ad6", hidden: false },
  ];
}

export function newId(prefix) {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}

export function createTrip(name = "Minha viagem") {
  return {
    id: newId("trip"),
    name,
    destination: null,
    baseId: null, // hospedagem: ponto de partida das distâncias
    categories: defaultCategories(),
    places: [],
  };
}

export function loadState() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
    if (saved?.trips?.length) return saved;
  } catch {
    // armazenamento indisponível ou corrompido: começa do zero
  }
  const trip = createTrip();
  return { trips: [trip], activeTripId: trip.id };
}

export function saveState(state) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // sem armazenamento: o app continua funcionando só em memória
  }
}

// Distância em linha reta (haversine), em metros.
export function straightDistance(a, b) {
  const toRad = (degrees) => (degrees * Math.PI) / 180;
  const earthRadius = 6371000;
  const dLat = toRad(b.lat - a.lat);
  const dLon = toRad(b.lon - a.lon);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLon / 2) ** 2;
  return 2 * earthRadius * Math.asin(Math.sqrt(h));
}

export function formatDistance(meters) {
  return meters < 1000
    ? `${Math.round(meters)} m`
    : `${(meters / 1000).toFixed(meters < 10000 ? 1 : 0)} km`;
}

export function formatDuration(seconds) {
  const minutes = Math.max(1, Math.round(seconds / 60));
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest ? `${hours} h ${rest} min` : `${hours} h`;
}

// Cores dos marcadores: azul para pontos e rotas, roxo para a hospedagem, laranja para o ponto aberto.
export const ACCENT = "#5b8def";
export const BASE_COLOR = "#8a7ad6";
export const WARM = "#e58a58";

// Pesquisas recentes (as últimas escolhas), mostradas ao clicar na barra de busca.
const RECENT_KEY = "rota.recent.v1";

export function loadRecents() {
  try {
    const saved = JSON.parse(localStorage.getItem(RECENT_KEY));
    return Array.isArray(saved) ? saved.slice(0, 6) : [];
  } catch {
    return [];
  }
}

export function addRecent(place) {
  if (!place?.id || !Number.isFinite(place.lat) || !Number.isFinite(place.lon)) return;
  const entry = {
    id: place.id,
    externalId: place.externalId ?? null,
    name: place.name,
    description: place.description ?? "",
    address: place.address ?? "",
    lat: place.lat,
    lon: place.lon,
  };
  try {
    const rest = loadRecents().filter((item) => item.id !== entry.id);
    localStorage.setItem(RECENT_KEY, JSON.stringify([entry, ...rest].slice(0, 6)));
  } catch {
    // sem armazenamento: só não lembra as recentes
  }
}
