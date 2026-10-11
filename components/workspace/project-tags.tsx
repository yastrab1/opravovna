"use client";
import { useEffect, useRef, useState } from "react";
import { Check, Plus, Tag, Trash2, X } from "lucide-react";
import { tagName } from "@/lib/tags";
export default function ProjectTags({
  doc,
  readonly,
  busy,
  projectTags,
  toggleTag,
  tag,
  setTag,
  changed,
  deleteProjectTag,
}: any) {
  const [pending, setPending] = useState<{
    name: string;
    count: number;
  } | null>(null);
  const [error, setError] = useState("");
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    if (pending) dialog.current?.showModal();
    else dialog.current?.close();
  }, [pending]);
  useEffect(() => setPending(null), [doc.id]);
  async function remove(name: string, confirmed = false) {
    setError("");
    const result = await deleteProjectTag(name, confirmed);
    if (result?.confirmationRequired) setPending({ name, count: result.count });
    else if (result?.ok) setPending(null);
    else if (result?.error) setError(result.error);
  }
  return (
    <div className="gradesection">
      <h3>
        <Tag size={15} /> Štítky
      </h3>
      <div className="tags">
        {doc.state.tags.map((t: any, i: number) => (
          <span key={i}>
            {tagName(t)}
            {!readonly && (
              <button
                disabled={!!busy}
                aria-label={`Odobrať štítok ${tagName(t)} z riešenia`}
                onClick={() =>
                  changed({
                    ...doc.state,
                    tags: doc.state.tags.filter((_: any, j: number) => i !== j),
                  })
                }
              >
                <X size={12} />
              </button>
            )}
          </span>
        ))}
      </div>
      {!readonly && (
        <>
          {projectTags.length > 0 && (
            <div className="projecttagpicker">
              <span className="muted">Štítky projektu</span>
              <div className="tagchoices">
                {projectTags.map((t: any) => {
                  const name = tagName(t),
                    selected = doc.state.tags.some(
                      (v: any) => tagName(v) === name,
                    );
                  return (
                    <span className="project-tag-option" key={name}>
                      <button
                        type="button"
                        aria-pressed={selected}
                        onClick={() => toggleTag(t)}
                        disabled={!!busy}
                      >
                        {selected ? <Check size={12} /> : <Plus size={12} />}{" "}
                        {name}
                      </button>
                      <button
                        type="button"
                        title={`Vymazať štítok ${name} z celého projektu`}
                        aria-label={`Vymazať štítok ${name} z projektu`}
                        disabled={!!busy}
                        onClick={() => remove(name)}
                      >
                        <Trash2 size={12} />
                      </button>
                    </span>
                  );
                })}
              </div>
            </div>
          )}
          <form
            className="tagform"
            onSubmit={(e) => {
              e.preventDefault();
              const name = tag.trim();
              if (name && !doc.state.tags.some((t: any) => tagName(t) === name))
                toggleTag(
                  projectTags.find((t: any) => tagName(t) === name) ?? name,
                );
              setTag("");
            }}
          >
            <input
              aria-label="Nový štítok projektu"
              placeholder="Nový štítok projektu…"
              value={tag}
              maxLength={60}
              onChange={(e) => setTag(e.target.value)}
              disabled={!!busy}
            />
            <button
              aria-label="Vytvoriť a priradiť štítok"
              disabled={!!busy || !tag.trim()}
            >
              <Plus size={16} />
            </button>
          </form>
        </>
      )}
      <dialog
        ref={dialog}
        className="sharing"
        aria-labelledby="delete-tag-title"
        onCancel={(e) => {
          e.preventDefault();
          if (!busy) setPending(null);
        }}
      >
        <h2 id="delete-tag-title">Vymazať štítok z projektu?</h2>
        <p>
          Štítok „{pending?.name}“ sa odstráni z {pending?.count} riešení aj zo
          zoznamu štítkov projektu.
        </p>
        {error && <p role="alert">{error}</p>}
        <div className="dialogactions">
          <button disabled={!!busy} onClick={() => setPending(null)}>
            Zrušiť
          </button>
          <button
            disabled={!!busy}
            onClick={() => pending && remove(pending.name, true)}
          >
            Vymazať štítok
          </button>
        </div>
      </dialog>
    </div>
  );
}
