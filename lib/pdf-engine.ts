import workerUrl from 'pdfjs-dist/legacy/build/pdf.worker.min.mjs?url';
// Browser-only modules are imported on demand, never while server-rendering.
export async function pdfjs(){const p=await import('pdfjs-dist/legacy/build/pdf.mjs');p.GlobalWorkerOptions.workerSrc=workerUrl;return p;}
import {loadObjectsWith} from './pdf-annotations';
import {flattenPdfWith} from './pdf-render';
export {legacyToFabric,fabricToLegacy} from './pdf-annotations';
export async function ensureFonts(){if(typeof document!=='undefined'&&document.fonts)await Promise.all(['Ubuntu','Open Sans','Gloria Hallelujah'].map(font=>document.fonts.load(`20px "${font}"`)));}
export async function loadObjects(canvas:any,changes:any[],page:number){await ensureFonts();return loadObjectsWith(canvas,changes,page,await import('fabric'));}
export async function flattenPdf(bytes:Uint8Array,state:any){return flattenPdfWith(bytes,state,{fabric:await import('fabric'),pdfjs,loadObjects});}
