import "server-only";

import { readFile } from "fs/promises";
export {
  getSourceMaterialPath,
  sourceMaterials,
  type SourceMaterialKey,
} from "@/lib/files/source-materials-data";
import { getSourceMaterialPath, type SourceMaterialKey } from "@/lib/files/source-materials-data";

export async function readSourceMaterial(key: SourceMaterialKey) {
  return readFile(getSourceMaterialPath(key));
}
