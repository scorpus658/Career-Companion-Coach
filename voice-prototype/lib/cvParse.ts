import mammoth from "mammoth";

export const MAX_CV_BYTES = 5 * 1024 * 1024;

const PDF_MIMES = new Set(["application/pdf"]);
const DOCX_MIMES = new Set([
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/msword",
]);

export type CvKind = "pdf" | "docx";

export function classifyCv(mime: string, fileName: string): CvKind | null {
  if (PDF_MIMES.has(mime) || fileName.toLowerCase().endsWith(".pdf")) return "pdf";
  if (DOCX_MIMES.has(mime) || fileName.toLowerCase().endsWith(".docx")) return "docx";
  return null;
}

export async function extractCvText(
  buffer: Buffer,
  kind: CvKind
): Promise<string> {
  if (kind === "pdf") {
    // pdf-parse v2 exposes a PDFParse class taking a LoadParameters object.
    // Convert Buffer -> Uint8Array (the class also accepts Buffer but Uint8Array
    // is the documented input shape).
    const { PDFParse } = await import("pdf-parse");
    const parser = new PDFParse({ data: new Uint8Array(buffer) });
    try {
      const result = await parser.getText();
      return result.text.trim();
    } finally {
      await parser.destroy();
    }
  }
  const { value } = await mammoth.extractRawText({ buffer });
  return value.trim();
}
