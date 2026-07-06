export type ProjectStep = "questions" | "generation" | "scripts" | "export";

type ProjectStepInput = {
  currentStep?: string | null;
  status: string;
  scripts?: unknown[];
};

const projectSteps = new Set<ProjectStep>(["questions", "generation", "scripts", "export"]);

export function getProjectStep(project: ProjectStepInput): ProjectStep {
  if (project.currentStep && projectSteps.has(project.currentStep as ProjectStep)) {
    return project.currentStep as ProjectStep;
  }

  if (project.status === "scripts_generated" || (project.scripts?.length ?? 0) > 0) {
    return "scripts";
  }

  if (project.status === "questions_approved" || project.status === "generating_scripts") {
    return "generation";
  }

  return "questions";
}
