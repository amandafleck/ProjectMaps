import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { CheckIcon, ChevronIcon } from "./Icons.jsx";

const LIST_MAX = 240;
const GAP = 6;

// Lista suspensa que abre POR CIMA da página (portal + posição fixa), sem empurrar nem ser
// cortada pelo painel onde está. Vira para cima quando falta espaço embaixo.
export default function Dropdown({ value, options, onChange, placeholder = "Selecione", ariaLabel }) {
  const [rect, setRect] = useState(null); // posição do botão quando aberto
  const buttonRef = useRef(null);
  const listRef = useRef(null);
  const open = rect !== null;
  const current = options.find((option) => option.value === value);

  useEffect(() => {
    if (!open) return undefined;
    const close = () => setRect(null);
    const onDown = (event) => {
      if (buttonRef.current?.contains(event.target) || listRef.current?.contains(event.target)) return;
      close();
    };
    const onKey = (event) => event.key === "Escape" && close();
    const onScroll = (event) => {
      if (!listRef.current?.contains(event.target)) close();
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    window.addEventListener("scroll", onScroll, true);
    window.addEventListener("resize", close);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
      window.removeEventListener("scroll", onScroll, true);
      window.removeEventListener("resize", close);
    };
  }, [open]);

  function toggle() {
    setRect(open ? null : buttonRef.current.getBoundingClientRect());
  }

  let listStyle = null;
  if (rect) {
    const wanted = Math.min(LIST_MAX, options.length * 38 + 12);
    const below = window.innerHeight - rect.bottom - GAP - 12;
    const above = rect.top - GAP - 12;
    const openUp = below < wanted && above > below;
    listStyle = {
      left: rect.left,
      width: rect.width,
      maxHeight: Math.max(120, Math.min(LIST_MAX, openUp ? above : below)),
      ...(openUp
        ? { bottom: window.innerHeight - rect.top + GAP }
        : { top: rect.bottom + GAP }),
    };
  }

  return (
    <div className="dd">
      <button
        ref={buttonRef}
        type="button"
        className={`dd-button ${open ? "is-open" : ""}`}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={ariaLabel}
        onClick={toggle}
      >
        <span className={current ? "" : "dd-placeholder"}>{current?.label ?? placeholder}</span>
        <ChevronIcon size={15} />
      </button>

      {open &&
        createPortal(
          <ul className="dd-list" role="listbox" ref={listRef} style={listStyle}>
            {options.map((option) => (
              <li key={option.value}>
                <button
                  type="button"
                  role="option"
                  aria-selected={option.value === value}
                  className={`dd-option ${option.value === value ? "is-selected" : ""}`}
                  onClick={() => {
                    onChange(option.value);
                    setRect(null);
                  }}
                >
                  <span>{option.label}</span>
                  {option.value === value && <CheckIcon size={15} />}
                </button>
              </li>
            ))}
          </ul>,
          document.body,
        )}
    </div>
  );
}
