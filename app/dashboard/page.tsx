import Link from "next/link";
import { AppShell } from "@/components/AppShell";
import { ProjectStatusBadge } from "@/components/ProjectStatusBadge";
import { ButtonLink } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

type DashboardProject = Awaited<ReturnType<typeof getDashboardProjects>>[number];

function normalizeText(value: string | null | undefined) {
  return (value ?? "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeFileName(value: string | null | undefined) {
  return normalizeText(value).replace(/\.[^.]+$/, "");
}

function isCloseDate(left: Date, right: Date) {
  return Math.abs(left.getTime() - right.getTime()) <= 15 * 60 * 1000;
}

function isPossibleDuplicate(left: DashboardProject, right: DashboardProject) {
  const sameTitle = normalizeText(left.title) === normalizeText(right.title);
  const leftFile = normalizeFileName(left.briefFileName);
  const rightFile = normalizeFileName(right.briefFileName);
  const sameBriefFile = Boolean(leftFile && rightFile && leftFile === rightFile);

  return (sameTitle || sameBriefFile) && isCloseDate(left.createdAt, right.createdAt);
}

function pickProjectForCard(left: DashboardProject, right: DashboardProject) {
  if (left._count.scripts !== right._count.scripts) {
    return left._count.scripts > right._count.scripts ? left : right;
  }

  return left.updatedAt >= right.updatedAt ? left : right;
}

function collapseDuplicateProjects(projects: DashboardProject[]) {
  const visibleProjects: DashboardProject[] = [];

  for (const project of projects) {
    const duplicateIndex = visibleProjects.findIndex((visible) => isPossibleDuplicate(visible, project));

    if (duplicateIndex === -1) {
      visibleProjects.push(project);
      continue;
    }

    visibleProjects[duplicateIndex] = pickProjectForCard(visibleProjects[duplicateIndex], project);
  }

  return visibleProjects.sort((left, right) => right.updatedAt.getTime() - left.updatedAt.getTime());
}

async function getDashboardProjects(userId: string) {
  return prisma.project.findMany({
    where: { userId },
    orderBy: { updatedAt: "desc" },
    select: {
      id: true,
      title: true,
      brand: true,
      briefFileName: true,
      status: true,
      createdAt: true,
      updatedAt: true,
      _count: { select: { scripts: true } },
    },
  });
}

export default async function DashboardPage() {
  const user = await requireUser();
  const projects = collapseDuplicateProjects(await getDashboardProjects(user.id));

  return (
    <AppShell login={user.login}>
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="text-sm text-slate-500">Рабочее пространство</p>
          <h1 className="mt-2 text-3xl font-normal tracking-tight text-slate-950">Проекты</h1>
          <p className="mt-3 text-sm text-slate-500">Брифы и будущие наборы UGC-сценариев.</p>
        </div>
        <ButtonLink href="/projects/new">
          Новый проект
        </ButtonLink>
      </div>

      <Card className="mt-10 overflow-hidden p-3">
        {projects.length ? (
          <div className="space-y-2">
            {projects.map((project) => (
              <Link
                key={project.id}
                href={`/projects/${project.id}`}
                className="grid gap-4 rounded-2xl bg-white px-5 py-5 transition-colors hover:bg-slate-100 md:grid-cols-[1fr_130px_150px_130px_110px] md:items-center"
              >
                <div>
                  <h2 className="font-normal text-slate-950">{project.title}</h2>
                  <p className="mt-2 text-sm text-slate-500">{project.brand}</p>
                </div>
                <div className="text-sm text-slate-500">{project._count.scripts} сценариев</div>
                <div>
                  <ProjectStatusBadge status={project.status} />
                </div>
                <time className="text-sm text-slate-500">
                  {project.updatedAt.toLocaleDateString("ru-RU")}
                </time>
                <span className="inline-flex h-9 items-center justify-center rounded-xl bg-slate-100 px-4 text-sm font-normal text-slate-900">
                  Открыть
                </span>
              </Link>
            ))}
          </div>
        ) : (
          <div className="px-5 py-12 text-center">
            <h2 className="font-normal text-slate-950">Проектов пока нет</h2>
            <p className="mt-3 text-sm text-slate-500">Создайте первый проект из рекламного брифа.</p>
          </div>
        )}
      </Card>
    </AppShell>
  );
}
