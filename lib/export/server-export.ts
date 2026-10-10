import { api, download } from "../client-api";
export async function exportZip({
  project,
  save,
  setError,
  setBusy,
  report,
  exportZipBrowser,
}: {
  project: any;
  save: any;
  setError: any;
  setBusy: any;
  report: any;
  exportZipBrowser: any;
}) {
  if (!(await save())) return;
  setError("");
  try {
    setBusy("Pripravujem export na serveri…");
    const root = "projects/" + project.id + "/export";
    let job;
    try {
      job = await api(root, { method: "POST" });
    } catch (e: any) {
      if (e.status === 501) {
        await exportZipBrowser();
        return;
      }
      throw e;
    }
    let failures = 0;
    while (job.status !== "ready") {
      if (job.status === "error")
        throw new Error(job.error || "Export zlyhal. Skúste ho znova.");
      setBusy(
        job.status === "queued"
          ? "Export čaká na server…"
          : job.stage === "loading"
            ? "Server načítava archív…"
            : job.stage === "packing"
              ? `Server balí archív… ${job.percent}%`
              : `Server exportuje PDF… ${job.completed} / ${job.total}`,
      );
      await new Promise((resolve) => setTimeout(resolve, 1000));
      try {
        job = await api(root + "/" + job.id);
        failures = 0;
      } catch (e: any) {
        if (e.status || ++failures >= 5) throw e;
        setBusy("Obnovujem spojenie so serverom…");
      }
    }
    setBusy("Sťahujem hotový ZIP…");
    const response = await fetch("/api/" + root + "/" + job.id + "/download");
    if (!response.ok) {
      const failure: any = await response.json().catch(() => null);
      throw new Error(
        failure?.error || "ZIP sa nepodarilo stiahnuť. Spustite export znova.",
      );
    }
    download(await response.blob(), job.filename);
  } catch (e: any) {
    report(
      /fetch|network/i.test(e?.message ?? "")
        ? "Spojenie sa prerušilo. Skúste export znova; hotový archív zostáva na serveri 30 minút."
        : e,
    );
  } finally {
    setBusy("");
  }
}
