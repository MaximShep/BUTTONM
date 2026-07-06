import Link from "next/link";
import { notFound } from "next/navigation";
import { AppShell } from "@/components/AppShell";
import { ProjectGeneration } from "@/components/ProjectGeneration";
import { ProjectQuestions } from "@/components/ProjectQuestions";
import { ProjectScripts } from "@/components/ProjectScripts";
import { ProjectWorkspaceMeta } from "@/components/ProjectWorkspaceMeta";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getProjectStep } from "@/lib/projects/getProjectStep";

type ProjectPageProps = {
  params: Promise<{ id: string }>;
};

function parseQuestionAnalysisPayload(payloadJson: string | null | undefined) {
  if (!payloadJson) return null;

  try {
    return JSON.parse(payloadJson) as { summary?: unknown };
  } catch {
    return null;
  }
}

export default async function ProjectPage({ params }: ProjectPageProps) {
  const user = await requireUser();
  const { id } = await params;
  const project = await prisma.project.findFirst({
    where: { id, userId: user.id },
    include: {
      questions: { orderBy: { createdAt: "asc" } },
      scripts: { orderBy: { number: "asc" } },
      events: { orderBy: { createdAt: "desc" }, take: 5 },
      references: { orderBy: { createdAt: "asc" } },
    },
  });

  if (!project) notFound();

  const questionAnalysisEvent = await prisma.projectEvent.findFirst({
    where: { projectId: project.id, type: "brief.questions_analyzed" },
    select: { id: true, payloadJson: true },
    orderBy: { createdAt: "desc" },
  });

  const currentStep = getProjectStep(project);
  const readyProjectReferenceCount = project.references.filter(
    (reference) => reference.useInGeneration && reference.status === "ready" && reference.extractedScenarioText,
  ).length;
  const questionAnalysisPayload = parseQuestionAnalysisPayload(questionAnalysisEvent?.payloadJson);
  const analysisSummary = typeof questionAnalysisPayload?.summary === "string" ? questionAnalysisPayload.summary : "";
  const generationComment = project.generationComment || analysisSummary;
  const hasQuestionAnalysis = Boolean(questionAnalysisEvent);

  return (
    <AppShell login={user.login}>
      <Link href="/dashboard" className="text-sm text-slate-500 transition-colors hover:text-slate-950">
        Назад к проектам
      </Link>

      <div className="mt-4 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-normal tracking-tight text-slate-950">{project.title}</h1>
          <p className="mt-3 text-sm text-slate-500">Бриф загружен и сохранен в проекте.</p>
        </div>
      </div>

      <ProjectWorkspaceMeta
        projectId={project.id}
        briefText={project.briefText}
        briefFileName={project.briefFileName}
        generationComment={generationComment}
        answers={project.questions.map((question) => ({
          question: question.question,
          answer: question.answer,
        }))}
        references={project.references.map((reference) => ({
          id: reference.id,
          type: reference.type,
          url: reference.url,
          fileName: reference.fileName,
          transcriptText: reference.transcriptText,
          extractedScenarioText: reference.extractedScenarioText,
          notes: reference.notes,
          useInGeneration: reference.useInGeneration,
          status: reference.status,
          error: reference.error,
        }))}
        events={project.events.map((event) => ({
          id: event.id,
          type: event.type,
          payloadJson: event.payloadJson,
          createdAt: event.createdAt.toLocaleString("ru-RU"),
        }))}
      />

      {currentStep === "questions" ? (
        <ProjectQuestions
          projectId={project.id}
          questions={project.questions.map((question) => ({
            id: question.id,
            question: question.question,
            answer: question.answer,
            importance: question.importance,
          }))}
          hasQuestionAnalysis={hasQuestionAnalysis}
        />
      ) : null}

      {currentStep === "generation" ? (
        <ProjectGeneration
          projectId={project.id}
          scriptsCount={project.scriptsCount}
          referenceScriptsCount={readyProjectReferenceCount ? project.referenceScriptsCount : 0}
          readyReferenceCount={readyProjectReferenceCount}
          projectStatus={project.status}
        />
      ) : null}

      {currentStep === "scripts" || currentStep === "export" ? (
        <ProjectScripts
          projectId={project.id}
          scriptsCount={project.scriptsCount}
          projectStatus={project.status}
          scripts={project.scripts.map((script) => ({
            id: script.id,
            number: script.number,
            title: script.title,
            format: script.format,
            generatedText: script.generatedText,
            status: script.status,
            basedOnReference: script.basedOnReference,
          }))}
        />
      ) : null}
    </AppShell>
  );
}
