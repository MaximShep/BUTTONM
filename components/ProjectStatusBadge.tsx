import { Badge } from "@/components/ui/Badge";

const statusLabels: Record<string, string> = {
  draft: "Черновик",
  brief_uploaded: "Бриф загружен",
  questions_pending: "Нужны ответы",
  questions_approved: "Ответы подтверждены",
  generating: "Генерация",
  generating_scripts: "Генерация сценариев",
  scripts_generated: "Сценарии готовы",
  script_generation_failed: "Ошибка генерации",
  editing: "Редактура",
  client_approved: "Одобрено",
  exported: "Экспортировано",
  ready: "Готов",
  archived: "Архив",
};

export function ProjectStatusBadge({ status }: { status: string }) {
  return <Badge>{statusLabels[status] ?? status}</Badge>;
}
