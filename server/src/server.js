import "dotenv/config";
import cors from "cors";
import express from "express";

const app = express();
const port = Number(process.env.PORT) || 3000;
const geoapifyApiKey = process.env.GEOAPIFY_API_KEY;
const missingApiKeyMessage =
  "Configure GEOAPIFY_API_KEY no arquivo server/.env e reinicie o servidor.";
const allowedCategories = new Set([
  "tourism",
  "catering.restaurant",
  "accommodation.hotel",
  "leisure.park",
]);

app.use(cors({ origin: "http://localhost:5173" }));
app.use(express.json());

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
    const places = (data.features ?? []).map(({ properties }) => ({
      id: properties.place_id,
      name: properties.name || properties.address_line1 || "Lugar sem nome",
      address: properties.formatted,
      category: properties.categories?.[0] ?? category,
      lat: properties.lat,
      lon: properties.lon,
    }));

    response.json(places);
  } catch (error) {
    console.error("Erro ao buscar lugares:", error);
    response.status(502).json({ error: "Falha ao conectar com a Geoapify." });
  }
});

app.listen(port, () => {
  console.log(`API disponível em http://localhost:${port}`);
  if (!geoapifyApiKey) {
    console.warn(missingApiKeyMessage);
  }
});
