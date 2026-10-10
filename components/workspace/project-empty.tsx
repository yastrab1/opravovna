"use client";
import { Upload } from "lucide-react";
export default function ProjectEmpty({
  readonly,
  busy,
  importZip,
}: {
  readonly: boolean;
  busy: string;
  importZip: any;
}) {
  return (
    <div className="projectempty">
      <Upload size={40} strokeWidth={1.2} />
      <h2>Pripravte riešenia na opravovanie</h2>
      <p>
        Nahrajte pôvodný ZIP alebo export s príponou _opravene.zip. Načítame
        mená, ročníky, body aj anotácie.
      </p>
      {!readonly && (
        <label className="button primary large">
          Vybrať ZIP archív
          <input
            type="file"
            accept=".zip"
            hidden
            aria-label="Vybrať ZIP archív"
            disabled={!!busy}
            onChange={(e) =>
              e.target.files?.[0] && importZip(e.target.files[0])
            }
          />
        </label>
      )}
    </div>
  );
}
