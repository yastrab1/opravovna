"use client";
import { useEffect, useState } from "react";
export default function VersionSummary({
  state,
  project,
  id,
  pdf,
}: {
  state: any;
  project: string;
  id: string;
  pdf?: Uint8Array;
}) {
  const changes = state.changes ?? [];
  const texts = changes
    .filter(
      (x: any) =>
        x.type === "Text" && x.data?.name !== state.scoring?.annotName,
    )
    .map((x: any) => x.data.text)
    .filter(Boolean);
  return (
    <div className="version-summary">
      <strong>
        {state.scoring?.points != null
          ? state.scoring.points + " bodov"
          : "Bez hodnotenia"}
      </strong>
      <span>
        {changes.length} anotácií · {state.extraPages ?? 0} pridaných strán
      </span>
      <span>
        Štítky:{" "}
        {state.tags
          ?.map((x: any) => (typeof x === "object" ? x.name : x))
          .join(", ") || "žiadne"}
      </span>
      {texts.length ? (
        <p>{texts.join("\n\n")}</p>
      ) : (
        <p className="muted">Bez textového komentára</p>
      )}
      <SnapshotPreview state={state} project={project} id={id} pdf={pdf} />
    </div>
  );
}
function SnapshotPreview({
  state,
  project,
  id,
  pdf,
}: {
  state: any;
  project: string;
  id: string;
  pdf?: Uint8Array;
}) {
  const [url, setUrl] = useState(""),
    [loading, setLoading] = useState(false),
    [failure, setFailure] = useState("");
  useEffect(
    () => () => {
      if (url) URL.revokeObjectURL(url);
    },
    [url],
  );
  return (
    <div className="snapshot-preview">
      <button
        type="button"
        disabled={loading}
        onClick={async (e) => {
          e.preventDefault();
          setLoading(true);
          setFailure("");
          try {
            let source = pdf;
            if (!source) {
              const res = await fetch(
                `/api/projects/${project}/documents/${id}/file`,
              );
              if (!res.ok) throw new Error("PDF sa nepodarilo načítať.");
              source = new Uint8Array(await res.arrayBuffer());
            }
            const { flattenPdf } = await import("@/lib/pdf-engine");
            const bytes = await flattenPdf(source, state);
            setUrl(
              URL.createObjectURL(
                new Blob([bytes as any], { type: "application/pdf" }),
              ),
            );
          } catch (e: any) {
            setFailure(e.message);
          } finally {
            setLoading(false);
          }
        }}
      >
        {loading
          ? "Pripravujem náhľad…"
          : url
            ? "Obnoviť náhľad"
            : "Zobraziť PDF"}
      </button>
      {failure && <span role="alert">{failure}</span>}
      {url && (
        <>
          <a
            href={url}
            target="_blank"
            rel="noreferrer"
            onClick={(e) => e.stopPropagation()}
          >
            Otvoriť väčší náhľad
          </a>
          <iframe title="Náhľad verzie riešenia" src={url} />
        </>
      )}
    </div>
  );
}
