import dotenv from "dotenv";
import cors from "cors";
import express from "express";
import { randomBytes } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const serverDirectory = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: resolve(serverDirectory, "../.env") });
dotenv.config({ path: resolve(serverDirectory, "../../.env") });

const app = express();
const port = Number(process.env.PORT) || 3000;
const geoapifyApiKey = process.env.GEOAPIFY_API_KEY || process.env.API_KEY;
const missingApiKeyMessage =
  "Configure GEOAPIFY_API_KEY em server/.env ou API_KEY no .env da raiz e reinicie o servidor.";
const categoryLabels = new Map([
  ["tourism", "Atração turística"],
  ["catering.restaurant", "Restaurante"],
  ["accommodation.hotel", "Hotel"],
  ["leisure.park", "Parque"],
  ["beach", "Praia"],
  ["entertainment.museum", "Museu"],
]);
const allowedCategories = new Set(categoryLabels.keys());

app.use(cors({ origin: "http://localhost:5173" }));
// Na Vercel o app fica atrás do proxy deles: sem isso, todo mundo teria o mesmo IP.
const onVercel = Boolean(process.env.VERCEL);
app.set("trust proxy", onVercel ? 1 : false);
app.use(express.json({ limit: "4mb" }));

app.get("/api/health", (_request, response) => {
  response.json({ status: "ok", geoapifyConfigured: Boolean(geoapifyApiKey) });
});

app.get("/api/geocode", async (request, response) => {
  const text = String(request.query.text ?? "").trim();

  if (!text) {
    response.status(400).json({ error: "Informe um destino para pesquisar." });
    return;
  }

  if (!geoapifyApiKey) {
    response.status(503).json({
      error: missingApiKeyMessage,
    });
    return;
  }

  try {
    const params = new URLSearchParams({
      text,
      format: "json",
      limit: "1",
      lang: "pt",
      apiKey: geoapifyApiKey,
    });
    const result = await fetch(
      `https://api.geoapify.com/v1/geocode/search?${params}`,
    );

    if (!result.ok) {
      response.status(502).json({ error: "Não foi possível pesquisar esse destino." });
      return;
    }

    const data = await result.json();
    const place = data.results?.[0];

    if (!place) {
      response.status(404).json({ error: "Nenhum destino encontrado." });
      return;
    }

    response.json({
      id: place.place_id,
      name: place.name || place.city || place.formatted || text,
      address: place.formatted,
      lat: place.lat,
      lon: place.lon,
    });
  } catch (error) {
    console.error("Erro ao pesquisar destino:", error);
    response.status(502).json({ error: "Falha ao conectar com a Geoapify." });
  }
});

app.get("/api/places", async (request, response) => {
  const lat = Number(request.query.lat);
  const lon = Number(request.query.lon);
  const radius = Number(request.query.radius) || 10000;
  const category = String(request.query.category ?? "tourism");

  if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
    response.status(400).json({ error: "Coordenadas inválidas." });
    return;
  }

  if (!allowedCategories.has(category)) {
    response.status(400).json({ error: "Categoria de lugares inválida." });
    return;
  }

  if (!geoapifyApiKey) {
    response.status(503).json({
      error: missingApiKeyMessage,
    });
    return;
  }

  try {
    const params = new URLSearchParams({
      categories: category,
      filter: `circle:${lon},${lat},${Math.min(Math.max(radius, 1000), 50000)}`,
      limit: "40",
      lang: "pt",
      apiKey: geoapifyApiKey,
    });
    const result = await fetch(`https://api.geoapify.com/v2/places?${params}`);

    if (!result.ok) {
      response.status(502).json({ error: "Não foi possível buscar lugares próximos." });
      return;
    }

    const data = await result.json();
    const places = (data.features ?? []).map(({ properties }) => {
      const sourceDescription = [
        properties.description,
        properties.datasource?.raw?.description,
      ].find((value) => typeof value === "string" && value.trim());
      const nearbyArea =
        properties.city ||
        properties.county ||
        properties.state ||
        properties.country ||
        properties.formatted;

      return {
        id: properties.place_id,
        externalId: properties.place_id,
        name: properties.name || properties.address_line1 || "Lugar sem nome",
        description:
          sourceDescription?.trim().slice(0, 240) ||
          `${categoryLabels.get(category) ?? "Lugar"}${
            nearbyArea ? ` em ${nearbyArea}` : ""
          }.`,
        address: properties.formatted,
        category: properties.categories?.[0] ?? category,
        lat: properties.lat,
        lon: properties.lon,
      };
    });

    response.json(places);
  } catch (error) {
    console.error("Erro ao buscar lugares:", error);
    response.status(502).json({ error: "Falha ao conectar com a Geoapify." });
  }
});

app.get("/api/search", async (request, response) => {
  const text = String(request.query.text ?? "").trim();
  const lat = Number(request.query.lat);
  const lon = Number(request.query.lon);

  if (!text) {
    response.status(400).json({ error: "Informe o que deseja pesquisar." });
    return;
  }

  if (!geoapifyApiKey) {
    response.status(503).json({ error: missingApiKeyMessage });
    return;
  }

  try {
    const params = new URLSearchParams({
      text,
      format: "json",
      limit: "15",
      lang: "pt",
      apiKey: geoapifyApiKey,
    });
    if (request.query.lat !== undefined && Number.isFinite(lat) && Number.isFinite(lon)) {
      params.set("bias", `proximity:${lon},${lat}`);
    }
    const result = await fetch(`https://api.geoapify.com/v1/geocode/search?${params}`);

    if (!result.ok) {
      response.status(502).json({ error: "Não foi possível pesquisar." });
      return;
    }

    const data = await result.json();
    response.json(
      (data.results ?? []).map((place) => ({
        id: place.place_id,
        externalId: place.place_id,
        name: place.name || place.address_line1 || place.formatted,
        description: place.address_line2 || place.formatted,
        address: place.formatted,
        category: place.category ?? "busca",
        lat: place.lat,
        lon: place.lon,
      })),
    );
  } catch (error) {
    console.error("Erro na busca livre:", error);
    response.status(502).json({ error: "Falha ao conectar com a Geoapify." });
  }
});

const routeModes = new Set(["drive", "walk", "bicycle"]);

// POST { mode, waypoints: [{lat, lon}, ...] } -> distância real, tempo e geometria
app.post("/api/route", async (request, response) => {
  const mode = String(request.body?.mode ?? "drive");
  const waypoints = Array.isArray(request.body?.waypoints) ? request.body.waypoints : [];

  if (!routeModes.has(mode)) {
    response.status(400).json({ error: "Meio de transporte inválido." });
    return;
  }

  if (
    waypoints.length < 2 ||
    waypoints.length > 25 ||
    waypoints.some((point) => !Number.isFinite(point?.lat) || !Number.isFinite(point?.lon))
  ) {
    response.status(400).json({ error: "Informe de 2 a 25 pontos válidos." });
    return;
  }

  if (!geoapifyApiKey) {
    response.status(503).json({ error: missingApiKeyMessage });
    return;
  }

  try {
    const params = new URLSearchParams({
      waypoints: waypoints.map((point) => `${point.lat},${point.lon}`).join("|"),
      mode,
      apiKey: geoapifyApiKey,
    });
    const result = await fetch(`https://api.geoapify.com/v1/routing?${params}`);

    if (!result.ok) {
      response.status(502).json({ error: "Não foi possível calcular a rota." });
      return;
    }

    const data = await result.json();
    const feature = data.features?.[0];

    if (!feature) {
      response.status(404).json({ error: "Nenhuma rota encontrada entre esses pontos." });
      return;
    }

    response.json({
      distance: feature.properties.distance,
      time: feature.properties.time,
      // GeoJSON usa [lon, lat]; o Leaflet espera [lat, lon].
      path: feature.geometry.coordinates.map((line) =>
        line.map(([lineLon, lineLat]) => [lineLat, lineLon]),
      ),
    });
  } catch (error) {
    console.error("Erro ao calcular rota:", error);
    response.status(502).json({ error: "Falha ao conectar com a Geoapify." });
  }
});

// Tiles do mapa (Geoapify osm-bright-grey), repassados para a chave não ir ao navegador.
app.get("/api/tiles/:z/:x/:y.png", async (request, response) => {
  const { z, x, y } = request.params;

  if (![z, x, y].every((value) => /^\d{1,7}$/.test(value)) || Number(z) > 22) {
    response.status(400).end();
    return;
  }

  if (!geoapifyApiKey) {
    response.status(503).end();
    return;
  }

  try {
    const result = await fetch(
      `https://maps.geoapify.com/v1/tile/osm-bright-grey/${z}/${x}/${y}.png?apiKey=${encodeURIComponent(geoapifyApiKey)}`,
    );

    if (!result.ok) {
      response.status(result.status === 404 ? 404 : 502).end();
      return;
    }

    response.set("Content-Type", result.headers.get("content-type") || "image/png");
    // s-maxage deixa o CDN da Vercel guardar o tile: poupa invocações e a cota da Geoapify
    response.set("Cache-Control", "public, max-age=86400, s-maxage=604800, stale-while-revalidate=86400");
    response.send(Buffer.from(await result.arrayBuffer()));
  } catch (error) {
    console.error("Erro ao buscar tile:", error);
    response.status(502).end();
  }
});

// Endereço de um ponto clicado no mapa.
app.get("/api/reverse", async (request, response) => {
  const lat = Number(request.query.lat);
  const lon = Number(request.query.lon);

  if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
    response.status(400).json({ error: "Coordenadas inválidas." });
    return;
  }

  if (!geoapifyApiKey) {
    response.status(503).json({ error: missingApiKeyMessage });
    return;
  }

  try {
    const params = new URLSearchParams({
      lat: String(lat),
      lon: String(lon),
      format: "json",
      lang: "pt",
      apiKey: geoapifyApiKey,
    });
    const result = await fetch(`https://api.geoapify.com/v1/geocode/reverse?${params}`);

    if (!result.ok) {
      response.status(502).json({ error: "Não foi possível identificar esse ponto." });
      return;
    }

    const place = (await result.json()).results?.[0];
    response.json({
      name: place?.name || place?.address_line1 || "Ponto no mapa",
      address: place?.formatted ?? "",
    });
  } catch (error) {
    console.error("Erro na geocodificação reversa:", error);
    response.status(502).json({ error: "Falha ao conectar com a Geoapify." });
  }
});

// Foto do lugar, quando ele tem página na Wikipédia (lugares conhecidos).
const photoCache = new Map();

function normalizeText(value) {
  return String(value)
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9 ]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

async function findWikipediaPhoto(language, name, lat, lon) {
  const params = new URLSearchParams({
    action: "query",
    format: "json",
    generator: "geosearch",
    ggscoord: `${lat}|${lon}`,
    ggsradius: "2000",
    ggslimit: "15",
    prop: "pageimages",
    piprop: "thumbnail",
    pithumbsize: "560",
    pilimit: "15",
  });
  const result = await fetch(`https://${language}.wikipedia.org/w/api.php?${params}`, {
    headers: { "User-Agent": "RotaTravelPlanner/1.0" },
  });
  if (!result.ok) return null;

  const wanted = normalizeText(name);
  const wantedWords = new Set(wanted.split(" ").filter((word) => word.length > 3));
  const pages = Object.values((await result.json()).query?.pages ?? {});

  const match = pages.find((page) => {
    if (!page.thumbnail?.source) return false;
    const title = normalizeText(page.title);
    if (!title || !wanted) return false;
    if (title.includes(wanted) || wanted.includes(title)) return true;
    const shared = title.split(" ").filter((word) => wantedWords.has(word));
    return shared.length >= 2;
  });

  return match
    ? {
        url: match.thumbnail.source,
        title: match.title,
        pageUrl: `https://${language}.wikipedia.org/wiki/${encodeURIComponent(
          match.title.replace(/ /g, "_"),
        )}`,
      }
    : null;
}

app.get("/api/photo", async (request, response) => {
  const name = String(request.query.name ?? "").trim();
  const lat = Number(request.query.lat);
  const lon = Number(request.query.lon);

  if (!name || !Number.isFinite(lat) || !Number.isFinite(lon)) {
    response.status(400).json({ error: "Informe nome e coordenadas." });
    return;
  }

  const cacheKey = `${normalizeText(name)}|${lat.toFixed(3)}|${lon.toFixed(3)}`;
  if (photoCache.has(cacheKey)) {
    response.json(photoCache.get(cacheKey));
    return;
  }

  try {
    const photo =
      (await findWikipediaPhoto("pt", name, lat, lon)) ||
      (await findWikipediaPhoto("en", name, lat, lon));
    const payload = photo ?? { url: null };
    photoCache.set(cacheKey, payload);
    response.json(payload);
  } catch (error) {
    console.error("Erro ao buscar foto:", error);
    response.json({ url: null });
  }
});

// Distância e tempo reais de um ponto de origem (a hospedagem) até vários destinos.
app.post("/api/matrix", async (request, response) => {
  const mode = String(request.body?.mode ?? "drive");
  const origin = request.body?.origin;
  const targets = Array.isArray(request.body?.targets) ? request.body.targets : [];
  const validPoint = (point) => Number.isFinite(point?.lat) && Number.isFinite(point?.lon);

  if (!routeModes.has(mode)) {
    response.status(400).json({ error: "Meio de transporte inválido." });
    return;
  }

  if (!validPoint(origin) || !targets.length || targets.length > 60 || !targets.every(validPoint)) {
    response.status(400).json({ error: "Informe a origem e de 1 a 60 destinos válidos." });
    return;
  }

  if (!geoapifyApiKey) {
    response.status(503).json({ error: missingApiKeyMessage });
    return;
  }

  try {
    const result = await fetch(
      `https://api.geoapify.com/v1/routematrix?apiKey=${encodeURIComponent(geoapifyApiKey)}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode,
          sources: [{ location: [origin.lon, origin.lat] }],
          targets: targets.map((point) => ({ location: [point.lon, point.lat] })),
        }),
      },
    );

    if (!result.ok) {
      response.status(502).json({ error: "Não foi possível calcular as distâncias." });
      return;
    }

    const row = (await result.json()).sources_to_targets?.[0] ?? [];
    response.json(
      targets.map((_, index) => {
        const cell = row[index];
        return Number.isFinite(cell?.distance)
          ? { distance: cell.distance, time: cell.time }
          : null;
      }),
    );
  } catch (error) {
    console.error("Erro na matriz de rotas:", error);
    response.status(502).json({ error: "Falha ao conectar com a Geoapify." });
  }
});

// Sugestões de pesquisa enquanto o usuário digita. O autocomplete da Geoapify é bom para texto
// parcial ("copacab") e a pesquisa completa para nomes inteiros ("praia mole"): usa os dois.
async function geoapifyList(endpoint, params) {
  try {
    const result = await fetch(`https://api.geoapify.com/v1/geocode/${endpoint}?${params}`);
    if (!result.ok) return null;
    return (await result.json()).results ?? [];
  } catch {
    return null;
  }
}

app.get("/api/suggest", async (request, response) => {
  const query = String(request.query.text ?? "").trim();
  const lat = Number(request.query.lat);
  const lon = Number(request.query.lon);

  if (query.length < 2) {
    response.json([]);
    return;
  }

  if (!geoapifyApiKey) {
    response.status(503).json({ error: missingApiKeyMessage });
    return;
  }

  const build = (limit) => {
    const params = new URLSearchParams({
      text: query,
      format: "json",
      limit: String(limit),
      lang: "pt",
      apiKey: geoapifyApiKey,
    });
    if (request.query.lat !== undefined && Number.isFinite(lat) && Number.isFinite(lon)) {
      params.set("bias", `proximity:${lon},${lat}`);
    }
    return params;
  };

  const [autocomplete, search] = await Promise.all([
    geoapifyList("autocomplete", build(6)),
    geoapifyList("search", build(5)),
  ]);

  if (autocomplete === null && search === null) {
    response.status(502).json({ error: "Não foi possível buscar sugestões." });
    return;
  }

  const wanted = normalizeText(query);
  const seen = new Set();
  const suggestions = [];
  for (const place of [...(autocomplete ?? []), ...(search ?? [])]) {
    if (!Number.isFinite(place.lat) || !Number.isFinite(place.lon)) continue;
    const name = place.name || place.address_line1 || place.formatted;
    if (!name) continue;
    const key = `${normalizeText(name)}|${place.lat.toFixed(3)}|${place.lon.toFixed(3)}`;
    if (seen.has(key) || seen.has(place.place_id)) continue;
    seen.add(key);
    seen.add(place.place_id);

    const normalized = normalizeText(name);
    suggestions.push({
      rank: normalized.startsWith(wanted) ? 0 : normalized.includes(wanted) ? 1 : 2,
      place: {
        id: place.place_id,
        externalId: place.place_id,
        name,
        description: place.address_line2 || place.formatted,
        address: place.formatted,
        category: place.category ?? "busca",
        lat: place.lat,
        lon: place.lon,
      },
    });
  }

  // o que começa com o texto digitado vem primeiro; a ordem original se mantém dentro de cada grupo
  suggestions.sort((a, b) => a.rank - b.rank);
  response.json(suggestions.slice(0, 7).map((item) => item.place));
});

// ---------- compartilhamento de viagens ----------
// O link guarda uma "foto" da viagem em server/data/shares/<id>.json.
const sharesDirectory = resolve(serverDirectory, "../data/shares");
const shareIdPattern = /^[A-Za-z0-9_-]{6,16}$/;
const MAX_SHARE_POINTS = 60000;
const shareHits = new Map(); // limite simples por IP: 20 links por hora

const text = (value, max) => (typeof value === "string" ? value.slice(0, max) : "");
const number = (value) => (Number.isFinite(value) ? value : null);
const hexColor = (value) => (/^#[0-9a-f]{6}$/i.test(value) ? value : "#5b8def");

// Reconstrói a viagem só com os campos e tipos esperados (a entrada não é confiável).
function cleanSnapshot(input) {
  if (!input || typeof input !== "object") return null;

  const categories = (Array.isArray(input.categories) ? input.categories : [])
    .slice(0, 50)
    .map((category) => ({
      id: text(category?.id, 60),
      name: text(category?.name, 80),
      color: hexColor(category?.color),
      hidden: Boolean(category?.hidden),
    }))
    .filter((category) => category.id && category.name);

  const places = (Array.isArray(input.places) ? input.places : [])
    .slice(0, 300)
    .map((place) => ({
      id: text(place?.id, 120),
      name: text(place?.name, 160) || "Ponto no mapa",
      address: text(place?.address, 300),
      description: text(place?.description, 400),
      lat: number(place?.lat),
      lon: number(place?.lon),
      categoryId: text(place?.categoryId, 60),
      notes: text(place?.notes, 2000),
      visited: Boolean(place?.visited),
      priority: Boolean(place?.priority),
      manual: Boolean(place?.manual),
    }))
    .filter(
      (place) =>
        place.id &&
        place.lat !== null &&
        place.lon !== null &&
        Math.abs(place.lat) <= 90 &&
        Math.abs(place.lon) <= 180,
    );

  const ids = new Set(places.map((place) => place.id));
  let pointCount = 0;
  const routes = [];
  for (const route of (Array.isArray(input.routes) ? input.routes : []).slice(0, 100)) {
    if (!ids.has(route?.from) || !ids.has(route?.to) || !Array.isArray(route.path)) continue;
    const path = [];
    for (const line of route.path.slice(0, 50)) {
      if (!Array.isArray(line)) continue;
      const points = line
        .filter((point) => Array.isArray(point) && Number.isFinite(point[0]) && Number.isFinite(point[1]))
        .map((point) => [point[0], point[1]]);
      pointCount += points.length;
      if (pointCount > MAX_SHARE_POINTS) return null;
      path.push(points);
    }
    routes.push({
      from: route.from,
      to: route.to,
      time: number(route.time) ?? 0,
      distance: number(route.distance) ?? 0,
      path,
    });
  }

  return {
    version: 1,
    name: text(input.name, 120) || "Viagem compartilhada",
    mode: routeModes.has(input.mode) ? input.mode : "drive",
    categories,
    places,
    baseId: ids.has(input.baseId) ? input.baseId : null,
    routes,
  };
}

app.post("/api/shares", async (request, response) => {
  // Na Vercel o disco é temporário e não é compartilhado entre instâncias: links salvos em arquivo
  // sumiriam. Até existir um armazenamento de verdade (Blob, Redis, MongoDB), avisa em vez de enganar.
  if (onVercel) {
    response.status(503).json({
      error: "Links de compartilhamento ainda não estão disponíveis neste ambiente. Use o arquivo KML ou o backup.",
    });
    return;
  }

  const ip = request.ip;
  const now = Date.now();
  const recent = (shareHits.get(ip) ?? []).filter((time) => now - time < 3600000);
  if (recent.length >= 20) {
    response.status(429).json({ error: "Muitos links gerados. Tente novamente mais tarde." });
    return;
  }

  const snapshot = cleanSnapshot(request.body?.snapshot);
  if (!snapshot || !snapshot.places.length) {
    response.status(400).json({ error: "A viagem precisa ter ao menos um ponto para ser compartilhada." });
    return;
  }

  try {
    await mkdir(sharesDirectory, { recursive: true });
    const id = randomBytes(6).toString("base64url");
    await writeFile(resolve(sharesDirectory, `${id}.json`), JSON.stringify(snapshot), "utf8");
    shareHits.set(ip, [...recent, now]);
    response.status(201).json({ id });
  } catch (error) {
    console.error("Erro ao salvar compartilhamento:", error);
    response.status(500).json({ error: "Não foi possível gerar o link." });
  }
});

app.get("/api/shares/:id", async (request, response) => {
  const { id } = request.params;

  if (!shareIdPattern.test(id)) {
    response.status(400).json({ error: "Link inválido." });
    return;
  }

  try {
    const content = await readFile(resolve(sharesDirectory, `${id}.json`), "utf8");
    response.json(JSON.parse(content));
  } catch (error) {
    if (error.code === "ENOENT") {
      response.status(404).json({ error: "Esse link não existe ou expirou." });
      return;
    }
    console.error("Erro ao ler compartilhamento:", error);
    response.status(500).json({ error: "Não foi possível abrir o link." });
  }
});

// Local: sobe o servidor. Na Vercel o app é exportado e a plataforma cuida das requisições.
if (!onVercel) {
  app.listen(port, () => {
    console.log(`API disponível em http://localhost:${port}`);
    if (!geoapifyApiKey) {
      console.warn(missingApiKeyMessage);
    }
  });
}

export default app;
