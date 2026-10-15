import { Dataset, Firm, Stage, Task, stages } from "./model";
import { dayDiff, shiftDate } from "./dates";
export const values = <T>(record: Record<string, T>): T[] =>
  Object.values(record);
export const activeFirms = (d: Dataset) =>
  values(d.firms).filter((f) => !f.archived);
export const currentInstance = (d: Dataset, f: Firm) =>
  values(d.instances).find(
    (i) =>
      i.firmId === f.id && i.stage === f.stage && i.entered === f.stageEntered,
  );
export const firmTasks = (d: Dataset, id: string) =>
  values(d.tasks).filter((t) => t.firmId === id);
export const checklist = (d: Dataset, f: Firm) =>
  (currentInstance(d, f)?.taskIds ?? [])
    .map((id) => d.tasks[id])
    .filter(Boolean);
export const progress = (tasks: Task[]) =>
  tasks.length
    ? Math.round(
        (tasks.filter((t) => t.status === "Completed").length / tasks.length) *
          100,
      )
    : 0;
export const stageAge = (d: Dataset, f: Firm) =>
  dayDiff(d.settings.demoDate, f.stageEntered);
export const stageTarget = (d: Dataset, f: Firm) =>
  currentInstance(d, f)?.snapshot.targetDays ??
  d.settings.defaultTargets[f.stage];
export const overdue = (d: Dataset, t: Task) =>
  t.status !== "Completed" && t.dueDate < d.settings.demoDate;
export const health = (
  d: Dataset,
  f: Firm,
): { label: "On track" | "Needs attention" | "At risk"; reason: string } => {
  const tasks = checklist(d, f);
  const blocked = tasks.find((t) => t.status === "Blocked");
  if (blocked) return { label: "At risk", reason: `Blocked: ${blocked.title}` };
  if (stageAge(d, f) > stageTarget(d, f) && f.stage !== "relationship")
    return {
      label: "At risk",
      reason: `Stage target exceeded by ${stageAge(d, f) - stageTarget(d, f)} days`,
    };
  const late = tasks.filter((t) => overdue(d, t));
  if (late.length)
    return {
      label: "Needs attention",
      reason: `${late.length} overdue requirement${late.length === 1 ? "" : "s"}`,
    };
  if (f.relationshipHealth !== "Healthy")
    return {
      label: f.relationshipHealth === "At risk" ? "At risk" : "Needs attention",
      reason: f.healthReason,
    };
  return {
    label: "On track",
    reason:
      f.stage === "relationship"
        ? "Relationship cadence is current"
        : "Within stage target",
  };
};
export function taskBlockers(d: Dataset, t: Task): string[] {
  const reasons: string[] = [];
  for (const dep of t.dependencies)
    if (d.tasks[dep]?.status !== "Completed")
      reasons.push(`Complete “${d.tasks[dep]?.title ?? dep}” first.`);
  if (t.evidence === "Note" && !t.evidenceNote.trim())
    reasons.push("A completion note is required.");
  if (t.evidence === "Meeting date" && !t.meetingDate)
    reasons.push("A meeting date is required.");
  if (
    t.evidence === "Verified primary contact" &&
    !values(d.contacts).some(
      (c) => c.firmId === t.firmId && c.primary && !c.archived,
    )
  )
    reasons.push("Add an active primary contact to this firm.");
  if (
    t.evidence === "Document/signature status" &&
    (!t.documentId || d.documents[t.documentId]?.status !== "Signed")
  )
    reasons.push("Link a fully signed agreement.");
  return reasons;
}
export function handoffBlockers(d: Dataset, f: Firm): string[] {
  if (f.archived) return ["Restore this firm before moving stages."];
  if (f.stage === "relationship")
    return ["This firm is in the final lifecycle stage."];
  const instance = currentInstance(d, f);
  if (!instance) return ["The current workflow instance is missing."];
  return instance.snapshot.steps
    .filter((s) => s.required)
    .flatMap((step) => {
      const task = instance.taskIds
        .map((id) => d.tasks[id])
        .find((t) => t?.stepId === step.id);
      if (!task) return [`Missing task: ${step.title}`];
      return [
        ...(task.status !== "Completed" ? [`Complete “${step.title}”.`] : []),
        ...taskBlockers(d, task),
      ];
    });
}
export const stageCounts = (d: Dataset, departmentId = "") =>
  stages.map((stage) => ({
    stage,
    name: d.settings.stageLabels[stage],
    value: activeFirms(d).filter(
      (f) =>
        f.stage === stage && (!departmentId || f.departmentId === departmentId),
    ).length,
  }));
export const scopedTasks = (d: Dataset, departmentId = "") =>
  values(d.tasks).filter(
    (t) =>
      (!departmentId || t.departmentId === departmentId) &&
      (!t.firmId || !d.firms[t.firmId]?.archived),
  );
export const dueThisWeek = (d: Dataset, t: Task) =>
  t.status !== "Completed" &&
  t.dueDate >= d.settings.demoDate &&
  t.dueDate <= shiftDate(d.settings.demoDate, 7);
export const stageColor: Record<Stage, string> = {
  prospect: "#4b7bb9",
  onboarding: "#d99526",
  implementation: "#5375cc",
  training: "#9263bf",
  relationship: "#138d77",
};
