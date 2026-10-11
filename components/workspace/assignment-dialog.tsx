"use client";
import { useEffect, useRef, useState } from "react";
import CollaboratorSelect, { type Collaborator } from "./collaborator-select";
import { X } from "lucide-react";
import { api } from "@/lib/client-api";
import { categoryLabel } from "@/lib/preferences";
export default function AssignmentDialog({
  project,
  categories,
  onClose,
  onAssign,
}: {
  project: any;
  categories: string[];
  onClose: () => void;
  onAssign: (value: Record<string, string[]>) => Promise<any>;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [people, setPeople] = useState<Collaborator[]>([]),
    [error, setError] = useState(""),
    [loading, setLoading] = useState(true),
    [saving, setSaving] = useState(false),
    [selection, setSelection] = useState<Record<string, string[]>>(
      project.legacy.assignments ?? {},
    );
  useEffect(() => {
    dialog.current?.showModal();
    let canceled = false;
    api(`projects/${project.id}/assignments`)
      .then((list) => {
        if (!canceled) setPeople(list);
      })
      .catch((e) => {
        if (!canceled) setError(e.message);
      })
      .finally(() => {
        if (!canceled) setLoading(false);
      });
    return () => {
      canceled = true;
    };
  }, [project.id]);
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError("");
    try {
      const assignments = Object.fromEntries(
        categories.map((c) => [
          c,
          (selection[c] ?? []).filter((email) =>
            people.some((p) => p.email === email && p.firstName),
          ),
        ]),
      );
      const result = await onAssign(assignments);
      if (result?.ok) onClose();
      else if (result?.error) setError(result.error);
    } finally {
      setSaving(false);
    }
  }
  return (
    <dialog
      ref={dialog}
      className="sharing assignment-dialog"
      aria-labelledby="assignment-title"
      onCancel={(e) => {
        e.preventDefault();
        if (!saving) onClose();
      }}
    >
      <form className="assignment-form" onSubmit={submit}>
        <div className="shareheading">
          <h2 id="assignment-title">Priradiť riešenia</h2>
          <button
            type="button"
            aria-label="Zavrieť priradenie"
            disabled={saving}
            onClick={onClose}
          >
            <X size={17} />
          </button>
        </div>
        <p className="assignment-description">
          Neohodnotené riešenia sa rozdelia rovnomerne. Predchádzajúce štítky
          assigned: sa odstránia z celého projektu.
        </p>
        {loading && <p role="status">Načítavam spolupracovníkov…</p>}
        {error && <p role="alert">{error}</p>}
        {!loading && people.length > 0 && (
          <div className="assignment-categories">
            {categories.map((c) => (
              <div className="assignment-row" key={c}>
                <div className="assignment-category">
                  <strong>{categoryLabel(c)}</strong>
                  <small>
                    {
                      project.documents.filter(
                        (d: any) =>
                          d.metadata.rocnik === c &&
                          d.state.scoring?.points == null,
                      ).length
                    }{" "}
                    neohodnotených
                  </small>
                </div>
                <CollaboratorSelect
                  label={`Spolupracovníci pre kategóriu ${categoryLabel(c)}`}
                  people={people}
                  value={selection[c] ?? []}
                  disabled={saving}
                  onChange={(emails) =>
                    setSelection((old) => ({ ...old, [c]: emails }))
                  }
                />
              </div>
            ))}
          </div>
        )}
        {!loading && !people.length && (
          <p className="assignment-description">
            Najprv pridajte spolupracovníkov cez Zdieľať.
          </p>
        )}
        <div className="dialogactions">
          <button type="button" disabled={saving} onClick={onClose}>
            Zrušiť
          </button>
          <button
            className="primary"
            disabled={loading || !people.length || saving}
            type="submit"
          >
            {saving ? "Prerozdeľujem…" : "Prerozdeliť od začiatku"}
          </button>
        </div>
      </form>
    </dialog>
  );
}
