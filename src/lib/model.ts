import { z } from "zod";
export const stages = [
  "prospect",
  "onboarding",
  "implementation",
  "training",
  "relationship",
] as const;
export const stageNames: Record<Stage, string> = {
  prospect: "Prospect",
  onboarding: "Onboarding",
  implementation: "Implementation",
  training: "Training",
  relationship: "Relationship",
};
export const statuses = [
  "Not started",
  "In progress",
  "Waiting",
  "Blocked",
  "Completed",
] as const;
export const roles = ["Admin", "Manager", "Member", "Read-only"] as const;
export const evidenceTypes = [
  "None",
  "Note",
  "Document/signature status",
  "Verified primary contact",
  "Meeting date",
] as const;
export const stageSchema = z.enum(stages);
const id = z.string().min(1).max(150);
const text = z.string().max(10000);
const date = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine(
    (v) =>
      !isNaN(Date.parse(v)) &&
      new Date(v + "T12:00:00").toISOString().slice(0, 10) === v,
    "Invalid date",
  );
const timestamp = z.iso.datetime();
const customValues = z.record(z.string(), z.union([z.string(), z.number()]));
export const departmentSchema = z.object({ id, name: text, managerId: id });
export const userSchema = z.object({
  id,
  name: z.string().min(1),
  email: z.email(),
  departmentId: id,
  role: z.enum(roles),
  active: z.boolean(),
  invitation: z.enum(["Active", "Demo invited"]),
});
export const firmSchema = z.object({
  id,
  name: z.string().min(1).max(200),
  type: text,
  location: text,
  stage: stageSchema,
  stageEntered: date,
  ownerId: id,
  departmentId: id,
  archived: z.boolean(),
  tags: z.array(text),
  nextAction: text,
  lastActivity: timestamp,
  custom: customValues,
  notes: text,
  relationshipHealth: z.enum(["Healthy", "Watch", "At risk"]),
  healthReason: text,
  renewalDate: date.optional(),
});
export const contactSchema = z.object({
  id,
  name: z.string().min(1),
  category: z.enum(["Advisor", "Firm staff", "Support staff", "Vendor"]),
  firmId: id.optional(),
  title: text,
  email: z.email(),
  phone: text,
  primary: z.boolean(),
  tags: z.array(text),
  notes: text,
  custom: customValues,
  archived: z.boolean(),
});
export const stepSchema = z.object({
  id,
  title: z.string().min(1),
  description: text,
  required: z.boolean(),
  departmentId: id,
  assignment: z.enum(["Firm owner", "Named employee", "Department queue"]),
  assigneeId: z.string(),
  dueDays: z.number().int().min(0).max(730),
  dependencies: z.array(id),
  evidence: z.enum(evidenceTypes),
});
export const workflowSchema = z.object({
  id,
  name: z.string().min(1),
  stage: stageSchema,
  targetDays: z.number().int().min(1).max(730),
  steps: z.array(stepSchema).min(1),
});
export const versionSchema = workflowSchema.extend({
  version: z.number().int().positive(),
  publishedAt: timestamp,
  publishedBy: id,
});
export const instanceSchema = z.object({
  id,
  firmId: id,
  stage: stageSchema,
  versionId: id,
  snapshot: versionSchema,
  entered: date,
  taskIds: z.array(id),
  handoffRequested: z.boolean(),
});
export const taskSchema = z.object({
  id,
  title: z.string().min(1),
  description: text,
  firmId: id.optional(),
  projectId: id.optional(),
  departmentId: id,
  assigneeId: z.string(),
  priority: z.enum(["Low", "Medium", "High", "Urgent"]),
  dueDate: date,
  status: z.enum(statuses),
  dependencies: z.array(id),
  evidence: z.enum(evidenceTypes),
  evidenceNote: text,
  meetingDate: z.union([date, z.literal("")]),
  documentId: z.string(),
  comments: z.array(z.object({ id, authorId: id, text, at: timestamp })),
  instanceId: id.optional(),
  stepId: id.optional(),
  recurringDays: z.number().int().min(0).max(730),
  completedAt: timestamp.optional(),
});
export const projectSchema = z.object({
  id,
  name: z.string().min(1),
  firmId: id.optional(),
  ownerId: id,
  type: z.enum(["Implementation", "Training", "Internal"]),
  startDate: date,
  targetDate: date,
  status: z.enum(["Planning", "Active", "On hold", "Completed"]),
  taskIds: z.array(id),
  milestoneIds: z.array(id),
  notes: text,
});
export const milestoneSchema = z.object({
  id,
  projectId: id,
  name: text,
  date,
  status: z.enum(["Upcoming", "In progress", "Completed"]),
});
export const documentSchema = z.object({
  id,
  name: z.string().min(1),
  category: z.enum([
    "Agreements",
    "Onboarding resources",
    "Training materials",
    "SOP templates",
    "Meeting notes",
    "Marketing documents",
  ]),
  firmId: id.optional(),
  taskId: id.optional(),
  version: text,
  added: date,
  status: z.enum([
    "Draft",
    "Sent",
    "Partially signed",
    "Signed",
    "Declined",
    "Expired",
  ]),
  signers: z.array(
    z.object({ name: text, email: z.email(), signedAt: timestamp.optional() }),
  ),
  source: z.enum(["sample", "session"]),
  fileName: text,
  size: z.number().nonnegative(),
  events: z.array(z.object({ at: timestamp, label: text })),
});
export const threadSchema = z.object({
  id,
  firmId: id,
  contactIds: z.array(id),
  subject: z.string().min(1),
  ownerId: id,
  status: z.enum(["Open", "Waiting", "Resolved"]),
  updatedAt: timestamp,
});
export const messageSchema = z.object({
  id,
  threadId: id,
  author: text,
  body: text,
  at: timestamp,
  kind: z.enum(["Incoming", "Demo reply", "Internal note"]),
});
export const reviewSchema = z.object({
  id,
  firmId: id,
  ownerId: id,
  type: z.enum([
    "Quarterly business review",
    "Annual partner review",
    "Relationship check-in",
  ]),
  date,
  status: z.enum(["Scheduled", "Completed"]),
  notes: text,
  completedAt: timestamp.optional(),
});
export const historySchema = z.object({
  id,
  firmId: id,
  stage: stageSchema,
  entered: date,
  exited: date,
  targetDays: z.number(),
  approverId: id,
});
export const activitySchema = z.object({
  id,
  firmId: z.string(),
  actorId: id,
  at: timestamp,
  label: text,
});
export const notificationSchema = z.object({
  id,
  recipientId: id,
  title: text,
  body: text,
  href: text,
  read: z.boolean(),
  at: timestamp,
});
export const customFieldSchema = z.object({
  id,
  name: z.string().min(1),
  entity: z.enum(["firm", "contact"]),
  type: z.enum(["Text", "Number", "Date", "Select"]),
  required: z.boolean(),
  options: z.array(text),
});
export const ruleSchema = z.object({
  id,
  type: z.enum([
    "overdue",
    "stage-target",
    "handoff",
    "implementation-project",
  ]),
  enabled: z.boolean(),
  days: z.number().int().min(0).max(365),
});
const normalized = <T extends z.ZodType>(schema: T) =>
  z.record(z.string(), schema);
export const datasetSchema = z.object({
  schemaVersion: z.literal(1),
  departments: normalized(departmentSchema),
  users: normalized(userSchema),
  firms: normalized(firmSchema),
  contacts: normalized(contactSchema),
  tasks: normalized(taskSchema),
  projects: normalized(projectSchema),
  milestones: normalized(milestoneSchema),
  documents: normalized(documentSchema),
  threads: normalized(threadSchema),
  messages: normalized(messageSchema),
  reviews: normalized(reviewSchema),
  workflows: normalized(workflowSchema),
  versions: normalized(versionSchema),
  instances: normalized(instanceSchema),
  history: normalized(historySchema),
  activities: normalized(activitySchema),
  notifications: normalized(notificationSchema),
  customFields: normalized(customFieldSchema),
  rules: normalized(ruleSchema),
  savedViews: normalized(
    z.object({
      id,
      name: text,
      entity: z.enum(["firms", "contacts"]),
      query: text,
      stage: z.string(),
      departmentId: z.string(),
      attention: z.boolean().default(false),
      archived: z.boolean().default(false),
    }),
  ),
  settings: z.object({
    anchorDate: date,
    demoDate: date,
    personaId: id,
    stageLabels: z.record(stageSchema, text),
    defaultTargets: z.record(stageSchema, z.number().int().min(1).max(730)),
    integrations: z.array(
      z.object({
        name: text,
        lastSync: z.union([timestamp, z.literal("")]),
        enabled: z.boolean(),
      }),
    ),
    reportSchedule: z.object({
      enabled: z.boolean(),
      frequency: z.enum(["Weekly", "Monthly"]),
      departmentId: z.string(),
    }),
  }),
});
export type Stage = (typeof stages)[number];
export type Role = (typeof roles)[number];
export type Evidence = (typeof evidenceTypes)[number];
export type Dataset = z.infer<typeof datasetSchema>;
export type Firm = z.infer<typeof firmSchema>;
export type Contact = z.infer<typeof contactSchema>;
export type Task = z.infer<typeof taskSchema>;
export type Project = z.infer<typeof projectSchema>;
export type DocumentRecord = z.infer<typeof documentSchema>;
export type Workflow = z.infer<typeof workflowSchema>;
export type Step = z.infer<typeof stepSchema>;
export type User = z.infer<typeof userSchema>;
export type Review = z.infer<typeof reviewSchema>;
export type CustomField = z.infer<typeof customFieldSchema>;
export type Thread = z.infer<typeof threadSchema>;
