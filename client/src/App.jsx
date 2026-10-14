import { useEffect, useState } from "react";
import {
  CircleMarker,
  MapContainer,
  Marker,
  Popup,
  TileLayer,
  useMap,
  useMapEvents,
} from "react-leaflet";
import L from "leaflet";

const categories = [
  { id: "tourism", label: "Atrações", icon: "✦" },
  { id: "catering.restaurant", label: "Restaurantes", icon: "⌂" },
  { id: "accommodation.hotel", label: "Hotéis", icon: "▰" },
  { id: "leisure.park", label: "Parques", icon: "♧" },
];

const pinIcon = L.divIcon({
  className: "custom-pin",
  html: '<span class="pin-dot"></span>',
  iconSize: [22, 22],
  iconAnchor: [11, 11],
});

function MapController({ center }) {
  const map = useMap();

  useEffect(() => {
    if (center) map.flyTo([center.lat, center.lon], 14, { duration: 1.2 });
  }, [center, map]);

  return null;
}

function ZoomControls() {
  const map = useMap();

  return (
    <div className="map-zoom-controls">
      <button aria-label="Aproximar" onClick={() => map.zoomIn()}>＋</button>
      <button aria-label="Afastar" onClick={() => map.zoomOut()}>−</button>
    </div>
  );
}

function MapClickHandler({ onMapClick }) {
  useMapEvents({
    click(event) {
      onMapClick({
        lat: event.latlng.lat,
        lon: event.latlng.lng,
      });
    },
  });

  return null;
}

function App() {
  const [destinationInput, setDestinationInput] = useState("");
  const [destination, setDestination] = useState(null);
  const [category, setCategory] = useState(categories[0].id);
  const [places, setPlaces] = useState([]);
  const [savedPlaces, setSavedPlaces] = useState([]);
  const [pendingPoint, setPendingPoint] = useState(null);
  const [pointName, setPointName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  async function searchDestination(event) {
    event.preventDefault();
    if (!destinationInput.trim()) return;

    setLoading(true);
    setError("");
    setNotice("");
    setPlaces([]);
    try {
      const response = await fetch(
        `/api/geocode?text=${encodeURIComponent(destinationInput.trim())}`,
      );
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Não foi possível pesquisar.");

      setDestination(data);
      setDestinationInput(data.name);
      setNotice("Destino encontrado. Escolha uma categoria para explorar a região.");
    } catch (searchError) {
      setError(searchError.message);
    } finally {
      setLoading(false);
    }
  }

  async function searchPlaces(nextCategory = category) {
    if (!destination) {
      setError("Pesquise um destino antes de procurar lugares.");
      return;
    }

    setCategory(nextCategory);
    setLoading(true);
    setError("");
    setNotice("");
    try {
      const params = new URLSearchParams({
        lat: String(destination.lat),
        lon: String(destination.lon),
        category: nextCategory,
      });
      const response = await fetch(`/api/places?${params}`);
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Não foi possível buscar lugares.");

      setPlaces(data);
      setNotice(
        data.length
          ? `${data.length} lugares encontrados perto de ${destination.name}.`
          : "Nenhum lugar encontrado nessa categoria. Tente outra.",
      );
    } catch (searchError) {
      setError(searchError.message);
    } finally {
      setLoading(false);
    }
  }

  function toggleSaved(place) {
    setSavedPlaces((current) =>
      current.some((saved) => saved.id === place.id)
        ? current.filter((saved) => saved.id !== place.id)
        : [...current, place],
    );
  }

  function startAddingPoint(coords) {
    setPendingPoint(coords);
    setPointName("");
    setError("");
  }

  function saveManualPoint(event) {
    event.preventDefault();
    const name = pointName.trim();
    if (!name || !pendingPoint) return;

    setSavedPlaces((current) => [
      ...current,
      {
        id: `manual-${Date.now()}`,
        name,
        address: "Ponto marcado no mapa",
        category: "personalizado",
        lat: pendingPoint.lat,
        lon: pendingPoint.lon,
        manual: true,
      },
    ]);
    setPendingPoint(null);
    setNotice(`"${name}" foi adicionado aos seus lugares salvos.`);
  }

  const center = destination
    ? [destination.lat, destination.lon]
    : [-8.5026, -35.0048];

  return (
    <main className="app-shell">
      <header className="topbar">
        <a className="brand" href="/" aria-label="Rota, início">
          <span className="brand-mark">r</span>
          <span>rota<span className="brand-period">.</span></span>
        </a>
        <div className="topbar-caption">SEU PRÓXIMO LUGAR FAVORITO</div>
        <div className="saved-counter">
          <span className="saved-counter-icon">♡</span>
          <span>{savedPlaces.length} salvos</span>
        </div>
      </header>

      <section className="workspace">
        <aside className="sidebar">
          <div className="sidebar-heading">
            <div className="eyebrow">COMECE A EXPLORAR</div>
            <h1>Para onde<br />vamos?</h1>
            <p>Encontre lugares especiais e guarde suas ideias para a viagem.</p>
          </div>

          <form className="destination-form" onSubmit={searchDestination}>
            <label htmlFor="destination">Seu destino</label>
            <div className="search-control">
              <span className="search-icon" aria-hidden="true">⌕</span>
              <input
                id="destination"
                value={destinationInput}
                onChange={(event) => setDestinationInput(event.target.value)}
                placeholder="Ex.: Porto de Galinhas"
              />
              <button type="submit" aria-label="Pesquisar destino" disabled={loading}>
                →
              </button>
            </div>
          </form>

          {destination && (
            <div className="destination-summary">
              <span className="destination-pin">⌖</span>
              <div>
                <strong>{destination.name}</strong>
                <span>{destination.address}</span>
              </div>
            </div>
          )}

          <div className="explore-section">
            <div className="section-title-row">
              <h2>Explore por categoria</h2>
              <span className="section-sparkle">✳</span>
            </div>
            <div className="category-list">
              {categories.map((item) => (
                <button
                  className={`category-button ${category === item.id ? "active" : ""}`}
                  key={item.id}
                  onClick={() => searchPlaces(item.id)}
                  disabled={loading}
                >
                  <span className="category-icon">{item.icon}</span>
                  <span>{item.label}</span>
                  <span className="category-arrow">↗</span>
                </button>
              ))}
            </div>
            <button
              className="map-add-button"
              onClick={() => {
                setPendingPoint(null);
                setPointName("");
                setNotice("Clique em um ponto do mapa para adicionar um local.");
                setError("");
              }}
            >
              <span>＋</span> Adicionar local no mapa
            </button>
            <p className="map-hint">Ou clique diretamente no mapa para marcar um ponto.</p>
          </div>

          <div className="places-section">
            <div className="section-title-row places-title">
              <h2>{places.length ? "Lugares encontrados" : "Sua lista de ideias"}</h2>
              <span className="list-count">{places.length || savedPlaces.length}</span>
            </div>
            {places.length ? (
              <div className="places-list">
                {places.map((place) => {
                  const saved = savedPlaces.some((item) => item.id === place.id);
                  return (
                    <article className="place-card" key={place.id}>
                      <span className="place-card-mark">⌖</span>
                      <div className="place-card-content">
                        <strong>{place.name}</strong>
                        <span>{place.address || "Endereço não informado"}</span>
                      </div>
                      <button
                        className={`save-button ${saved ? "is-saved" : ""}`}
                        onClick={() => toggleSaved(place)}
                        aria-label={saved ? "Remover dos salvos" : "Salvar lugar"}
                        title={saved ? "Remover dos salvos" : "Salvar lugar"}
                      >
                        {saved ? "♥" : "♡"}
                      </button>
                    </article>
                  );
                })}
              </div>
            ) : savedPlaces.length ? (
              <div className="places-list">
                {savedPlaces.map((place) => (
                  <article className="place-card saved-card" key={place.id}>
                    <span className="place-card-mark">⌖</span>
                    <div className="place-card-content">
                      <strong>{place.name}</strong>
                      <span>{place.address || "Ponto salvo"}</span>
                    </div>
                    <button
                      className="save-button is-saved"
                      onClick={() => toggleSaved(place)}
                      aria-label="Remover dos salvos"
                    >
                      ♥
                    </button>
                  </article>
                ))}
              </div>
            ) : (
              <div className="empty-state">
                <span className="empty-state-icon">✳</span>
                <p>Seus lugares salvos aparecem aqui.</p>
                <span>Pesquise um destino para começar.</span>
              </div>
            )}
          </div>

          {pendingPoint && (
            <form className="point-form" onSubmit={saveManualPoint}>
              <label htmlFor="point-name">Nome deste local</label>
              <div className="point-form-row">
                <input
                  id="point-name"
                  autoFocus
                  value={pointName}
                  onChange={(event) => setPointName(event.target.value)}
                  placeholder="Ex.: Hotel, aeroporto..."
                />
                <button type="submit" disabled={!pointName.trim()}>Salvar</button>
              </div>
              <button
                type="button"
                className="cancel-point"
                onClick={() => setPendingPoint(null)}
              >
                Cancelar
              </button>
            </form>
          )}

          {(error || notice) && (
            <div className={`feedback ${error ? "feedback-error" : ""}`} role="status">
              {error || notice}
            </div>
          )}
          {loading && <div className="loading-note">Buscando...</div>}
        </aside>

        <section className="map-panel" aria-label="Mapa do destino">
          <div className="map-toolbar">
            <div className="map-location">
              <span className="map-location-dot" />
              <span>{destination?.name || "Porto de Galinhas, PE"}</span>
            </div>
            <button
              className="map-action"
              onClick={() => {
                setPendingPoint(null);
                setNotice("Clique em um ponto do mapa para adicionar um local.");
              }}
            >
              <span>＋</span> Marcar ponto
            </button>
          </div>
          <MapContainer center={center} zoom={13} zoomControl={false}>
            <MapController center={destination} />
            <MapClickHandler onMapClick={startAddingPoint} />
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
            {destination && (
              <Marker position={[destination.lat, destination.lon]} icon={pinIcon}>
                <Popup>{destination.name}</Popup>
              </Marker>
            )}
            {places
              .filter((place) => !savedPlaces.some((saved) => saved.id === place.id))
              .map((place) => (
              <CircleMarker
                key={place.id}
                center={[place.lat, place.lon]}
                radius={7}
                pathOptions={{ color: "#fff", weight: 2, fillColor: "#397466", fillOpacity: 1 }}
              >
                <Popup>
                  <strong>{place.name}</strong>
                  <br />
                  {place.address}
                </Popup>
              </CircleMarker>
              ))}
            {savedPlaces.map((place) => (
              <Marker
                key={`saved-${place.id}`}
                position={[place.lat, place.lon]}
                icon={pinIcon}
              >
                <Popup>
                  <strong>{place.name}</strong>
                  <br />
                  {place.address}
                </Popup>
              </Marker>
            ))}
            {pendingPoint && (
              <CircleMarker
                center={[pendingPoint.lat, pendingPoint.lon]}
                radius={9}
                pathOptions={{ color: "#fff", weight: 3, fillColor: "#e58a58", fillOpacity: 1 }}
              />
            )}
            <ZoomControls />
          </MapContainer>
          <div className="map-legend">
            <span><i className="legend-dot found-dot" /> Lugares encontrados</span>
            <span><i className="legend-dot saved-dot" /> Lugares salvos</span>
          </div>
        </section>
      </section>
    </main>
  );
}

export default App;
