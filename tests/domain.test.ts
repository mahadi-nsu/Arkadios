import { test } from "node:test";
import assert from "node:assert/strict";
import { createSeed } from "../src/lib/seed";
import { execute } from "../src/lib/repository";
import { evaluateRules, instantiateStage } from "../src/lib/engine";
import { Dataset, Firm, stages } from "../src/lib/model";
import {
  checklist,
  currentInstance,
  handoffBlockers,
  values,
} from "../src/lib/selectors";
import {
  parseImport,
  validateDataset,
  validateWorkflow,
} from "../src/lib/validation";
const initial = () => createSeed("2026-10-15");
function prospect(d: Dataset, id = "journey_firm"): Dataset {
  const firm: Firm = {
    id,
    name: "Crescent Path Advisory",
    type: "Independent advisory",
    location: "Atlanta, GA",
    stage: "prospect",
    stageEntered: d.settings.demoDate,
    ownerId: "u1",
    departmentId: "d1",
    archived: false,
    tags: ["New partner"],
    nextAction: "Verify primary contact",
    lastActivity: "2026-10-15T14:00:00.000Z",
    custom: { cf_segment: "Growth" },
    notes: "Introduced at a regional partner meeting.",
    relationshipHealth: "Healthy",
    healthReason: "New partner introduction.",
  };
  return execute(d, { type: "firm.save", value: firm });
}
function completeStage(d: Dataset, id: string) {
  for (const task of checklist(d, d.firms[id])) {
    d = execute(d, {
      type: "task.save",
      value: {
        ...task,
        status: "Completed",
        evidenceNote: "Required details confirmed with the partner.",
        meetingDate: d.settings.demoDate,
      },
    });
  }
  return d;
}
function approve(d: Dataset, id: string) {
  return execute(d, {
    type: "firm.advance",
    id,
    expectedStage: d.firms[id].stage,
  });
}
test("fictional seed has coherent references, exact counts, and fixed stage distribution", () => {
  const d = initial();
  assert.equal(values(d.users).length, 50);
  assert.equal(values(d.contacts).length, 700);
  assert.equal(values(d.firms).length, 67);
  assert.deepEqual(
    stages.map((s) => values(d.firms).filter((f) => f.stage === s).length),
    [14, 6, 5, 4, 38],
  );
  assert.doesNotThrow(() => validateDataset(d));
  assert.equal(
    values(d.contacts).filter((c) => !c.email.endsWith("@example.com")).length,
    0,
  );
});
test("stage gating validates primary contact, evidence, dependencies, and approved sequence", () => {
  const d = prospect(initial());
  const before = JSON.stringify(d);
  assert.throws(() => approve(d, "journey_firm"), /Complete/);
  assert.equal(JSON.stringify(d), before);
  const first = checklist(d, d.firms.journey_firm)[0];
  assert.throws(
    () =>
      execute(d, {
        type: "task.save",
        value: { ...first, status: "Completed" },
      }),
    /primary contact/,
  );
  const last = checklist(d, d.firms.journey_firm)[2];
  assert.throws(
    () =>
      execute(d, {
        type: "task.save",
        value: {
          ...last,
          status: "Completed",
          meetingDate: d.settings.demoDate,
        },
      }),
    /first/,
  );
  assert.throws(
    () =>
      execute(d, {
        type: "firm.save",
        value: { ...d.firms.journey_firm, stage: "relationship" },
      }),
    /approved handoff/,
  );
  assert.ok(handoffBlockers(d, d.firms.journey_firm).length);
});
test("centralized permissions reject forbidden service calls even when bypassing UI controls", () => {
  const d = initial();
  d.settings.personaId = "u4";
  assert.throws(() => prospect(d), /demo role/);
  assert.throws(() => execute(d, { type: "date.advance" }), /demo role/);
  assert.throws(
    () =>
      execute(d, {
        type: "task.save",
        value: { ...values(d.tasks)[0], status: "Waiting" },
      }),
    /demo role/,
  );
  d.settings.personaId = "u2";
  assert.throws(
    () =>
      execute(d, {
        type: "firm.save",
        value: { ...d.firms.f2, name: "Forbidden edit" },
      }),
    /demo role/,
  );
  assert.throws(
    () =>
      execute(d, {
        type: "workflow.save",
        value: d.workflows.w_prospect,
        publish: true,
      }),
    /demo role/,
  );
  d.settings.personaId = "u3";
  const own = values(d.tasks).find((t) => t.assigneeId === "u3")!;
  assert.doesNotThrow(() =>
    execute(d, { type: "task.save", value: { ...own, status: "Waiting" } }),
  );
  assert.throws(
    () =>
      execute(d, { type: "firm.advance", id: "f3", expectedStage: "prospect" }),
    /demo role/,
  );
});
test("the entire connected lifecycle, signatures, projects, reviews, export, and import works", () => {
  let d = prospect(initial());
  const id = "journey_firm";
  d = execute(d, {
    type: "contact.save",
    value: {
      id: "journey_contact",
      name: "Alex Partner",
      category: "Advisor",
      firmId: id,
      title: "Managing partner",
      email: "alex.partner@example.com",
      phone: "(404) 555-0184",
      primary: true,
      tags: [],
      notes: "Primary introduction",
      custom: {},
      archived: false,
    },
  });
  d = completeStage(d, id);
  d = approve(d, id);
  assert.equal(d.firms[id].stage, "onboarding");
  assert.equal(checklist(d, d.firms[id]).length, 3);
  assert.equal(checklist(d, d.firms[id])[0].assigneeId, "u1");
  d = execute(d, {
    type: "thread.save",
    value: {
      id: "journey_thread",
      firmId: id,
      contactIds: ["journey_contact"],
      subject: "Our next steps",
      ownerId: "u1",
      status: "Open",
      updatedAt: "2026-10-15T14:00:00.000Z",
    },
  });
  d = execute(d, {
    type: "message.add",
    threadId: "journey_thread",
    body: "Welcome. Our onboarding team will follow up.",
    internal: false,
  });
  assert.equal(
    values(d.messages).find((m) => m.threadId === "journey_thread")?.kind,
    "Demo reply",
  );
  const agreement = values(d.documents).find((doc) => doc.firmId === id)!;
  assert.equal(agreement.status, "Draft");
  d = execute(d, {
    type: "document.simulate",
    id: agreement.id,
    action: "send",
  });
  d = execute(d, {
    type: "document.simulate",
    id: agreement.id,
    action: "sign",
  });
  assert.equal(d.documents[agreement.id].status, "Partially signed");
  assert.throws(() => completeStage(d, id), /fully signed/);
  d = execute(d, {
    type: "document.simulate",
    id: agreement.id,
    action: "sign",
  });
  assert.equal(d.documents[agreement.id].status, "Signed");
  d = completeStage(d, id);
  d = approve(d, id);
  assert.equal(d.firms[id].stage, "implementation");
  const projects = values(d.projects).filter((p) => p.firmId === id);
  assert.equal(projects.length, 1);
  assert.deepEqual(
    projects[0].taskIds,
    checklist(d, d.firms[id]).map((t) => t.id),
  );
  const taskCount = values(d.tasks).length;
  instantiateStage(d, d.firms[id]);
  evaluateRules(d);
  evaluateRules(d);
  assert.equal(values(d.tasks).length, taskCount);
  assert.equal(values(d.projects).filter((p) => p.firmId === id).length, 1);
  assert.throws(
    () => execute(d, { type: "firm.advance", id, expectedStage: "onboarding" }),
    /already changed/,
  );
  d = completeStage(d, id);
  d = approve(d, id);
  assert.equal(d.firms[id].stage, "training");
  d = completeStage(d, id);
  d = approve(d, id);
  assert.equal(d.firms[id].stage, "relationship");
  assert.equal(values(d.history).filter((h) => h.firmId === id).length, 4);
  assert.equal(values(d.reviews).filter((r) => r.firmId === id).length, 2);
  const review = values(d.reviews).find((r) => r.firmId === id)!;
  d = execute(d, {
    type: "review.save",
    value: {
      ...review,
      status: "Completed",
      notes: "Discussed service experience. Schedule a platform refresher.",
    },
  });
  assert.equal(d.reviews[review.id].status, "Completed");
  assert.equal(values(d.reviews).filter((r) => r.firmId === id).length, 3);
  const exported = JSON.stringify(d);
  const imported = parseImport(exported);
  assert.deepEqual(imported, JSON.parse(exported));
  assert.doesNotThrow(() => validateDataset(imported));
});
test("publishing SOP changes affects only new stage entries and snapshots remain immutable", () => {
  let d = prospect(initial(), "before");
  const snapshot = JSON.stringify(currentInstance(d, d.firms.before)?.snapshot);
  const w = structuredClone(d.workflows.w_prospect);
  w.steps[0].title = "Confirm expanded firm profile";
  w.targetDays = 18;
  d = execute(d, { type: "workflow.save", value: w, publish: true });
  assert.equal(
    JSON.stringify(currentInstance(d, d.firms.before)?.snapshot),
    snapshot,
  );
  d = prospect(d, "after");
  assert.equal(currentInstance(d, d.firms.after)?.snapshot.version, 3);
  assert.equal(
    currentInstance(d, d.firms.after)?.snapshot.steps[0].title,
    "Confirm expanded firm profile",
  );
  assert.equal(currentInstance(d, d.firms.before)?.snapshot.version, 2);
});
test("workflow validation rejects cycles, invalid dependencies, and invalid named assignments", () => {
  const d = initial();
  const w = structuredClone(d.workflows.w_prospect);
  w.steps[0].dependencies = [w.steps[2].id];
  assert.throws(() => validateWorkflow(d, w), /cycle/);
  w.steps[0].dependencies = ["missing"];
  assert.throws(() => validateWorkflow(d, w), /missing step/);
  w.steps[0].dependencies = [];
  w.steps[0].assignment = "Named employee";
  w.steps[0].assigneeId = "u1";
  assert.throws(() => validateWorkflow(d, w), /assigned department/);
});
test("invalid imports and failed multi-record mutations preserve all original state", () => {
  const d = initial(),
    original = JSON.stringify(d);
  const invalid = structuredClone(d);
  invalid.firms.f1.ownerId = "missing";
  assert.throws(() => parseImport(JSON.stringify(invalid)), /Broken reference/);
  assert.equal(JSON.stringify(d), original);
  assert.throws(() => parseImport("{broken json"));
  assert.equal(JSON.stringify(d), original);
  const duplicate = structuredClone(d);
  duplicate.firms.f1.id = "f2";
  assert.throws(() => parseImport(JSON.stringify(duplicate)), /ID/);
  const tasks = values(d.tasks).slice(0, 2);
  d.settings.personaId = "u3";
  assert.throws(
    () =>
      execute(d, {
        type: "task.bulk",
        ids: tasks.map((t) => t.id),
        assigneeId: "u3",
      }),
    /demo role/,
  );
});
test("time-based evaluation deduplicates notifications and recurring review tasks", () => {
  const d = initial();
  evaluateRules(d);
  const notifications = values(d.notifications).length,
    tasks = values(d.tasks).length;
  for (let i = 0; i < 5; i++) evaluateRules(d);
  assert.equal(values(d.notifications).length, notifications);
  assert.equal(values(d.tasks).length, tasks);
  const advanced = execute(d, { type: "date.advance" });
  assert.equal(advanced.settings.demoDate, "2026-10-16");
  const once = JSON.stringify(advanced);
  evaluateRules(advanced);
  assert.equal(JSON.stringify(advanced), once);
});
test("lifecycle target edits retain active target snapshots and update future entries", () => {
  let d = prospect(initial(), "old_target");
  d = execute(d, {
    type: "settings.save",
    value: { defaultTargets: { ...d.settings.defaultTargets, prospect: 25 } },
  });
  d = prospect(d, "new_target");
  assert.equal(currentInstance(d, d.firms.old_target)?.snapshot.targetDays, 14);
  assert.equal(currentInstance(d, d.firms.new_target)?.snapshot.targetDays, 25);
});
