import "server-only";

import { PDFParse } from "pdf-parse";

export async function extractPdfText(file: ArrayBuffer | Buffer) {
  const parser = new PDFParse({
    data: file instanceof Buffer ? file : new Uint8Array(file),
  });

  try {
    const result = await parser.getText();
    const text = result.text.trim();

    if (!text) {
      throw new Error("PDF does not contain extractable text.");
    }

    return text;
  } catch (error) {
    throw new Error("Could not extract text from PDF.", { cause: error });
  } finally {
    await parser.destroy();
  }
}
