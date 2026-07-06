"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/Card";
import { Input, Label } from "@/components/ui/Field";

type ProjectGenerationProps = {
  projectId: string;
  scriptsCount: number;
  referenceScriptsCount: number;
  readyReferenceCount: number;
  projectStatus: string;
};

export function ProjectGeneration({
  projectId,
  scriptsCount,
  referenceScriptsCount,
  readyReferenceCount,
  projectStatus,
}: ProjectGenerationProps) {
  const router = useRouter();
  const hasReadyReferences = readyReferenceCount > 0;
  const [isGenerating, setIsGenerating] = useState(projectStatus === "generating_scripts");
  const [error, setError] = useState<string | null>(null);
  const [selectedReferenceScriptsCount, setSelectedReferenceScriptsCount] = useState(
    hasReadyReferences ? Math.min(referenceScriptsCount, scriptsCount) : 0,
  );

  async function generateScripts() {
    setIsGenerating(true);
    setError(null);
    const boundedReferenceScriptsCount = hasReadyReferences
      ? Math.min(Math.max(selectedReferenceScriptsCount, 0), scriptsCount)
      : 0;

    try {
      const response = await fetch(`/api/projects/${projectId}/scripts/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ referenceScriptsCount: boundedReferenceScriptsCount }),
      });

      const body = await response.json().catch(() => null) as { error?: string } | null;

      if (!response.ok) {
        throw new Error(body?.error ?? "Не удалось сгенерировать сценарии.");
      }

      router.refresh();
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : "Не удалось сгенерировать сценарии.");
    } finally {
      setIsGenerating(false);
    }
  }

  return (
    <Card className="mt-6 max-w-4xl">
      <CardHeader>
        <CardTitle>Генерация сценариев</CardTitle>
        <CardDescription>Бриф принят, ответы подтверждены, стиль подключен.</CardDescription>
      </CardHeader>
      <CardContent>
        {error ? (
          <p className="mb-4 rounded-2xl bg-white p-4 text-sm text-red-700">{error}</p>
        ) : null}

        <dl className="grid gap-3 sm:grid-cols-2">
          <div className="rounded-2xl bg-white p-5">
            <dt className="text-sm text-slate-500">Количество сценариев</dt>
            <dd className="mt-2 text-2xl font-normal text-slate-950">{scriptsCount}</dd>
          </div>
          <div className="rounded-2xl bg-white p-5">
            <dt className="text-sm text-slate-500">По референсам</dt>
            <dd className="mt-2">
              <Label htmlFor="referenceScriptsCount">Сколько сценариев сделать по референсам?</Label>
              <Input
                id="referenceScriptsCount"
                type="number"
                min="0"
                max={scriptsCount}
                value={hasReadyReferences ? selectedReferenceScriptsCount : 0}
                disabled={!hasReadyReferences || isGenerating}
                onChange={(event) => {
                  const value = Number(event.target.value);
                  setSelectedReferenceScriptsCount(
                    Number.isFinite(value) ? Math.min(Math.max(value, 0), scriptsCount) : 0,
                  );
                }}
              />
            </dd>
          </div>
        </dl>

        <div className="mt-5 flex justify-end">
          <Button onClick={generateScripts} disabled={isGenerating} type="button">
            {isGenerating ? "Генерируем..." : "Сгенерировать сценарии"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
