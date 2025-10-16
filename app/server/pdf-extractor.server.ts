import { createRequire } from "module";
import { PDFLoader } from "@langchain/community/document_loaders/fs/pdf";

type PdfParseResult = {
  text: string;
  numpages: number;
  numrender: number;
  info: unknown;
  metadata: Record<string, unknown> | null;
  version: string;
};

type PdfParseOptions = {
  pagerender?: (pageData: any) => string | Promise<string>;
  max?: number;
  version?: string;
};

type PdfParseFn = (dataBuffer: Buffer, options?: PdfParseOptions) => Promise<PdfParseResult>;

const requireForPdf = createRequire(import.meta.url);
let cachedParser: PdfParseFn | null = null;

const loadPdfParser = (): PdfParseFn => {
  if (cachedParser) return cachedParser;
  const parser = requireForPdf("pdf-parse") as PdfParseFn;
  cachedParser = parser;
  return parser;
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

const createPdfBlob = (buffer: Buffer) => {
  if (typeof Blob !== "undefined") {
    return new Blob([buffer], { type: "application/pdf" });
  }
  const { Blob: NodeBlob } = requireForPdf("buffer") as { Blob: typeof Blob };
  return new NodeBlob([buffer], { type: "application/pdf" });
};

const primaryParseOptions: PdfParseOptions = {
  max: 0,
  pagerender: pageData =>
    pageData.getTextContent().then((content: any) =>
      content.items
        .map((item: any) => (typeof item?.str === "string" ? item.str : ""))
        .join(" ")
    ),
};

type ExtractedPdf = {
  text: string;
  metadata: Record<string, unknown>;
  version?: string;
};

export async function extractPdfText(buffer: Buffer): Promise<ExtractedPdf> {
  const pdfParse = loadPdfParser();

  let parsed: PdfParseResult | null = null;
  let primaryError: unknown;
  try {
    parsed = await pdfParse(buffer, primaryParseOptions);
  } catch (error) {
    primaryError = error;
  }

  if (!parsed?.text?.trim()) {
    if (primaryError) {
      console.warn("[pdf-extractor] primary parser failed; attempting fallback", primaryError);
    } else {
      console.warn("[pdf-extractor] primary parser returned no text; attempting fallback");
    }
    try {
      const loader = new PDFLoader(createPdfBlob(buffer), {
        splitPages: false,
        parsedItemSeparator: " ",
      });
      const docs = await loader.load();
      const fallbackText = normalizePdfText(docs.map(doc => doc.pageContent).join("\n\n"));
      if (!fallbackText) {
        throw new PdfExtractionError("No text remaining after normalization");
      }
      const metadata = (docs[0]?.metadata?.pdf as Record<string, unknown> | undefined) ?? {};
      return {
        text: fallbackText,
        metadata,
        version: typeof metadata.version === "string" ? metadata.version : undefined,
      };
    } catch (fallbackError) {
      throw new PdfExtractionError("Failed to parse PDF buffer", fallbackError ?? primaryError);
    }
  }

  const text = normalizePdfText(parsed.text);
  if (!text) {
    throw new PdfExtractionError("No text remaining after normalization");
  }

  return {
    text,
    metadata: parsed.metadata ?? {},
    version: parsed.version,
  };
}
