import { useEffect, useRef, useState } from "react";
import { SearchIcon } from "./Icons.jsx";
import { loadRecents } from "./lib.js";

const coordinateLike = /^\s*-?\d+([.,]\d+)?\s*[,;\s]\s*-?\d/;
const MIN_CHARS = 2;

// Barra de pesquisa com sugestões enquanto digita (setas + Enter, Esc fecha).
// Com a barra vazia, mostra as pesquisas recentes.
export default function SearchBox({ value, onChange, onSubmit, onPick, getView, placeholder, loading, inputRef }) {
  const [items, setItems] = useState([]);
  const [recents, setRecents] = useState([]);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const skipNext = useRef(false); // não sugerir logo depois de escolher uma sugestão

  const query = value.trim();
  const typing = query.length >= MIN_CHARS;
  const list = typing ? items : recents;

  useEffect(() => {
    if (skipNext.current) {
      skipNext.current = false;
      return undefined;
    }
    if (!typing || coordinateLike.test(query)) {
      setItems([]);
      return undefined;
    }

    const controller = new AbortController();
    const timer = setTimeout(async () => {
      try {
        const params = new URLSearchParams({ text: query });
        const view = getView();
        if (view) {
          params.set("lat", String(view.lat));
          params.set("lon", String(view.lon));
        }
        const response = await fetch(`/api/suggest?${params}`, { signal: controller.signal });
        const data = response.ok ? await response.json() : [];
        setItems(Array.isArray(data) ? data : []);
        setActive(-1);
        setOpen(true);
      } catch {
        // sugestões são opcionais: se falhar, a pesquisa normal continua funcionando
      }
    }, 220);

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
    // getView lê o estado do mapa na hora; só a digitação deve disparar a busca
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  function pick(place) {
    skipNext.current = true;
    onChange(place.name);
    setItems([]);
    setOpen(false);
    onPick(place);
  }

  function submit(event) {
    event.preventDefault();
    setOpen(false);
    if (active >= 0 && list[active]) pick(list[active]);
    else onSubmit();
  }

  function onKeyDown(event) {
    if (event.key === "Escape") {
      setOpen(false);
      return;
    }
    if (!open || !list.length) return;
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActive((current) => (current + 1) % list.length);
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setActive((current) => (current <= 0 ? list.length - 1 : current - 1));
    }
  }

  return (
    <form
      className="search"
      onSubmit={submit}
      role="search"
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false);
      }}
    >
      <SearchIcon size={18} />
      <input
        ref={inputRef}
        value={value}
        onChange={(event) => {
          onChange(event.target.value);
          setOpen(true);
        }}
        onFocus={() => {
          setRecents(loadRecents());
          setActive(-1);
          setOpen(true);
        }}
        onKeyDown={onKeyDown}
        placeholder={placeholder}
        aria-label="Pesquisar"
        aria-autocomplete="list"
        aria-expanded={open}
        autoComplete="off"
      />
      {loading && <span className="search-status">Buscando…</span>}

      {open && list.length > 0 && (
        <ul className="suggest" role="listbox">
          {!typing && <li className="suggest-title">Pesquisas recentes</li>}
          {list.map((place, index) => (
            <li key={place.id}>
              <button
                type="button"
                role="option"
                aria-selected={index === active}
                className={`suggest-item ${index === active ? "is-active" : ""}`}
                onMouseDown={(event) => event.preventDefault()}
                onMouseEnter={() => setActive(index)}
                onClick={() => pick(place)}
              >
                <strong>{place.name}</strong>
                <span>{place.description}</span>
              </button>
            </li>
          ))}
          {typing && (
            <li>
              <button
                type="button"
                className="suggest-item suggest-all"
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => {
                  setOpen(false);
                  onSubmit();
                }}
              >
                Ver todos os resultados para “{query}”
              </button>
            </li>
          )}
        </ul>
      )}
    </form>
  );
}
