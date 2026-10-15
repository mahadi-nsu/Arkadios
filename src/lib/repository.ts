import {
  Contact,
  CustomField,
  Dataset,
  DocumentRecord,
  Firm,
  Project,
  Review,
  Task,
  Thread,
  User,
  Workflow,
  contactSchema,
  customFieldSchema,
  documentSchema,
  firmSchema,
  projectSchema,
  reviewSchema,
  taskSchema,
  threadSchema,
  userSchema,
  workflowSchema,
} from "./model";
import {
  actor,
  canAdmin,
  canApprove,
  canEditFirm,
  canEditTask,
  canWrite,
  requirePermission,
} from "./permissions";
import {
  evaluateRules,
  instantiateStage,
  log,
  newTask,
  transition,
} from "./engine";
import { eventTime, shiftDate } from "./dates";
import { checklist, currentInstance, taskBlockers, values } from "./selectors";
import { validateDataset, validateWorkflow } from "./validation";
export type Command =
  | { type: "firm.save"; value: Firm }
  | { type: "firm.archive"; id: string; archived: boolean }
  | { type: "firm.advance"; id: string; expectedStage: string }
  | { type: "contact.save"; value: Contact }
  | { type: "contact.import"; values: Contact[]; duplicates: "skip" | "update" }
  | { type: "contact.archive"; id: string; archived: boolean }
  | { type: "task.save"; value: Task }
  | { type: "task.bulk"; ids: string[]; assigneeId: string }
  | { type: "task.comment"; id: string; text: string }
  | { type: "project.save"; value: Project; template?: boolean }
  | {
      type: "milestone.save";
      id: string;
      status: "Upcoming" | "In progress" | "Completed";
      date: string;
    }
  | { type: "document.save"; value: DocumentRecord }
  | {
      type: "document.simulate";
      id: string;
      action: "send" | "sign" | "decline";
    }
  | { type: "thread.save"; value: Thread }
  | { type: "message.add"; threadId: string; body: string; internal: boolean }
  | { type: "review.save"; value: Review }
  | { type: "workflow.save"; value: Workflow; publish: boolean }
  | { type: "user.save"; value: User; reassignTo?: string }
  | { type: "department.save"; id: string; name: string; managerId: string }
  | { type: "custom.save"; value: CustomField }
  | {
      type: "settings.save";
      value: Partial<
        Pick<
          Dataset["settings"],
          "stageLabels" | "defaultTargets" | "reportSchedule"
        >
      >;
    }
  | { type: "rule.save"; id: string; enabled: boolean; days: number }
  | { type: "integration.sync"; name: string }
  | { type: "notification.read"; id?: string }
  | { type: "date.advance" }
  | { type: "view.save"; value: Dataset["savedViews"][string] };
function requireFirm(d: Dataset, id?: string) {
  requirePermission(id ? canEditFirm(d, d.firms[id]) : canWrite(d));
}
function validateCustom(
  d: Dataset,
  entity: "firm" | "contact",
  custom: Record<string, string | number>,
) {
  for (const f of values(d.customFields).filter((f) => f.entity === entity)) {
    const v = custom[f.id];
    if (f.required && (v === undefined || v === ""))
      throw new Error(`${f.name} is required.`);
    if (v === undefined || v === "") continue;
    if (f.type === "Number" && typeof v !== "number")
      throw new Error(`${f.name} must be a number.`);
    if (f.type === "Select" && !f.options.includes(String(v)))
      throw new Error(`${f.name} needs a configured option.`);
    if (f.type === "Date" && !/^\d{4}-\d{2}-\d{2}$/.test(String(v)))
      throw new Error(`${f.name} needs a date.`);
  }
}
function saveContact(d: Dataset, contact: Contact) {
  const c = contactSchema.parse(contact);
  const old = d.contacts[c.id];
  requireFirm(d, old?.firmId);
  requireFirm(d, c.firmId);
  if (!c.firmId && c.category !== "Vendor")
    throw new Error("Choose a firm for this contact category.");
  if (
    values(d.contacts).some(
      (x) =>
        x.id !== c.id &&
        !x.archived &&
        x.email.toLowerCase() === c.email.toLowerCase(),
    )
  )
    throw new Error("An active contact already uses this email address.");
  validateCustom(d, "contact", c.custom);
  if (c.primary && c.firmId)
    for (const other of values(d.contacts))
      if (other.firmId === c.firmId) other.primary = false;
  d.contacts[c.id] = c;
  log(d, c.firmId ?? "", `${old ? "Updated" : "Added"} contact ${c.name}.`);
}
function saveTask(d: Dataset, input: Task) {
  const t = taskSchema.parse(input),
    old = d.tasks[t.id];
  requirePermission(canEditTask(d, old ?? t));
  requirePermission(canEditTask(d, t));
  if (t.assigneeId && !d.users[t.assigneeId]?.active)
    throw new Error("Choose an active employee.");
  if (old?.instanceId) {
    for (const key of [
      "instanceId",
      "stepId",
      "evidence",
      "dependencies",
      "firmId",
    ] as const)
      if (JSON.stringify(t[key]) !== JSON.stringify(old[key]))
        throw new Error(
          "Published workflow requirements cannot be changed on an active instance.",
        );
  }
  if (t.projectId && d.projects[t.projectId]?.firmId !== t.firmId)
    throw new Error("Task and project must belong to the same firm.");
  if (t.documentId && d.documents[t.documentId]?.firmId !== t.firmId)
    throw new Error("Evidence document must belong to the linked firm.");
  if (t.status === "Completed") {
    const blockers = taskBlockers(d, t);
    if (blockers.length) throw new Error(blockers.join(" "));
    t.completedAt = t.completedAt ?? eventTime(d.settings.demoDate);
  } else delete t.completedAt;
  d.tasks[t.id] = t;
  if (
    t.firmId &&
    t.instanceId &&
    currentInstance(d, d.firms[t.firmId])?.id === t.instanceId
  ) {
    const f = d.firms[t.firmId];
    f.nextAction =
      checklist(d, f).find((task) => task.status !== "Completed")?.title ??
      (f.stage === "relationship"
        ? "Prepare for the next partner review"
        : "Review handoff for the next stage");
  }
  if (old?.projectId && old.projectId !== t.projectId)
    d.projects[old.projectId].taskIds = d.projects[
      old.projectId
    ].taskIds.filter((id) => id !== t.id);
  if (t.projectId && !d.projects[t.projectId].taskIds.includes(t.id))
    d.projects[t.projectId].taskIds.push(t.id);
  if (
    t.status === "Completed" &&
    old?.status !== "Completed" &&
    t.recurringDays > 0
  ) {
    const nextId = `repeat_${t.id}`;
    if (!d.tasks[nextId])
      d.tasks[nextId] = {
        ...structuredClone(t),
        id: nextId,
        status: "Not started",
        dueDate: shiftDate(t.dueDate, t.recurringDays),
        evidenceNote: "",
        meetingDate: "",
        comments: [],
        completedAt: undefined,
      };
  }
  log(
    d,
    t.firmId ?? "",
    `${old ? "Updated" : "Created"} task “${t.title}” · ${t.status.toLowerCase()}.`,
  );
}
/** All mutations run against a clone. Failure never commits partial state. Replace this boundary with an API repository later. */
export function execute(current: Dataset, command: Command): Dataset {
  const d = structuredClone(current);
  const u = actor(d);
  switch (command.type) {
    case "firm.save": {
      const f = firmSchema.parse(command.value);
      const old = d.firms[f.id];
      requirePermission(canEditFirm(d, old));
      requirePermission(canEditFirm(d, f));
      if (old && (f.stage !== old.stage || f.stageEntered !== old.stageEntered))
        throw new Error("Use an approved handoff to change lifecycle stage.");
      if (!old && f.stage !== "prospect")
        throw new Error("New firms must begin in Prospect.");
      if (!d.users[f.ownerId]?.active)
        throw new Error("Choose an active firm owner.");
      validateCustom(d, "firm", f.custom);
      d.firms[f.id] = f;
      if (!old) instantiateStage(d, f);
      log(d, f.id, `${old ? "Updated" : "Created"} firm record.`);
      break;
    }
    case "firm.archive": {
      const f = d.firms[command.id];
      requirePermission(canEditFirm(d, f));
      f.archived = command.archived;
      log(
        d,
        f.id,
        `${command.archived ? "Archived" : "Restored"} firm. Linked records retained.`,
      );
      break;
    }
    case "firm.advance": {
      const f = d.firms[command.id];
      requirePermission(canApprove(d, f));
      if (f.stage !== command.expectedStage)
        throw new Error(
          "This stage has already changed. Refresh the handoff review.",
        );
      transition(d, f);
      break;
    }
    case "contact.save":
      saveContact(d, command.value);
      break;
    case "contact.import": {
      requirePermission(canWrite(d));
      if (command.values.length > 2000)
        throw new Error("Import at most 2,000 contacts at once.");
      for (const row of command.values) {
        const duplicate = values(d.contacts).find(
          (c) =>
            !c.archived && c.email.toLowerCase() === row.email.toLowerCase(),
        );
        if (duplicate && command.duplicates === "skip") continue;
        saveContact(d, { ...row, id: duplicate?.id ?? row.id });
      }
      break;
    }
    case "contact.archive": {
      const c = d.contacts[command.id];
      requireFirm(d, c.firmId);
      c.archived = command.archived;
      log(
        d,
        c.firmId ?? "",
        `${command.archived ? "Archived" : "Restored"} contact ${c.name}.`,
      );
      break;
    }
    case "task.save":
      saveTask(d, command.value);
      break;
    case "task.bulk": {
      for (const id of command.ids) {
        const t = d.tasks[id];
        saveTask(d, { ...t, assigneeId: command.assigneeId });
      }
      break;
    }
    case "task.comment": {
      const t = d.tasks[command.id];
      requirePermission(canEditTask(d, t));
      if (!command.text.trim()) throw new Error("Enter a comment.");
      t.comments.push({
        id: crypto.randomUUID(),
        authorId: u.id,
        text: command.text,
        at: eventTime(d.settings.demoDate),
      });
      log(d, t.firmId ?? "", `Commented on “${t.title}”.`);
      break;
    }
    case "project.save": {
      const p = projectSchema.parse(command.value);
      const old = d.projects[p.id];
      requireFirm(d, old?.firmId ?? p.firmId);
      if (!p.firmId)
        requirePermission(
          canAdmin(d) ||
            u.role === "Manager" ||
            (p.ownerId === u.id && canWrite(d)),
        );
      if (p.targetDate < p.startDate)
        throw new Error("Target date must be on or after start date.");
      d.projects[p.id] = p;
      if (command.template && !old) {
        for (const [index, title] of [
          "Plan and confirm ownership",
          "Coordinate delivery",
          "Document outcomes",
        ].entries()) {
          const t = newTask(d, {
            title,
            firmId: p.firmId,
            projectId: p.id,
            assigneeId: p.ownerId,
            dueDate: shiftDate(p.startDate, 3 + index * 5),
          });
          d.tasks[t.id] = t;
          if (
            t.firmId &&
            t.instanceId &&
            currentInstance(d, d.firms[t.firmId])?.id === t.instanceId
          ) {
            const f = d.firms[t.firmId];
            f.nextAction =
              checklist(d, f).find((task) => task.status !== "Completed")
                ?.title ??
              (f.stage === "relationship"
                ? "Prepare for the next partner review"
                : "Review handoff for the next stage");
          }
          p.taskIds.push(t.id);
        }
        const mid = `milestone_${p.id}`;
        d.milestones[mid] = {
          id: mid,
          projectId: p.id,
          name: "Delivery review",
          date: p.targetDate,
          status: "Upcoming",
        };
        p.milestoneIds.push(mid);
      }
      log(
        d,
        p.firmId ?? "",
        `${old ? "Updated" : "Created"} project ${p.name}.`,
      );
      break;
    }
    case "milestone.save": {
      const m = d.milestones[command.id];
      const p = d.projects[m.projectId];
      requireFirm(d, p.firmId);
      m.status = command.status;
      m.date = command.date;
      log(
        d,
        p.firmId ?? "",
        `Updated milestone “${m.name}” to ${m.status.toLowerCase()}.`,
      );
      break;
    }
    case "document.save": {
      const doc = documentSchema.parse(command.value);
      requireFirm(d, d.documents[doc.id]?.firmId ?? doc.firmId);
      d.documents[doc.id] = doc;
      log(
        d,
        doc.firmId ?? "",
        `Added document ${doc.name}. Only metadata is persisted for selected files.`,
      );
      break;
    }
    case "document.simulate": {
      const doc = d.documents[command.id];
      requireFirm(d, doc.firmId);
      const at = eventTime(d.settings.demoDate);
      if (command.action === "send") {
        if (!doc.signers.length)
          throw new Error("This document has no configured signers.");
        if (!["Draft", "Declined", "Expired"].includes(doc.status))
          throw new Error(
            "This agreement already has an active or completed request.",
          );
        doc.status = "Sent";
        doc.signers.forEach((s) => delete s.signedAt);
      }
      if (command.action === "sign") {
        if (!["Sent", "Partially signed"].includes(doc.status))
          throw new Error("Simulate a signature request first.");
        const signer = doc.signers.find((s) => !s.signedAt);
        if (signer) signer.signedAt = at;
        doc.status = doc.signers.every((s) => s.signedAt)
          ? "Signed"
          : "Partially signed";
      }
      if (command.action === "decline") {
        if (!["Sent", "Partially signed"].includes(doc.status))
          throw new Error("Only an active request can be declined.");
        doc.status = "Declined";
      }
      doc.events.push({
        at,
        label: `Demo: ${command.action === "send" ? "signature request sent" : command.action === "sign" ? "signer completed" : "request declined"}`,
      });
      log(
        d,
        doc.firmId ?? "",
        `${doc.name}: simulated ${doc.status.toLowerCase()}.`,
      );
      break;
    }
    case "thread.save": {
      const th = threadSchema.parse(command.value);
      requireFirm(d, th.firmId);
      d.threads[th.id] = th;
      log(d, th.firmId, `Created communication “${th.subject}”.`);
      break;
    }
    case "message.add": {
      const th = d.threads[command.threadId];
      requirePermission(canWrite(d));
      requirePermission(
        canEditFirm(d, d.firms[th.firmId]) ||
          (u.role === "Member" && th.ownerId === u.id),
      );
      if (!command.body.trim()) throw new Error("Enter a message.");
      const id = `msg_${crypto.randomUUID()}`,
        at = eventTime(d.settings.demoDate);
      d.messages[id] = {
        id,
        threadId: th.id,
        author: u.name,
        body: command.body,
        at,
        kind: command.internal ? "Internal note" : "Demo reply",
      };
      th.updatedAt = at;
      th.status = command.internal ? th.status : "Waiting";
      log(
        d,
        th.firmId,
        command.internal
          ? "Added internal communication note."
          : `Sent simulated reply: ${th.subject}. No email was sent.`,
      );
      break;
    }
    case "review.save": {
      const r = reviewSchema.parse(command.value);
      requireFirm(d, r.firmId);
      const old = d.reviews[r.id];
      if (r.status === "Completed" && !r.notes.trim())
        throw new Error("Add review outcome notes before completing.");
      if (r.status === "Completed")
        r.completedAt = r.completedAt ?? eventTime(d.settings.demoDate);
      d.reviews[r.id] = r;
      if (r.status === "Completed" && old?.status !== "Completed") {
        const task = d.tasks[`review_task_${r.id}`];
        if (task) {
          task.evidenceNote = r.notes;
          task.status = "Completed";
          task.completedAt = r.completedAt;
        }
        const days = r.type === "Annual partner review" ? 365 : 90;
        const nextId = `next_${r.id}`;
        if (!d.reviews[nextId])
          d.reviews[nextId] = {
            ...r,
            id: nextId,
            date: shiftDate(r.date, days),
            status: "Scheduled",
            notes: "",
            completedAt: undefined,
          };
      }
      log(
        d,
        r.firmId,
        `${r.status === "Completed" ? "Completed" : "Scheduled"} ${r.type.toLowerCase()}.`,
      );
      break;
    }
    case "workflow.save": {
      requirePermission(canAdmin(d));
      const w = workflowSchema.parse(command.value);
      validateWorkflow(d, w);
      d.workflows[w.id] = w;
      if (command.publish) {
        const version =
          Math.max(
            0,
            ...values(d.versions)
              .filter((v) => v.stage === w.stage)
              .map((v) => v.version),
          ) + 1;
        const id = `v_${w.stage}_${version}`;
        d.versions[id] = {
          ...structuredClone(w),
          id,
          version,
          publishedAt: eventTime(d.settings.demoDate),
          publishedBy: u.id,
        };
        log(
          d,
          "",
          `Published ${w.name} v${version}. Existing instances retain their snapshots.`,
        );
      }
      break;
    }
    case "user.save": {
      requirePermission(canAdmin(d));
      const employee = userSchema.parse(command.value);
      if (
        employee.id === u.id &&
        (!employee.active || employee.role !== "Admin")
      )
        throw new Error(
          "Keep the active administrator enabled. Switch personas to edit this administrator.",
        );
      if (
        values(d.users).some(
          (x) =>
            x.id !== employee.id &&
            x.email.toLowerCase() === employee.email.toLowerCase(),
        )
      )
        throw new Error("An employee already uses this email.");
      if (!employee.active) {
        const replacement = command.reassignTo
          ? d.users[command.reassignTo]
          : undefined;
        if (
          command.reassignTo &&
          (!replacement?.active || replacement.id === employee.id)
        )
          throw new Error("Choose an active replacement.");
        for (const t of values(d.tasks))
          if (t.assigneeId === employee.id && t.status !== "Completed")
            t.assigneeId = replacement?.id ?? "";
        for (const f of values(d.firms))
          if (f.ownerId === employee.id) {
            f.ownerId =
              replacement?.id ?? d.departments[f.departmentId].managerId;
            if (f.ownerId === employee.id)
              throw new Error(
                "This employee is a department manager. Set a new manager or choose a replacement first.",
              );
          }
      }
      d.users[employee.id] = employee;
      log(
        d,
        "",
        `${employee.active ? "Saved" : "Deactivated"} employee ${employee.name}. No invitation email was sent.`,
      );
      break;
    }
    case "department.save": {
      requirePermission(canAdmin(d));
      if (!command.name.trim() || !d.users[command.managerId]?.active)
        throw new Error(
          "Enter a department name and choose an active manager.",
        );
      d.departments[command.id] = {
        id: command.id,
        name: command.name,
        managerId: command.managerId,
      };
      break;
    }
    case "custom.save": {
      requirePermission(canAdmin(d));
      const f = customFieldSchema.parse(command.value);
      if (
        f.type === "Select" &&
        (!f.options.length || f.options.some((x) => !x.trim()))
      )
        throw new Error("Select fields need nonempty options.");
      d.customFields[f.id] = f;
      break;
    }
    case "settings.save": {
      requirePermission(canAdmin(d));
      if (command.value.defaultTargets) {
        for (const [stage, targetDays] of Object.entries(
          command.value.defaultTargets,
        )) {
          if (
            d.settings.defaultTargets[
              stage as keyof typeof d.settings.defaultTargets
            ] === targetDays
          )
            continue;
          const published = values(d.versions)
            .filter((v) => v.stage === stage)
            .sort((a, b) => b.version - a.version)[0];
          const version = published.version + 1;
          const id = `v_${stage}_${version}`;
          d.versions[id] = {
            ...structuredClone(published),
            id,
            version,
            targetDays,
            publishedAt: eventTime(d.settings.demoDate),
            publishedBy: u.id,
          };
          for (const w of values(d.workflows))
            if (w.stage === stage) w.targetDays = targetDays;
          log(
            d,
            "",
            `Published ${stage} target update as workflow v${version}. Existing instances preserved.`,
          );
        }
      }
      d.settings = { ...d.settings, ...command.value };
      break;
    }
    case "rule.save": {
      requirePermission(canAdmin(d));
      d.rules[command.id] = {
        ...d.rules[command.id],
        enabled: command.enabled,
        days: command.days,
      };
      break;
    }
    case "integration.sync": {
      requirePermission(canAdmin(d));
      const integration = d.settings.integrations.find(
        (i) => i.name === command.name,
      );
      if (!integration) throw new Error("Unknown integration.");
      integration.lastSync = eventTime(d.settings.demoDate);
      log(
        d,
        "",
        `${integration.name}: simulated record-reference refresh. No network request was made.`,
      );
      for (const f of values(d.firms).slice(0, 3))
        log(d, f.id, `${integration.name} demo reference reviewed.`);
      break;
    }
    case "notification.read": {
      for (const n of values(d.notifications))
        if (
          (!command.id || n.id === command.id) &&
          (n.recipientId === u.id || u.role === "Admin")
        )
          n.read = true;
      break;
    }
    case "date.advance": {
      requirePermission(canAdmin(d));
      d.settings.demoDate = shiftDate(d.settings.demoDate, 1);
      log(d, "", "Advanced demo clock by one day. Local rules evaluated.");
      break;
    }
    case "view.save": {
      requirePermission(canWrite(d));
      d.savedViews[command.value.id] = command.value;
      break;
    }
  }
  evaluateRules(d);
  return validateDataset(d);
}
