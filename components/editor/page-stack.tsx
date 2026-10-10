"use client";
import AnnotationPreview from "./annotation-preview";
export default function PageStack({
  changes,
  stage,
  updateCurrentPage,
  ready,
  pageSizes,
  zoom,
  pageBounds,
  pdf,
  pdfCanvases,
  page,
  annotationHosts,
}: {
  changes: any[];
  stage: any;
  updateCurrentPage: any;
  ready: any;
  pageSizes: { width: number; height: number }[];
  zoom: any;
  pageBounds: React.RefObject<(HTMLDivElement | null)[]>;
  pdf: any;
  pdfCanvases: React.RefObject<(HTMLCanvasElement | null)[]>;
  page: any;
  annotationHosts: React.RefObject<(HTMLDivElement | null)[]>;
}) {
  return (
    <div className="paperwell" ref={stage} onScroll={updateCurrentPage}>
      {!ready && <div className="loading">Načítavam PDF…</div>}
      {pageSizes.map((size, index) => (
        <div
          key={index}
          className="paperbounds"
          ref={(node) => {
            pageBounds.current[index] = node;
          }}
          style={{
            width: size.width * zoom,
            height: size.height * zoom,
            visibility: ready ? "visible" : "hidden",
          }}
        >
          <div
            className="paper"
            style={{
              width: size.width,
              height: size.height,
              transform: `translate(-50%,-50%) scale(${zoom})`,
            }}
          >
            {index < pdf.current?.numPages && (
              <canvas
                ref={(node) => {
                  pdfCanvases.current[index] = node;
                }}
                style={{
                  position: "absolute",
                  inset: 0,
                  width: size.width,
                  height: size.height,
                }}
              />
            )}
            <AnnotationPreview
              page={index}
              width={size.width}
              height={size.height}
              changes={changes}
              active={index === page}
            />
            <div
              className="annotation"
              style={{ visibility: index === page ? "visible" : "hidden" }}
            >
              <div
                ref={(node) => {
                  annotationHosts.current[index] = node;
                }}
              />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
