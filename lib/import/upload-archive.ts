import { api } from "../client-api";
export async function uploadArchive(
  file: File,
  root: string,
  progress: (message: string) => void,
) {
  const upload = await api(root + "/archive", { method: "POST" });
  let completed = false;
  try {
    const chunk = 8 * 1024 * 1024;
    for (
      let offset = 0, part = 1;
      offset < file.size;
      offset += chunk, part++
    ) {
      progress(
        `Ukladám ZIP na server… ${Math.round((offset / file.size) * 100)} %`,
      );
      await api(`${root}/uploads/${upload.id}?part=${part}`, {
        method: "PUT",
        body: file.slice(offset, offset + chunk),
      });
    }
    try {
      await api(`${root}/uploads/${upload.id}`, { method: "POST" });
    } catch (error) {
      // A lost response can occur after the server commits the multipart upload.
      // Confirm that outcome instead of replaying a non-idempotent completion.
      if (!upload.key || (await api(root)).archive !== upload.key) throw error;
    }
    completed = true;
  } finally {
    if (!completed)
      await api(`${root}/uploads/${upload.id}`, { method: "DELETE" }).catch(
        () => {},
      );
  }
}
