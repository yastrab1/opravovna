import { createRequire } from "node:module";
import path from "node:path";
import * as napi from "@napi-rs/canvas";
export async function nativeFabric() {
  const require = createRequire(import.meta.url);
  require.cache[require.resolve("canvas")] = { exports: napi };
  Object.assign(globalThis, {
    DOMMatrix: napi.DOMMatrix,
    ImageData: napi.ImageData,
    Path2D: napi.Path2D,
  });
  const fabric = await import("fabric/node");
  const { default: utils } =
    await import("jsdom/lib/jsdom/living/generated/utils.js");
  const { implForWrapper } = utils;
  const env = fabric.getEnv(),
    proto = env.window.HTMLCanvasElement.prototype;
  // jsdom assumes node-canvas decodes Image.src synchronously. Skia decodes
  // asynchronously, so let Fabric await the native Image.onload directly.
  const createElement = env.document.createElement.bind(env.document);
  env.document.createElement = (tag, options) =>
    String(tag).toLowerCase() === "img"
      ? new napi.Image()
      : createElement(tag, options);
  proto.getContext = function () {
    const impl = implForWrapper(this);
    const canvas = (impl._canvas ??= napi.createCanvas(
      this.width || 300,
      this.height || 150,
    ));
    if (canvas.width !== this.width) canvas.width = this.width;
    if (canvas.height !== this.height) canvas.height = this.height;
    const context = canvas.getContext("2d");
    if (!context.__patched) {
      const draw = context.drawImage.bind(context);
      context.drawImage = (image, ...args) => {
        const impl = implForWrapper(image);
        return draw(impl?._canvas ?? impl?._image ?? image, ...args);
      };
      context.__patched = true;
    }
    return context;
  };
  proto.toDataURL = function (...args) {
    this.getContext("2d");
    return implForWrapper(this)._canvas.toDataURL(...args);
  };
  for (const [index, family] of [
    [0, "Gloria Hallelujah"],
    [1, "Open Sans"],
    [2, "Open Sans"],
    [3, "Ubuntu"],
    [4, "Ubuntu"],
    [5, "Ubuntu"],
  ]) {
    if (
      !napi.GlobalFonts.registerFromPath(
        path.resolve(`public/fonts/font-${index}.ttf`),
        family,
      )
    )
      throw new Error("Export font unavailable");
  }
  for (const [family, alias] of [
    ["Liberation Sans", "Arial"],
    ["Liberation Serif", "Georgia"],
    ["Liberation Mono", "Courier New"],
  ])
    napi.GlobalFonts.setAlias(family, alias);
  return fabric;
}
