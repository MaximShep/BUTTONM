"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/Card";

type ProjectQuestion = {
  id: string;
  question: string;
  answer: string | null;
  importance: string;
};

type ProjectQuestionsProps = {
  projectId: string;
  questions: ProjectQuestion[];
  hasQuestionAnalysis: boolean;
};

const importanceLabels: Record<string, string> = {
  high: "Важно",
  medium: "Полезно",
  low: "Можно уточнить",
};

export function ProjectQuestions({ projectId, questions, hasQuestionAnalysis }: ProjectQuestionsProps) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [answers, setAnswers] = useState<Record<string, string>>(
    Object.fromEntries(questions.map((question) => [question.id, question.answer ?? ""])),
  );
  const [isApproving, setIsApproving] = useState(false);

  async function approveAnswers() {
    if (questions.some((question) => !(answers[question.id] ?? "").trim())) {
      setError("Ответьте на все вопросы перед подтверждением.");
      return;
    }

    setIsApproving(true);
    setError(null);

    try {
      const response = await fetch(`/api/projects/${projectId}/questions/approve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          answers: questions.map((question) => ({
            questionId: question.id,
            answer: answers[question.id] ?? "",
          })),
        }),
      });

      if (!response.ok) {
        const body = await response.json().catch(() => null) as { error?: string } | null;
        throw new Error(body?.error ?? "Не удалось подтвердить ответы.");
      }

      router.refresh();
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : "Не удалось подтвердить ответы.");
    } finally {
      setIsApproving(false);
    }
  }

  return (
    <Card className="mt-6 max-w-4xl">
      <CardHeader>
        <CardTitle>Уточняющие вопросы</CardTitle>
        <CardDescription>
          Бриф загружен. Осталось закрыть только важные уточнения перед генерацией.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {error ? (
          <p className="mb-4 rounded-2xl bg-white p-4 text-sm text-red-700">{error}</p>
        ) : null}

        {questions.length ? (
          <div className="space-y-3">
            {questions.map((question) => (
              <div key={question.id} className="rounded-2xl bg-white p-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <p className="max-w-3xl text-sm leading-6 text-slate-950">{question.question}</p>
                  <span className="rounded-xl bg-slate-100 px-3 py-1 text-xs text-slate-500">
                    {importanceLabels[question.importance] ?? "Полезно"}
                  </span>
                </div>
                <textarea
                  value={answers[question.id] ?? ""}
                  onChange={(event) =>
                    setAnswers((currentAnswers) => ({
                      ...currentAnswers,
                      [question.id]: event.target.value,
                    }))
                  }
                  rows={3}
                  className="mt-4 w-full resize-y rounded-2xl bg-slate-50 px-4 py-3 text-sm leading-6 text-slate-950 outline-none transition-colors placeholder:text-slate-400 focus:bg-slate-100"
                  placeholder="Ответ"
                />
              </div>
            ))}
            <div className="flex justify-end pt-2">
              <Button onClick={approveAnswers} disabled={isApproving} type="button">
                {isApproving ? "Подтверждаем..." : "Подтвердить ответы"}
              </Button>
            </div>
          </div>
        ) : hasQuestionAnalysis ? (
          <p className="rounded-2xl bg-white p-7 text-center text-sm text-slate-500">
            Данных достаточно для генерации.
          </p>
        ) : (
          <p className="rounded-2xl bg-white p-7 text-center text-sm text-slate-500">
            Уточняющие вопросы появятся после обработки брифа.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
