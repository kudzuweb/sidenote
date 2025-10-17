type PdfParseParameters = {
  itemJoiner?: string;
  pageJoiner?: string;
  lineEnforce?: boolean;
};

type PdfParserInstance = {
  getText: (params?: PdfParseParameters) => Promise<{ text: string }>;
  getInfo: (params?: PdfParseParameters) => Promise<unknown>;
  destroy: () => Promise<void>;
};

type PdfParseCtor = new (options: { data: Uint8Array | Buffer }) => PdfParserInstance;

let cachedPdfParseCtor: PdfParseCtor | null = null;
let pdfParseCtorPromise: Promise<PdfParseCtor> | null = null;

const loadPdfParser = async (): Promise<PdfParseCtor> => {
  if (cachedPdfParseCtor) return cachedPdfParseCtor;
  if (!pdfParseCtorPromise) {
    pdfParseCtorPromise = import("pdf-parse").then(module => {
      cachedPdfParseCtor = module.PDFParse as unknown as PdfParseCtor;
      return cachedPdfParseCtor;
    });
  }
  return pdfParseCtorPromise;
};

let pdfjsModulePromise: Promise<any> | null = null;

const loadPdfJs = async () => {
  if (!pdfjsModulePromise) {
    pdfjsModulePromise = import("pdfjs-dist/legacy/build/pdf.mjs").then(module => {
      if (module?.GlobalWorkerOptions) {
        module.GlobalWorkerOptions.workerSrc = undefined;
      }
      return module;
    });
  }
  return pdfjsModulePromise;
};

const normalizePdfText = (raw: string) => {
  return raw
    .replace(/\r\n?/g, "\n")
    .replace(/\f/g, "\n\n")
    .replace(/\u00a0/g, " ")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
};

export class PdfExtractionError extends Error {
  constructor(message: string, public readonly cause?: unknown) {
    super(message);
    this.name = "PdfExtractionError";
  }
}

const primaryParseParameters: PdfParseParameters = {
  itemJoiner: " ",
  pageJoiner: "\n\n",
  lineEnforce: true,
};

type ExtractedPdf = {
  text: string;
  metadata: Record<string, unknown>;
  version?: string;
};

export async function extractPdfText(buffer: Buffer): Promise<ExtractedPdf> {
  const PdfParse = await loadPdfParser();
  const parser = new PdfParse({ data: buffer });

  let primaryError: unknown;
  let textResult: { text: string } | null = null;
  let infoResult: unknown = null;

  try {
    textResult = await parser.getText(primaryParseParameters);
    if (!textResult?.text?.trim()) {
      throw new Error("Primary parser returned no text");
    }
    infoResult = await parser.getInfo().catch(infoError => {
      console.warn("[pdf-extractor] unable to read PDF metadata", infoError);
      return null;
    });
  } catch (error) {
    primaryError = error;
  } finally {
    try {
      await parser.destroy();
    } catch {
      // best effort cleanup
    }
  }

  if (!textResult?.text?.trim()) {
    if (primaryError) {
      console.warn("[pdf-extractor] primary parser failed; attempting fallback", primaryError);
    } else {
      console.warn("[pdf-extractor] primary parser returned no text; attempting fallback");
    }
    return runFallbackExtraction(buffer, primaryError);
  }

  const text = normalizePdfText(textResult.text);
  if (!text) {
    throw new PdfExtractionError("No text remaining after normalization");
  }

  const metadata = mergeMetadata(infoResult);
  const version = extractPdfVersion(infoResult, metadata);

  return {
    text,
    metadata,
    version,
  };
}

const mergeMetadata = (source: unknown): Record<string, unknown> => {
  if (!source || typeof source !== "object") return {};
  const result: Record<string, unknown> = {};
  const maybeInfo = (source as { info?: unknown }).info;
  if (maybeInfo && typeof maybeInfo === "object") {
    Object.assign(result, maybeInfo as Record<string, unknown>);
  }
  const maybeMetadata = (source as { metadata?: unknown }).metadata;
  if (maybeMetadata) {
    if (typeof maybeMetadata === "object") {
      const metaObj = maybeMetadata as Record<string, unknown> & { getAll?: () => unknown };
      if (typeof metaObj.getAll === "function") {
        const entries = metaObj.getAll();
        if (entries && typeof entries === "object") {
          Object.assign(result, entries as Record<string, unknown>);
        }
      } else {
        Object.assign(result, metaObj);
      }
    }
  }
  return result;
};

const extractPdfVersion = (
  infoSource: unknown,
  metadata: Record<string, unknown>
): string | undefined => {
  const candidates: Array<unknown> = [];
  if (infoSource && typeof infoSource === "object") {
    const info = (infoSource as { info?: unknown }).info;
    if (info && typeof info === "object") {
      const infoRecord = info as Record<string, unknown>;
      candidates.push(
        infoRecord.PDFFormatVersion,
        infoRecord.Version,
        infoRecord.version,
        infoRecord["pdf:PDFVersion"],
        infoRecord["pdf:version"]
      );
      if (typeof infoRecord["dc:format"] === "string") {
        candidates.push(infoRecord["dc:format"]);
      }
    }
  }
  candidates.push(
    metadata.PDFFormatVersion,
    metadata.Version,
    metadata.version,
    metadata["pdf:PDFVersion"],
    metadata["pdf:version"],
    metadata["xap:PDFVersion"],
    metadata["dc:format"]
  );

  for (const candidate of candidates) {
    if (typeof candidate !== "string") continue;
    const trimmed = candidate.trim();
    if (!trimmed) continue;
    const match = trimmed.match(/(\d+(?:\.\d+)+)/);
    if (match) return match[1];
    return trimmed;
  }
  return undefined;
};

const runFallbackExtraction = async (
  buffer: Buffer,
  cause?: unknown
): Promise<ExtractedPdf> => {
  let loadingTask: any;
  let document: any;
  try {
    const pdfjs = await loadPdfJs();
    const data = new Uint8Array(buffer);
    loadingTask = pdfjs.getDocument({ data });
    document = await loadingTask.promise;

    const pageTexts: string[] = [];
    const totalPages = typeof document?.numPages === "number" ? document.numPages : 0;
    for (let pageNumber = 1; pageNumber <= totalPages; pageNumber += 1) {
      const page = await document.getPage(pageNumber);
      const content = await page.getTextContent();
      const pageText = content.items
        .map((item: any) => (typeof item?.str === "string" ? item.str : ""))
        .join(" ");
      pageTexts.push(pageText);
    }

    const metadataResult = await document.getMetadata().catch(() => null);
    const metadata = mergeMetadata(metadataResult);
    const version = extractPdfVersion(metadataResult, metadata);
    const fallbackText = normalizePdfText(pageTexts.join("\n\n"));
    if (!fallbackText) {
      throw new PdfExtractionError("No text remaining after normalization", cause);
    }
    return {
      text: fallbackText,
      metadata,
      version,
    };
  } catch (error) {
    if (error instanceof PdfExtractionError) throw error;
    throw new PdfExtractionError("Failed to parse PDF buffer", error ?? cause);
  } finally {
    if (document) {
      try {
        if (typeof document.cleanup === "function") {
          await document.cleanup();
        }
      } catch {
        // ignore cleanup errors
      }
      try {
        if (typeof document.destroy === "function") {
          await document.destroy();
        }
      } catch {
        // ignore destroy errors
      }
    }
    if (loadingTask && typeof loadingTask.destroy === "function") {
      try {
        await loadingTask.destroy();
      } catch {
        // ignore destroy errors
      }
    }
  }
};
