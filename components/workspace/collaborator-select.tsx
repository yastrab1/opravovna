"use client";
import { useFloatingPopover } from "@/hooks/use-floating-popover";
import { ChevronDown, Search } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";
export type Collaborator = { email: string; name: string; firstName?: string };
export default function CollaboratorSelect({
  people,
  value,
  onChange,
  disabled,
  label,
}: {
  people: Collaborator[];
  value: string[];
  onChange: (emails: string[]) => void;
  disabled: boolean;
  label: string;
}) {
  const [open, setOpen] = useState(false),
    [query, setQuery] = useState("");
  const root = useRef<HTMLDivElement>(null),
    search = useRef<HTMLInputElement>(null);
  const { trigger, panel } = useFloatingPopover(open);
  const id = useId();
  const selected = people.filter(
    (person) => person.firstName && value.includes(person.email),
  );
  const filtered = people.filter((person) =>
    `${person.name} ${person.email}`
      .toLocaleLowerCase("sk")
      .includes(query.toLocaleLowerCase("sk")),
  );
  useEffect(() => {
    if (!open) return;
    search.current?.focus();
    function outside(event: PointerEvent) {
      if (!root.current?.contains(event.target as Node)) setOpen(false);
    }
    document.addEventListener("pointerdown", outside);
    return () => document.removeEventListener("pointerdown", outside);
  }, [open]);
  useEffect(() => {
    if (disabled) setOpen(false);
  }, [disabled]);
  return (
    <div
      className="collaborator-select"
      ref={root}
      onKeyDown={(event) => {
        if (event.key === "Escape" && open) {
          event.preventDefault();
          event.stopPropagation();
          setOpen(false);
          trigger.current?.focus();
        }
      }}
      onBlur={(event) => {
        // Native label activation can focus the enclosing modal before its input.
        // Outside pointer presses are already handled separately.
        if (
          event.relatedTarget &&
          event.relatedTarget !== event.currentTarget.closest("dialog") &&
          !event.currentTarget.contains(event.relatedTarget)
        )
          setOpen(false);
      }}
    >
      <button
        ref={trigger}
        type="button"
        className="collaborator-trigger"
        disabled={disabled}
        aria-label={label}
        aria-expanded={open}
        aria-controls={id}
        onClick={() => {
          setQuery("");
          setOpen(!open);
        }}
        onKeyDown={(event) => {
          if (event.key === "ArrowDown") {
            event.preventDefault();
            setOpen(true);
          }
        }}
      >
        <span className="collaborator-chips">
          {selected.length ? (
            selected.map((person) => (
              <span
                className="collaborator-chip"
                key={person.email}
                title={person.email}
              >
                {person.name}
              </span>
            ))
          ) : (
            <span className="muted">Vybrať spolupracovníkov…</span>
          )}
        </span>
        <ChevronDown size={15} />
      </button>
      {open && (
        <div ref={panel} popover="manual" className="collaborator-menu" id={id}>
          <div className="collaborator-search">
            <Search size={15} />
            <input
              ref={search}
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Hľadať meno alebo e-mail…"
              aria-label="Hľadať spolupracovníkov"
            />
          </div>
          <div className="collaborator-options" role="group" aria-label={label}>
            {filtered.map((person) => (
              <label className="collaborator-option" key={person.email}>
                <input
                  type="checkbox"
                  checked={!!person.firstName && value.includes(person.email)}
                  disabled={!person.firstName}
                  onChange={(event) =>
                    onChange(
                      event.target.checked
                        ? [...value, person.email]
                        : value.filter((email) => email !== person.email),
                    )
                  }
                />
                <span>
                  <strong>{person.name}</strong>
                  <small>{person.email}</small>
                  {!person.firstName && (
                    <small>Najprv sa musí prihlásiť a doplniť meno.</small>
                  )}
                </span>
              </label>
            ))}
            {!filtered.length && (
              <p className="collaborator-empty">
                Žiadny spolupracovník sa nenašiel.
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
