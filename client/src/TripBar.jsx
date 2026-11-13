import { useState } from "react";
import Dropdown from "./Dropdown.jsx";
import { PencilIcon, PlusIcon } from "./Icons.jsx";

// Seletor de viagem. O lápis abre a edição do título, onde também fica "Excluir viagem".
export default function TripBar({ trips, trip, onSwitch, onAdd, onRename, onDelete }) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(trip.name);

  function startEditing() {
    setName(trip.name);
    setEditing(true);
  }

  function save(event) {
    event.preventDefault();
    if (name.trim()) onRename(name.trim());
    setEditing(false);
  }

  if (editing) {
    return (
      <form className="trip-edit" onSubmit={save}>
        <label htmlFor="trip-title">Título da viagem</label>
        <input
          id="trip-title"
          autoFocus
          value={name}
          onChange={(event) => setName(event.target.value)}
          onKeyDown={(event) => event.key === "Escape" && setEditing(false)}
        />
        <div className="button-row">
          <button type="submit" className="btn btn-primary" disabled={!name.trim()}>Salvar</button>
          <button type="button" className="btn" onClick={() => setEditing(false)}>Cancelar</button>
        </div>
        {trips.length > 1 && (
          <button
            type="button"
            className="link-danger"
            onClick={() => {
              setEditing(false);
              onDelete();
            }}
          >
            Excluir esta viagem
          </button>
        )}
      </form>
    );
  }

  return (
    <div className="trip-bar">
      <Dropdown
        ariaLabel="Viagem"
        value={trip.id}
        options={trips.map((item) => ({ value: item.id, label: item.name }))}
        onChange={onSwitch}
      />
      <button className="icon-btn" onClick={startEditing} title="Editar título" aria-label="Editar título da viagem">
        <PencilIcon size={16} />
      </button>
      <button className="icon-btn" onClick={onAdd} title="Nova viagem" aria-label="Nova viagem">
        <PlusIcon size={17} />
      </button>
    </div>
  );
}
