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

export default function PdfViewer({ src, className, maxPages, annotations = [], theme }: PdfViewerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [error, setError] = useState<string | null>(null);
  const logPrefix = "[PdfViewer]";

  useEffect(() => {
    let cancelled = false;

    async function loadPdfJsViewer() {
      // Strictly bundled (non-CDN) path
      const pdfjsLib = await import(/* @vite-ignore */ "pdfjs-dist/build/pdf.mjs");
      try {
        const workerUrlMod: any = await import(/* @vite-ignore */ "pdfjs-dist/build/pdf.worker.min.mjs?url");
        if (workerUrlMod?.default) {
          (pdfjsLib as any).GlobalWorkerOptions.workerSrc = workerUrlMod.default;
          console.info(logPrefix, "Configured worker from bundled url");
        }
      } catch (e) {
        console.warn(logPrefix, "Failed to resolve worker via ?url, attempting default worker path", e);
      }
      // expose for legacy code that expects window.pdfjsLib
      window.pdfjsLib = pdfjsLib as any;
      const pdfjsViewer = await import(/* @vite-ignore */ "pdfjs-dist/web/pdf_viewer.mjs");
      return { pdfjsLib, pdfjsViewer };
    }

    async function render() {
      setError(null);
      const container = containerRef.current;
      if (!container) return;
      container.innerHTML = "";

      try {
        const { pdfjsLib, pdfjsViewer } = await loadPdfJsViewer();
        if (cancelled) return;

        if (!src) throw new Error("Empty PDF src");

        // Build viewer container structure
        // Ensure container is absolutely positioned as required by pdf.js viewer
        const cs = window.getComputedStyle(container);
        if (cs.position !== "absolute") {
          console.warn(logPrefix, "Adjusting container to absolute positioning");
          container.style.position = "absolute";
          (container.style as any).inset = "0";
          container.style.left = "0";
          container.style.top = "0";
          container.style.right = "0";
          container.style.bottom = "0";
        }

        const viewerHost = document.createElement("div");
        viewerHost.className = "pdfViewer"; // required class name for PDFViewer styling
        container.appendChild(viewerHost);

        const eventBus = new (pdfjsViewer as any).EventBus();
        const linkService = new (pdfjsViewer as any).PDFLinkService({ eventBus });
        const findController = new (pdfjsViewer as any).PDFFindController({ eventBus, linkService });

        const viewer = new (pdfjsViewer as any).PDFViewer({
          container,
          eventBus,
          linkService,
          findController,
          textLayerMode: 1,
          // Make scroll scale-friendly to avoid blurry textLayer when zooming
          enableScripting: false,
        });
        linkService.setViewer(viewer);

        const loadingTask = (pdfjsLib as any).getDocument({ url: src, withCredentials: false });
        const pdf = await loadingTask.promise;
        if (cancelled) return;

        viewer.setDocument(pdf);
        linkService.setDocument(pdf, null);

        const onPagesInit = () => {
          try { viewer.currentScaleValue = "page-width"; } catch {}
          try { viewer.update?.(); } catch {}
          try { injectHighlights(container, annotations); } catch (e) {
            console.warn(logPrefix, "Highlight injection failed after pagesinit", e);
          }
        };
        eventBus.on("pagesinit", onPagesInit);

        const onTextLayerRendered = () => {
          try { injectHighlights(container, annotations); } catch {}
        };
        eventBus.on("textlayerrendered", onTextLayerRendered as any);

        console.info(logPrefix, `Loaded PDF (pages=${pdf.numPages})`, { src });
      } catch (e: any) {
        if (cancelled) return;
        console.error(logPrefix, "Viewer error", e);
        setError(e?.message ?? "Failed to render PDF");
      }
    }

    render();
    return () => {
      cancelled = true;
    };
  }, [src, maxPages, JSON.stringify(annotations)]);

  function injectHighlights(rootEl: HTMLElement, annsAll: Annotation[]) {
    // 1) collect text nodes in render order with absolute offsets
    const walker = document.createTreeWalker(rootEl, NodeFilter.SHOW_TEXT);
    const nodes: Array<{ node: Text; start: number; end: number }> = [];
    let pos = 0;
    while (walker.nextNode()) {
      const node = walker.currentNode as Text;
      const len = node.nodeValue?.length ?? 0;
      if (len > 0) nodes.push({ node, start: pos, end: pos + len });
      pos += len;
    }

    const anns = (annsAll ?? [])
      .filter((a) => Number.isFinite(a.start) && Number.isFinite(a.end) && a.end > a.start)
      .slice()
      .sort((a, b) => a.start - b.start);

    const perNode = new Map<Text, Array<{ rs: number; re: number; ann: Annotation }>>();
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
          const arr = perNode.get(node) ?? (perNode.set(node, []), perNode.get(node)!);
          arr.push({ rs: s - ns, re: e - ns, ann });
        }
      }
    }

    for (const [node, rangesRaw] of perNode) {
      const full = node.nodeValue ?? "";
      if (!full) continue;

      type Ev = { x: number; type: "start" | "end"; ann: Annotation };
      const events: Ev[] = [];
      for (const { rs, re, ann } of rangesRaw) {
        if (rs < re) {
          events.push({ x: rs, type: "start", ann });
          events.push({ x: re, type: "end", ann });
        }
      }
      events.sort((a, b) => (a.x !== b.x ? a.x - b.x : a.type === b.type ? 0 : a.type === "end" ? -1 : 1));

      const frag = document.createDocumentFragment();
      const active: Annotation[] = [];
      let cursor = 0;

      const pushPlain = (text: string) => { if (text) frag.append(text); };
      const pushMarked = (text: string, covering: Annotation[]) => {
        const primary = covering[0];
        const mark = document.createElement("mark");
        mark.textContent = text;
        mark.className = "anno-mark";
        mark.style.background = "rgba(168, 122, 245, 0.35)"; // default highlight
        mark.style.mixBlendMode = "multiply";
        const ids = covering.map((a) => (a.id ? String(a.id) : ""));
        if (ids.length) {
          mark.dataset.annids = JSON.stringify(ids);
          mark.dataset.annid = ids[0];
        }
        const noteVal = (primary as any)?.note ?? (primary as any)?.body ?? "";
        if (noteVal) mark.dataset.note = String(noteVal);
        mark.dataset.ranges = JSON.stringify(covering.map((a) => ({ start: a.start, end: a.end })));
        frag.append(mark);
      };

      const emitSegment = (from: number, to: number) => {
        if (from >= to) return;
        const text = full.slice(from, to);
        if (active.length === 0) pushPlain(text); else pushMarked(text, active);
      };

      for (const ev of events) {
        if (cursor < ev.x) emitSegment(cursor, ev.x);
        if (ev.type === "start") { if (!active.includes(ev.ann)) active.push(ev.ann); }
        else { const idx = active.indexOf(ev.ann); if (idx !== -1) active.splice(idx, 1); }
        cursor = ev.x;
      }
      if (cursor < full.length) emitSegment(cursor, full.length);
      node.parentNode?.replaceChild(frag, node);
    }
  }

  return (
    <div className={className} style={{ width: "100%", height: "100%", overflowY: "auto" }}>
      {error ? (
        <div className="text-red-500 text-sm p-4">{error}</div>
      ) : (
        <div ref={containerRef} className="p-4 flex flex-col items-stretch" />
      )}
    </div>
  );
}


