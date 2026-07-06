import Link from "next/link";
import { notFound } from "next/navigation";
import { AppShell } from "@/components/AppShell";
import { ScriptEditor } from "@/components/ScriptEditor";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

type ScriptPageProps = {
  params: Promise<{ id: string; scriptId: string }>;
};

type ScriptStatus = "draft" | "needs_revision" | "approved_by_creator" | "approved_by_client" | "rejected" | "reference_quality";

function normalizeScriptStatus(status: string): ScriptStatus {
  if (status === "approved") return "approved_by_creator";
  if (
    status === "draft" ||
    status === "needs_revision" ||
    status === "approved_by_creator" ||
    status === "approved_by_client" ||
    status === "rejected" ||
    status === "reference_quality"
  ) {
    return status;
  }
  return "draft";
}

export default async function ScriptPage({ params }: ScriptPageProps) {
  const user = await requireUser();
  const { id, scriptId } = await params;
  const script = await prisma.script.findFirst({
    where: {
      id: scriptId,
      projectId: id,
      project: { userId: user.id },
    },
    include: {
      project: true,
      revisions: { orderBy: { createdAt: "desc" }, take: 10 },
    },
  });

  if (!script) notFound();

  return (
    <AppShell login={user.login}>
      <Link href={`/projects/${script.projectId}`} className="text-sm text-slate-500 transition-colors hover:text-slate-950">
        Назад к проекту
      </Link>
      <div className="mt-4">
        <p className="text-sm text-slate-500">{script.project.title}</p>
        <h1 className="mt-2 text-3xl font-normal tracking-tight text-slate-950">
          {script.number}. {script.title}
        </h1>
      </div>

      <ScriptEditor
        projectId={script.projectId}
        scriptId={script.id}
        title={script.title}
        format={script.format}
        status={normalizeScriptStatus(script.status)}
        generatedText={script.generatedText}
        editedText={script.editedText ?? script.generatedText}
        approvedByClientAt={script.approvedByClientAt?.toISOString() ?? null}
        isStyleReference={script.isStyleReference}
        revisions={script.revisions.map((revision) => ({
          id: revision.id,
          previousText: revision.previousText,
          newText: revision.newText,
          changeNote: revision.changeNote,
          createdAt: revision.createdAt.toISOString(),
        }))}
      />
    </AppShell>
  );
}
