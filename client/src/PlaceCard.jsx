import { useEffect, useState } from "react";
import Dropdown from "./Dropdown.jsx";
import { CloseIcon, HomeIcon, PlusIcon, RouteIcon } from "./Icons.jsx";
import { formatDistance, formatDuration, straightDistance } from "./lib.js";

const photoCache = new Map();

function usePhoto(place) {
  const key = place.id;
  const [photo, setPhoto] = useState(photoCache.get(key) ?? null);

  useEffect(() => {
    if (photoCache.has(key)) {
      setPhoto(photoCache.get(key));
      return undefined;
    }
    setPhoto(null);
    if (!place.name?.trim()) return undefined; // ponto sem título ainda: sem foto
    const controller = new AbortController();
    const params = new URLSearchParams({
      name: place.name,
      lat: String(place.lat),
      lon: String(place.lon),
    });
    fetch(`/api/photo?${params}`, { signal: controller.signal })
      .then((response) => response.json())
      .then((data) => {
        const value = data.url ? data : { url: null };
        photoCache.set(key, value);
        setPhoto(value);
      })
      .catch(() => {});
    return () => controller.abort();
    // name/lat/lon identificam o lugar junto com o id
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  return photo?.url ? photo : null;
}

export default function PlaceCard({
  place,
  saved,
  isBase,
  base,
  categories,
  defaultCategoryId,
  pickingBase,
  distance,
  routeActive,
  routeOrigin,
  onClose,
  onAdd,
  onSave,
  onSetBase,
  onClearBase,
  onRemove,
  onToggleRoute,
}) {
  const photo = usePhoto(place);
  const validId = (id) => (categories.some((category) => category.id === id) ? id : "");
  // Rascunho: nada é gravado até clicar em "Salvar" (ou "Adicionar").
  const [draft, setDraft] = useState({
    name: place.name ?? "",
    categoryId: validId(saved ? place.categoryId : defaultCategoryId),
    notes: place.notes ?? "",
  });
  const change = (patch) => setDraft((current) => ({ ...current, ...patch }));

  const loose = !saved && place.manual;
  const displayName = draft.name.trim() || place.suggestedName || "este lugar";
  const straight = base && !isBase ? straightDistance(base, place) : null;
  const dirty =
    saved &&
    ((draft.name.trim() || place.name) !== place.name ||
      draft.categoryId !== validId(place.categoryId) ||
      draft.notes !== (place.notes ?? ""));

  return (
    <aside className={`place-card ${photo ? "has-photo" : ""}`} aria-label={`Detalhes de ${displayName}`}>
      <button className="icon-btn card-close" onClick={onClose} aria-label="Fechar">
        <CloseIcon size={16} />
      </button>

      {photo && (
        <figure className="card-photo">
          <img src={photo.url} alt={place.name} />
          <figcaption>
            Foto: <a href={photo.pageUrl} target="_blank" rel="noreferrer">Wikipédia</a>
          </figcaption>
        </figure>
      )}

      <div className="card-body">
        <label className="field">
          {isBase ? "Título da hospedagem" : "Título"}
          <input
            className="input input-title"
            value={draft.name}
            autoFocus={loose}
            onChange={(event) => change({ name: event.target.value })}
            placeholder={
              loose
                ? place.suggestedName
                  ? `Ex.: Hotel, Casa da Maria (${place.suggestedName})`
                  : "Ex.: Hotel, Casa da Maria, Aeroporto"
                : "Dê um nome a este lugar"
            }
          />
        </label>
        <p className="card-address">{place.address || place.description || "Endereço não informado"}</p>

        {saved && base && !isBase && (
          <div className="card-distance">
            {distance ? (
              <>
                <strong>{formatDistance(distance.distance)}</strong>
                <span> · {formatDuration(distance.time)} pela rota desde a hospedagem</span>
              </>
            ) : (
              <span>Calculando rota…</span>
            )}
            <small>Em linha reta: {formatDistance(straight)}</small>
          </div>
        )}

        <div className="field">
          Categoria
          <Dropdown
            ariaLabel="Categoria"
            value={draft.categoryId}
            placeholder="Selecione uma categoria"
            options={[
              { value: "", label: saved ? "Sem categoria" : "Selecione uma categoria" },
              ...categories.map((category) => ({ value: category.id, label: category.name })),
            ]}
            onChange={(categoryId) => change({ categoryId })}
          />
        </div>

        <label className="field">
          Descrição
          <textarea
            className="input"
            rows={2}
            value={draft.notes}
            onChange={(event) => change({ notes: event.target.value })}
            placeholder="Horários, dicas, reservas..."
          />
        </label>

        <div className="card-actions">
          {dirty && (
            <div className="button-row">
              <button className="btn btn-primary" onClick={() => onSave(draft)}>Salvar alterações</button>
              <button
                className="btn"
                onClick={() =>
                  setDraft({
                    name: place.name,
                    categoryId: validId(place.categoryId),
                    notes: place.notes ?? "",
                  })
                }
              >
                Descartar
              </button>
            </div>
          )}

          {!saved && (
            <button
              className={`btn btn-block ${pickingBase ? "" : "btn-primary"}`}
              onClick={() => onAdd(draft)}
            >
              <PlusIcon size={16} /> Adicionar ao roteiro
            </button>
          )}

          {isBase ? (
            <button className="btn btn-block" onClick={onClearBase}>Remover como hospedagem</button>
          ) : (
            <button
              className={`btn btn-block ${pickingBase ? "btn-primary" : ""}`}
              onClick={() => onSetBase(draft)}
            >
              <HomeIcon size={16} /> Definir como hospedagem
            </button>
          )}

          {saved && (
            <button className="btn btn-block" onClick={onToggleRoute}>
              <RouteIcon size={16} />
              {routeOrigin?.id === place.id
                ? "Cancelar origem da rota"
                : routeOrigin
                  ? `${routeActive ? "Ocultar" : "Traçar"} rota de ${routeOrigin.name} até aqui`
                  : "Traçar rota a partir daqui"}
            </button>
          )}

          {saved && (
            <button className="link-danger" onClick={onRemove}>Excluir do roteiro</button>
          )}
        </div>
      </div>
    </aside>
  );
}
