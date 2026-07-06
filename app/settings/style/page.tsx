import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/Button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/Card";
import { Input, Label, Textarea } from "@/components/ui/Field";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

type StyleSettingsPageProps = {
  searchParams: Promise<{ error?: string }>;
};

const errorMessages: Record<string, string> = {
  case_title_required: "Введите название кейса.",
  brief_required: "Добавьте PDF-бриф или вставьте текст брифа вручную.",
  example_required: "Добавьте файл с финальными сценариями или вставьте текст вручную.",
  example_read: "Не удалось прочитать файл. Загрузите PDF, TXT, MD или вставьте текст вручную.",
  rule_required: "Введите правило стиля.",
};

function previewText(text: string) {
  const compacted = text.replace(/\s+/g, " ").trim();
  if (compacted.length <= 220) return compacted;
  return `${compacted.slice(0, 220).trim()}...`;
}

function parseJsonList(value: string) {
  try {
    const parsed = JSON.parse(value) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((item): item is string => typeof item === "string" && item.trim().length > 0);
  } catch {
    return [];
  }
}

export default async function StyleSettingsPage({ searchParams }: StyleSettingsPageProps) {
  const user = await requireUser();
  const { error } = await searchParams;
  const [rules, examples, learnings] = await Promise.all([
    prisma.styleRule.findMany({ where: { userId: user.id }, orderBy: { createdAt: "desc" } }),
    prisma.styleExample.findMany({ where: { userId: user.id }, orderBy: { createdAt: "desc" } }),
    prisma.styleLearning.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: "desc" },
      take: 10,
      include: {
        script: {
          select: {
            title: true,
            project: { select: { title: true } },
          },
        },
      },
    }),
  ]);

  return (
    <AppShell login={user.login}>
      <div className="max-w-3xl">
        <p className="text-sm text-slate-500">Настройки</p>
        <h1 className="mt-2 text-3xl font-normal tracking-tight text-slate-950">Память стиля</h1>
        <p className="mt-3 text-sm leading-6 text-slate-500">
          Добавьте правила и эталонные кейсы. Генерация будет брать из них темп, структуру и механику,
          но не копировать текст буквально.
        </p>
      </div>

      {error ? (
        <p className="mt-8 max-w-3xl rounded-2xl bg-red-50 px-4 py-3 text-sm text-red-700">
          {errorMessages[error] ?? "Не удалось сохранить настройки стиля."}
        </p>
      ) : null}

      <section className="mt-8 grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Правила</CardTitle>
            <CardDescription>Короткие принципы тона, формата и подачи блогера.</CardDescription>
          </CardHeader>
          <CardContent>
            <form action="/api/settings/style/rules" method="post">
              <Label htmlFor="rule">Новое правило</Label>
              <Textarea
                id="rule"
                name="rule"
                rows={4}
                placeholder="Например: не использовать прямые рекламные фразы"
                required
              />
              <div className="mt-5 flex justify-end">
                <Button size="sm">Добавить правило</Button>
              </div>
            </form>

            <h3 className="mt-8 text-sm font-normal text-slate-900">Сохраненные правила</h3>
            {rules.length ? (
              <ul className="mt-4 space-y-3">
                {rules.map((rule) => (
                  <li key={rule.id} className="rounded-2xl bg-white p-4">
                    <p className="text-sm text-slate-900">{rule.rule}</p>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-4 text-sm text-slate-500">Правила пока не добавлены.</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Эталонные кейсы</CardTitle>
            <CardDescription>Сохраните бриф, финальные сценарии и пояснение, почему кейс удачный.</CardDescription>
          </CardHeader>
          <CardContent>
            <form action="/api/settings/style/examples" method="post" encType="multipart/form-data">
              <div>
                <Label htmlFor="title">Название кейса</Label>
                <Input id="title" name="title" placeholder="Например: АБ ВиТ, серия майских роликов" required />
              </div>

              <div className="mt-5">
                <Label htmlFor="briefFile">PDF-бриф</Label>
                <Input
                  id="briefFile"
                  name="briefFile"
                  type="file"
                  accept="application/pdf,text/plain,text/markdown,.txt,.md"
                  className="pt-2.5"
                />
              </div>

              <div className="mt-5">
                <Label htmlFor="briefText">Или вставить текст брифа</Label>
                <Textarea
                  id="briefText"
                  name="briefText"
                  rows={6}
                  placeholder="Вставьте бриф, по которому были написаны сценарии."
                />
              </div>

              <div className="mt-5">
                <Label htmlFor="scriptsFile">Файл с финальными сценариями</Label>
                <Input
                  id="scriptsFile"
                  name="scriptsFile"
                  type="file"
                  accept="application/pdf,text/plain,text/markdown,.txt,.md"
                  className="pt-2.5"
                />
              </div>

              <div className="mt-5">
                <Label htmlFor="finalScriptsText">Или вставить финальные сценарии</Label>
                <Textarea
                  id="finalScriptsText"
                  name="finalScriptsText"
                  rows={9}
                  placeholder="Вставьте сценарии, которые считаются хорошим эталоном."
                />
              </div>

              <div className="mt-5">
                <Label htmlFor="comment">Комментарий</Label>
                <Textarea
                  id="comment"
                  name="comment"
                  rows={4}
                  placeholder="Почему это хороший пример: структура, тон, заход, интеграция продукта."
                />
              </div>

              <label className="mt-5 flex items-center gap-3 text-sm text-slate-700">
                <input
                  name="active"
                  type="checkbox"
                  defaultChecked
                  className="h-4 w-4 rounded border-slate-300 text-slate-950"
                />
                Использовать в генерации
              </label>

              <div className="mt-5 flex justify-end">
                <Button size="sm">Добавить кейс</Button>
              </div>
            </form>

            <h3 className="mt-8 text-sm font-normal text-slate-900">Загруженные кейсы</h3>
            {examples.length ? (
              <ul className="mt-4 space-y-3">
                {examples.map((example) => (
                  <li key={example.id} className="rounded-2xl bg-white p-4">
                    <div className="flex items-start justify-between gap-3">
                      <p className="text-sm text-slate-900">{example.title}</p>
                      <span className="shrink-0 rounded-full bg-slate-100 px-3 py-1 text-xs text-slate-600">
                        {example.active ? "В генерации" : "Выключен"}
                      </span>
                    </div>
                    <dl className="mt-3 space-y-3 text-xs leading-5 text-slate-500">
                      <div>
                        <dt className="text-slate-400">Бриф кейса</dt>
                        <dd className="mt-1">{previewText(example.briefText)}</dd>
                      </div>
                      <div>
                        <dt className="text-slate-400">Финальные сценарии</dt>
                        <dd className="mt-1">{previewText(example.finalScriptsText || example.scriptsText)}</dd>
                      </div>
                      {example.comment ? (
                        <div>
                          <dt className="text-slate-400">Комментарий</dt>
                          <dd className="mt-1">{previewText(example.comment)}</dd>
                        </div>
                      ) : null}
                    </dl>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-4 text-sm text-slate-500">Кейсы в базе пока не созданы.</p>
            )}
          </CardContent>
        </Card>
      </section>

      <Card className="mt-6">
        <CardHeader>
          <CardTitle>Выучено из правок</CardTitle>
          <CardDescription>Наблюдения, которые сервис извлек из редакторских изменений сценариев.</CardDescription>
        </CardHeader>
        <CardContent>
          {learnings.length ? (
            <div className="grid gap-4 md:grid-cols-2">
              {learnings.map((learning) => {
                const avoid = parseJsonList(learning.phrasesToAvoidJson);
                const prefer = parseJsonList(learning.phrasesToPreferJson);

                return (
                  <article key={learning.id} className="rounded-2xl bg-white p-5">
                    <p className="text-xs text-slate-400">
                      {learning.createdAt.toLocaleDateString("ru-RU")} · {learning.script.project.title}
                    </p>
                    <h3 className="mt-2 text-sm font-normal text-slate-950">{learning.script.title}</h3>
                    <p className="mt-3 text-sm leading-6 text-slate-600">{learning.summary}</p>
                    {avoid.length || prefer.length ? (
                      <dl className="mt-4 space-y-3 text-sm">
                        {avoid.length ? (
                          <div>
                            <dt className="text-slate-500">Избегать</dt>
                            <dd className="mt-1 text-slate-900">{avoid.join(", ")}</dd>
                          </div>
                        ) : null}
                        {prefer.length ? (
                          <div>
                            <dt className="text-slate-500">Предпочитать</dt>
                            <dd className="mt-1 text-slate-900">{prefer.join(", ")}</dd>
                          </div>
                        ) : null}
                      </dl>
                    ) : null}
                  </article>
                );
              })}
            </div>
          ) : (
            <p className="rounded-2xl bg-white p-5 text-sm leading-6 text-slate-500">
              Пока нет выводов из правок. Они появятся после сохранения сценария как эталона.
            </p>
          )}
        </CardContent>
      </Card>
    </AppShell>
  );
}
