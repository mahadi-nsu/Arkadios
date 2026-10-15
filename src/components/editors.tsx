"use client";
import { createContext, useContext, useState } from "react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "./ui/dialog";
import { Button } from "./ui/button";
import { prettyDate } from "@/lib/dates";
import { Field, RecordForm } from "./forms";
import { useApp, useData } from "@/lib/store";
import { actor, canEditFirm, canEditTask, canWrite } from "@/lib/permissions";
import {
  Contact,
  DocumentRecord,
  Firm,
  Project,
  Review,
  Task,
  Thread,
  statuses,
} from "@/lib/model";
import { values } from "@/lib/selectors";
import { eventTime, shiftDate } from "@/lib/dates";
import { uid } from "@/lib/utils";
import { newTask } from "@/lib/engine";
import { Command } from "@/lib/repository";
import { useDiscardChanges, useUnsavedChanges } from "./unsaved-changes";
export type EditorRequest = {
  type:
    "firm" | "contact" | "task" | "project" | "document" | "thread" | "review";
  id?: string;
  firmId?: string;
  title?: string;
  projectId?: string;
};
const EditorContext = createContext<(r: EditorRequest) => void>(
  () => undefined,
);
export const useEditor = () => useContext(EditorContext);
export const sessionFiles = new Map<string, File>();
export function EditorProvider({ children }: { children: React.ReactNode }) {
  const [request, setRequest] = useState<EditorRequest | null>(null);
  const confirmDiscard = useDiscardChanges();
  const openEditor = async (next: EditorRequest) => {
    if (await confirmDiscard()) setRequest(next);
  };
  return (
    <EditorContext.Provider value={openEditor}>
      {children}
      <Dialog
        open={!!request}
        onOpenChange={(open) => !open && setRequest(null)}
      >
        {request && (
          <Editor
            key={`${request.type}-${request.id ?? "new"}`}
            request={request}
            close={() => setRequest(null)}
          />
        )}
      </Dialog>
    </EditorContext.Provider>
  );
}
function Editor({
  request: r,
  close,
}: {
  request: EditorRequest;
  close: () => void;
}) {
  const d = useData(),
    run = useApp((s) => s.run);
  const u = actor(d);
  const [file, setFile] = useState<File | null>(null);
  useUnsavedChanges(!!file, () => setFile(null));
  const people = values(d.users)
    .filter((u) => u.active)
    .map((u) => ({ value: u.id, label: u.name }));
  const departments = values(d.departments).map((dep) => ({
    value: dep.id,
    label: dep.name,
  }));
  const firms = values(d.firms)
    .filter((f) => !f.archived)
    .map((f) => ({ value: f.id, label: f.name }));
  const opts = (list: readonly string[]) =>
    list.map((value) => ({ value, label: value }));
  const base = { firmId: r.firmId ?? "", id: r.id ?? uid(r.type) };
  let fields: Field[] = [],
    defaults: Record<string, string> = {},
    save: (v: Record<string, string>) => Command = () => {
      throw new Error("Unsupported editor.");
    };
  const customFields = (
    entity: "firm" | "contact",
    custom: Record<string, string | number>,
  ) =>
    values(d.customFields)
      .filter((f) => f.entity === entity)
      .map((f) => {
        defaults[f.id] = String(custom[f.id] ?? "");
        return {
          name: f.id,
          label: f.name,
          type:
            f.type === "Select"
              ? "select"
              : f.type === "Number"
                ? "number"
                : f.type === "Date"
                  ? "date"
                  : "text",
          required: f.required,
          options: opts(f.options),
        } as Field;
      });
  const customValues = (
    entity: "firm" | "contact",
    v: Record<string, string>,
  ) =>
    Object.fromEntries(
      values(d.customFields)
        .filter((f) => f.entity === entity)
        .filter((f) => v[f.id] !== undefined && v[f.id] !== "")
        .map((f) => [f.id, f.type === "Number" ? Number(v[f.id]) : v[f.id]]),
    );
  if (r.type === "firm") {
    const f: Firm = r.id
      ? d.firms[r.id]
      : {
          ...base,
          name: "",
          type: "Independent advisory",
          location: "",
          stage: "prospect",
          stageEntered: d.settings.demoDate,
          ownerId: u.id,
          departmentId: u.departmentId,
          archived: false,
          tags: [],
          nextAction: "Confirm firm profile",
          lastActivity: eventTime(d.settings.demoDate),
          custom: {},
          notes: "",
          relationshipHealth: "Healthy",
          healthReason: "New partnership; introductory conversation pending.",
        };
    defaults = {
      name: f.name,
      type: f.type,
      location: f.location,
      ownerId: f.ownerId,
      departmentId: f.departmentId,
      tags: f.tags.join(", "),
      nextAction: f.nextAction,
      notes: f.notes,
      relationshipHealth: f.relationshipHealth,
      healthReason: f.healthReason,
      renewalDate: f.renewalDate ?? "",
    };
    fields = [
      { name: "name", label: "Firm name", required: true, wide: true },
      {
        name: "type",
        label: "Firm type",
        type: "select",
        required: true,
        options: opts([
          "Independent advisory",
          "Wealth management",
          "Investment firm",
          "Trust company",
        ]),
      },
      { name: "location", label: "City, state", required: true },
      {
        name: "ownerId",
        label: "Relationship owner",
        type: "select",
        required: true,
        options: people,
      },
      {
        name: "departmentId",
        label: "Owning department",
        type: "select",
        required: true,
        options: departments,
      },
      {
        name: "tags",
        label: "Tags",
        hint: "Separate tags with commas.",
        wide: true,
      },
      { name: "nextAction", label: "Next action", wide: true },
      {
        name: "relationshipHealth",
        label: "Relationship health",
        type: "select",
        options: opts(["Healthy", "Watch", "At risk"]),
      },
      { name: "renewalDate", label: "Agreement renewal", type: "date" },
      { name: "healthReason", label: "Health explanation", wide: true },
      { name: "notes", label: "Internal notes", type: "textarea" },
      ...customFields("firm", f.custom),
    ];
    save = (v) => ({
      type: "firm.save",
      value: {
        ...f,
        name: v.name,
        type: v.type,
        location: v.location,
        ownerId: v.ownerId,
        departmentId: v.departmentId,
        tags: v.tags
          .split(",")
          .map((x) => x.trim())
          .filter(Boolean),
        nextAction: v.nextAction,
        notes: v.notes,
        relationshipHealth: v.relationshipHealth as Firm["relationshipHealth"],
        healthReason: v.healthReason,
        renewalDate: v.renewalDate || undefined,
        custom: customValues("firm", v),
      },
    });
  }
  if (r.type === "contact") {
    const c: Contact = r.id
      ? d.contacts[r.id]
      : {
          ...base,
          firmId: r.firmId,
          name: "",
          category: "Advisor",
          title: "",
          email: "",
          phone: "",
          primary: false,
          tags: [],
          notes: "",
          custom: {},
          archived: false,
        };
    defaults = {
      name: c.name,
      category: c.category,
      firmId: c.firmId ?? "",
      title: c.title,
      email: c.email,
      phone: c.phone,
      primary: String(c.primary),
      tags: c.tags.join(", "),
      notes: c.notes,
    };
    fields = [
      { name: "name", label: "Full name", required: true, wide: true },
      {
        name: "category",
        label: "Category",
        type: "select",
        required: true,
        options: opts(["Advisor", "Firm staff", "Support staff", "Vendor"]),
      },
      {
        name: "firmId",
        label: "Associated firm",
        type: "select",
        options: firms,
      },
      { name: "title", label: "Job title", wide: true },
      { name: "email", label: "Email address", type: "email", required: true },
      { name: "phone", label: "Phone number" },
      {
        name: "primary",
        label: "Primary contact",
        type: "checkbox",
        hint: "Designate as the firm’s primary contact",
        wide: true,
      },
      {
        name: "tags",
        label: "Tags",
        hint: "Separate tags with commas.",
        wide: true,
      },
      { name: "notes", label: "Notes", type: "textarea" },
      ...customFields("contact", c.custom),
    ];
    save = (v) => ({
      type: "contact.save",
      value: {
        ...c,
        name: v.name,
        category: v.category as Contact["category"],
        firmId: v.firmId || undefined,
        title: v.title,
        email: v.email.trim(),
        phone: v.phone,
        primary: v.primary === "true",
        tags: v.tags
          .split(",")
          .map((x) => x.trim())
          .filter(Boolean),
        notes: v.notes,
        custom: customValues("contact", v),
      },
    });
  }
  if (r.type === "task") {
    const t: Task = r.id
      ? d.tasks[r.id]
      : newTask(d, {
          title: r.title ?? "",
          firmId: r.firmId,
          projectId: r.projectId,
        });
    defaults = {
      title: t.title,
      description: t.description,
      firmId: t.firmId ?? "",
      projectId: t.projectId ?? "",
      departmentId: t.departmentId,
      assigneeId: t.assigneeId,
      priority: t.priority,
      dueDate: t.dueDate,
      status: t.status,
      evidence: t.evidence,
      evidenceNote: t.evidenceNote,
      meetingDate: t.meetingDate,
      documentId: t.documentId,
      dependencies: t.dependencies.join(", "),
      recurringDays: String(t.recurringDays),
    };
    fields = [
      { name: "title", label: "Task title", required: true, wide: true },
      { name: "description", label: "Description", type: "textarea" },
      {
        name: "firmId",
        label: "Linked firm",
        type: "select",
        options: firms,
        disabled: !!t.instanceId,
      },
      {
        name: "projectId",
        label: "Linked project",
        type: "select",
        options: values(d.projects)
          .filter((p) => !t.firmId || p.firmId === t.firmId)
          .map((p) => ({ value: p.id, label: p.name })),
      },
      {
        name: "departmentId",
        label: "Department",
        type: "select",
        required: true,
        options: departments,
      },
      {
        name: "assigneeId",
        label: "Assigned to",
        type: "select",
        options: people,
      },
      {
        name: "priority",
        label: "Priority",
        type: "select",
        required: true,
        options: opts(["Low", "Medium", "High", "Urgent"]),
      },
      { name: "dueDate", label: "Due date", type: "date", required: true },
      {
        name: "status",
        label: "Status",
        type: "select",
        required: true,
        options: opts(statuses),
      },
      {
        name: "evidence",
        label: "Required evidence",
        type: "select",
        options: opts([
          "None",
          "Note",
          "Document/signature status",
          "Verified primary contact",
          "Meeting date",
        ]),
        disabled: !!t.instanceId,
      },
      {
        name: "evidenceNote",
        label: "Completion / evidence note",
        type: "textarea",
        hint:
          t.evidence === "Verified primary contact"
            ? "Readiness checks the active primary contact on the firm."
            : undefined,
      },
      { name: "meetingDate", label: "Meeting date", type: "date" },
      {
        name: "documentId",
        label: "Agreement evidence",
        type: "select",
        options: values(d.documents)
          .filter((doc) => doc.firmId === t.firmId)
          .map((doc) => ({
            value: doc.id,
            label: `${doc.name} (${doc.status})`,
          })),
      },
      {
        name: "dependencies",
        label: "Dependencies",
        type: "multiselect",
        options: values(d.tasks)
          .filter(
            (candidate) =>
              candidate.id !== t.id && candidate.firmId === t.firmId,
          )
          .map((candidate) => ({
            value: candidate.id,
            label: candidate.title,
          })),
        disabled: !!t.instanceId,
        hint: "Required tasks must be completed first. Use Ctrl / ⌘ to select multiple. Workflow dependencies are versioned.",
        wide: true,
      },
      {
        name: "recurringDays",
        label: "Repeat after completion (days)",
        type: "number",
        min: 0,
        max: 730,
        hint: "0 means this task does not repeat.",
      },
    ];
    save = (v) => ({
      type: "task.save",
      value: {
        ...t,
        title: v.title,
        description: v.description,
        firmId: v.firmId || undefined,
        projectId: v.projectId || undefined,
        departmentId: v.departmentId,
        assigneeId: v.assigneeId,
        priority: v.priority as Task["priority"],
        dueDate: v.dueDate,
        status: v.status as Task["status"],
        evidence: v.evidence as Task["evidence"],
        evidenceNote: v.evidenceNote,
        meetingDate: v.meetingDate,
        documentId: v.documentId,
        dependencies: v.dependencies
          .split(",")
          .map((x) => x.trim())
          .filter(Boolean),
        recurringDays: Number(v.recurringDays),
      },
    });
  }
  if (r.type === "project") {
    const p: Project = r.id
      ? d.projects[r.id]
      : {
          id: base.id,
          name: "",
          firmId: r.firmId,
          ownerId: u.id,
          type: "Internal",
          startDate: d.settings.demoDate,
          targetDate: shiftDate(d.settings.demoDate, 30),
          status: "Planning",
          taskIds: [],
          milestoneIds: [],
          notes: "",
        };
    defaults = {
      name: p.name,
      firmId: p.firmId ?? "",
      ownerId: p.ownerId,
      type: p.type,
      startDate: p.startDate,
      targetDate: p.targetDate,
      status: p.status,
      notes: p.notes,
      template: "true",
    };
    fields = [
      { name: "name", label: "Project name", required: true, wide: true },
      {
        name: "firmId",
        label: "Linked firm",
        type: "select",
        options: firms,
        disabled: !!r.id,
      },
      {
        name: "ownerId",
        label: "Project owner",
        type: "select",
        required: true,
        options: people,
      },
      {
        name: "type",
        label: "Project type",
        type: "select",
        required: true,
        options: opts(["Implementation", "Training", "Internal"]),
      },
      {
        name: "status",
        label: "Project status",
        type: "select",
        required: true,
        options: opts(["Planning", "Active", "On hold", "Completed"]),
      },
      { name: "startDate", label: "Start date", type: "date", required: true },
      {
        name: "targetDate",
        label: "Target date",
        type: "date",
        required: true,
      },
      { name: "notes", label: "Project notes", type: "textarea" },
      ...(!r.id
        ? [
            {
              name: "template",
              label: "Use coordination template",
              type: "checkbox" as const,
              hint: "Create planning, delivery, and review tasks",
              wide: true,
            },
          ]
        : []),
    ];
    save = (v) => ({
      type: "project.save",
      value: {
        ...p,
        name: v.name,
        firmId: v.firmId || undefined,
        ownerId: v.ownerId,
        type: v.type as Project["type"],
        startDate: v.startDate,
        targetDate: v.targetDate,
        status: v.status as Project["status"],
        notes: v.notes,
      },
      template: v.template === "true",
    });
  }
  if (r.type === "review") {
    const review: Review = r.id
      ? d.reviews[r.id]
      : {
          id: base.id,
          firmId: r.firmId ?? "",
          ownerId: u.id,
          type: "Quarterly business review",
          date: shiftDate(d.settings.demoDate, 7),
          status: "Scheduled",
          notes: "",
        };
    defaults = {
      firmId: review.firmId,
      ownerId: review.ownerId,
      type: review.type,
      date: review.date,
      status: review.status,
      notes: review.notes,
    };
    fields = [
      {
        name: "firmId",
        label: "Firm partner",
        type: "select",
        options: firms,
        required: true,
      },
      {
        name: "ownerId",
        label: "Review owner",
        type: "select",
        options: people,
        required: true,
      },
      {
        name: "type",
        label: "Review type",
        type: "select",
        options: opts([
          "Quarterly business review",
          "Annual partner review",
          "Relationship check-in",
        ]),
        required: true,
        wide: true,
      },
      { name: "date", label: "Review date", type: "date", required: true },
      {
        name: "status",
        label: "Status",
        type: "select",
        options: opts(["Scheduled", "Completed"]),
        required: true,
      },
      {
        name: "notes",
        label: "Agenda / outcome notes",
        type: "textarea",
        hint: "Outcome notes are required to complete a review. The next review is scheduled automatically.",
      },
    ];
    save = (v) => ({
      type: "review.save",
      value: {
        ...review,
        firmId: v.firmId,
        ownerId: v.ownerId,
        type: v.type as Review["type"],
        date: v.date,
        status: v.status as Review["status"],
        notes: v.notes,
      },
    });
  }
  if (r.type === "thread") {
    const th: Thread = r.id
      ? d.threads[r.id]
      : {
          id: base.id,
          firmId: r.firmId ?? "",
          contactIds: [],
          subject: "",
          ownerId: u.id,
          status: "Open",
          updatedAt: eventTime(d.settings.demoDate),
        };
    defaults = {
      firmId: th.firmId,
      subject: th.subject,
      ownerId: th.ownerId,
      status: th.status,
      contactIds: th.contactIds.join(", "),
    };
    fields = [
      { name: "subject", label: "Subject", required: true, wide: true },
      {
        name: "firmId",
        label: "Firm partner",
        type: "select",
        options: firms,
        required: true,
      },
      {
        name: "ownerId",
        label: "Conversation owner",
        type: "select",
        options: people,
        required: true,
      },
      {
        name: "status",
        label: "Status",
        type: "select",
        options: opts(["Open", "Waiting", "Resolved"]),
        required: true,
      },
      {
        name: "contactIds",
        label: "Contact participants",
        type: "multiselect",
        options: values(d.contacts)
          .filter((c) => !c.archived && (!th.firmId || c.firmId === th.firmId))
          .map((c) => ({
            value: c.id,
            label: `${c.name} · ${d.firms[c.firmId ?? ""]?.name ?? "Vendor"}`,
          })),
        hint: "Use Ctrl / ⌘ to select multiple contacts from the associated firm.",
        wide: true,
      },
    ];
    save = (v) => ({
      type: "thread.save",
      value: {
        ...th,
        subject: v.subject,
        firmId: v.firmId,
        ownerId: v.ownerId,
        status: v.status as Thread["status"],
        contactIds: v.contactIds
          .split(",")
          .map((x) => x.trim())
          .filter(Boolean),
      },
    });
  }
  if (r.type === "document") {
    const doc: DocumentRecord = r.id
      ? d.documents[r.id]
      : {
          id: base.id,
          name: "",
          category: "Onboarding resources",
          firmId: r.firmId,
          version: "1.0",
          added: d.settings.demoDate,
          status: "Draft",
          signers: [],
          source: "session",
          fileName: "",
          size: 0,
          events: [],
        };
    defaults = {
      name: doc.name,
      category: doc.category,
      firmId: doc.firmId ?? "",
      version: doc.version,
    };
    fields = [
      { name: "name", label: "Document title", required: true, wide: true },
      {
        name: "category",
        label: "Category",
        type: "select",
        required: true,
        options: opts([
          "Agreements",
          "Onboarding resources",
          "Training materials",
          "SOP templates",
          "Meeting notes",
          "Marketing documents",
        ]),
      },
      { name: "firmId", label: "Linked firm", type: "select", options: firms },
      { name: "version", label: "Version label", required: true },
    ];
    save = (v) => {
      if (!file && doc.source === "session" && !sessionFiles.has(doc.id))
        throw new Error("Select a file to attach.");
      return {
        type: "document.save",
        value: {
          ...doc,
          name: v.name,
          category: v.category as DocumentRecord["category"],
          firmId: v.firmId || undefined,
          version: v.version,
          fileName: file?.name ?? doc.fileName,
          size: file?.size ?? doc.size,
        },
      };
    };
  }
  const allowed =
    r.type === "task" && r.id
      ? canEditTask(d, d.tasks[r.id])
      : r.firmId
        ? canEditFirm(d, d.firms[r.firmId])
        : canWrite(d);
  return (
    <DialogContent drawer>
      <div className="drawer-heading">
        <span className="eyebrow">
          {r.type === "task" && r.id && d.tasks[r.id]?.instanceId
            ? "WORKFLOW REQUIREMENT"
            : "WORKSPACE RECORD"}
        </span>
        <DialogTitle>
          {r.id ? (allowed ? "Edit" : "View") : "New"}{" "}
          {r.type === "firm" ? "firm partner" : r.type}
        </DialogTitle>
        <DialogDescription>
          {r.type === "firm" && !r.id
            ? "Start in Prospect. The published SOP creates readiness tasks automatically."
            : "Changes update linked records throughout your workspace."}
        </DialogDescription>
      </div>
      <RecordForm
        readOnly={!allowed}
        fields={fields}
        defaults={defaults}
        submitLabel={r.id ? "Save changes" : `Create ${r.type}`}
        onSubmit={(v) => {
          const command = save(v);
          run(command);
          if (file) sessionFiles.set(base.id, file);
          toast.success(
            `${r.type[0].toUpperCase() + r.type.slice(1)} ${r.id ? "updated" : "created"}.`,
          );
          close();
        }}
      >
        {r.type === "task" && r.id && (
          <TaskDiscussion id={r.id} readOnly={!allowed} />
        )}
        {r.type === "document" && allowed && (
          <div className="file-field">
            <label htmlFor="upload-file">Select a local file</label>
            <input
              id="upload-file"
              type="file"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f && f.size > 20 * 1024 * 1024) {
                  toast.error("Choose a file smaller than 20 MB.");
                  return;
                }
                setFile(f ?? null);
              }}
            />
            <p className="field-hint">
              Only metadata is saved. Select the file again after a reload to
              preview it.
            </p>
          </div>
        )}
      </RecordForm>
    </DialogContent>
  );
}

function TaskDiscussion({ id, readOnly }: { id: string; readOnly: boolean }) {
  const d = useData(),
    run = useApp((s) => s.run),
    editor = useEditor();
  const t = d.tasks[id];
  const [comment, setComment] = useState("");
  useUnsavedChanges(!readOnly && !!comment.trim(), () => setComment(""));
  return (
    <section className="task-discussion">
      <h3>Team conversation</h3>
      {t.comments.map((c) => (
        <div className="task-comment" key={c.id}>
          <strong>
            {d.users[c.authorId]?.name}
            <small>{prettyDate(c.at, "MMM d · h:mm a")}</small>
          </strong>
          <p>{c.text}</p>
        </div>
      ))}
      {!t.comments.length && (
        <p className="field-hint">
          Keep decisions and handoff context with the task.
        </p>
      )}
      <label className="field">
        Add a comment
        <textarea
          disabled={readOnly}
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          rows={2}
        />
      </label>
      <div>
        <Button
          type="button"
          size="sm"
          variant="secondary"
          disabled={readOnly || !comment.trim()}
          onClick={() => {
            try {
              run({ type: "task.comment", id, text: comment });
              setComment("");
              toast.success("Comment added.");
            } catch (e) {
              toast.error(String(e));
            }
          }}
        >
          Add comment
        </Button>
        <Button
          type="button"
          size="sm"
          variant="ghost"
          disabled={readOnly}
          onClick={() =>
            editor({
              type: "task",
              firmId: t.firmId,
              projectId: t.projectId,
              title: `Follow up: ${t.title}`,
            })
          }
        >
          Create follow-up task
        </Button>
      </div>
    </section>
  );
}
