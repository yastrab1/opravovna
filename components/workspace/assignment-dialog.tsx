"use client";
import { useEffect, useRef, useState } from "react";
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
  const [people, setPeople] = useState<any[]>([]),
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
  const selected = Object.entries(selection).some(
    ([category, emails]) =>
      categories.includes(category) &&
      emails.some((email) =>
        people.some((p) => p.email === email && p.firstName),
      ),
  );
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
      className="sharing"
      aria-labelledby="assignment-title"
      onCancel={(e) => {
        e.preventDefault();
        if (!saving) onClose();
      }}
    >
      <form onSubmit={submit}>
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
        <p>
          Neohodnotené riešenia sa rozdelia rovnomerne. Predchádzajúce štítky
          assigned: sa odstránia z celého projektu.
        </p>
        {loading && <p role="status">Načítavam spolupracovníkov…</p>}
        {error && <p role="alert">{error}</p>}
        {!loading && people.length > 0 && (
          <div className="assignment-categories">
            {categories.map((c) => (
              <fieldset key={c} disabled={saving}>
                <legend>
                  {categoryLabel(c)} ·{" "}
                  {
                    project.documents.filter(
                      (d: any) =>
                        d.metadata.rocnik === c &&
                        d.state.scoring?.points == null,
                    ).length
                  }{" "}
                  neohodnotených
                </legend>
                {people.map((p) => (
                  <label className="assignment-person" key={p.email}>
                    <input
                      type="checkbox"
                      disabled={!p.firstName}
                      checked={
                        !!p.firstName && (selection[c] ?? []).includes(p.email)
                      }
                      onChange={(e) =>
                        setSelection((old) => ({
                          ...old,
                          [c]: e.target.checked
                            ? [...(old[c] ?? []), p.email]
                            : (old[c] ?? []).filter(
                                (email) => email !== p.email,
                              ),
                        }))
                      }
                    />
                    <span>
                      {p.name}
                      <small>
                        {p.email}
                        {!p.firstName &&
                          " · Najprv sa musí prihlásiť a doplniť meno"}
                      </small>
                    </span>
                  </label>
                ))}
              </fieldset>
            ))}
          </div>
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
            {saving
              ? "Priraďujem…"
              : selected
                ? "Priradiť"
                : "Odstrániť všetky priradenia"}
          </button>
        </div>
      </form>
    </dialog>
  );
}
