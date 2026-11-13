import { Fragment, useEffect, useMemo } from "react";
import {
  CircleMarker,
  MapContainer,
  Marker,
  Polyline,
  TileLayer,
  Tooltip,
  useMap,
  useMapEvents,
} from "react-leaflet";
import L from "leaflet";
import { MinusIcon, PlusIcon, homeIconMarkup } from "./Icons.jsx";
import { ACCENT, BASE_COLOR, WARM, formatDistance, formatDuration } from "./lib.js";

const iconCache = new Map();
const isHex = (value) => /^#[0-9a-f]{6}$/i.test(value);

// Ponto na metade do comprimento do trajeto, onde fica o bloquinho de tempo.
function pathMidpoint(lines) {
  const points = lines.flat();
  if (points.length < 2) return points[0] ?? null;
  const segments = [];
  let total = 0;
  for (let index = 1; index < points.length; index += 1) {
    const length = L.latLng(points[index - 1]).distanceTo(L.latLng(points[index]));
    segments.push(length);
    total += length;
  }
  let remaining = total / 2;
  for (let index = 0; index < segments.length; index += 1) {
    if (remaining <= segments[index]) {
      const ratio = segments[index] ? remaining / segments[index] : 0;
      const [fromLat, fromLon] = points[index];
      const [toLat, toLon] = points[index + 1];
      return [fromLat + (toLat - fromLat) * ratio, fromLon + (toLon - fromLon) * ratio];
    }
    remaining -= segments[index];
  }
  return points[points.length - 1];
}

function routeLabelIcon(line, active) {
  const color = isHex(line.color) ? line.color : ACCENT;
  return L.divIcon({
    className: "route-label-wrap",
    html: `<span class="route-label ${active ? "is-active" : ""}" style="--route-color:${color}"><b>${formatDuration(
      line.time,
    )}</b><small>${formatDistance(line.distance)}</small></span>`,
    iconSize: [0, 0],
  });
}

// Marcador permanente; a hospedagem é um círculo grafite com a casa.
function pinFor(color, isBase) {
  const safeColor = isHex(color) ? color : ACCENT;
  const key = isBase ? "base" : safeColor;
  if (!iconCache.has(key)) {
    iconCache.set(
      key,
      isBase
        ? L.divIcon({
            className: "pin-wrap",
            html: `<span class="pin-base" style="background:${BASE_COLOR}">${homeIconMarkup}</span>`,
            iconSize: [36, 36],
            iconAnchor: [18, 18],
          })
        : L.divIcon({
            className: "pin-wrap",
            html: `<span class="pin-dot" style="background:${safeColor}"></span>`,
            iconSize: [20, 20],
            iconAnchor: [10, 10],
          }),
    );
  }
  return iconCache.get(key);
}

function MapController({ fitPoints, focus, onReady }) {
  const map = useMap();

  useEffect(() => {
    onReady(map);
  }, [map, onReady]);

  useEffect(() => {
    if (!fitPoints?.length) return;
    const bounds = L.latLngBounds(fitPoints.map((place) => [place.lat, place.lon]));
    // reserva espaço para o painel lateral e a barra de busca flutuantes
    map.fitBounds(bounds, {
      paddingTopLeft: [420, 100],
      paddingBottomRight: [80, 60],
      maxZoom: 15,
    });
  }, [fitPoints, map]);

  useEffect(() => {
    if (focus) map.flyTo([focus.lat, focus.lon], Math.max(map.getZoom(), 15), { duration: 0.8 });
  }, [focus, map]);

  return null;
}

function ZoomControls() {
  const map = useMap();

  return (
    <div className="zoom">
      <button aria-label="Aproximar" onClick={() => map.zoomIn()}><PlusIcon size={18} /></button>
      <button aria-label="Afastar" onClick={() => map.zoomOut()}><MinusIcon size={18} /></button>
    </div>
  );
}

function MapClickHandler({ onMapClick }) {
  useMapEvents({
    click(event) {
      onMapClick({ lat: event.latlng.lat, lon: event.latlng.lng });
    },
  });

  return null;
}

export default function MapView({
  center,
  results,
  fitPoints,
  savedPlaces,
  categoriesById,
  colorByCategory,
  baseId,
  focus,
  detail,
  routeLines,
  onReady,
  onMapClick,
  onSelect,
}) {
  const savedIds = useMemo(() => new Set(savedPlaces.map((place) => place.id)), [savedPlaces]);
  const temporary = results.filter((place) => !savedIds.has(place.id));
  const detailIsLoose =
    detail && !savedIds.has(detail.id) && !results.some((place) => place.id === detail.id);

  return (
    <MapContainer center={center} zoom={13} zoomControl={false}>
      <MapController fitPoints={fitPoints} focus={focus} onReady={onReady} />
      <MapClickHandler onMapClick={onMapClick} />
      <TileLayer
        attribution='&copy; <a href="https://www.geoapify.com/">Geoapify</a> &copy; <a href="https://openmaptiles.org/">OpenMapTiles</a> &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        url="/api/tiles/{z}/{x}/{y}.png"
        maxZoom={19}
      />

      {/* uma linha por rota, com o tempo no meio */}
      {routeLines.map((line) => {
        const active = detail?.id === line.place.id;
        const dimmed = detail && routeLines.some((other) => other.place.id === detail.id) && !active;
        const midpoint = pathMidpoint(line.path);
        return (
          <Fragment key={`route-${line.id}`}>
            <Polyline
              positions={line.path}
              pathOptions={{
                color: isHex(line.color) ? line.color : ACCENT,
                weight: active ? 7 : 5,
                opacity: dimmed ? 0.4 : 0.95,
                bubblingMouseEvents: false,
              }}
              eventHandlers={{ click: () => onSelect(line.place) }}
            />
            {midpoint && (
              <Marker
                position={midpoint}
                icon={routeLabelIcon(line, active)}
                zIndexOffset={active ? 900 : 500}
                eventHandlers={{ click: () => onSelect(line.place) }}
              />
            )}
          </Fragment>
        );
      })}

      {/* resultados da pesquisa: pontos vazados, ainda não são do roteiro */}
      {temporary.map((place) => {
        const active = detail?.id === place.id;
        return (
          <CircleMarker
            key={`found-${place.id}`}
            center={[place.lat, place.lon]}
            radius={8}
            pathOptions={{
              color: ACCENT,
              weight: 3,
              fillColor: active ? ACCENT : "#fff",
              fillOpacity: 1,
            }}
            eventHandlers={{ click: () => onSelect(place) }}
          >
            <Tooltip direction="top" offset={[0, -6]}>{place.name}</Tooltip>
          </CircleMarker>
        );
      })}

      {/* pontos do roteiro */}
      {savedPlaces.map((place) => (
        <Marker
          key={`saved-${place.id}`}
          position={[place.lat, place.lon]}
          icon={pinFor(
            colorByCategory ? categoriesById.get(place.categoryId)?.color ?? "#8b93a3" : ACCENT,
            place.id === baseId,
          )}
          zIndexOffset={place.id === baseId ? 1000 : 0}
          eventHandlers={{ click: () => onSelect(place) }}
        >
          <Tooltip direction="top" offset={[0, place.id === baseId ? -14 : -8]}>{place.name}</Tooltip>
        </Marker>
      ))}

      {/* ponto clicado no mapa, ainda não salvo */}
      {detailIsLoose && (
        <CircleMarker
          center={[detail.lat, detail.lon]}
          radius={9}
          pathOptions={{ color: "#fff", weight: 3, fillColor: WARM, fillOpacity: 1 }}
        />
      )}
      <ZoomControls />
    </MapContainer>
  );
}
