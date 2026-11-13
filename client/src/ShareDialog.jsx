import { useEffect, useRef, useState } from "react";
import { CloseIcon } from "./Icons.jsx";

function Option({ checked, disabled, onChange, title, hint }) {
  return (
    <label className={`share-option ${disabled ? "is-disabled" : ""}`}>
      <input type="checkbox" checked={checked && !disabled} disabled={disabled} onChange={(e) => onChange(e.target.checked)} />
      <span>
        <strong>{title}</strong>
        <small>{hint}</small>
      </span>
    </label>
  );
}

export default function ShareDialog({ trip, routeCount, onClose, onCreateLink, onDownload, onImportFile }) {
  const hasBase = Boolean(trip.baseId && trip.places.some((place) => place.id === trip.baseId));
  const [options, setOptions] = useState({ notes: true, base: true, routes: routeCount > 0 });
  const [link, setLink] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState({ text: "", error: false });
  const fileRef = useRef(null);
  const linkRef = useRef(null);

  useEffect(() => {
    const onKey = (event) => event.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const effective = { ...options, base: options.base && hasBase, routes: options.routes && routeCount > 0 };
  const baseName = hasBase ? trip.places.find((place) => place.id === trip.baseId).name : "";
  const summary = [
    `${trip.places.length} ${trip.places.length === 1 ? "ponto" : "pontos"}`,
    effective.base ? `hospedagem “${baseName}”` : null,
    effective.routes ? `${routeCount} ${routeCount === 1 ? "rota" : "rotas"}` : null,
  ]
    .filter(Boolean)
    .join(" · ");
  const set = (patch) => {
    setOptions((current) => ({ ...current, ...patch }));
    setLink(""); // mudou o que inclui: o link anterior não vale mais
    setMessage({ text: "", error: false });
  };

  async function createLink() {
    setBusy(true);
    setMessage({ text: "", error: false });
    try {
      setLink(await onCreateLink(effective));
    } catch (problem) {
      setMessage({ text: problem.message, error: true });
    } finally {
      setBusy(false);
    }
  }

  async function copy() {
    try {
      await navigator.clipboard.writeText(link);
      setMessage({ text: "Link copiado.", error: false });
    } catch {
      linkRef.current?.select();
      setMessage({ text: "Selecione e copie o link (Ctrl+C).", error: false });
    }
  }

  async function importFile(event) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    try {
      await onImportFile(file);
    } catch (problem) {
      setMessage({ text: problem.message, error: true });
    }
  }

  return (
    <div className="dialog-backdrop" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <section className="dialog" role="dialog" aria-modal="true" aria-label="Compartilhar viagem">
        <header className="dialog-head">
          <div>
            <h2>Compartilhar viagem</h2>
            <p>
              {trip.name} · {trip.places.length} {trip.places.length === 1 ? "ponto" : "pontos"}
            </p>
          </div>
          <button className="mini-button" onClick={onClose} aria-label="Fechar">
            <CloseIcon size={16} />
          </button>
        </header>

        <div className="share-options">
          <p className="share-label">O que enviar além dos pontos e categorias</p>
          <Option
            checked={options.notes}
            onChange={(notes) => set({ notes })}
            title="Descrições"
            hint="As anotações de cada lugar."
          />
          <Option
            checked={options.base}
            disabled={!hasBase}
            onChange={(base) => set({ base })}
            title="Hospedagem e distâncias"
            hint={
              hasBase
                ? "Quem abrir verá a hospedagem e a distância por rota até cada ponto."
                : "Defina uma hospedagem para incluir."
            }
          />
          <Option
            checked={options.routes}
            disabled={routeCount === 0}
            onChange={(routes) => set({ routes })}
            title={`Rotas traçadas no mapa${routeCount ? ` (${routeCount})` : ""}`}
            hint={
              routeCount
                ? "Com o tempo e a distância de cada uma."
                : "Trace rotas no mapa para poder incluí-las."
            }
          />
        </div>

        <p className="share-summary">Será enviado: {summary}</p>

        {link ? (
          <div className="share-link">
            <input ref={linkRef} readOnly value={link} onFocus={(event) => event.target.select()} aria-label="Link" />
            <button className="btn btn-primary" onClick={copy}>Copiar</button>
          </div>
        ) : (
          <button className="btn btn-primary btn-block" onClick={createLink} disabled={busy || !trip.places.length}>
            {busy ? "Gerando…" : "Gerar link"}
          </button>
        )}

        {message.text && <p className={`share-message ${message.error ? "is-error" : ""}`}>{message.text}</p>}

        <div className="share-file">
          <button className="link" onClick={() => onDownload(effective, "kml")} disabled={!trip.places.length}>
            Baixar KML (Google Maps)
          </button>
          <button className="link" onClick={() => onDownload(effective, "json")} disabled={!trip.places.length}>
            Backup (.json)
          </button>
          <button className="link" onClick={() => fileRef.current?.click()}>Importar backup</button>
          <input ref={fileRef} type="file" accept=".json,application/json" hidden onChange={importFile} />
        </div>

        <p className="share-note">
          O link abre neste mesmo servidor, então outras pessoas só conseguem usá-lo se o app estiver acessível
          a elas; quem abre ganha uma cópia própria, que pode editar. O KML abre em qualquer lugar (importe no
          Google My Maps ou abra no Google Earth), mas vira só um mapa para ver. O backup (.json) serve para
          guardar ou reabrir a viagem aqui no app.
        </p>
      </section>
    </div>
  );
}
