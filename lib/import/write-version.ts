import { api } from "../client-api";
export async function writeImportedVersion(
  project: string,
  id: string,
  state: any,
  revision: number,
  pdf: Uint8Array,
) {
  const form = new FormData();
  form.set("operation", crypto.randomUUID());
  form.set(
    "pdf",
    new Blob([pdf as BlobPart], { type: "application/pdf" }),
    "solution.pdf",
  );
  form.set("state", JSON.stringify(state));
  form.set("revision", String(revision));
  return api(`projects/${project}/documents/${id}/version`, {
    method: "PUT",
    body: form,
  });
}
