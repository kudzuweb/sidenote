import { useEffect, useRef, useState } from "react";
import type { Annotation } from "~/types/types";
import "pdfjs-dist/web/pdf_viewer.css";

type PdfViewerProps = {
  src: string;
  className?: string;
  maxPages?: number;
  annotations?: Annotation[];
  theme?: string;
};

declare global {
  interface Window {
    pdfjsLib?: any;
  }
}

type PdfJsModules = { pdfjsLib: any; pdfjsViewer: any };

const SCALE_EPSILON = 0.0005;

let pdfjsModulesPromise: Promise<PdfJsModules> | null = null;
let workerConfigured = false;

async function loadPdfJs(): Promise<PdfJsModules> {
  if (!pdfjsModulesPromise) {
    pdfjsModulesPromise = (async () => {
      const pdfjsLib = await import(
        /* @vite-ignore */ "pdfjs-dist/build/pdf.mjs"
      );

      if (!workerConfigured) {
        try {
          const worker = await import(
            /* @vite-ignore */ "pdfjs-dist/build/pdf.worker.min.mjs?url"
          );
          if (worker?.default) {
            pdfjsLib.GlobalWorkerOptions.workerSrc = worker.default;
            workerConfigured = true;
          }
        } catch {
          // fall back to pdf.js default worker resolution
        }
      }

      window.pdfjsLib = pdfjsLib as any;
      const pdfjsViewer = await import(
        /* @vite-ignore */ "pdfjs-dist/web/pdf_viewer.mjs"
      );
      return { pdfjsLib, pdfjsViewer };
    })();
  }
  return pdfjsModulesPromise;
}

function matrixToCss(matrix: DOMMatrix): string {
  if (
    matrix.a === 1 &&
    matrix.b === 0 &&
    matrix.c === 0 &&
    matrix.d === 1 &&
    matrix.e === 0 &&
    matrix.f === 0
  ) {
    return "";
  }
  return `matrix(${matrix.a},${matrix.b},${matrix.c},${matrix.d},${matrix.e},${matrix.f})`;
}

function alignTextLayers(rootEl: HTMLElement) {
  if (typeof DOMMatrix === "undefined") return;

  const pages = rootEl.querySelectorAll<HTMLElement>(".page");
  pages.forEach((page) => {
    const textLayer = page.querySelector<HTMLElement>(".textLayer");
    const canvasWrapper = page.querySelector<HTMLElement>(".canvasWrapper");
    if (!textLayer || !canvasWrapper) return;

    const textWidth = textLayer.clientWidth;
    const textHeight = textLayer.clientHeight;
    const canvasWidth = canvasWrapper.clientWidth;
    const canvasHeight = canvasWrapper.clientHeight;
    if (!textWidth || !textHeight || !canvasWidth || !canvasHeight) return;

    const scaleX = canvasWidth / textWidth;
    const scaleY = canvasHeight / textHeight;
    const needsScale =
      Math.abs(scaleX - 1) > SCALE_EPSILON ||
      Math.abs(scaleY - 1) > SCALE_EPSILON;

    if (!textLayer.dataset.fractalBaseTransform) {
      const computed = window.getComputedStyle(textLayer).transform;
      textLayer.dataset.fractalBaseTransform =
        computed && computed !== "none" ? computed : "";
    }

    const baseMatrix = new DOMMatrix(
      textLayer.dataset.fractalBaseTransform || undefined
    );
    const correctedMatrix = needsScale
      ? baseMatrix.scale(scaleX, scaleY)
      : baseMatrix;
    const css = matrixToCss(correctedMatrix);

    if (textLayer.dataset.fractalAppliedTransform !== css) {
      textLayer.style.transformOrigin = css ? "0 0" : "";
      textLayer.style.transform = css;
      textLayer.dataset.fractalAppliedTransform = css;
    }
  });
}

function getElementScale(el: HTMLElement) {
  try {
    const computed = window.getComputedStyle(el).transform;
    if (!computed || computed === "none") {
      return { scaleX: 1, scaleY: 1 };
    }
    const matrix = new DOMMatrix(computed);
    return {
      scaleX: Math.hypot(matrix.a, matrix.b) || 1,
      scaleY: Math.hypot(matrix.c, matrix.d) || 1,
    };
  } catch {
    return { scaleX: 1, scaleY: 1 };
  }
}

function drawOverlayHighlights(rootEl: HTMLElement, annsAll: Annotation[]) {
  rootEl.querySelectorAll(".pdfOverlayLayer").forEach((el) => {
    (el as HTMLElement).innerHTML = "";
  });

  const walker = document.createTreeWalker(rootEl, NodeFilter.SHOW_TEXT);
  const nodes: Array<{
    node: Text;
    start: number;
    end: number;
    pageDiv: HTMLElement;
  }> = [];
  let pos = 0;
  while (walker.nextNode()) {
    const node = walker.currentNode as Text;
    const parent = node.parentElement as HTMLElement | null;
    if (!parent) continue;
    if (!parent.closest(".textLayer")) continue;
    const pageDiv = parent.closest(".page") as HTMLElement | null;
    if (!pageDiv) continue;
    const len = node.nodeValue?.length ?? 0;
    if (len > 0) {
      nodes.push({ node, start: pos, end: pos + len, pageDiv });
    }
    pos += len;
  }

  const anns = (annsAll ?? [])
    .filter(
      (a) =>
        Number.isFinite(a.start) && Number.isFinite(a.end) && a.end > a.start
    )
    .slice()
    .sort((a, b) => a.start - b.start);

  const perNode = new Map<
    Text,
    Array<{ rs: number; re: number; ann: Annotation }>
  >();
  let ni = 0;
  for (const ann of anns) {
    const aStart = ann.start;
    const aEnd = ann.end;
    while (ni < nodes.length && nodes[ni].end <= aStart) ni++;
    for (let j = ni; j < nodes.length; j++) {
      const { node, start: ns, end: ne } = nodes[j];
      if (ns >= aEnd) break;
      const s = Math.max(aStart, ns);
      const e = Math.min(aEnd, ne);
      if (s < e) {
        const arr =
          perNode.get(node) ?? (perNode.set(node, []), perNode.get(node)!);
        arr.push({ rs: s - ns, re: e - ns, ann });
      }
    }
  }

  const getOverlayLayer = (pageDiv: HTMLElement): HTMLDivElement => {
    const textLayer = pageDiv.querySelector(".textLayer") as HTMLElement | null;
    const parent = textLayer || pageDiv;
    let layer = parent.querySelector(".pdfOverlayLayer") as
      | HTMLDivElement
      | null;
    if (!layer) {
      layer = document.createElement("div");
      layer.className = "pdfOverlayLayer";
      layer.style.position = "absolute";
      (layer.style as any).inset = "0";
      layer.style.pointerEvents = "none";
      layer.style.zIndex = "4";
      parent.appendChild(layer);
    }
    return layer;
  };

  for (const [node, rangesRaw] of perNode) {
    const full = node.nodeValue ?? "";
    if (!full) continue;
    const hostEl = node.parentElement as HTMLElement | null;
    if (!hostEl) continue;
    const pageDiv = hostEl.closest(".page") as HTMLElement | null;
    if (!pageDiv) continue;
    const overlayLayer = getOverlayLayer(pageDiv);
    const textLayer = pageDiv.querySelector(".textLayer") as
      | HTMLElement
      | null;
    const anchorEl = textLayer || pageDiv;
    const { scaleX, scaleY } = getElementScale(anchorEl);

    type Ev = { x: number; type: "start" | "end"; ann: Annotation };
    const events: Ev[] = [];
    for (const { rs, re, ann } of rangesRaw) {
      if (rs < re) {
        events.push({ x: rs, type: "start", ann });
        events.push({ x: re, type: "end", ann });
      }
    }
    events.sort((a, b) =>
      a.x !== b.x
        ? a.x - b.x
        : a.type === b.type
          ? 0
          : a.type === "end"
            ? -1
            : 1
    );

    const active: Annotation[] = [];
    let cursor = 0;

    const drawSegment = (from: number, to: number, covering: Annotation[]) => {
      if (from >= to || covering.length === 0) return;
      const range = document.createRange();
      try {
        range.setStart(node, from);
        range.setEnd(node, to);
      } catch {
        return;
      }
      const rects = Array.from(range.getClientRects());
      const anchorBCR = anchorEl.getBoundingClientRect();
      const primary = covering[0];
      for (const r of rects) {
        if (r.width <= 0 || r.height <= 0) continue;
        const hl = document.createElement("div");
        hl.className = "pdfOverlayHighlight";
        hl.style.position = "absolute";
        const left = Math.round((r.left - anchorBCR.left) / scaleX);
        const top = Math.round((r.top - anchorBCR.top) / scaleY);
        const width = Math.round(r.width / scaleX);
        const height = Math.round(r.height / scaleY);
        hl.style.left = `${left}px`;
        hl.style.top = `${top}px`;
        hl.style.width = `${width}px`;
        hl.style.height = `${height}px`;
        hl.style.background = "rgba(168, 122, 245, 0.35)";
        hl.style.mixBlendMode = "multiply";
        hl.style.borderRadius = "2px";
        hl.style.pointerEvents = "none";
        if ((primary as any)?.id) {
          hl.dataset.annid = String((primary as any).id);
        }
        overlayLayer.appendChild(hl);
      }
    };

    for (const ev of events) {
      if (cursor < ev.x) drawSegment(cursor, ev.x, active);
      if (ev.type === "start") {
        if (!active.includes(ev.ann)) active.push(ev.ann);
      } else {
        const idx = active.indexOf(ev.ann);
        if (idx !== -1) active.splice(idx, 1);
      }
      cursor = ev.x;
    }
    if (cursor < full.length) drawSegment(cursor, full.length, active);
  }
}

export default function PdfViewer({
  src,
  className,
  annotations = [],
}: PdfViewerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const viewerRef = useRef<any>(null);
  const cleanupRef = useRef<() => void>(() => {});
  const resizeObserverRef = useRef<ResizeObserver | null>(null);
  const annotationsRef = useRef<Annotation[]>(annotations);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    annotationsRef.current = annotations ?? [];
    const container = containerRef.current;
    if (!container || !viewerRef.current) return;

    alignTextLayers(container);
    drawOverlayHighlights(container, annotationsRef.current);
  }, [annotations]);

  useEffect(() => {
    let cancelled = false;

    const teardown = () => {
      try {
        cleanupRef.current();
      } catch {
        // ignore teardown errors
      }
      cleanupRef.current = () => {};
      resizeObserverRef.current?.disconnect();
      resizeObserverRef.current = null;
      viewerRef.current = null;
    };

    const setup = async () => {
      const container = containerRef.current;
      if (!container) return;

      teardown();
      container.innerHTML = "";
      container.style.position = container.style.position || "relative";
      container.style.overflow = "auto";

      const viewerHost = document.createElement("div");
      viewerHost.className = "pdfViewer";
      container.appendChild(viewerHost);

      try {
        const { pdfjsLib, pdfjsViewer } = await loadPdfJs();
        if (cancelled) return;

        const cleanupFns: Array<() => void> = [];
        const eventBus = new pdfjsViewer.EventBus();
        const linkService = new pdfjsViewer.PDFLinkService({ eventBus });
        const viewer = new pdfjsViewer.PDFViewer({
          container,
          eventBus,
          linkService,
          textLayerMode: 1,
        });
        linkService.setViewer(viewer);
        viewerRef.current = viewer;

        const loadingTask = pdfjsLib.getDocument({ url: src, withCredentials: false });
        const pdf = await loadingTask.promise;
        if (cancelled) {
          try {
            await loadingTask.destroy?.();
          } catch {
            /* noop */
          }
          return;
        }

        linkService.setDocument(pdf, null);
        viewer.setDocument(pdf);

        const handlePagesInit = () => {
          try {
            viewer.currentScaleValue = "page-width";
          } catch {
            /* ignore */
          }
          alignTextLayers(container);
          drawOverlayHighlights(container, annotationsRef.current);
        };
        eventBus.on("pagesinit", handlePagesInit);
        cleanupFns.push(() => {
          try {
            eventBus.off("pagesinit", handlePagesInit);
          } catch {
            /* noop */
          }
        });

        const handleTextLayerRendered = () => {
          alignTextLayers(container);
          drawOverlayHighlights(container, annotationsRef.current);
        };
        eventBus.on("textlayerrendered", handleTextLayerRendered as any);
        cleanupFns.push(() => {
          try {
            eventBus.off("textlayerrendered", handleTextLayerRendered as any);
          } catch {
            /* noop */
          }
        });

        try {
          const ro = new ResizeObserver(() => {
            if (!viewerRef.current) return;
            try {
              viewerRef.current.currentScaleValue = "page-width";
            } catch {
              /* noop */
            }
            alignTextLayers(container);
            drawOverlayHighlights(container, annotationsRef.current);
          });
          ro.observe(container);
          resizeObserverRef.current = ro;
          cleanupFns.push(() => {
            try {
              ro.disconnect();
            } catch {
              /* noop */
            }
            resizeObserverRef.current = null;
          });
        } catch {
          /* ResizeObserver may be unavailable */
        }

        cleanupFns.push(() => {
          try {
            viewer.cleanup?.();
          } catch {
            /* noop */
          }
          try {
            linkService.setDocument?.(null, null);
          } catch {
            /* noop */
          }
        });

        cleanupFns.push(() => {
          try {
            pdf.destroy?.();
          } catch {
            /* noop */
          }
        });

        cleanupFns.push(() => {
          try {
            loadingTask.destroy?.();
          } catch {
            /* noop */
          }
        });

        cleanupRef.current = () => {
          cleanupFns.splice(0, cleanupFns.length).forEach((fn) => {
            try {
              fn();
            } catch {
              /* noop */
            }
          });
        };

        setError(null);
      } catch (err: any) {
        if (cancelled) return;
        console.error("[PdfViewer]", err);
        setError(err?.message ?? "Failed to render PDF");
      }
    };

    setup();

    return () => {
      cancelled = true;
      teardown();
    };
  }, [src]);

  return (
    <div className={className} style={{ width: "100%", height: "100%" }}>
      {error ? (
        <div className="text-red-500 text-sm p-4">{error}</div>
      ) : (
        <div
          ref={containerRef}
          style={{ width: "100%", height: "100%", overflow: "auto", position: "absolute" }}
        />
      )}
    </div>
  );
}
