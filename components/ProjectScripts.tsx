"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button, ButtonLink } from "@/components/ui/Button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";

type ProjectScript = {
  id: string;
  number: number;
  title: string;
  format: string;
  generatedText: string;
  status: string;
  basedOnReference: boolean;
};

type ProjectScriptsProps = {
  projectId: string;
  scripts: ProjectScript[];
  scriptsCount: number;
  projectStatus: string;
};

const statusLabels: Record<string, string> = {
  draft: "Черновик",
  needs_revision: "На доработку",
  approved: "Одобрен автором",
  approved_by_creator: "Одобрен автором",
  approved_by_client: "Одобрен заказчиком",
  rejected: "Отклонён",
  reference_quality: "Эталон",
};

function scriptIdea(text: string) {
  const match = text.match(/Идея:\s*([\s\S]*?)(?:\n\n|$)/i);
  const compacted = (match?.[1] ?? text).replace(/\s+/g, " ").trim();
  if (compacted.length <= 120) return compacted;
  return `${compacted.slice(0, 120).trim()}...`;
}

export function ProjectScripts({ projectId, scripts, scriptsCount, projectStatus }: ProjectScriptsProps) {
  const router = useRouter();
  const [isGenerating, setIsGenerating] = useState(projectStatus === "generating_scripts");
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState("all");

  async function generateScripts() {
    setIsGenerating(true);
    setError(null);

    try {
      const response = await fetch(`/api/projects/${projectId}/scripts/generate`, {
        method: "POST",
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

  const statuses = Array.from(new Set(scripts.map((script) => script.status)));
  const visibleScripts = statusFilter === "all"
    ? scripts
    : scripts.filter((script) => script.status === statusFilter);

  return (
    <Card className="mt-6">
      <CardHeader>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <CardTitle>Сценарии</CardTitle>
            <CardDescription>{scripts.length} из {scriptsCount} сценариев в проекте.</CardDescription>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              onClick={() => {
                if (window.confirm("Пересобрать все сценарии? Текущий набор будет заменен.")) {
                  void generateScripts();
                }
              }}
              disabled={isGenerating}
              type="button"
              variant="outline"
            >
              {isGenerating ? "Пересобираем..." : "Пересобрать сценарии"}
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {error ? (
          <p className="mb-4 rounded-2xl bg-white p-4 text-sm text-red-700">{error}</p>
        ) : null}

        {scripts.length ? (
          <>
            <div className="mb-4 flex flex-wrap gap-2">
              <Button
                type="button"
                size="sm"
                variant={statusFilter === "all" ? "default" : "outline"}
                onClick={() => setStatusFilter("all")}
              >
                Все
              </Button>
              {statuses.map((status) => (
                <Button
                  key={status}
                  type="button"
                  size="sm"
                  variant={statusFilter === status ? "default" : "outline"}
                  onClick={() => setStatusFilter(status)}
                >
                  {statusLabels[status] ?? status}
                </Button>
              ))}
            </div>
            <div className="grid gap-4 md:grid-cols-2">
            {visibleScripts.map((script) => (
              <article key={script.id} className="rounded-2xl bg-white p-5">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-xs text-slate-400">Сценарий {script.number}</p>
                    <h3 className="mt-2 text-base font-normal text-slate-950">{script.title}</h3>
                  </div>
                  <Badge>{statusLabels[script.status] ?? script.status}</Badge>
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  <Badge className="bg-slate-100">{script.format}</Badge>
                  {script.basedOnReference ? <Badge className="bg-slate-100">по референсу</Badge> : null}
                </div>
                <p className="mt-4 text-sm leading-6 text-slate-700">{scriptIdea(script.generatedText)}</p>
                <div className="mt-5 flex justify-end">
                  <ButtonLink href={`/projects/${projectId}/scripts/${script.id}`} size="sm" variant="outline">
                    Открыть
                  </ButtonLink>
                </div>
              </article>
            ))}
            </div>
            {!visibleScripts.length ? (
              <p className="rounded-2xl bg-white p-7 text-center text-sm text-slate-500">
                Сценариев с таким статусом нет.
              </p>
            ) : null}
          </>
        ) : (
          <div className="rounded-2xl bg-white p-7 text-center text-sm text-slate-500">
            Сценарии еще не сгенерированы.
          </div>
        )}
      </CardContent>
    </Card>
  );
}
