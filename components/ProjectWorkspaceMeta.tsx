"use client";

import type { ReactNode } from "react";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { projectEventLabel, referenceErrorMessage } from "@/lib/userMessages";

type ProjectWorkspaceMetaProps = {
  projectId: string;
  briefText: string;
  briefFileName: string | null;
  generationComment: string;
  answers: Array<{ question: string; answer: string | null }>;
  references: Array<{
    id: string;
    type: string;
    url: string | null;
    fileName: string | null;
    transcriptText: string | null;
    extractedScenarioText: string | null;
    notes: string | null;
    useInGeneration: boolean;
    status: string;
    error: string | null;
  }>;
  events: Array<{ id: string; type: string; payloadJson: string; createdAt: string }>;
};

type ReferenceDraft = {
  type: string;
  url: string;
  transcriptText: string;
  notes: string;
  file: File | null;
};

const referenceTypeLabels: Record<string, string> = {
  youtube: "YouTube",
  tiktok: "TikTok",
  instagram: "Instagram Reels",
  uploaded_video: "Видео",
  manual: "Ручной текст",
};

const referenceStatusLabels: Record<string, string> = {
  added: "добавлен",
  processing: "обработка",
  downloading: "скачивание видео",
  extracting_audio: "извлечение аудио",
  downloading_model: "скачивание модели",
  transcribing: "расшифровка",
  extracting_scenario: "извлечение структуры",
  ready: "готов",
  failed: "ошибка",
};

const videoReferenceHelp =
  "Можно загрузить видео вручную, вставить расшифровку, проверить ссылку или настроить yt-dlp/ffmpeg.";

function Dialog({
  title,
  open,
  onClose,
  children,
}: {
  title: string;
  open: boolean;
  onClose: () => void;
  children: ReactNode;
}) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-slate-950/30 px-4 py-10">
      <div className="max-h-[86vh] w-full max-w-3xl overflow-hidden rounded-2xl bg-white shadow-xl">
        <div className="flex items-center justify-between gap-4 border-b border-slate-100 px-6 py-4">
          <h2 className="text-base font-normal text-slate-950">{title}</h2>
          <Button type="button" variant="ghost" size="sm" onClick={onClose}>
            Закрыть
          </Button>
        </div>
        <div className="max-h-[calc(86vh-73px)] overflow-auto px-6 py-5">{children}</div>
      </div>
    </div>
  );
}

export function ProjectWorkspaceMeta({
  projectId,
  briefText,
  briefFileName,
  generationComment,
  answers,
  references,
  events,
}: ProjectWorkspaceMetaProps) {
  const router = useRouter();
  const [helpOpen, setHelpOpen] = useState(false);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [busyReferenceId, setBusyReferenceId] = useState<string | null>(null);
  const [referenceError, setReferenceError] = useState<string | null>(null);
  const [draft, setDraft] = useState<ReferenceDraft>({
    type: "youtube",
    url: "",
    transcriptText: "",
    notes: "",
    file: null,
  });

  async function addReference() {
    setReferenceError(null);
    const formData = new FormData();
    formData.set("type", draft.type);
    formData.set("url", draft.url);
    formData.set("transcriptText", draft.transcriptText);
    formData.set("notes", draft.notes);
    if (draft.file) formData.set("file", draft.file);

    const response = await fetch(`/api/projects/${projectId}/references`, {
      method: "POST",
      body: formData,
    });
    const body = await response.json().catch(() => null) as { error?: string } | null;

    if (!response.ok) {
      setReferenceError(body?.error ?? "Не удалось добавить референс.");
      return;
    }

    setDraft({ type: "youtube", url: "", transcriptText: "", notes: "", file: null });
    router.refresh();
  }

  async function patchReference(referenceId: string, body: Record<string, unknown>) {
    setBusyReferenceId(referenceId);
    setReferenceError(null);

    try {
      const response = await fetch(`/api/projects/${projectId}/references/${referenceId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const responseBody = await response.json().catch(() => null) as { error?: string } | null;
      if (!response.ok) throw new Error(responseBody?.error ?? "Не удалось сохранить референс.");
      router.refresh();
    } catch (error) {
      setReferenceError(error instanceof Error ? error.message : "Не удалось сохранить референс.");
    } finally {
      setBusyReferenceId(null);
    }
  }

  async function processReference(referenceId: string) {
    setBusyReferenceId(referenceId);
    setReferenceError(null);

    try {
      const response = await fetch(`/api/projects/${projectId}/references/${referenceId}/process`, {
        method: "POST",
      });
      const body = await response.json().catch(() => null) as { error?: string } | null;
      if (!response.ok) throw new Error(referenceErrorMessage(body?.error));
      router.refresh();
    } catch (error) {
      setReferenceError(referenceErrorMessage(error));
      router.refresh();
    } finally {
      setBusyReferenceId(null);
    }
  }

  async function deleteReference(referenceId: string) {
    setBusyReferenceId(referenceId);
    setReferenceError(null);

    try {
      const response = await fetch(`/api/projects/${projectId}/references/${referenceId}`, {
        method: "DELETE",
      });
      const body = await response.json().catch(() => null) as { error?: string } | null;
      if (!response.ok) throw new Error(body?.error ?? "Не удалось удалить референс.");
      router.refresh();
    } catch (error) {
      setReferenceError(error instanceof Error ? error.message : "Не удалось удалить референс.");
    } finally {
      setBusyReferenceId(null);
    }
  }

  return (
    <>
      <div className="mt-4 flex flex-wrap gap-2">
        <Button type="button" variant="outline" size="sm" onClick={() => setHelpOpen(true)}>
          Как это работает?
        </Button>
        <Button type="button" variant="outline" size="sm" onClick={() => setDetailsOpen(true)}>
          Детали проекта
        </Button>
      </div>

      <Dialog title="Как это работает" open={helpOpen} onClose={() => setHelpOpen(false)}>
        <div className="grid gap-3 text-sm leading-6 text-slate-600">
          <p><span className="text-slate-950">Бриф.</span> Проект хранит исходные требования рекламодателя.</p>
          <p><span className="text-slate-950">Вопросы.</span> Сервис спрашивает только то, без чего сценарии будут слабее.</p>
          <p><span className="text-slate-950">Генерация.</span> После подтверждения ответов создается нужное количество черновиков.</p>
          <p><span className="text-slate-950">Редактура.</span> Каждый сценарий открывается отдельно и правится в редакторе.</p>
          <p><span className="text-slate-950">Одобрение.</span> Готовые варианты можно отметить статусом.</p>
          <p><span className="text-slate-950">Память стиля.</span> Правки и референсы помогают следующим сценариям звучать ближе к автору.</p>
        </div>
      </Dialog>

      <Dialog title="Детали проекта" open={detailsOpen} onClose={() => setDetailsOpen(false)}>
        <div className="space-y-5">
          <section>
            <h3 className="text-sm font-normal text-slate-950">Бриф</h3>
            <p className="mt-1 text-xs text-slate-500">{briefFileName ?? "Файл не указан"}</p>
            <div className="mt-3 max-h-72 overflow-auto rounded-2xl bg-slate-50 p-4 text-sm leading-6 whitespace-pre-wrap text-slate-700">
              {briefText}
            </div>
          </section>

          <section>
            <h3 className="text-sm font-normal text-slate-950">Комментарий к генерации</h3>
            <p className="mt-2 rounded-2xl bg-slate-50 p-4 text-sm leading-6 text-slate-700">
              {generationComment || "Комментарий пока не сформирован."}
            </p>
          </section>

          <section>
            <h3 className="text-sm font-normal text-slate-950">Ответы на вопросы</h3>
            <div className="mt-3 space-y-3">
              {answers.length ? answers.map((item) => (
                <div key={item.question} className="rounded-2xl bg-slate-50 p-4">
                  <p className="text-sm text-slate-950">{item.question}</p>
                  <p className="mt-2 text-sm leading-6 text-slate-600">{item.answer || "Нет ответа"}</p>
                </div>
              )) : (
                <p className="rounded-2xl bg-slate-50 p-4 text-sm text-slate-500">Вопросов по брифу нет.</p>
              )}
            </div>
          </section>

          <section>
            <h3 className="text-sm font-normal text-slate-950">Референсы</h3>
            {referenceError ? (
              <p className="mt-3 rounded-lg bg-red-50 p-3 text-sm text-red-700">{referenceError}</p>
            ) : null}
            <div className="mt-3 grid gap-3 rounded-lg border border-slate-200 p-4">
              <div className="grid gap-3 sm:grid-cols-[160px_1fr]">
                <select
                  value={draft.type}
                  onChange={(event) => setDraft((current) => ({ ...current, type: event.target.value }))}
                  className="rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-950 outline-none focus:bg-slate-100"
                >
                  <option value="youtube">YouTube</option>
                  <option value="tiktok">TikTok</option>
                  <option value="instagram">Instagram</option>
                  <option value="uploaded_video">Видео</option>
                  <option value="manual">Ручной текст</option>
                </select>
                <input
                  value={draft.url}
                  onChange={(event) => setDraft((current) => ({ ...current, url: event.target.value }))}
                  className="rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-950 outline-none placeholder:text-slate-400 focus:bg-slate-100"
                  placeholder="Ссылка на YouTube, TikTok или Instagram Reels"
                />
              </div>
              <input
                type="file"
                accept="video/*"
                onChange={(event) => setDraft((current) => ({ ...current, file: event.target.files?.[0] ?? null }))}
                className="text-sm text-slate-600"
              />
              <textarea
                value={draft.transcriptText}
                onChange={(event) => setDraft((current) => ({ ...current, transcriptText: event.target.value }))}
                rows={4}
                className="w-full resize-y rounded-lg bg-slate-50 px-3 py-2 text-sm leading-6 text-slate-950 outline-none placeholder:text-slate-400 focus:bg-slate-100"
                placeholder="Ручная расшифровка"
              />
              <textarea
                value={draft.notes}
                onChange={(event) => setDraft((current) => ({ ...current, notes: event.target.value }))}
                rows={2}
                className="w-full resize-y rounded-lg bg-slate-50 px-3 py-2 text-sm leading-6 text-slate-950 outline-none placeholder:text-slate-400 focus:bg-slate-100"
                placeholder="Заметки"
              />
              <div className="flex justify-end">
                <Button type="button" size="sm" onClick={addReference}>Добавить референс</Button>
              </div>
            </div>
            <div className="mt-3 space-y-3">
              {references.length ? references.map((reference, index) => (
                <div key={reference.id} className="rounded-lg bg-slate-50 p-4">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="min-w-0 flex-1 break-words text-sm text-slate-950">
                      {reference.url || reference.fileName || `Референс ${index + 1}`}
                    </p>
                    <Badge>{referenceTypeLabels[reference.type] ?? reference.type}</Badge>
                    <Badge>{reference.useInGeneration ? "в генерации" : "выключен"}</Badge>
                    <Badge>{referenceStatusLabels[reference.status] ?? reference.status}</Badge>
                  </div>
                  <label className="mt-3 flex items-center gap-2 text-sm text-slate-600">
                    <input
                      type="checkbox"
                      checked={reference.useInGeneration}
                      disabled={busyReferenceId === reference.id}
                      onChange={(event) => patchReference(reference.id, { useInGeneration: event.target.checked })}
                    />
                    Использовать в генерации
                  </label>
                  {reference.status === "failed" ? (
                    <p className="mt-3 rounded-lg bg-amber-50 p-3 text-sm leading-6 text-amber-800">
                      Автообработка не сработала. {videoReferenceHelp}
                    </p>
                  ) : null}
                  <textarea
                    defaultValue={reference.transcriptText ?? ""}
                    rows={4}
                    onBlur={(event) => patchReference(reference.id, { transcriptText: event.target.value })}
                    className="mt-3 w-full resize-y rounded-lg bg-white px-3 py-2 text-sm leading-6 text-slate-950 outline-none placeholder:text-slate-400 focus:bg-slate-100"
                    placeholder="Ручная расшифровка"
                  />
                  <p className="mt-2 text-xs text-slate-500">Вставить расшифровку вручную</p>
                  <textarea
                    defaultValue={reference.notes ?? ""}
                    rows={2}
                    onBlur={(event) => patchReference(reference.id, { notes: event.target.value })}
                    className="mt-3 w-full resize-y rounded-lg bg-white px-3 py-2 text-sm leading-6 text-slate-950 outline-none placeholder:text-slate-400 focus:bg-slate-100"
                    placeholder="Заметки"
                  />
                  {reference.extractedScenarioText ? (
                    <div className="mt-3 max-h-72 overflow-auto rounded-lg bg-white p-3 text-xs leading-5 whitespace-pre-wrap text-slate-600">
                      {reference.extractedScenarioText}
                    </div>
                  ) : null}
                  {reference.error ? (
                    <p className="mt-2 rounded-lg bg-red-50 p-3 text-sm leading-6 text-red-700">
                      {referenceErrorMessage(reference.error)}
                    </p>
                  ) : null}
                  <div className="mt-3 flex flex-wrap justify-end gap-2">
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      disabled={busyReferenceId === reference.id}
                      onClick={() => processReference(reference.id)}
                    >
                      {busyReferenceId === reference.id ? "Обработка..." : "Обработать"}
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      disabled={busyReferenceId === reference.id}
                      onClick={() => deleteReference(reference.id)}
                    >
                      Удалить
                    </Button>
                  </div>
                </div>
              )) : (
                <p className="rounded-lg bg-slate-50 p-4 text-sm text-slate-500">Референсы не подключены.</p>
              )}
            </div>
          </section>

          <section>
            <h3 className="text-sm font-normal text-slate-950">История проекта</h3>
            <div className="mt-3 space-y-3">
              {events.length ? events.map((event) => (
                <div key={event.id} className="rounded-2xl bg-slate-50 p-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-sm text-slate-950">{projectEventLabel(event.type)}</p>
                    <p className="text-xs text-slate-500">{event.createdAt}</p>
                  </div>
                </div>
              )) : (
                <p className="rounded-2xl bg-slate-50 p-4 text-sm text-slate-500">История пока пустая.</p>
              )}
            </div>
          </section>
        </div>
      </Dialog>
    </>
  );
}
