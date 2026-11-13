import { useState } from "react";
import { CloseIcon, EyeIcon, EyeOffIcon, HomeIcon, PlusIcon, RouteIcon, TrashIcon } from "./Icons.jsx";
import { ACCENT, colorPalette, formatDistance, formatDuration } from "./lib.js";

const modes = [
  { id: "drive", label: "Carro" },
  { id: "walk", label: "A pé" },
  { id: "bicycle", label: "Bicicleta" },
];

function CategoryForm({ onCreate }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [color, setColor] = useState(colorPalette[0]);

  function submit(event) {
    event.preventDefault();
    if (!name.trim()) return;
    onCreate(name.trim(), color);
    setName("");
    setOpen(false);
  }

  if (!open) {
    return (
      <button className="map-add-button" onClick={() => setOpen(true)}>
        <PlusIcon size={15} /> Criar categoria
      </button>
    );
  }

  return (
    <form className="point-form" onSubmit={submit}>
      <label htmlFor="category-name">Nome da categoria</label>
      <input
        id="category-name"
        autoFocus
        value={name}
        onChange={(event) => setName(event.target.value)}
        placeholder="Ex.: Quero conhecer"
      />
      <div className="swatches">
        {colorPalette.map((swatch) => (
          <button
            type="button"
            key={swatch}
            className={`swatch ${swatch === color ? "is-active" : ""}`}
            style={{ background: swatch }}
            aria-label={`Cor ${swatch}`}
            onClick={() => setColor(swatch)}
          />
        ))}
      </div>
      <div className="point-form-row">
        <button type="submit" disabled={!name.trim()}>Criar</button>
        <button type="button" className="cancel-point" onClick={() => setOpen(false)}>
          Cancelar
        </button>
      </div>
    </form>
  );
}

function BaseCard({ base, pickingBase, onPick, onCancelPick, onClear, onLocate }) {
  if (pickingBase) {
    return (
      <section className="base-card is-picking">
        <div className="base-card-title"><HomeIcon size={16} /> Onde você vai ficar?</div>
        <p>Pesquise o endereço na barra acima ou clique no mapa e escolha “Definir como hospedagem”.</p>
        <button className="cancel-point" onClick={onCancelPick}>Cancelar</button>
      </section>
    );
  }

  if (!base) {
    return (
      <section className="base-card">
        <div className="base-card-title"><HomeIcon size={16} /> Onde você vai ficar?</div>
        <p>Defina a hospedagem ou a casa e veja a distância por rota até cada ponto da viagem.</p>
        <button className="base-cta" onClick={onPick}>
          <PlusIcon size={16} /> Adicionar hospedagem
        </button>
      </section>
    );
  }

  return (
    <section className="base-card has-base">
      <div className="base-card-title"><HomeIcon size={16} /> Sua hospedagem</div>
      <button className="base-name" onClick={onLocate}>{base.name}</button>
      {base.address && <p className="base-address">{base.address}</p>}
      <div className="base-actions">
        <button className="cancel-point" onClick={onPick}>Trocar hospedagem</button>
        <button className="cancel-point" onClick={onClear}>Excluir hospedagem</button>
      </div>
    </section>
  );
}

function PlaceRow({ place, color, isBase, base, distance, distanceLoading, selected, routeState, showDot, onOpen, onToggleRoute, onRemove }) {
  return (
    <article className={`saved-card ${selected ? "is-selected" : ""} ${isBase ? "is-base" : ""}`}>
      {isBase ? (
        <i className="row-base"><HomeIcon size={12} /></i>
      ) : (
        showDot && <i className="row-dot" style={{ background: color }} />
      )}
      <button className="saved-card-name" onClick={onOpen}>
        <span>{place.visited ? "✓ " : ""}{place.name}</span>
        {isBase && <small className="base-badge">Hospedagem</small>}
        {base && !isBase && (
          <small className="distance-badge">
            {distance
              ? `${formatDistance(distance.distance)} · ${formatDuration(distance.time)}`
              : distanceLoading
                ? "calculando…"
                : "—"}
          </small>
        )}
      </button>
      <button
        className={`route-toggle ${routeState ? `is-${routeState}` : ""}`}
        style={routeState === "on" && color !== ACCENT ? { background: color, borderColor: color } : undefined}
        onClick={onToggleRoute}
        title={
          routeState === "origin"
            ? "Origem da rota: clique para cancelar"
            : routeState === "on"
              ? "Ocultar esta rota"
              : "Traçar rota (clique na origem e depois no destino)"
        }
        aria-pressed={routeState === "on" || routeState === "origin"}
        aria-label="Traçar rota"
      >
        <RouteIcon size={16} />
      </button>
      <button
        className="mini-button remove-place"
        onClick={onRemove}
        title="Excluir do roteiro"
        aria-label={`Excluir ${place.name} do roteiro`}
      >
        <TrashIcon size={16} />
      </button>
    </article>
  );
}

export default function SavedPanel({
  categories,
  places,
  base,
  pickingBase,
  distances,
  distanceLoading,
  mode,
  selectedId,
  view,
  routePairs,
  routeOrigin,
  routeLoading,
  onView,
  onShowAllRoutes,
  onClearRoutes,
  onMode,
  onPickBase,
  onCancelPickBase,
  onClearBase,
  onOpen,
  onToggleRoute,
  onRemovePlace,
  onCreateCategory,
  onUpdateCategory,
  onDeleteCategory,
}) {
  // a hospedagem entra na lista como qualquer outro ponto, sempre em primeiro
  const ordered = base ? [base, ...places.filter((place) => place.id !== base.id)] : places;
  // tudo azul; as cores das categorias só aparecem na visão "Por categoria"
  const colorOf = (place) =>
    view === "type"
      ? categories.find((category) => category.id === place.categoryId)?.color ?? "#6c7a74"
      : ACCENT;
  const uncategorized = ordered.filter(
    (place) =>
      place.id !== base?.id && !categories.some((category) => category.id === place.categoryId),
  );
  const others = ordered.filter((place) => place.id !== base?.id);
  const allShown =
    Boolean(base) &&
    others.length > 0 &&
    others.every((place) => routePairs.some((pair) => pair.from === base.id && pair.to === place.id));

  // com origem escolhida, marca os destinos dela; sem origem, marca todo ponto que faz parte de alguma rota
  const routeStateOf = (id) => {
    if (routeOrigin === id) return "origin";
    if (routeOrigin) {
      return routePairs.some((pair) => pair.from === routeOrigin && pair.to === id) ? "on" : "";
    }
    return routePairs.some((pair) => pair.from === id || pair.to === id) ? "on" : "";
  };

  const renderRow = (place, showDot) => (
    <PlaceRow
      key={place.id}
      place={place}
      color={colorOf(place)}
      isBase={place.id === base?.id}
      base={base}
      showDot={showDot}
      distance={distances[place.id]}
      distanceLoading={distanceLoading}
      selected={selectedId === place.id}
      routeState={routeStateOf(place.id)}
      onOpen={() => onOpen(place)}
      onToggleRoute={() => onToggleRoute(place.id)}
      onRemove={() => onRemovePlace(place.id)}
    />
  );

  return (
    <div className="saved-panel">
      <BaseCard
        base={base}
        pickingBase={pickingBase}
        onPick={onPickBase}
        onCancelPick={onCancelPickBase}
        onClear={onClearBase}
        onLocate={() => onOpen(base)}
      />

      {places.length > 1 && (
        <>
          <div className="mode-row">
            {modes.map((item) => (
              <button
                key={item.id}
                className={`mode-button ${mode === item.id ? "active" : ""}`}
                onClick={() => onMode(item.id)}
              >
                {item.label}
              </button>
            ))}
          </div>
          <div className="route-actions">
            {base && (
              <button className={`route-all ${allShown ? "is-active" : ""}`} onClick={onShowAllRoutes}>
                Hospedagem → todos
              </button>
            )}
            {(routePairs.length > 0 || routeOrigin) && (
              <button className="cancel-point" onClick={onClearRoutes}>Limpar rotas</button>
            )}
            {routeLoading && <span className="route-loading">traçando…</span>}
          </div>
          <p className="route-hint">
            {routeOrigin
              ? "Escolha o destino: clique no ícone de rota de outro ponto."
              : "Para traçar uma rota entre dois pontos, clique no ícone de rota do primeiro e depois do segundo."}
          </p>
        </>
      )}

      {places.length > 0 && (
        <div className="view-toggle" role="group" aria-label="Organizar lista">
          <button className={view === "all" ? "active" : ""} onClick={() => onView("all")}>
            Tudo <span className="list-count">{places.length}</span>
          </button>
          <button className={view === "type" ? "active" : ""} onClick={() => onView("type")}>
            Por categoria
          </button>
        </div>
      )}

      {places.length === 0 && (
        <div className="empty-state">
          <p>Nada escolhido ainda.</p>
          <span>Pesquise no topo ou use as categorias do mapa e clique em “Adicionar”.</span>
        </div>
      )}

      {view === "all" && <div className="places-flat">{ordered.map((place) => renderRow(place, true))}</div>}

      {view === "type" && base && (
        <section className="category-group base-group">
          <div className="category-group-head">
            <i className="row-base"><HomeIcon size={12} /></i>
            <span className="category-name-input">Hospedagem</span>
          </div>
          {renderRow(base, false)}
        </section>
      )}

      {view === "type" &&
        categories.map((category) => {
          const items = ordered.filter(
            (place) => place.categoryId === category.id && place.id !== base?.id,
          );
          return (
            <section className="category-group" key={category.id}>
              <div className="category-group-head">
                <input
                  type="color"
                  className="color-input"
                  value={category.color}
                  onChange={(event) => onUpdateCategory(category.id, { color: event.target.value })}
                  aria-label={`Cor de ${category.name}`}
                />
                <input
                  className="category-name-input"
                  value={category.name}
                  onChange={(event) => onUpdateCategory(category.id, { name: event.target.value })}
                  aria-label="Nome da categoria"
                />
                <span className="list-count">{items.length}</span>
                <button
                  className="mini-button"
                  onClick={() => onUpdateCategory(category.id, { hidden: !category.hidden })}
                  title={category.hidden ? "Mostrar no mapa" : "Ocultar do mapa"}
                  aria-label={category.hidden ? "Mostrar no mapa" : "Ocultar do mapa"}
                >
                  {category.hidden ? <EyeOffIcon size={16} /> : <EyeIcon size={16} />}
                </button>
                {categories.length > 1 && (
                  <button
                    className="mini-button"
                    onClick={() => onDeleteCategory(category.id)}
                    title="Excluir categoria"
                    aria-label="Excluir categoria"
                  >
                    <CloseIcon size={15} />
                  </button>
                )}
              </div>
              {items.map((place) => renderRow(place, false))}
            </section>
          );
        })}

      {view === "type" && uncategorized.length > 0 && (
        <section className="category-group">
          <div className="category-group-head">
            <i className="row-dot" style={{ background: "#6c7a74" }} />
            <span className="category-name-input">Sem categoria</span>
            <span className="list-count">{uncategorized.length}</span>
          </div>
          {uncategorized.map((place) => renderRow(place, false))}
        </section>
      )}

      {view === "type" && <CategoryForm onCreate={onCreateCategory} />}
    </div>
  );
}
