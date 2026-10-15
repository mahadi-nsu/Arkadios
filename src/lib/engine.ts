import { Dataset, Firm, Stage, Task, stages } from "./model";
import { dayDiff, eventTime, shiftDate } from "./dates";
import { actor } from "./permissions";
import {
  activeFirms,
  checklist,
  currentInstance,
  handoffBlockers,
  overdue,
  stageAge,
  stageTarget,
  values,
} from "./selectors";
export function log(d: Dataset, firmId: string, label: string) {
  const id = `a_${crypto.randomUUID()}`;
  d.activities[id] = {
    id,
    firmId,
    actorId: actor(d).id,
    at: eventTime(d.settings.demoDate),
    label,
  };
  if (firmId && d.firms[firmId])
    d.firms[firmId].lastActivity = eventTime(d.settings.demoDate);
}
export function instantiateStage(d: Dataset, f: Firm) {
  const key = `inst_${f.id}_${f.stage}`;
  if (d.instances[key]) return d.instances[key];
  const version = values(d.versions)
    .filter((v) => v.stage === f.stage)
    .sort((a, b) => b.version - a.version)[0];
  if (!version) throw new Error("Publish a workflow for this stage first.");
  const snapshot = structuredClone(version);
  const taskIds = snapshot.steps.map((s) => `wf_${f.id}_${f.stage}_${s.id}`);
  d.instances[key] = {
    id: key,
    firmId: f.id,
    stage: f.stage,
    entered: f.stageEntered,
    versionId: version.id,
    snapshot,
    taskIds,
    handoffRequested: false,
  };
  snapshot.steps.forEach((s, index) => {
    const id = taskIds[index];
    if (d.tasks[id]) return;
    const assigneeId =
      s.assignment === "Firm owner"
        ? f.ownerId
        : s.assignment === "Named employee"
          ? s.assigneeId
          : "";
    d.tasks[id] = {
      id,
      title: s.title,
      description: s.description,
      firmId: f.id,
      departmentId: s.departmentId,
      assigneeId: d.users[assigneeId]?.active ? assigneeId : "",
      priority: s.required ? "High" : "Medium",
      dueDate: shiftDate(f.stageEntered, s.dueDays),
      status: "Not started",
      dependencies: s.dependencies.map(
        (dep) => taskIds[snapshot.steps.findIndex((step) => step.id === dep)],
      ),
      evidence: s.evidence,
      evidenceNote: "",
      meetingDate: "",
      documentId: "",
      comments: [],
      instanceId: key,
      stepId: s.id,
      recurringDays: 0,
    };
  });
  if (
    f.stage === "implementation" &&
    values(d.rules).some(
      (r) => r.type === "implementation-project" && r.enabled,
    )
  )
    ensureImplementationProject(d, f);
  if (f.stage === "onboarding") {
    const id = `agreement_${f.id}`;
    if (!d.documents[id])
      d.documents[id] = {
        id,
        name: `${f.name} · Partner agreement`,
        category: "Agreements",
        firmId: f.id,
        taskId: taskIds.find(
          (t) => d.tasks[t].evidence === "Document/signature status",
        ),
        version: "1.0",
        added: d.settings.demoDate,
        status: "Draft",
        signers: [
          {
            name: "Partner representative",
            email:
              values(d.contacts).find(
                (c) => c.firmId === f.id && c.primary && !c.archived,
              )?.email ?? "partner@example.com",
          },
          { name: "Arkadios representative", email: "agreements@example.com" },
        ],
        source: "sample",
        fileName: "partner-agreement.html",
        size: 4200,
        events: [],
      };
    for (const t of taskIds)
      if (d.tasks[t].evidence === "Document/signature status")
        d.tasks[t].documentId = id;
  }
  if (f.stage === "relationship") {
    const id = `review_initial_${f.id}`;
    if (!d.reviews[id])
      d.reviews[id] = {
        id,
        firmId: f.id,
        ownerId: f.ownerId,
        type: "Quarterly business review",
        date: shiftDate(f.stageEntered, Math.min(90, version.targetDays)),
        status: "Scheduled",
        notes: "",
      };
    const annualId = `review_annual_${f.id}`;
    if (!d.reviews[annualId])
      d.reviews[annualId] = {
        id: annualId,
        firmId: f.id,
        ownerId: f.ownerId,
        type: "Annual partner review",
        date: shiftDate(f.stageEntered, 365),
        status: "Scheduled",
        notes: "",
      };
    f.renewalDate = shiftDate(f.stageEntered, 365);
  }
  return d.instances[key];
}
export function ensureImplementationProject(d: Dataset, f: Firm) {
  const existing = values(d.projects).find(
    (p) => p.firmId === f.id && p.type === "Implementation",
  );
  if (existing) return existing;
  const id = `project_impl_${f.id}`;
  const taskIds = checklist(d, f).map((t) => t.id);
  const milestoneIds = ["kickoff", "validation", "launch"].map(
    (s) => `${id}_${s}`,
  );
  d.projects[id] = {
    id,
    name: `${f.name} implementation`,
    firmId: f.id,
    ownerId: f.ownerId,
    type: "Implementation",
    startDate: f.stageEntered,
    targetDate: shiftDate(f.stageEntered, stageTarget(d, f)),
    status: "Active",
    taskIds,
    milestoneIds,
    notes: "Created by the approved implementation handoff.",
  };
  for (const tid of taskIds) d.tasks[tid].projectId = id;
  milestoneIds.forEach((mid, index) => {
    d.milestones[mid] = {
      id: mid,
      projectId: id,
      name: ["Kickoff & planning", "Service validation", "Partner launch"][
        index
      ],
      date: shiftDate(f.stageEntered, [3, 14, stageTarget(d, f)][index]),
      status: "Upcoming",
    };
  });
  log(
    d,
    f.id,
    "Created implementation project and linked existing workflow tasks.",
  );
  return d.projects[id];
}
function notify(
  d: Dataset,
  id: string,
  recipientId: string,
  title: string,
  body: string,
  href: string,
) {
  if (d.notifications[id] || !d.users[recipientId]) return;
  d.notifications[id] = {
    id,
    recipientId,
    title,
    body,
    href,
    read: false,
    at: eventTime(d.settings.demoDate),
  };
}
export function evaluateRules(d: Dataset) {
  const enabled = (type: string) =>
    values(d.rules).find((r) => r.type === type && r.enabled);
  const overdueRule = enabled("overdue");
  if (overdueRule)
    for (const t of values(d.tasks))
      if (
        overdue(d, t) &&
        dayDiff(d.settings.demoDate, t.dueDate) >= overdueRule.days &&
        (!t.firmId || !d.firms[t.firmId]?.archived)
      )
        notify(
          d,
          `late_${t.id}`,
          d.departments[t.departmentId].managerId,
          "Overdue work needs attention",
          `${t.title} is overdue. Review ownership and dependencies.`,
          `/tasks?task=${t.id}`,
        );
  for (const f of activeFirms(d)) {
    if (f.renewalDate && dayDiff(f.renewalDate, d.settings.demoDate) <= 30)
      notify(
        d,
        `renewal_${f.id}_${f.renewalDate}`,
        f.ownerId,
        `${f.name} agreement renewal is approaching`,
        `Renewal date: ${f.renewalDate}. Confirm the next action with the partner.`,
        `/firms/detail?id=${f.id}`,
      );
    const instance = currentInstance(d, f);
    if (!instance) continue;
    if (
      enabled("stage-target") &&
      f.stage !== "relationship" &&
      stageAge(d, f) > stageTarget(d, f)
    )
      notify(
        d,
        `target_${instance.id}`,
        f.ownerId,
        `${f.name} exceeded its stage target`,
        `Review ${d.settings.stageLabels[f.stage].toLowerCase()} requirements and the next action.`,
        `/firms/detail?id=${f.id}`,
      );
    if (
      enabled("handoff") &&
      f.stage !== "relationship" &&
      handoffBlockers(d, f).length === 0 &&
      !instance.handoffRequested
    ) {
      instance.handoffRequested = true;
      notify(
        d,
        `handoff_${instance.id}`,
        d.departments[f.departmentId].managerId,
        `${f.name} is ready for handoff`,
        "Review the completed requirements and approve the next stage.",
        `/firms/detail?id=${f.id}`,
      );
    }
  }
  for (const r of values(d.reviews))
    if (
      r.status === "Scheduled" &&
      dayDiff(r.date, d.settings.demoDate) <= 7 &&
      !d.firms[r.firmId].archived
    ) {
      const id = `review_task_${r.id}`;
      if (!d.tasks[id]) {
        const f = d.firms[r.firmId];
        d.tasks[id] = {
          id,
          title: `${r.type}: ${f.name}`,
          description:
            "Prepare for the review, capture the outcome, and agree on follow-up actions.",
          firmId: f.id,
          departmentId: f.departmentId,
          assigneeId: d.users[r.ownerId]?.active ? r.ownerId : "",
          priority: "Medium",
          dueDate: r.date,
          status: "Not started",
          dependencies: [],
          evidence: "Note",
          evidenceNote: "",
          meetingDate: "",
          documentId: "",
          comments: [],
          recurringDays: 0,
        };
      }
    }
}
export function transition(d: Dataset, f: Firm) {
  const blockers = handoffBlockers(d, f);
  if (blockers.length) throw new Error(blockers.join(" "));
  const previous = f.stage;
  const next = stages[stages.indexOf(previous) + 1];
  if (!next) throw new Error("Relationship is the final stage.");
  const historyId = `history_${f.id}_${previous}`;
  d.history[historyId] = {
    id: historyId,
    firmId: f.id,
    stage: previous,
    entered: f.stageEntered,
    exited: d.settings.demoDate,
    targetDays: stageTarget(d, f),
    approverId: actor(d).id,
  };
  f.stage = next;
  f.stageEntered = d.settings.demoDate;
  const instance = instantiateStage(d, f);
  f.nextAction =
    instance.snapshot.steps[0]?.title ?? "Schedule a relationship review";
  log(
    d,
    f.id,
    `${actor(d).name} approved ${d.settings.stageLabels[previous]} → ${d.settings.stageLabels[next]}. Workflow v${instance.snapshot.version} applied.`,
  );
}
export function newTask(
  d: Dataset,
  patch: Partial<Task> & { title: string },
): Task {
  return {
    id: `t_${crypto.randomUUID()}`,
    description: "",
    departmentId: actor(d).departmentId,
    assigneeId: actor(d).id,
    priority: "Medium",
    dueDate: shiftDate(d.settings.demoDate, 3),
    status: "Not started",
    dependencies: [],
    evidence: "None",
    evidenceNote: "",
    meetingDate: "",
    documentId: "",
    comments: [],
    recurringDays: 0,
    ...patch,
  };
}
export function nextStage(stage: Stage) {
  return stages[stages.indexOf(stage) + 1];
}
