import { Download, X } from "lucide-react";
import type { ExportDownloads } from "@/hooks/use-export-downloads";
export default function ExportDownloadList({
  downloads,
  close,
}: {
  downloads: ExportDownloads;
  close: () => void;
}) {
  return (
    <div className="notice progress export-downloads" role="status">
      <div>
        <strong>Export je rozdelený na {downloads.parts.length} časti.</strong>
        <p>
          Nahrajte do PMAT všetky časti. Každé riešenie je práve v jednej z
          nich.{downloads.expires && " Odkazy platia 30 minút."}
        </p>
        <div className="export-part-links">
          {downloads.parts.map((part) => (
            <a key={part.part} href={part.url} download={downloads.filename}>
              <Download size={15} /> Časť {part.part} · {part.count} riešení ·{" "}
              {(part.bytes / 1_000_000).toFixed(1)} MB
            </a>
          ))}
        </div>
      </div>
      <button aria-label="Zavrieť export" onClick={close}>
        <X size={16} />
      </button>
    </div>
  );
}
