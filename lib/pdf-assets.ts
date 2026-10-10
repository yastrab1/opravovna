/** PDF.js workers and their binary/JS decoders must come from the same version. */
export function pdfAssetOptions(base: string) {
  if (!base.endsWith("/")) throw new Error("PDF asset base must end with '/'.");
  return {
    wasmUrl: `${base}wasm/`,
    cMapUrl: `${base}cmaps/`,
    cMapPacked: true,
    standardFontDataUrl: `${base}standard_fonts/`,
    isEvalSupported: false,
  };
}
