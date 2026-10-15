import { Dataset, Firm, Review, Task, stages } from "./model";
import {
  checklist,
  currentInstance,
  firmTasks,
  handoffBlockers,
  taskBlockers,
  values,
} from "./selectors";

export type FirmNextAction =
  | { kind: "task"; task: Task; blockers: string[] }
  | { kind: "handoff"; nextStage: string }
  | { kind: "review"; review: Review }
  | { kind: "schedule-review" }
  | { kind: "checklist"; blockers: string[] }
  | { kind: "archived" };

export function nextFirmAction(d: Dataset, firm: Firm): FirmNextAction {
  if (firm.archived) return { kind: "archived" };
  const mandatoryIds = new Set(
    currentInstance(d, firm)
      ?.snapshot.steps.filter((step) => step.required)
      .map((step) => step.id) ?? [],
  );
  const required = checklist(d, firm).filter(
    (task) =>
      mandatoryIds.has(task.stepId ?? "") &&
      (task.status !== "Completed" || taskBlockers(d, task).length > 0),
  );
  const open =
    firm.stage === "relationship"
      ? [
          ...required,
          ...firmTasks(d, firm.id).filter(
            (task) =>
              task.status !== "Completed" &&
              !required.some((r) => r.id === task.id),
          ),
        ]
      : required;
  const ordered = [...open].sort((a, b) => a.dueDate.localeCompare(b.dueDate));
  const task =
    ordered.find((task) =>
      task.dependencies.every((id) => d.tasks[id]?.status === "Completed"),
    ) ?? ordered[0];
  if (task)
    return {
      kind: "task",
      task,
      blockers: [
        ...(task.status === "Blocked"
          ? ["This task is marked as blocked."]
          : []),
        ...taskBlockers(d, task),
      ],
    };
  if (firm.stage !== "relationship") {
    const blockers = handoffBlockers(d, firm);
    return blockers.length
      ? { kind: "checklist", blockers }
      : {
          kind: "handoff",
          nextStage:
            d.settings.stageLabels[stages[stages.indexOf(firm.stage) + 1]],
        };
  }
  const review = values(d.reviews)
    .filter((r) => r.firmId === firm.id && r.status === "Scheduled")
    .sort((a, b) => a.date.localeCompare(b.date))[0];
  return review ? { kind: "review", review } : { kind: "schedule-review" };
}
