"use client";

import { useEffect, useRef, useState } from "react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Label, Textarea } from "@/components/ui/Field";

type ScriptStatus =
  | "draft"
  | "needs_revision"
  | "approved_by_creator"
  | "approved_by_client"
  | "rejected"
  | "reference_quality";

type Revision = {
  id: string;
  previousText?: string;
  newText?: string;
  changeNote: string | null;
  createdAt: string;
};

type StyleLearningResult = {
  skipped: boolean;
  reason?: string;
  summary?: string;
  badPatterns?: string[];
  goodPatterns?: string[];
  newStyleRules?: string[];
  phrasesToAvoid?: string[];
  phrasesToPrefer?: string[];
  styleCaseComment?: string;
};

type ScriptEditorProps = {
  projectId: string;
  scriptId: string;
  title: string;
  format: string;
  status: ScriptStatus;
  generatedText: string;
  editedText: string;
  approvedByClientAt: string | null;
  isStyleReference: boolean;
  revisions: Revision[];
};

const statusLabels: Record<ScriptStatus, string> = {
  draft: "Черновик",
  needs_revision: "На доработку",
  approved_by_creator: "Одобрен автором",
  approved_by_client: "Одобрен заказчиком",
  rejected: "Отклонён",
  reference_quality: "Эталон",
};

const statusOptions: ScriptStatus[] = [
  "draft",
  "needs_revision",
  "approved_by_creator",
  "approved_by_client",
  "rejected",
  "reference_quality",
];

type SaveState = "idle" | "saving" | "saved" | "error";

export function ScriptEditor({
  projectId,
  scriptId,
  title,
  format,
  status,
  generatedText,
  editedText,
  approvedByClientAt,
  isStyleReference,
  revisions,
}: ScriptEditorProps) {
  const [text, setText] = useState(editedText);
  const [currentTitle, setCurrentTitle] = useState(title);
  const [currentFormat, setCurrentFormat] = useState(format);
  const [currentGeneratedText, setCurrentGeneratedText] = useState(generatedText);
  const [currentStatus, setCurrentStatus] = useState<ScriptStatus>(status);
  const [clientApprovedAt, setClientApprovedAt] = useState<string | null>(approvedByClientAt);
  const [styleReference, setStyleReference] = useState(isStyleReference);
  const [changeNote, setChangeNote] = useState("");
  const [rejectionReason, setRejectionReason] = useState("");
  const [regenerationReason, setRegenerationReason] = useState("");
  const [history, setHistory] = useState(revisions);
  const [saveState, setSaveState] = useState<SaveState>("saved");
  const [isAnalyzingEdits, setIsAnalyzingEdits] = useState(false);
  const [isApprovingByClient, setIsApprovingByClient] = useState(false);
  const [showClientApprovalHint, setShowClientApprovalHint] = useState(status === "approved_by_client" && !isStyleReference);
  const [isRegenerating, setIsRegenerating] = useState(false);
  const [styleLearning, setStyleLearning] = useState<StyleLearningResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const lastAutoSavedText = useRef(editedText);

  async function patchScript(payload: Record<string, unknown>) {
    const response = await fetch(`/api/projects/${projectId}/scripts/${scriptId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const body = await response.json().catch(() => null) as {
      error?: string;
      script?: {
        status: ScriptStatus;
        editedText: string | null;
        approvedByClientAt?: string | null;
        isStyleReference?: boolean;
      };
      revision?: Revision | null;
    } | null;

    if (!response.ok) {
      throw new Error(body?.error ?? "Не удалось сохранить изменения.");
    }

    return body;
  }

  async function saveManually() {
    setSaveState("saving");
    setError(null);

    try {
      const body = await patchScript({
        editedText: text,
        changeNote,
        saveMode: "manual",
      });

      if (body?.revision) {
        setHistory((items) => [body.revision as Revision, ...items]);
      }
      lastAutoSavedText.current = text;
      setChangeNote("");
      setSaveState("saved");
    } catch (caughtError) {
      setSaveState("error");
      setError(caughtError instanceof Error ? caughtError.message : "Не удалось сохранить изменения.");
    }
  }

  async function updateStatus(nextStatus: ScriptStatus) {
    setSaveState("saving");
    setError(null);

    try {
      const body = await patchScript({
        editedText: text,
        status: nextStatus,
        rejectionReason: nextStatus === "rejected" ? rejectionReason : undefined,
      });

      if (body?.script?.status) {
        setCurrentStatus(body.script.status);
      } else {
        setCurrentStatus(nextStatus);
      }
      if (body?.script?.approvedByClientAt !== undefined) {
        setClientApprovedAt(body.script.approvedByClientAt);
      }
      if (body?.script?.isStyleReference !== undefined) {
        setStyleReference(body.script.isStyleReference);
      }
      lastAutoSavedText.current = text;
      setSaveState("saved");
    } catch (caughtError) {
      setSaveState("error");
      setError(caughtError instanceof Error ? caughtError.message : "Не удалось обновить статус.");
    }
  }

  async function approveByClient() {
    setIsApprovingByClient(true);
    setSaveState("saving");
    setError(null);
    setStyleLearning(null);

    try {
      const body = await patchScript({
        editedText: text,
        approveByClient: true,
      });

      setCurrentStatus(body?.script?.status ?? "approved_by_client");
      setClientApprovedAt(body?.script?.approvedByClientAt ?? new Date().toISOString());
      setShowClientApprovalHint(true);
      lastAutoSavedText.current = text;
      setSaveState("saved");
    } catch (caughtError) {
      setSaveState("error");
      setError(caughtError instanceof Error ? caughtError.message : "Не удалось отметить одобрение заказчиком.");
    } finally {
      setIsApprovingByClient(false);
    }
  }

  async function saveAsStyleReference() {
    setIsAnalyzingEdits(true);
    setError(null);
    setStyleLearning(null);

    try {
      if (text !== lastAutoSavedText.current) {
        await patchScript({ editedText: text, saveMode: "auto" });
        lastAutoSavedText.current = text;
        setSaveState("saved");
      }

      const response = await fetch(`/api/projects/${projectId}/scripts/${scriptId}/style-reference`, {
        method: "POST",
      });
      const body = await response.json().catch(() => null) as (StyleLearningResult & {
        error?: string;
        script?: { status: ScriptStatus; isStyleReference: boolean };
      }) | null;

      if (!response.ok) {
        throw new Error(body?.error ?? "Не удалось запомнить сценарий как эталон.");
      }

      setStyleLearning(body);
      setStyleReference(true);
      if (body?.script?.status) setCurrentStatus(body.script.status);
      setShowClientApprovalHint(false);
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : "Не удалось запомнить сценарий как эталон.");
    } finally {
      setIsAnalyzingEdits(false);
    }
  }

  async function regenerateScript() {
    const reason = regenerationReason.trim();
    if (!reason) {
      setError("Укажите, что не так с этим сценарием.");
      return;
    }

    setIsRegenerating(true);
    setError(null);
    setStyleLearning(null);

    try {
      if (text !== lastAutoSavedText.current) {
        await patchScript({ editedText: text, saveMode: "auto" });
        lastAutoSavedText.current = text;
        setSaveState("saved");
      }

      const response = await fetch(`/api/projects/${projectId}/scripts/${scriptId}/regenerate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason }),
      });
      const body = await response.json().catch(() => null) as {
        error?: string;
        script?: {
          title: string;
          format: string;
          generatedText: string;
          editedText: string | null;
          status: ScriptStatus;
        };
        revision?: Revision;
      } | null;

      if (!response.ok || !body?.script) {
        throw new Error(body?.error ?? "Не удалось перегенерировать сценарий.");
      }

      setCurrentTitle(body.script.title);
      setCurrentFormat(body.script.format);
      setCurrentGeneratedText(body.script.generatedText);
      setText(body.script.editedText ?? body.script.generatedText);
      setCurrentStatus(body.script.status);
      lastAutoSavedText.current = body.script.editedText ?? body.script.generatedText;
      if (body.revision) {
        setHistory((items) => [body.revision as Revision, ...items]);
      }
      setRegenerationReason("");
      setSaveState("saved");
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : "Не удалось перегенерировать сценарий.");
    } finally {
      setIsRegenerating(false);
    }
  }

  useEffect(() => {
    if (text === lastAutoSavedText.current) return;

    const timeoutId = window.setTimeout(async () => {
      setSaveState("saving");
      setError(null);

      try {
        await patchScript({ editedText: text, saveMode: "auto" });
        lastAutoSavedText.current = text;
        setSaveState("saved");
      } catch (caughtError) {
        setSaveState("error");
        setError(caughtError instanceof Error ? caughtError.message : "Автосохранение не сработало.");
      }
    }, 4000);

    return () => window.clearTimeout(timeoutId);
  }, [text]);

  const saveLabel = {
    idle: "Есть несохраненные изменения",
    saving: "Сохраняем...",
    saved: "Сохранено",
    error: "Ошибка сохранения",
  }[saveState];

  return (
    <div className="mt-10 grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
      <section className="rounded-2xl bg-slate-50 p-7">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-xl font-normal text-slate-950">{currentTitle}</h2>
              {styleReference ? <Badge className="bg-emerald-50 text-emerald-700">Эталон</Badge> : null}
            </div>
            <p className="mt-2 text-sm leading-6 text-slate-500">{currentFormat}</p>
          </div>
        </div>

        <div className="mt-6">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <Label htmlFor="editedText">Текст сценария</Label>
            <span className="text-xs text-slate-400">{saveLabel}</span>
          </div>
          <Textarea
            id="editedText"
            value={text}
            onChange={(event) => {
              setText(event.target.value);
              if (event.target.value !== lastAutoSavedText.current) {
                setSaveState("idle");
              }
            }}
            className="min-h-[560px] resize-y p-4 font-mono"
          />
        </div>

        <div className="mt-5">
          <Label htmlFor="changeNote">Комментарий к сохранению</Label>
          <Textarea
            id="changeNote"
            value={changeNote}
            onChange={(event) => setChangeNote(event.target.value)}
            placeholder="Например: усилил хук и сократил финал"
            className="min-h-20"
          />
        </div>

        {error ? (
          <p className="mt-4 rounded-xl bg-white p-3 text-sm text-red-700">{error}</p>
        ) : null}

        <div className="mt-6 flex flex-wrap gap-3">
          <Button onClick={saveManually} disabled={saveState === "saving" || isRegenerating || isApprovingByClient} type="button" className="min-w-36">
            Сохранить
          </Button>
        </div>

        <details className="mt-6 rounded-2xl bg-white p-4 text-sm text-slate-700">
          <summary className="cursor-pointer text-slate-950">Показать исходную генерацию</summary>
          <div className="mt-4 max-h-80 overflow-auto whitespace-pre-wrap leading-6">{currentGeneratedText}</div>
        </details>

        {styleLearning ? (
          <section className="mt-6 rounded-2xl bg-white p-5">
            <h3 className="text-sm font-normal text-slate-950">Сохранено в память стиля</h3>
            {styleLearning.skipped ? (
              <p className="mt-3 text-sm leading-6 text-slate-500">{styleLearning.reason ?? "Этот сценарий не был сохранён."}</p>
            ) : (
              <div className="mt-4 space-y-5 text-sm">
                <p className="leading-6 text-slate-700">{styleLearning.summary}</p>
                {styleLearning.newStyleRules?.length ? (
                  <div>
                    <p className="text-slate-950">Новые правила</p>
                    <ul className="mt-2 list-disc space-y-2 pl-5 text-slate-600">
                      {styleLearning.newStyleRules.map((rule) => <li key={rule}>{rule}</li>)}
                    </ul>
                  </div>
                ) : null}
                {styleLearning.badPatterns?.length ? (
                  <div>
                    <p className="text-slate-950">Что избегать</p>
                    <ul className="mt-2 list-disc space-y-2 pl-5 text-slate-600">
                      {styleLearning.badPatterns.map((pattern) => <li key={pattern}>{pattern}</li>)}
                    </ul>
                  </div>
                ) : null}
                {styleLearning.goodPatterns?.length ? (
                  <div>
                    <p className="text-slate-950">Что предпочитать</p>
                    <ul className="mt-2 list-disc space-y-2 pl-5 text-slate-600">
                      {styleLearning.goodPatterns.map((pattern) => <li key={pattern}>{pattern}</li>)}
                    </ul>
                  </div>
                ) : null}
              </div>
            )}
          </section>
        ) : null}
      </section>

      <aside className="space-y-6">
        <section className="rounded-2xl bg-slate-50 p-7">
          <h2 className="text-base font-normal text-slate-950">Статус</h2>
          <select
            value={currentStatus}
            onChange={(event) => updateStatus(event.target.value as ScriptStatus)}
            disabled={saveState === "saving" || isRegenerating || isApprovingByClient || isAnalyzingEdits}
            className="mt-4 h-11 w-full rounded-xl bg-white px-4 text-sm text-slate-900 outline-none transition-shadow focus:ring-4 focus:ring-slate-200"
          >
            {statusOptions.map((option) => (
              <option key={option} value={option}>{statusLabels[option]}</option>
            ))}
          </select>
          {clientApprovedAt ? (
            <p className="mt-3 text-xs leading-5 text-slate-500">
              Заказчик одобрил: {new Date(clientApprovedAt).toLocaleString("ru-RU", {
                day: "2-digit",
                month: "2-digit",
                year: "numeric",
                hour: "2-digit",
                minute: "2-digit",
              })}
            </p>
          ) : null}
        </section>

        <section className="rounded-2xl bg-slate-50 p-7">
          <h2 className="text-base font-normal text-slate-950">Одобрение заказчиком</h2>
          <Button
            onClick={approveByClient}
            disabled={saveState === "saving" || isRegenerating || isApprovingByClient || isAnalyzingEdits}
            type="button"
            className="mt-4 w-full"
          >
            {isApprovingByClient ? "Сохраняем одобрение..." : "Одобрено заказчиком"}
          </Button>
          {showClientApprovalHint && !styleReference ? (
            <div className="mt-4 rounded-2xl bg-emerald-50 p-4 text-sm leading-6 text-emerald-800">
              <p>Этот сценарий можно запомнить как эталон для будущих генераций.</p>
              {currentStatus === "approved_by_client" ? (
                <Button
                  onClick={saveAsStyleReference}
                  disabled={isAnalyzingEdits || saveState === "saving" || isRegenerating}
                  type="button"
                  variant="outline"
                  className="mt-3 w-full bg-white"
                >
                  {isAnalyzingEdits ? "Запоминаем..." : "Запомнить как эталон"}
                </Button>
              ) : null}
            </div>
          ) : null}
          {styleReference ? (
            <p className="mt-4 rounded-2xl bg-white p-4 text-sm leading-6 text-slate-600">
              Этот сценарий сохранён как эталон и будет учитываться в будущих генерациях.
            </p>
          ) : null}
        </section>

        <details className="rounded-2xl bg-slate-50 p-7">
          <summary className="cursor-pointer text-base font-normal text-slate-950">Перегенерировать</summary>
          <div className="mt-5">
            <Label htmlFor="regenerationReason">Что не так с этим сценарием?</Label>
            <Textarea
              id="regenerationReason"
              value={regenerationReason}
              onChange={(event) => setRegenerationReason(event.target.value)}
              placeholder="Например: слишком рекламно, скучная ситуация, невозможно снять, хочется больше POV"
              className="min-h-32"
            />
          </div>
          <Button
            onClick={regenerateScript}
            disabled={saveState === "saving" || isRegenerating}
            type="button"
            variant="outline"
            className="mt-4 w-full"
          >
            {isRegenerating ? "Перегенерируем..." : "Перегенерировать этот сценарий"}
          </Button>
        </details>

        <details className="rounded-2xl bg-slate-50 p-7">
          <summary className="cursor-pointer text-base font-normal text-slate-950">Не в моем стиле</summary>
          <div className="mt-5">
            <Label htmlFor="rejectionReason">Что не так?</Label>
            <Textarea
              id="rejectionReason"
              value={rejectionReason}
              onChange={(event) => setRejectionReason(event.target.value)}
              placeholder="Например: слишком рекламно, не мой темп речи"
              className="min-h-28"
            />
          </div>
          <Button
            onClick={() => updateStatus("rejected")}
            disabled={saveState === "saving"}
            type="button"
            variant="outline"
            className="mt-4 w-full"
          >
            Не в моем стиле
          </Button>
        </details>

        <section className="rounded-2xl bg-slate-50 p-7">
          <h2 className="text-base font-normal text-slate-950">История изменений</h2>
          {history.length ? (
            <div className="mt-5 space-y-3">
              {history.map((revision) => (
                <article key={revision.id} className="rounded-2xl bg-white p-4 text-sm">
                  <p className="text-slate-950">
                    {new Date(revision.createdAt).toLocaleString("ru-RU", {
                      day: "2-digit",
                      month: "2-digit",
                      year: "numeric",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </p>
                  <p className="mt-2 leading-5 text-slate-500">
                    {revision.changeNote || "Ручное сохранение"}
                  </p>
                </article>
              ))}
            </div>
          ) : (
            <p className="mt-5 rounded-2xl bg-white p-4 text-sm leading-6 text-slate-500">
              Ревизии появятся после ручного сохранения измененного текста.
            </p>
          )}
        </section>
      </aside>
    </div>
  );
}
