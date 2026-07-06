"use client";

import { useState } from "react";
import { Button, ButtonLink } from "@/components/ui/Button";
import { Input, Label, Textarea } from "@/components/ui/Field";

type ReferenceDraft = {
  id: number;
  type: "youtube" | "tiktok" | "instagram" | "uploaded_video" | "manual";
};

const referenceTypeLabels: Record<ReferenceDraft["type"], string> = {
  youtube: "YouTube",
  tiktok: "TikTok",
  instagram: "Instagram Reels",
  uploaded_video: "Видеофайл",
  manual: "Описание или расшифровка",
};

export function NewProjectForm({ errorMessage }: { errorMessage?: string }) {
  const [references, setReferences] = useState<ReferenceDraft[]>([]);
  const [nextReferenceId, setNextReferenceId] = useState(1);

  function addReference(type: ReferenceDraft["type"]) {
    setReferences((current) => [...current, { id: nextReferenceId, type }]);
    setNextReferenceId((current) => current + 1);
  }

  function removeReference(id: number) {
    setReferences((current) => current.filter((reference) => reference.id !== id));
  }

  return (
    <form action="/api/projects" method="post" encType="multipart/form-data" className="space-y-8">
      {errorMessage ? (
        <p className="rounded-2xl bg-red-50 px-4 py-3 text-sm text-red-700">{errorMessage}</p>
      ) : null}

      <section className="rounded-2xl bg-slate-50 p-6">
        <h2 className="text-base font-normal text-slate-950">Проект</h2>
        <div className="mt-5 grid gap-5 md:grid-cols-2">
          <div>
            <Label htmlFor="title">Название проекта</Label>
            <Input id="title" name="title" required />
          </div>
          <div>
            <Label htmlFor="brand">Бренд</Label>
            <Input id="brand" name="brand" required />
          </div>
        </div>
        <div className="mt-5 max-w-[220px]">
          <Label htmlFor="scriptsCount">Количество сценариев</Label>
          <Input id="scriptsCount" name="scriptsCount" type="number" min="1" max="20" defaultValue="5" />
        </div>
      </section>

      <section className="rounded-2xl bg-slate-50 p-6">
        <h2 className="text-base font-normal text-slate-950">Бриф</h2>
        <div className="mt-5">
          <Label htmlFor="briefFile">Загрузить PDF</Label>
          <Input id="briefFile" name="briefFile" type="file" accept="application/pdf" className="pt-2.5" />
        </div>
        <div className="mt-5">
          <Label htmlFor="briefText">Или вставить текст вручную</Label>
          <Textarea
            id="briefText"
            name="briefText"
            rows={10}
            placeholder="Если PDF нет под рукой, вставьте текст брифа сюда."
          />
        </div>
      </section>

      <section className="rounded-2xl bg-slate-50 p-6">
        <h2 className="text-base font-normal text-slate-950">Комментарий к генерации</h2>
        <Textarea
          id="generationComment"
          name="generationComment"
          rows={4}
          placeholder="Например: сделать больше POV, без прямой рекламы, добавить студенческий вайб, 3 сценария по референсам"
        />
      </section>

      <section className="rounded-2xl bg-slate-50 p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h2 className="text-base font-normal text-slate-950">Референсы</h2>
            <p className="mt-2 text-sm leading-6 text-slate-500">
              Можно добавить несколько примеров для структуры, темпа и ощущения ролика.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="outline" size="sm" onClick={() => addReference("tiktok")}>
              TikTok
            </Button>
            <Button type="button" variant="outline" size="sm" onClick={() => addReference("youtube")}>
              YouTube
            </Button>
            <Button type="button" variant="outline" size="sm" onClick={() => addReference("instagram")}>
              Instagram
            </Button>
            <Button type="button" variant="outline" size="sm" onClick={() => addReference("uploaded_video")}>
              Видео
            </Button>
            <Button type="button" variant="outline" size="sm" onClick={() => addReference("manual")}>
              Текст
            </Button>
          </div>
        </div>

        <div className="mt-5 max-w-[280px]">
          <Label htmlFor="referenceScriptsCount">Сколько сценариев делать по референсам</Label>
          <Input id="referenceScriptsCount" name="referenceScriptsCount" type="number" min="0" max="20" defaultValue="0" />
        </div>

        <input type="hidden" name="referenceIds" value={references.map((reference) => reference.id).join(",")} />

        {references.length ? (
          <div className="mt-5 space-y-4">
            {references.map((reference) => (
              <div key={reference.id} className="rounded-2xl bg-white p-5">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <p className="text-sm text-slate-950">{referenceTypeLabels[reference.type]}</p>
                    <input type="hidden" name={`referenceType-${reference.id}`} value={reference.type} />
                  </div>
                  <Button type="button" variant="ghost" size="sm" onClick={() => removeReference(reference.id)}>
                    Убрать
                  </Button>
                </div>

                {reference.type === "youtube" || reference.type === "tiktok" || reference.type === "instagram" ? (
                  <div className="mt-4">
                    <Label htmlFor={`referenceUrl-${reference.id}`}>Ссылка на YouTube, TikTok или Instagram Reels</Label>
                    <Input
                      id={`referenceUrl-${reference.id}`}
                      name={`referenceUrl-${reference.id}`}
                      type="url"
                      placeholder="https://youtube.com/... или https://instagram.com/reel/..."
                    />
                  </div>
                ) : null}

                {reference.type === "uploaded_video" ? (
                  <div className="mt-4">
                    <Label htmlFor={`referenceFile-${reference.id}`}>Видеофайл</Label>
                    <Input
                      id={`referenceFile-${reference.id}`}
                      name={`referenceFile-${reference.id}`}
                      type="file"
                      accept="video/*"
                      className="pt-2.5"
                    />
                  </div>
                ) : null}

                <div className="mt-4">
                  <Label htmlFor={`referenceText-${reference.id}`}>
                    {reference.type === "manual" ? "Описание или расшифровка" : "Заметки к референсу"}
                  </Label>
                  <Textarea
                    id={`referenceText-${reference.id}`}
                    name={`referenceText-${reference.id}`}
                    rows={4}
                    placeholder="Что взять из референса: заход, темп, структура, вайб, финал."
                  />
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="mt-5 rounded-2xl bg-white p-5 text-sm text-slate-500">
            Референсы можно пропустить и добавить позже в детали проекта.
          </p>
        )}
      </section>

      <div className="flex justify-end gap-4">
        <ButtonLink href="/dashboard" variant="outline">
          Отмена
        </ButtonLink>
        <Button>Создать проект и перейти к вопросам</Button>
      </div>
    </form>
  );
}
