import Link from "next/link";
import { AppShell } from "@/components/AppShell";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/Card";
import { NewProjectForm } from "@/components/projects/NewProjectForm";
import { requireUser } from "@/lib/auth";
type NewProjectPageProps = {
  searchParams: Promise<{ error?: string }>;
};

const errorMessages: Record<string, string> = {
  required: "Заполните название проекта и добавьте бриф PDF-файлом или текстом.",
  pdf_read: "Не удалось прочитать PDF. Загрузите другой файл или вставьте текст брифа вручную.",
  pdf_type: "Загрузите PDF-файл или вставьте текст брифа вручную.",
};

export default async function NewProjectPage({ searchParams }: NewProjectPageProps) {
  const user = await requireUser();
  const { error } = await searchParams;

  return (
    <AppShell login={user.login}>
      <Link href="/dashboard" className="text-sm text-slate-500 transition-colors hover:text-slate-950">
        Назад к проектам
      </Link>
      <div className="mt-4 max-w-3xl">
        <h1 className="text-3xl font-normal tracking-tight text-slate-950">Создать проект</h1>
        <p className="mt-3 text-sm leading-6 text-slate-500">
          Первый шаг: сохранить бриф, комментарий и референсы, чтобы перейти к уточняющим вопросам.
        </p>
      </div>

      <Card className="mt-10 max-w-4xl">
        <CardHeader>
          <CardTitle>Входные данные</CardTitle>
          <CardDescription>Все, что нужно сервису перед анализом брифа.</CardDescription>
        </CardHeader>
        <CardContent>
          <NewProjectForm errorMessage={error ? errorMessages[error] ?? errorMessages.required : undefined} />
        </CardContent>
      </Card>
    </AppShell>
  );
}
