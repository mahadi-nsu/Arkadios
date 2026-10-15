import { test } from "node:test";
import assert from "node:assert/strict";
import { createSeed } from "../src/lib/seed";
import { nextFirmAction } from "../src/lib/next-action";
import { checklist, firmTasks, values } from "../src/lib/selectors";

test("next action prioritizes an actionable prerequisite, then exposes handoff only after requirements are complete", () => {
  const d = createSeed("2026-10-15");
  const firm = d.firms.f1;
  const [first, second, third] = checklist(d, firm);
  for (const task of [first, second, third]) {
    task.evidence = "None";
    task.dependencies = [];
    task.status = "Completed";
  }
  first.status = "Not started";
  first.dueDate = "2026-10-15";
  second.status = "Not started";
  second.dueDate = "2026-10-01";
  second.dependencies = [first.id];
  let action = nextFirmAction(d, firm);
  assert.equal(action.kind, "task");
  if (action.kind === "task") assert.equal(action.task.id, first.id);
  first.status = "Completed";
  action = nextFirmAction(d, firm);
  assert.equal(action.kind, "task");
  if (action.kind === "task") assert.equal(action.task.id, second.id);
  second.status = "Completed";
  assert.deepEqual(nextFirmAction(d, firm), {
    kind: "handoff",
    nextStage: "Implementation",
  });
  firm.archived = true;
  assert.equal(nextFirmAction(d, firm).kind, "archived");
});

test("relationship next action uses current tasks and scheduled reviews rather than a stale firm text field", () => {
  const d = createSeed("2026-10-15");
  const firm = d.firms.f6;
  firm.nextAction = "Old action that is no longer relevant";
  for (const task of firmTasks(d, firm.id)) {
    task.status = "Completed";
    task.evidence = "None";
    task.dependencies = [];
  }
  const expected = values(d.reviews)
    .filter(
      (review) => review.firmId === firm.id && review.status === "Scheduled",
    )
    .sort((a, b) => a.date.localeCompare(b.date))[0];
  assert.ok(expected);
  const action = nextFirmAction(d, firm);
  assert.equal(action.kind, "review");
  if (action.kind === "review") assert.equal(action.review.id, expected.id);
  for (const review of values(d.reviews).filter((r) => r.firmId === firm.id))
    review.status = "Completed";
  assert.equal(nextFirmAction(d, firm).kind, "schedule-review");
  const task = firmTasks(d, firm.id)[0];
  task.status = "In progress";
  assert.equal(nextFirmAction(d, firm).kind, "task");
});
