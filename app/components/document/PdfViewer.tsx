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

const PDF_DEBUG = false;

function isDebugEnabled(): boolean {
  if (!PDF_DEBUG) return false;
  if (typeof window === "undefined") return false;
  if ((window as any).__PDF_DEBUG__ === false) return false;
  return true;
}

function debugLog(...args: any[]) {
  if (!isDebugEnabled()) return;
  // eslint-disable-next-line no-console
  console.log(...args);
}

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

type SnapshotInfo = {
  label: string;
  event?: any;
  container: HTMLElement;
  viewer: any;
};

function logLayerSnapshot({ label, event, container, viewer }: SnapshotInfo) {
  if (!isDebugEnabled()) return;
  try {
    const scale =
      typeof viewer?.currentScale === "number"
        ? viewer.currentScale
        : viewer?._currentScale;
    const scaleValue = viewer?.currentScaleValue;
    const pages = Array.from(
      container.querySelectorAll<HTMLElement>(".page")
    );
    const rows = pages.map((page, index) => {
      const canvasWrapper = page.querySelector<HTMLElement>(".canvasWrapper");
      const textLayer = page.querySelector<HTMLElement>(".textLayer");
      const canvasRect = canvasWrapper?.getBoundingClientRect();
      const textRect = textLayer?.getBoundingClientRect();
      const canvasStyles = canvasWrapper
        ? window.getComputedStyle(canvasWrapper)
        : null;
      const textStyles = textLayer ? window.getComputedStyle(textLayer) : null;
      const pageNumber = page.dataset.pageNumber
        ? Number(page.dataset.pageNumber)
        : index + 1;
      const widthDiff =
        canvasRect && textRect
          ? Number((textRect.width - canvasRect.width).toFixed(2))
          : null;
      const heightDiff =
        canvasRect && textRect
          ? Number((textRect.height - canvasRect.height).toFixed(2))
          : null;
      const widthRatio =
        canvasRect && textRect && canvasRect.width !== 0
          ? Number((textRect.width / canvasRect.width).toFixed(4))
          : null;
      const heightRatio =
        canvasRect && textRect && canvasRect.height !== 0
          ? Number((textRect.height / canvasRect.height).toFixed(4))
          : null;
      return {
        page: pageNumber,
        canvasW: canvasRect ? Number(canvasRect.width.toFixed(2)) : null,
        canvasH: canvasRect ? Number(canvasRect.height.toFixed(2)) : null,
        textW: textRect ? Number(textRect.width.toFixed(2)) : null,
        textH: textRect ? Number(textRect.height.toFixed(2)) : null,
        widthDiff,
        heightDiff,
        widthRatio,
        heightRatio,
        canvasTransform: canvasStyles?.transform ?? "none",
        textTransform: textStyles?.transform ?? "none",
        textOrigin: textStyles?.transformOrigin ?? "",
      };
    });
    // eslint-disable-next-line no-console
    console.groupCollapsed(
      `[PdfViewer][${label}] scale=${scale}, scaleValue=${scaleValue}`
    );
    if (event) {
      // eslint-disable-next-line no-console
      console.log("event", event);
    }
    // eslint-disable-next-line no-console
    console.table(rows);
    // eslint-disable-next-line no-console
    console.log("container metrics", {
      clientWidth: container.clientWidth,
      clientHeight: container.clientHeight,
      scrollWidth: container.scrollWidth,
      scrollHeight: container.scrollHeight,
    });
    // eslint-disable-next-line no-console
    console.groupEnd();
  } catch (error) {
    debugLog("[PdfViewer] logLayerSnapshot error", error);
  }
}

function drawOverlayHighlights(rootEl: HTMLElement, annsAll: Annotation[]) {
  if (isDebugEnabled()) {
    debugLog("[PdfViewer] drawOverlayHighlights:start", {
      annotationsCount: annsAll?.length ?? 0,
      existingHighlights: rootEl.querySelectorAll(".pdfOverlayHighlight").length,
    });
  }
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

  if (isDebugEnabled()) {
    debugLog("[PdfViewer] drawOverlayHighlights:end", {
      pageCount: rootEl.querySelectorAll(".page").length,
      highlightCount: rootEl.querySelectorAll(".pdfOverlayHighlight").length,
    });
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
  const annotationsRef = useRef<Annotation[]>(annotations);
  const [error, setError] = useState<string | null>(null);

  const snapshot = (label: string, event?: any) => {
    const container = containerRef.current;
    const viewer = viewerRef.current;
    if (!container || !viewer) {
      if (isDebugEnabled()) {
        debugLog("[PdfViewer] snapshot skipped", {
          label,
          hasContainer: !!container,
          hasViewer: !!viewer,
        });
      }
      return;
    }
    logLayerSnapshot({ label, event, container, viewer });
  };

  useEffect(() => {
    if (isDebugEnabled()) {
      debugLog("[PdfViewer] annotations changed", {
        count: annotations?.length ?? 0,
      });
    }
    annotationsRef.current = annotations ?? [];
    const container = containerRef.current;
    if (!container || !viewerRef.current) return;

    drawOverlayHighlights(container, annotationsRef.current);
    snapshot("annotations effect");
  }, [annotations]);

  useEffect(() => {
    if (isDebugEnabled()) {
      debugLog("[PdfViewer] viewer effect run", { src });
    }

    let cancelled = false;

    const teardown = () => {
      if (isDebugEnabled()) {
        debugLog("[PdfViewer] teardown", {
          hasViewer: !!viewerRef.current,
        });
      }
      try {
        cleanupRef.current();
      } catch {
        // ignore teardown errors
      }
      cleanupRef.current = () => {};
      viewerRef.current = null;
    };

    const setup = async () => {
      if (isDebugEnabled()) {
        debugLog("[PdfViewer] setup start", { src });
      }
      const container = containerRef.current;
      if (!container) return;

      teardown();
      container.innerHTML = "";
      container.style.position = "absolute";
      (container.style as any).inset = "0";
      container.style.overflow = "auto";
      if (isDebugEnabled()) {
        debugLog("[PdfViewer] container initialized", {
          clientWidth: container.clientWidth,
          clientHeight: container.clientHeight,
          scrollWidth: container.scrollWidth,
          scrollHeight: container.scrollHeight,
        });
      }

      const viewerHost = document.createElement("div");
      viewerHost.className = "pdfViewer";
      container.appendChild(viewerHost);
      if (isDebugEnabled()) {
        debugLog("[PdfViewer] viewer host appended", {
          childCount: container.children.length,
        });
      }

      try {
        const { pdfjsLib, pdfjsViewer } = await loadPdfJs();
        if (cancelled) return;
        if (isDebugEnabled()) {
          debugLog("[PdfViewer] pdf.js modules loaded", {
            version: pdfjsLib?.version,
          });
        }

        const cleanupFns: Array<() => void> = [];
        const eventBus = new pdfjsViewer.EventBus();
        const linkService = new pdfjsViewer.PDFLinkService({ eventBus });
        const viewer = new pdfjsViewer.PDFViewer({
          container,
          viewer: viewerHost,
          eventBus,
          linkService,
          textLayerMode: 1,
        });
        linkService.setViewer(viewer);
        viewerRef.current = viewer;
        if (isDebugEnabled()) {
          debugLog("[PdfViewer] PDFViewer instantiated", {
            pagesCount: viewer.pagesCount,
            currentScale: viewer.currentScale,
            currentScaleValue: viewer.currentScaleValue,
          });
        }
        snapshot("after viewer init");

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
        if (isDebugEnabled()) {
          debugLog("[PdfViewer] document loaded", {
            numPages: pdf?.numPages,
            fingerprint: pdf?.fingerprint,
          });
        }

        linkService.setDocument(pdf, null);
        viewer.setDocument(pdf);
        snapshot("after setDocument", { numPages: pdf?.numPages });

        const ensurePageWidth = async () => {
          if (!viewerRef.current) return;
          if (isDebugEnabled()) {
            debugLog("[PdfViewer] ensurePageWidth:start", {
              currentScale: viewerRef.current.currentScale,
              currentScaleValue: viewerRef.current.currentScaleValue,
            });
          }
          try {
            await (document as any).fonts?.ready;
          } catch {
            /* ignore font readiness */
          }
          if (!viewerRef.current) return;
          try {
            viewerRef.current.currentScaleValue = "page-width";
          } catch {
            /* ignore */
          }
          try {
            viewerRef.current.update?.();
          } catch {
            /* ignore */
          }
          snapshot("ensurePageWidth:after");
        };

        const handlePagesInit = (evt: any) => {
          if (isDebugEnabled()) {
            debugLog("[PdfViewer] pagesinit", {
              event: evt,
              currentScale: viewerRef.current?.currentScale,
            });
          }
          ensurePageWidth().finally(() => {
            drawOverlayHighlights(container, annotationsRef.current);
            snapshot("pagesinit:after", evt);
          });
        };
        eventBus.on("pagesinit", handlePagesInit);
        cleanupFns.push(() => {
          try {
            eventBus.off("pagesinit", handlePagesInit);
          } catch {
            /* noop */
          }
        });

        const handleTextLayerRendered = (evt: any) => {
          if (isDebugEnabled()) {
            debugLog("[PdfViewer] textlayerrendered", evt);
          }
          drawOverlayHighlights(container, annotationsRef.current);
          snapshot("textlayerrendered", evt);
        };
        eventBus.on("textlayerrendered", handleTextLayerRendered);
        cleanupFns.push(() => {
          try {
            eventBus.off("textlayerrendered", handleTextLayerRendered);
          } catch {
            /* noop */
          }
        });

        const handlePageRendered = (evt: any) => {
          if (isDebugEnabled()) {
            debugLog("[PdfViewer] pagerendered", evt);
          }
          snapshot("pagerendered", evt);
        };
        eventBus.on("pagerendered", handlePageRendered);
        cleanupFns.push(() => {
          try {
            eventBus.off("pagerendered", handlePageRendered);
          } catch {
            /* noop */
          }
        });

        const handleScaleChanging = (evt: any) => {
          if (isDebugEnabled()) {
            debugLog("[PdfViewer] scalechanging", {
              event: evt,
              currentScale: viewerRef.current?.currentScale,
            });
          }
          snapshot("scalechanging", evt);
        };
        eventBus.on("scalechanging", handleScaleChanging);
        cleanupFns.push(() => {
          try {
            eventBus.off("scalechanging", handleScaleChanging);
          } catch {
            /* noop */
          }
        });

        const handleScaleChange = (evt: any) => {
          if (isDebugEnabled()) {
            debugLog("[PdfViewer] scalechange", {
              event: evt,
              currentScale: viewerRef.current?.currentScale,
            });
          }
          snapshot("scalechange", evt);
        };
        eventBus.on("scalechange", handleScaleChange);
        cleanupFns.push(() => {
          try {
            eventBus.off("scalechange", handleScaleChange);
          } catch {
            /* noop */
          }
        });

        const handlePagesLoaded = (evt: any) => {
          if (isDebugEnabled()) {
            debugLog("[PdfViewer] pagesloaded", evt);
          }
          snapshot("pagesloaded", evt);
        };
        eventBus.on("pagesloaded", handlePagesLoaded);
        cleanupFns.push(() => {
          try {
            eventBus.off("pagesloaded", handlePagesLoaded);
          } catch {
            /* noop */
          }
        });

        ensurePageWidth();
        snapshot("post ensurePageWidth call");

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
          if (isDebugEnabled()) {
            debugLog("[PdfViewer] cleanup run", {
              remaining: cleanupFns.length,
            });
          }
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
      if (isDebugEnabled()) {
        debugLog("[PdfViewer] effect cleanup", { src });
      }
      teardown();
    };
  }, [src]);

  return (
    <div
      className={className}
      style={{ width: "100%", height: "100%", position: "absolute" }}
    >
      {error ? (
        <div className="text-red-500 text-sm p-4">{error}</div>
      ) : (
        <div
          ref={containerRef}
          style={{ position: "absolute", inset: 0, overflow: "auto" }}
        />
      )}
    </div>
  );
}
