import { parentPort } from 'node:worker_threads';
import { createRequire } from 'node:module';
import path from 'node:path';
import * as napi from '@napi-rs/canvas';
import { flattenPdfWith } from './dist/export/pdf-render.mjs';
import { loadObjectsWith } from './dist/export/pdf-annotations.mjs';

// Fabric's DOM wrappers use the native Skia canvas. Each CPU thread owns its
// renderer and font registry; no shared canvas or browser main thread is used.
const require = createRequire(import.meta.url);
require.cache[require.resolve('canvas')] = { exports: napi };
Object.assign(globalThis, { DOMMatrix: napi.DOMMatrix, ImageData: napi.ImageData, Path2D: napi.Path2D });
const fabric = await import('fabric/node');
const { default: utils } = await import('jsdom/lib/jsdom/living/generated/utils.js');
const { implForWrapper } = utils;
const env = fabric.getEnv(), proto = env.window.HTMLCanvasElement.prototype;
// jsdom assumes node-canvas decodes Image.src synchronously. Skia decodes
// asynchronously, so let Fabric await the native Image.onload directly.
const createElement = env.document.createElement.bind(env.document);
env.document.createElement = (tag, options) => String(tag).toLowerCase() === 'img' ? new napi.Image() : createElement(tag, options);
proto.getContext = function () {
  const impl = implForWrapper(this);
  const canvas = impl._canvas ??= napi.createCanvas(this.width || 300, this.height || 150);
  if (canvas.width !== this.width) canvas.width = this.width;
  if (canvas.height !== this.height) canvas.height = this.height;
  const context = canvas.getContext('2d');
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
  this.getContext('2d');
  return implForWrapper(this)._canvas.toDataURL(...args);
};
for (const [index, family] of [[0, 'Gloria Hallelujah'], [1, 'Open Sans'], [2, 'Open Sans'], [3, 'Ubuntu'], [4, 'Ubuntu'], [5, 'Ubuntu']]) {
  if (!napi.GlobalFonts.registerFromPath(path.resolve(`public/fonts/font-${index}.ttf`), family)) throw new Error('Export font unavailable');
}
for (const [family, alias] of [['Liberation Sans', 'Arial'], ['Liberation Serif', 'Georgia'], ['Liberation Mono', 'Courier New']]) napi.GlobalFonts.setAlias(family, alias);
const js = await import('pdfjs-dist/legacy/build/pdf.mjs');
js.GlobalWorkerOptions.workerSrc = require.resolve('pdfjs-dist/legacy/build/pdf.worker.min.mjs');
const loadObjects = (canvas, changes, page) => loadObjectsWith(canvas, changes, page, fabric);
function validateImages(value) {
  if (!value || typeof value !== 'object') return;
  for (const [key, child] of Object.entries(value)) {
    // Imported annotations must never make the server fetch arbitrary URLs.
    if ((key === 'src' || key === 'source') && typeof child === 'string' && !/^data:image\/(png|jpe?g|webp|gif);base64,/i.test(child)) throw new Error('Obrázky v anotáciách musia byť vložené do dokumentu.');
    validateImages(child);
  }
}
parentPort.on('message', async ({ id, bytes, state }) => {
  try {
    validateImages(state.changes);
    const output = await flattenPdfWith(bytes, state, { fabric, pdfjs: async () => js, loadObjects, createCanvas: (width, height) => napi.createCanvas(width, height) });
    parentPort.postMessage({ id, bytes: output }, [output.buffer]);
  } catch (error) {
    console.error('PDF export failed:', error.message);
    parentPort.postMessage({ id, error: 'PDF sa nepodarilo exportovať. Skontrolujte anotácie riešenia.' });
  }
});
