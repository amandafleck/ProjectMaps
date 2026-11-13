import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import MapView from "./MapView.jsx";
import PlaceCard from "./PlaceCard.jsx";
import SavedPanel from "./SavedPanel.jsx";
import TripBar from "./TripBar.jsx";
import SearchBox from "./SearchBox.jsx";
import ShareDialog from "./ShareDialog.jsx";
import { CloseIcon, ShareIcon } from "./Icons.jsx";
import { buildSnapshot, cleanSnapshot, downloadKml, downloadSnapshot } from "./share.js";
import {
  colorPalette,
  addRecent,
  createTrip,
  defaultCategories,
  loadState,
  newId,
  saveState,
  searchCategories,
} from "./lib.js";

const coordinatePattern = /^\s*(-?\d+(?:\.\d+)?)\s*[,;\s]\s*(-?\d+(?:\.\d+)?)\s*$/;
const DEFAULT_CENTER = [-8.5026, -35.0048];

async function api(url, options) {
  const response = await fetch(url, options);
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || "Não foi possível concluir a busca.");
  return data;
}

function App() {
  const [state, setState] = useState(loadState);
  const mapRef = useRef(null);
  const searchInputRef = useRef(null);

  const [searchText, setSearchText] = useState("");
  const [shareOpen, setShareOpen] = useState(false);
  const sharedLoaded = useRef(false);
  const [searchCategory, setSearchCategory] = useState(null);
  const [results, setResults] = useState([]);
  const [fitPoints, setFitPoints] = useState(null);
  const [focus, setFocus] = useState(null);
  const [detail, setDetail] = useState(null);

  const [pickingBase, setPickingBase] = useState(false);
  const [mode, setMode] = useState("drive");
  const [distances, setDistances] = useState({});
  const [distanceLoading, setDistanceLoading] = useState(false);
  const [view, setView] = useState("all"); // "all" = tudo junto, "type" = por categoria
  const [routePairs, setRoutePairs] = useState([]); // [{ from, to }] (ids de lugares)
  const [routeOrigin, setRouteOrigin] = useState(null);
  const [allFromBase, setAllFromBase] = useState(false); // "Hospedagem → todos" ligado
  const [routes, setRoutes] = useState({}); // "de>para" -> trajeto
  const [routeLoading, setRouteLoading] = useState(false);
  const routeCache = useRef(new Map());

  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState(null);

  useEffect(() => saveState(state), [state]);

  const trip = state.trips.find((item) => item.id === state.activeTripId) ?? state.trips[0];
  const categoriesById = useMemo(
    () => new Map(trip.categories.map((category) => [category.id, category])),
    [trip.categories],
  );
  const placeById = useMemo(
    () => new Map(trip.places.map((place) => [place.id, place])),
    [trip.places],
  );
  const base = trip.baseId ? placeById.get(trip.baseId) ?? null : null;
  const visiblePlaces = trip.places.filter((place) => !categoriesById.get(place.categoryId)?.hidden);
  const detailPlace = detail ? placeById.get(detail.id) ?? detail : null;
  const mapCenter = trip.destination ? [trip.destination.lat, trip.destination.lon] : DEFAULT_CENTER;

  const say = (text, action) => setToast({ text, action, type: "info", id: Date.now() });
  const fail = (text) => setToast({ text, type: "error", id: Date.now() });

  // Avisos somem sozinhos; o mapa fica limpo.
  useEffect(() => {
    if (!toast) return undefined;
    const timer = setTimeout(
      () => setToast(null),
      toast.type === "error" ? 8000 : toast.action ? 7000 : 3500,
    );
    return () => clearTimeout(timer);
  }, [toast]);

  useEffect(() => {
    function onKey(event) {
      if (event.key === "Escape") setDetail(null);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const handleMapReady = useCallback((map) => {
    mapRef.current = map;
  }, []);

  function updateTrip(change) {
    setState((current) => ({
      ...current,
      trips: current.trips.map((item) =>
        item.id === current.activeTripId ? { ...item, ...change(item) } : item,
      ),
    }));
  }

  // Centro e raio (m) da parte do mapa que o usuário está vendo.
  function getView() {
    const map = mapRef.current;
    if (!map) return null;
    const center = map.getCenter();
    const radius = Math.min(Math.max(center.distanceTo(map.getBounds().getNorthEast()) * 0.8, 1000), 50000);
    return { lat: center.lat, lon: center.lng, radius: Math.round(radius) };
  }

  // ---------- distâncias a partir da hospedagem ----------
  const targetsKey = trip.places
    .filter((place) => place.id !== base?.id)
    .map((place) => `${place.id}:${place.lat},${place.lon}`)
    .join("|");
  const baseKey = base ? `${base.lat},${base.lon}` : "";

  useEffect(() => {
    setDistances({});
    const targets = trip.places.filter((place) => place.id !== base?.id);
    if (!base || !targets.length) {
      setDistanceLoading(false);
      return undefined;
    }

    const controller = new AbortController();
    setDistanceLoading(true);
    api("/api/matrix", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      signal: controller.signal,
      body: JSON.stringify({
        mode,
        origin: { lat: base.lat, lon: base.lon },
        targets: targets.slice(0, 60).map(({ lat, lon }) => ({ lat, lon })),
      }),
    })
      .then((rows) => {
        setDistances(
          Object.fromEntries(
            targets.slice(0, 60).map((place, index) => [place.id, rows[index]]).filter(([, row]) => row),
          ),
        );
        setDistanceLoading(false);
      })
      .catch((problem) => {
        if (problem.name === "AbortError") return;
        setDistanceLoading(false);
        fail(problem.message);
      });

    return () => controller.abort();
    // baseKey/targetsKey resumem a hospedagem e os destinos
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [baseKey, targetsKey, mode]);

  // Rotas entre quaisquer dois pontos: a hospedagem é só mais um ponto da lista.
  const activePairs = routePairs
    .map((pair) => ({
      key: `${pair.from}>${pair.to}`,
      from: placeById.get(pair.from),
      to: placeById.get(pair.to),
    }))
    .filter((pair) => pair.from && pair.to);
  const routesKey = activePairs
    .map((pair) => `${pair.key}:${pair.from.lat},${pair.from.lon}:${pair.to.lat},${pair.to.lon}`)
    .join("|");

  useEffect(() => {
    if (!activePairs.length) {
      setRoutes({});
      setRouteLoading(false);
      return undefined;
    }

    const controller = new AbortController();
    const cacheKey = (pair) =>
      `${mode}|${pair.from.lat},${pair.from.lon}|${pair.to.lat},${pair.to.lon}`;
    const readCache = () =>
      Object.fromEntries(
        activePairs
          .filter((pair) => routeCache.current.has(cacheKey(pair)))
          .map((pair) => [pair.key, routeCache.current.get(cacheKey(pair))]),
      );

    setRoutes(readCache());
    const missing = activePairs.filter((pair) => !routeCache.current.has(cacheKey(pair)));
    if (!missing.length) {
      setRouteLoading(false);
      return undefined;
    }

    setRouteLoading(true);
    (async () => {
      const queue = [...missing];
      let failed = false;
      // poucas requisições ao mesmo tempo, para respeitar o limite da API
      const worker = async () => {
        while (queue.length && !controller.signal.aborted) {
          const pair = queue.shift();
          try {
            const data = await api("/api/route", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              signal: controller.signal,
              body: JSON.stringify({
                mode,
                waypoints: [
                  { lat: pair.from.lat, lon: pair.from.lon },
                  { lat: pair.to.lat, lon: pair.to.lon },
                ],
              }),
            });
            routeCache.current.set(cacheKey(pair), data);
            setRoutes(readCache());
          } catch (problem) {
            if (problem.name === "AbortError") return;
            if (!failed) {
              failed = true;
              fail(problem.message);
            }
          }
        }
      };
      await Promise.all([worker(), worker(), worker()]);
      if (!controller.signal.aborted) setRouteLoading(false);
    })();

    return () => controller.abort();
    // routesKey resume os pares de pontos com rota
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [routesKey, mode]);

  function resetExploration() {
    setResults([]);
    setFitPoints(null);
    setSearchCategory(null);
    setDetail(null);
    setRoutePairs([]);
    setRouteOrigin(null);
    setAllFromBase(false);
    setPickingBase(false);
    setToast(null);
  }

  // ---------- viagens ----------
  function switchTrip(id) {
    setState((current) => ({ ...current, activeTripId: id }));
    resetExploration();
  }

  function addTrip() {
    const created = createTrip(`Viagem ${state.trips.length + 1}`);
    setState((current) => ({ trips: [...current.trips, created], activeTripId: created.id }));
    resetExploration();
  }

  function deleteTrip() {
    if (state.trips.length < 2) return;
    if (!window.confirm(`Excluir "${trip.name}" e todos os lugares salvos nela?`)) return;
    const remaining = state.trips.filter((item) => item.id !== trip.id);
    setState({ trips: remaining, activeTripId: remaining[0].id });
    resetExploration();
  }

  // ---------- pesquisa ----------
  async function runSearch(task) {
    setLoading(true);
    setToast(null);
    try {
      return await task();
    } catch (searchError) {
      fail(searchError.message);
      return null;
    } finally {
      setLoading(false);
    }
  }

  async function submitSearch() {
    const text = searchText.trim();
    if (!text) return;

    // "lat, lon" abre um ponto por coordenadas
    const coordinates = text.match(coordinatePattern);
    if (coordinates) {
      const [lat, lon] = [Number(coordinates[1]), Number(coordinates[2])];
      if (Math.abs(lat) <= 90 && Math.abs(lon) <= 180) {
        openLoosePoint({ lat, lon });
        setFocus({ lat, lon, key: Date.now() });
        return;
      }
    }

    const view = getView();
    const params = new URLSearchParams({ text });
    if (view) {
      params.set("lat", String(view.lat));
      params.set("lon", String(view.lon));
    }
    const data = await runSearch(() => api(`/api/search?${params}`));
    if (!data) return;

    setSearchCategory(null);
    setFitPoints(null);
    setResults(data);
    if (!data.length) {
      setDetail(null);
      fail(`Nada encontrado para "${text}".`);
      return;
    }
    // O melhor resultado já abre com o card; os demais ficam na lista.
    addRecent(data[0]);
    setDetail(data[0]);
    setFocus({ lat: data[0].lat, lon: data[0].lon, key: Date.now() });
    if (!trip.destination) {
      updateTrip(() => ({ destination: { lat: data[0].lat, lon: data[0].lon, name: data[0].name } }));
    }
  }

  async function searchByCategory(categoryId) {
    const view = getView();
    if (!view) return;
    const params = new URLSearchParams({
      lat: String(view.lat),
      lon: String(view.lon),
      radius: String(view.radius),
      category: categoryId,
    });
    const data = await runSearch(() => api(`/api/places?${params}`));
    if (!data) return;

    setSearchCategory(categoryId);
    setResults(data);
    setDetail(null);
    setFitPoints(data.length ? data : null);
    if (!data.length) say("Nenhum lugar encontrado nessa área. Mova o mapa ou tente outra categoria.");
  }

  function clearResults() {
    setResults([]);
    setFitPoints(null);
    setSearchCategory(null);
  }

  // ---------- ponto clicado no mapa ----------
  async function openLoosePoint(coords) {
    const id = newId("pin");
    // O título começa vazio para o usuário nomear o ponto; a rua fica só como endereço.
    setDetail({
      id,
      name: "",
      suggestedName: "",
      address: "Buscando endereço…",
      description: "",
      lat: coords.lat,
      lon: coords.lon,
      manual: true,
    });
    try {
      const data = await api(`/api/reverse?lat=${coords.lat}&lon=${coords.lon}`);
      setDetail((current) =>
        current?.id === id
          ? { ...current, suggestedName: data.name, address: data.address }
          : current,
      );
    } catch {
      setDetail((current) =>
        current?.id === id
          ? { ...current, address: `${coords.lat.toFixed(5)}, ${coords.lon.toFixed(5)}` }
          : current,
      );
    }
  }

  // ---------- lugares salvos ----------
  function defaultCategoryId() {
    // a categoria só vem escolhida para hospedagem; nos demais casos o usuário decide
    return pickingBase && categoriesById.has("hospedagem") ? "hospedagem" : "";
  }

  function buildSaved(place, categoryId) {
    return {
      id: place.id,
      externalId: place.externalId ?? null,
      name: place.name?.trim() || place.suggestedName || "Ponto no mapa",
      description: place.description ?? "",
      address: place.address ?? "",
      lat: place.lat,
      lon: place.lon,
      categoryId: categoriesById.has(categoryId) ? categoryId : "", // "" = sem categoria
      notes: place.notes ?? "",
      priority: false,
      visited: false,
      manual: Boolean(place.manual),
    };
  }

  function addPlaces(places, categoryId) {
    const fresh = places.filter((place) => !placeById.has(place.id));
    if (!fresh.length) return;
    updateTrip((current) => ({
      places: [...current.places, ...fresh.map((place) => buildSaved(place, categoryId))],
    }));
    say(
      fresh.length === 1
        ? `"${fresh[0].name}" foi adicionado ao roteiro.`
        : `${fresh.length} lugares adicionados ao roteiro.`,
    );
  }

  function setBase(place, categoryId) {
    const exists = placeById.has(place.id);
    const category = categoriesById.has("hospedagem") ? "hospedagem" : categoryId;
    updateTrip((current) => ({
      baseId: place.id,
      places: exists ? current.places : [...current.places, buildSaved(place, category)],
    }));
    setPickingBase(false);
    say(`"${place.name}" é sua hospedagem e fica no início da lista.`);
  }

  function clearBase() {
    updateTrip(() => ({ baseId: null }));
  }

  function startPickingBase() {
    setPickingBase(true);
    setDetail(null);
    searchInputRef.current?.focus();
  }

  function updatePlace(id, patch) {
    updateTrip((current) => ({
      places: current.places.map((place) => (place.id === id ? { ...place, ...patch } : place)),
    }));
  }

  function removePlace(id) {
    const removed = placeById.get(id);
    const wasBase = trip.baseId === id;
    if (removed) {
      say(`"${removed.name}" saiu do roteiro.`, {
        label: "Desfazer",
        run: () => {
          updateTrip((current) => ({
            places: current.places.some((place) => place.id === id)
              ? current.places
              : [...current.places, removed],
            baseId: wasBase ? id : current.baseId,
          }));
          setToast(null);
        },
      });
    }
    updateTrip((current) => ({
      places: current.places.filter((place) => place.id !== id),
      baseId: current.baseId === id ? null : current.baseId,
    }));
    setRoutePairs((current) => current.filter((pair) => pair.from !== id && pair.to !== id));
    setRouteOrigin((current) => (current === id ? null : current));
    setDetail(null);
  }

  function openPlace(place) {
    setDetail(place);
    setFocus({ lat: place.lat, lon: place.lon, key: Date.now() });
  }

  // Ícone de rota: 1º clique escolhe a origem, os próximos ligam/desligam a rota até cada destino.
  function routeClick(id) {
    // sem origem escolhida, clicar num ponto que já faz parte de uma rota remove as rotas dele
    if (!routeOrigin && routePairs.some((pair) => pair.from === id || pair.to === id)) {
      setRoutePairs(routePairs.filter((pair) => pair.from !== id && pair.to !== id));
      setAllFromBase(false);
      return;
    }
    if (!routeOrigin) {
      setRouteOrigin(id);
      say("Origem escolhida. Clique no ícone de rota de outro ponto para traçar o caminho.");
      return;
    }
    if (routeOrigin === id) {
      setRouteOrigin(null);
      return;
    }
    const exists = routePairs.some((pair) => pair.from === routeOrigin && pair.to === id);
    const next = exists
      ? routePairs.filter((pair) => !(pair.from === routeOrigin && pair.to === id))
      : [...routePairs, { from: routeOrigin, to: id }];
    setRoutePairs(next);
    if (!exists) fitPairs(next);
  }

  function fitPairs(pairs) {
    const ids = new Set(pairs.flatMap((pair) => [pair.from, pair.to]));
    const points = [...ids].map((id) => placeById.get(id)).filter(Boolean);
    if (points.length) setFitPoints(points);
  }

  // Atalho: hospedagem -> todos os outros pontos.
  function showAllRoutes() {
    if (!base) return;
    const next = trip.places
      .filter((place) => place.id !== base.id)
      .map((place) => ({ from: base.id, to: place.id }));
    setRoutePairs(next);
    setRouteOrigin(null);
    setAllFromBase(true);
    fitPairs(next);
  }

  function clearRoutes() {
    setRoutePairs([]);
    setRouteOrigin(null);
    setAllFromBase(false);
  }

  // Com "Hospedagem → todos" ligado, pontos novos entram nas rotas sozinhos.
  useEffect(() => {
    if (!allFromBase) return;
    if (!base) {
      setAllFromBase(false);
      return;
    }
    const wanted = trip.places.filter((place) => place.id !== base.id).map((place) => place.id);
    setRoutePairs((current) => {
      const kept = current.filter((pair) => pair.from !== base.id || wanted.includes(pair.to));
      const added = wanted
        .filter((id) => !kept.some((pair) => pair.from === base.id && pair.to === id))
        .map((id) => ({ from: base.id, to: id }));
      return added.length || kept.length !== current.length ? [...kept, ...added] : current;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allFromBase, base?.id, trip.places]);

  // Sugestão escolhida na barra de pesquisa: abre direto o card do lugar.
  function pickSuggestion(place) {
    addRecent(place);
    setSearchCategory(null);
    setFitPoints(null);
    setResults([place]);
    setDetail(place);
    setFocus({ lat: place.lat, lon: place.lon, key: Date.now() });
    if (!trip.destination) {
      updateTrip(() => ({ destination: { lat: place.lat, lon: place.lon, name: place.name } }));
    }
  }

  // ---------- compartilhar ----------
  const routedPairs = activePairs.filter((pair) => routes[pair.key]);

  function snapshotFor(options) {
    return buildSnapshot(trip, options, {
      mode,
      routes: routedPairs.map((pair) => ({
        from: pair.from.id,
        to: pair.to.id,
        time: routes[pair.key].time,
        distance: routes[pair.key].distance,
        path: routes[pair.key].path,
      })),
    });
  }

  async function createShareLink(options) {
    const data = await api("/api/shares", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ snapshot: snapshotFor(options) }),
    });
    return `${window.location.origin}/?s=${data.id}`;
  }

  function downloadShare(options, format) {
    const snapshot = snapshotFor(options);
    if (format === "kml") downloadKml(snapshot);
    else downloadSnapshot(snapshot);
    say(format === "kml" ? "KML baixado: importe no Google My Maps ou abra no Google Earth." : "Backup baixado.");
  }

  // Cria uma cópia da viagem recebida (link ou arquivo) como nova viagem do usuário.
  function importSnapshot(raw) {
    const snapshot = cleanSnapshot(raw);
    if (!snapshot) throw new Error("Esse arquivo não é uma viagem válida.");

    const created = {
      id: newId("trip"),
      name: `${snapshot.name} (recebida)`,
      destination: { lat: snapshot.places[0].lat, lon: snapshot.places[0].lon, name: snapshot.places[0].name },
      baseId: snapshot.baseId,
      categories: snapshot.categories.length ? snapshot.categories : defaultCategories(),
      places: snapshot.places,
    };

    // rotas já traçadas entram no cache e aparecem sem nova consulta
    const byId = new Map(snapshot.places.map((place) => [place.id, place]));
    const pairs = [];
    for (const route of snapshot.routes) {
      const from = byId.get(route.from);
      const to = byId.get(route.to);
      routeCache.current.set(`${snapshot.mode}|${from.lat},${from.lon}|${to.lat},${to.lon}`, {
        path: route.path,
        time: route.time,
        distance: route.distance,
      });
      pairs.push({ from: route.from, to: route.to });
    }

    setState((current) => ({ trips: [...current.trips, created], activeTripId: created.id }));
    resetExploration();
    setAllFromBase(false);
    setMode(snapshot.mode);
    setRoutePairs(pairs);
    setFitPoints(snapshot.places);

    const hasBase = snapshot.baseId && byId.has(snapshot.baseId);
    return [
      `${snapshot.places.length} ${snapshot.places.length === 1 ? "ponto" : "pontos"}`,
      hasBase ? `hospedagem “${byId.get(snapshot.baseId).name}”` : "sem hospedagem",
      `${snapshot.routes.length} ${snapshot.routes.length === 1 ? "rota" : "rotas"}`,
    ].join(", ");
  }

  async function importShareFile(file) {
    if (file.size > 6_000_000) throw new Error("Arquivo grande demais.");
    let raw;
    try {
      raw = JSON.parse(await file.text());
    } catch {
      throw new Error("Esse arquivo não é uma viagem válida.");
    }
    const summary = importSnapshot(raw);
    setShareOpen(false);
    say(`Viagem importada: ${summary}.`);
  }

  // Abrir um link de compartilhamento (/?s=ID) traz a viagem para as viagens do usuário.
  useEffect(() => {
    const id = new URLSearchParams(window.location.search).get("s");
    if (!id || sharedLoaded.current) return;
    sharedLoaded.current = true;
    api(`/api/shares/${encodeURIComponent(id)}`)
      .then((data) => say(`Viagem recebida e adicionada às suas viagens: ${importSnapshot(data)}.`))
      .catch((problem) => fail(problem.message))
      .finally(() => window.history.replaceState(null, "", window.location.pathname));
    // roda só uma vez, ao abrir a página
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ---------- categorias ----------
  function createCategory(name, color) {
    updateTrip((current) => ({
      categories: [
        ...current.categories,
        { id: newId("cat"), name, color: color || colorPalette[0], hidden: false },
      ],
    }));
  }

  function updateCategory(id, patch) {
    updateTrip((current) => ({
      categories: current.categories.map((category) =>
        category.id === id ? { ...category, ...patch } : category,
      ),
    }));
  }

  function deleteCategory(id) {
    if (trip.categories.length < 2) return;
    const fallback = trip.categories.find((category) => category.id !== id);
    const count = trip.places.filter((place) => place.categoryId === id).length;
    const category = categoriesById.get(id);
    const message = count
      ? `Excluir "${category.name}"? Os ${count} lugares dela vão para "${fallback.name}".`
      : `Excluir a categoria "${category.name}"?`;
    if (!window.confirm(message)) return;
    updateTrip((current) => ({
      categories: current.categories.filter((item) => item.id !== id),
      places: current.places.map((place) =>
        place.categoryId === id ? { ...place, categoryId: fallback.id } : place,
      ),
    }));
  }

  return (
    <main className="app">
      <div className="map-layer">
        <MapView
          key={trip.id}
          center={mapCenter}
          results={results}
          fitPoints={fitPoints}
          savedPlaces={visiblePlaces}
          categoriesById={categoriesById}
          colorByCategory={view === "type"}
          baseId={base?.id}
          focus={focus}
          detail={detailPlace}
          routeLines={activePairs
            .filter((pair) => routes[pair.key])
            .map((pair) => ({
              id: pair.key,
              place: pair.to,
              path: routes[pair.key].path,
              time: routes[pair.key].time,
              distance: routes[pair.key].distance,
              color:
                view === "type"
                  ? categoriesById.get(pair.to.categoryId)?.color ?? "#8b93a3"
                  : undefined,
            }))}
          onReady={handleMapReady}
          onMapClick={openLoosePoint}
          onSelect={(place) => setDetail(place)}
        />
      </div>

      <header className="topbar">
        <SearchBox
          value={searchText}
          onChange={setSearchText}
          onSubmit={submitSearch}
          onPick={pickSuggestion}
          getView={getView}
          loading={loading}
          inputRef={searchInputRef}
          placeholder={
            pickingBase
              ? "Endereço ou nome da hospedagem"
              : "Pesquise cidade, lugar, endereço ou coordenadas"
          }
        />

        <div className="chips">
          {searchCategories.map((item) => (
            <button
              key={item.id}
              className={`chip ${searchCategory === item.id ? "is-on" : ""}`}
              onClick={() => searchByCategory(item.id)}
              disabled={loading}
            >
              {item.label}
            </button>
          ))}
          {results.length > 0 && (
            <button className="chip chip-dark" onClick={clearResults}>
              {results.length} {results.length === 1 ? "resultado" : "resultados"}
              <CloseIcon size={14} />
            </button>
          )}
        </div>
      </header>

      <aside className="sidebar">
        <div className="side-head">
          <span className="brand">rota</span>
          <button className="share-btn" onClick={() => setShareOpen(true)}>
            <ShareIcon size={16} /> Compartilhar
          </button>
        </div>
        <TripBar
          key={trip.id}
          trips={state.trips}
          trip={trip}
          onSwitch={switchTrip}
          onAdd={addTrip}
          onRename={(name) => updateTrip(() => ({ name }))}
          onDelete={deleteTrip}
        />

        <SavedPanel
          categories={trip.categories}
          places={trip.places}
          base={base}
          pickingBase={pickingBase}
          distances={distances}
          distanceLoading={distanceLoading}
          mode={mode}
          selectedId={detail?.id}
          view={view}
          routePairs={routePairs}
          routeOrigin={routeOrigin}
          routeLoading={routeLoading}
          onView={setView}
          onShowAllRoutes={showAllRoutes}
          onClearRoutes={clearRoutes}
          onMode={setMode}
          onPickBase={startPickingBase}
          onCancelPickBase={() => setPickingBase(false)}
          onClearBase={() => base && removePlace(base.id)}
          onOpen={openPlace}
          onToggleRoute={routeClick}
          onRemovePlace={removePlace}
          onCreateCategory={createCategory}
          onUpdateCategory={updateCategory}
          onDeleteCategory={deleteCategory}
        />
      </aside>

      {detailPlace && (
        <PlaceCard
          key={detailPlace.id}
          place={detailPlace}
          saved={placeById.has(detailPlace.id)}
          isBase={detailPlace.id === base?.id}
          base={base}
          categories={trip.categories}
          defaultCategoryId={defaultCategoryId()}
          pickingBase={pickingBase}
          distance={distances[detailPlace.id]}
          routeActive={routePairs.some((pair) => pair.from === routeOrigin && pair.to === detailPlace.id)}
          routeOrigin={routeOrigin ? placeById.get(routeOrigin) : null}
          onClose={() => setDetail(null)}
          onAdd={(draft) =>
            addPlaces([{ ...detailPlace, name: draft.name, notes: draft.notes }], draft.categoryId)
          }
          onSetBase={(draft) =>
            setBase({ ...detailPlace, name: draft.name, notes: draft.notes }, draft.categoryId)
          }
          onClearBase={clearBase}
          onSave={(draft) => {
            updatePlace(detailPlace.id, {
              name: draft.name.trim() || detailPlace.name,
              categoryId: draft.categoryId,
              notes: draft.notes,
            });
            say("Alterações salvas.");
          }}
          onRemove={() => removePlace(detailPlace.id)}
          onToggleRoute={() => routeClick(detailPlace.id)}
        />
      )}

      {shareOpen && (
        <ShareDialog
          trip={trip}
          routeCount={routedPairs.length}
          onClose={() => setShareOpen(false)}
          onCreateLink={createShareLink}
          onDownload={downloadShare}
          onImportFile={importShareFile}
        />
      )}

      {toast && (
        <div className={`toast ${toast.type === "error" ? "is-error" : ""}`} role="status">
          <span>{toast.text}</span>
          {toast.action && (
            <button className="toast-action" onClick={toast.action.run}>{toast.action.label}</button>
          )}
          <button className="toast-close" onClick={() => setToast(null)} aria-label="Fechar aviso">
            <CloseIcon size={14} />
          </button>
        </div>
      )}
    </main>
  );
}

export default App;
