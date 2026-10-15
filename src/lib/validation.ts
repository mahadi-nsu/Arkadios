import { Dataset, Workflow, datasetSchema, stages } from "./model";
import { values } from "./selectors";
export function validateWorkflow(
  d: Pick<Dataset, "departments" | "users">,
  w: Workflow,
) {
  const ids = w.steps.map((s) => s.id);
  if (new Set(ids).size !== ids.length)
    throw new Error("Workflow step IDs must be unique.");
  const visited = new Set<string>(),
    active = new Set<string>();
  function visit(id: string) {
    if (active.has(id))
      throw new Error("Workflow dependencies contain a cycle.");
    if (visited.has(id)) return;
    active.add(id);
    const s = w.steps.find((s) => s.id === id);
    if (!s) throw new Error("A dependency references a missing step.");
    for (const dep of s.dependencies) visit(dep);
    active.delete(id);
    visited.add(id);
  }
  for (const s of w.steps) {
    if (!s.title.trim()) throw new Error("Every workflow step needs a title.");
    if (!d.departments[s.departmentId])
      throw new Error("Choose a valid department.");
    if (
      s.assignment === "Named employee" &&
      (!d.users[s.assigneeId]?.active ||
        d.users[s.assigneeId].departmentId !== s.departmentId)
    )
      throw new Error("Choose an active employee in the assigned department.");
    visit(s.id);
  }
}
export function validateDataset(input: unknown): Dataset {
  const result = datasetSchema.safeParse(input);
  if (!result.success)
    throw new Error(
      `Invalid dataset: ${result.error.issues
        .slice(0, 3)
        .map((i) => `${i.path.join(".")}: ${i.message}`)
        .join("; ")}`,
    );
  const d = result.data;
  const collections = [
    d.departments,
    d.users,
    d.firms,
    d.contacts,
    d.tasks,
    d.projects,
    d.milestones,
    d.documents,
    d.threads,
    d.messages,
    d.reviews,
    d.workflows,
    d.versions,
    d.instances,
    d.history,
    d.activities,
    d.notifications,
    d.customFields,
    d.rules,
    d.savedViews,
  ];
  let total = 0;
  for (const records of collections) {
    for (const [key, v] of Object.entries(records)) {
      if (key !== v.id)
        throw new Error(`Record ID does not match its key: ${key}`);
      total++;
    }
  }
  if (total > 50000)
    throw new Error("Dataset exceeds the 50,000 record limit.");
  const check = (ok: unknown, label: string) => {
    if (!ok) throw new Error(`Broken reference: ${label}`);
  };
  check(d.users[d.settings.personaId]?.active, "active demo persona");
  for (const u of values(d.users))
    check(d.departments[u.departmentId], `employee ${u.id} department`);
  for (const dep of values(d.departments))
    check(d.users[dep.managerId], `department ${dep.id} manager`);
  for (const f of values(d.firms)) {
    check(d.users[f.ownerId], `${f.name} owner`);
    check(d.departments[f.departmentId], `${f.name} department`);
  }
  for (const c of values(d.contacts))
    if (c.firmId) check(d.firms[c.firmId], `${c.name} firm`);
  for (const t of values(d.tasks)) {
    check(d.departments[t.departmentId], `${t.id} department`);
    if (t.assigneeId) check(d.users[t.assigneeId], `${t.id} assignee`);
    if (t.firmId) check(d.firms[t.firmId], `${t.id} firm`);
    if (t.projectId) check(d.projects[t.projectId], `${t.id} project`);
    if (t.instanceId)
      check(d.instances[t.instanceId], `${t.id} workflow instance`);
    if (t.documentId) check(d.documents[t.documentId], `${t.id} document`);
    for (const dep of t.dependencies)
      check(d.tasks[dep] && dep !== t.id, `${t.id} dependency`);
  }
  const visited = new Set<string>(),
    active = new Set<string>();
  function visit(id: string) {
    if (active.has(id)) throw new Error("Task dependencies contain a cycle.");
    if (visited.has(id)) return;
    active.add(id);
    for (const ref of d.tasks[id].dependencies) visit(ref);
    active.delete(id);
    visited.add(id);
  }
  for (const id of Object.keys(d.tasks)) visit(id);
  for (const p of values(d.projects)) {
    check(d.users[p.ownerId], `${p.id} owner`);
    if (p.firmId) check(d.firms[p.firmId], `${p.id} firm`);
    for (const id of p.taskIds)
      check(d.tasks[id]?.projectId === p.id, `${p.id} task`);
    for (const id of p.milestoneIds)
      check(d.milestones[id]?.projectId === p.id, `${p.id} milestone`);
  }
  for (const m of values(d.milestones))
    check(d.projects[m.projectId], `${m.id} project`);
  for (const doc of values(d.documents)) {
    if (doc.firmId) check(d.firms[doc.firmId], `${doc.id} firm`);
    if (doc.taskId) check(d.tasks[doc.taskId], `${doc.id} task`);
  }
  for (const th of values(d.threads)) {
    check(d.firms[th.firmId], `${th.id} firm`);
    check(d.users[th.ownerId], `${th.id} owner`);
    for (const id of th.contactIds) check(d.contacts[id], `${th.id} contact`);
  }
  for (const msg of values(d.messages))
    check(d.threads[msg.threadId], `${msg.id} thread`);
  for (const r of values(d.reviews)) {
    check(d.firms[r.firmId], `${r.id} firm`);
    check(d.users[r.ownerId], `${r.id} owner`);
  }
  for (const w of values(d.workflows)) validateWorkflow(d, w);
  for (const v of values(d.versions)) {
    validateWorkflow(d, v);
    check(d.users[v.publishedBy], `${v.id} publisher`);
  }
  for (const i of values(d.instances)) {
    check(d.firms[i.firmId], `${i.id} firm`);
    check(d.versions[i.versionId], `${i.id} version`);
    check(
      JSON.stringify(i.snapshot) === JSON.stringify(d.versions[i.versionId]),
      `${i.id} immutable version snapshot`,
    );
    validateWorkflow(d, i.snapshot);
    for (const id of i.taskIds)
      check(d.tasks[id]?.instanceId === i.id, `${i.id} task`);
  }
  for (const f of values(d.firms))
    check(
      values(d.instances).filter(
        (i) =>
          i.firmId === f.id &&
          i.stage === f.stage &&
          i.entered === f.stageEntered,
      ).length === 1,
      `${f.id} current workflow instance`,
    );
  for (const h of values(d.history)) {
    check(d.firms[h.firmId], `${h.id} firm`);
    check(d.users[h.approverId], `${h.id} approver`);
    if (h.exited < h.entered)
      throw new Error("Stage history exits before entry.");
  }
  for (const a of values(d.activities)) {
    if (a.firmId) check(d.firms[a.firmId], `${a.id} firm`);
    check(d.users[a.actorId], `${a.id} actor`);
  }
  for (const n of values(d.notifications))
    check(d.users[n.recipientId], `${n.id} recipient`);
  for (const stage of stages)
    check(
      values(d.versions).some((v) => v.stage === stage),
      `${stage} published workflow`,
    );
  return d;
}
export function parseImport(raw: string) {
  if (new Blob([raw]).size > 12 * 1024 * 1024)
    throw new Error("JSON file exceeds 12 MB.");
  return validateDataset(JSON.parse(raw));
}
