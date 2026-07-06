import path from "path";

export const sourceMaterials = {
  sampleBrief: {
    label: "Бриф кейса",
    fileName: "Бриф_АБ_ВиТ.pdf",
  },
  referenceScripts: {
    label: "Финальные сценарии",
    fileName: "сценарии_oblv9o.pdf",
  },
} as const;

export type SourceMaterialKey = keyof typeof sourceMaterials;

export function getSourceMaterialPath(key: SourceMaterialKey) {
  return path.join(process.cwd(), sourceMaterials[key].fileName);
}
