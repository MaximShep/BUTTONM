export type ExportFormat = "txt" | "docx" | "pdf";

export function exportScriptsPlaceholder(_format: ExportFormat): never {
  throw new Error("Export is not implemented yet.");
}
