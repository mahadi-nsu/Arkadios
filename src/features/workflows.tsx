"use client";
import { useState } from "react";
import {
  ArrowDown,
  ArrowUp,
  BookOpen,
  ChevronRight,
  GitBranch,
  History,
  Plus,
  Save,
  Send,
  Settings2,
  Trash2,
  Workflow as WorkflowIcon,
} from "lucide-react";
import { toast } from "sonner";
import { Dataset, Step, Workflow, evidenceTypes, stages } from "@/lib/model";
import { useApp, useData } from "@/lib/store";
import { canAdmin } from "@/lib/permissions";
import { values } from "@/lib/selectors";
import { uid } from "@/lib/utils";
import { prettyDate } from "@/lib/dates";
import { Badge, PageHeading, SectionHeading } from "@/components/common";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import { RecordForm } from "@/components/forms";
import { useConfirm } from "@/components/confirm";
import {
  useDiscardChanges,
  useUnsavedChanges,
} from "@/components/unsaved-changes";
export function Workflows() {
  const d = useData();
  const [selected, setSelected] = useState(values(d.workflows)[0].id),
    [tab, setTab] = useState("editor"),
    [create, setCreate] = useState(false);
  const run = useApp((s) => s.run);
  const confirmDiscard = useDiscardChanges();
  return (
    <>
      <PageHeading
        title="Workflows & SOPs"
        description="Build a repeatable process. Leave room for a personal partnership."
        actions={
          <Button
            disabled={!canAdmin(d)}
            onClick={async () => {
              if (await confirmDiscard()) setCreate(true);
            }}
          >
            <Plus size={16} />
            New workflow
          </Button>
        }
      />
      <div className="workflow-intro">
        <div className="workflow-intro-icon">
          <GitBranch size={24} />
        </div>
        <div>
          <h3>A shared playbook for every stage</h3>
          <p>
            Publish a new version when your process evolves. In-progress firms
            keep their original steps, assignments, and targets.
          </p>
        </div>
        <Badge tone="green">Versioned by design</Badge>
      </div>
      <Tabs
        value={tab}
        onValueChange={async (next) => {
          if (next !== tab && (await confirmDiscard())) setTab(next);
        }}
      >
        <TabsList>
          <TabsTrigger value="editor">
            <BookOpen size={15} />
            Workflow editor
          </TabsTrigger>
          <TabsTrigger value="rules">
            <Settings2 size={15} />
            When / then rules
          </TabsTrigger>
        </TabsList>
        <TabsContent value="editor">
          <div className="workflow-layout">
            <aside className="panel workflow-nav">
              <SectionHeading title="Your playbooks" />
              {values(d.workflows).map((w) => (
                <button
                  key={w.id}
                  className={selected === w.id ? "selected" : ""}
                  onClick={async () => {
                    if (w.id !== selected && (await confirmDiscard()))
                      setSelected(w.id);
                  }}
                >
                  <span className="workflow-nav-icon">
                    <WorkflowIcon size={18} />
                  </span>
                  <span>
                    <strong>{d.settings.stageLabels[w.stage]}</strong>
                    <small>
                      {w.steps.length} steps · {w.targetDays} day target
                    </small>
                  </span>
                  <ChevronRight size={15} />
                </button>
              ))}
            </aside>
            <WorkflowEditor key={selected} workflow={d.workflows[selected]} />
          </div>
        </TabsContent>
        <TabsContent value="rules">
          <RulesEditor />
        </TabsContent>
      </Tabs>
      <Dialog open={create} onOpenChange={setCreate}>
        <DialogContent>
          <div className="drawer-heading">
            <DialogTitle>Create a workflow</DialogTitle>
            <DialogDescription>
              Start a draft. Publish it when the steps and assignments are
              ready.
            </DialogDescription>
          </div>
          <RecordForm
            fields={[
              {
                name: "name",
                label: "Workflow name",
                required: true,
                wide: true,
              },
              {
                name: "stage",
                label: "Lifecycle stage",
                type: "select",
                required: true,
                options: stages.map((s) => ({
                  value: s,
                  label: d.settings.stageLabels[s],
                })),
              },
              {
                name: "targetDays",
                label: "Stage target (days)",
                type: "number",
                required: true,
                min: 1,
                max: 730,
              },
            ]}
            defaults={{ name: "", stage: "prospect", targetDays: "14" }}
            submitLabel="Create draft"
            onSubmit={(v) => {
              const id = uid("workflow");
              run({
                type: "workflow.save",
                publish: false,
                value: {
                  id,
                  name: v.name,
                  stage: v.stage as Workflow["stage"],
                  targetDays: Number(v.targetDays),
                  steps: [blankStep(d)],
                },
              });
              setSelected(id);
              setCreate(false);
              toast.success("Draft created.");
            }}
          />
        </DialogContent>
      </Dialog>
    </>
  );
}
function blankStep(d: Dataset): Step {
  return {
    id: uid("step"),
    title: "New requirement",
    description: "",
    required: true,
    departmentId: values(d.departments)[0].id,
    assignment: "Department queue",
    assigneeId: "",
    dueDays: 3,
    dependencies: [],
    evidence: "Note",
  };
}
function WorkflowEditor({ workflow }: { workflow: Workflow }) {
  const d = useData(),
    run = useApp((s) => s.run),
    confirm = useConfirm();
  const [draft, setDraft] = useState<Workflow>(structuredClone(workflow)),
    [expanded, setExpanded] = useState(draft.steps[0]?.id ?? ""),
    [history, setHistory] = useState(false);
  const editable = canAdmin(d);
  useUnsavedChanges(
    editable && JSON.stringify(draft) !== JSON.stringify(workflow),
    () => setDraft(structuredClone(workflow)),
  );
  const versions = values(d.versions)
    .filter((v) => v.stage === draft.stage)
    .sort((a, b) => b.version - a.version);
  const updateStep = (id: string, patch: Partial<Step>) =>
    setDraft((w) => ({
      ...w,
      steps: w.steps.map((s) => (s.id === id ? { ...s, ...patch } : s)),
    }));
  const save = async (publish: boolean) => {
    if (
      publish &&
      !(await confirm({
        title: "Publish a new SOP version?",
        description:
          "New stage entries will use this version. Existing workflow instances will keep their original snapshots.",
        label: "Publish version",
      }))
    )
      return;
    try {
      run({ type: "workflow.save", value: draft, publish });
      toast.success(
        publish
          ? "Version published. Existing instances preserved."
          : "Workflow draft saved.",
      );
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Unable to save workflow.");
    }
  };
  return (
    <div>
      <section className="panel workflow-editor">
        <div className="workflow-editor-top">
          <div>
            <span className="eyebrow">WORKFLOW DRAFT</span>
            <h2>{draft.name}</h2>
            <p>
              {versions.length
                ? `Latest published v${versions[0].version}`
                : "Not yet published"}{" "}
              · {draft.steps.filter((s) => s.required).length} mandatory
              requirements
            </p>
          </div>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => setHistory(true)}
          >
            <History size={15} />
            Version history
          </Button>
        </div>
        <div className="workflow-config">
          <label className="field">
            Workflow name
            <input
              disabled={!editable}
              value={draft.name}
              onChange={(e) => setDraft({ ...draft, name: e.target.value })}
            />
          </label>
          <label className="field">
            Stage target (days)
            <input
              type="number"
              min="1"
              max="730"
              disabled={!editable}
              value={draft.targetDays}
              onChange={(e) =>
                setDraft({ ...draft, targetDays: Number(e.target.value) })
              }
            />
          </label>
        </div>
        <div className="workflow-steps-header">
          <h3>Steps & requirements</h3>
          <span>Due dates start from stage entry</span>
        </div>
        <div className="workflow-steps">
          {draft.steps.map((step, index) => (
            <div
              className={`workflow-step ${expanded === step.id ? "expanded" : ""}`}
              key={step.id}
            >
              <div className="workflow-step-summary">
                <span className="step-number">{index + 1}</span>
                <button
                  onClick={() =>
                    setExpanded(expanded === step.id ? "" : step.id)
                  }
                >
                  <strong>{step.title}</strong>
                  <span>
                    {d.departments[step.departmentId]?.name} · Day{" "}
                    {step.dueDays} · {step.evidence}
                  </span>
                </button>
                <Badge>{step.required ? "Required" : "Optional"}</Badge>
                <div className="step-controls">
                  <button
                    className="icon-action"
                    disabled={!editable || index === 0}
                    aria-label={`Move ${step.title} up`}
                    onClick={() =>
                      setDraft((w) => {
                        const steps = [...w.steps];
                        [steps[index - 1], steps[index]] = [
                          steps[index],
                          steps[index - 1],
                        ];
                        return { ...w, steps };
                      })
                    }
                  >
                    <ArrowUp size={15} />
                  </button>
                  <button
                    className="icon-action"
                    disabled={!editable || index === draft.steps.length - 1}
                    aria-label={`Move ${step.title} down`}
                    onClick={() =>
                      setDraft((w) => {
                        const steps = [...w.steps];
                        [steps[index + 1], steps[index]] = [
                          steps[index],
                          steps[index + 1],
                        ];
                        return { ...w, steps };
                      })
                    }
                  >
                    <ArrowDown size={15} />
                  </button>
                  <button
                    className="icon-action"
                    disabled={!editable || draft.steps.length === 1}
                    aria-label={`Remove ${step.title}`}
                    onClick={() =>
                      setDraft((w) => ({
                        ...w,
                        steps: w.steps
                          .filter((s) => s.id !== step.id)
                          .map((s) => ({
                            ...s,
                            dependencies: s.dependencies.filter(
                              (id) => id !== step.id,
                            ),
                          })),
                      }))
                    }
                  >
                    <Trash2 size={15} />
                  </button>
                </div>
              </div>
              {expanded === step.id && (
                <fieldset disabled={!editable} className="workflow-step-fields">
                  <legend className="sr-only">Edit {step.title}</legend>
                  <label className="field field-wide">
                    Step title
                    <input
                      value={step.title}
                      onChange={(e) =>
                        updateStep(step.id, { title: e.target.value })
                      }
                    />
                  </label>
                  <label className="field field-wide">
                    Instructions
                    <textarea
                      value={step.description}
                      onChange={(e) =>
                        updateStep(step.id, { description: e.target.value })
                      }
                      rows={2}
                    />
                  </label>
                  <label className="field">
                    Department
                    <select
                      value={step.departmentId}
                      onChange={(e) =>
                        updateStep(step.id, {
                          departmentId: e.target.value,
                          assigneeId: "",
                        })
                      }
                    >
                      {values(d.departments).map((dep) => (
                        <option key={dep.id} value={dep.id}>
                          {dep.name}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="field">
                    Assignment method
                    <select
                      value={step.assignment}
                      onChange={(e) =>
                        updateStep(step.id, {
                          assignment: e.target.value as Step["assignment"],
                        })
                      }
                    >
                      {["Firm owner", "Named employee", "Department queue"].map(
                        (a) => (
                          <option key={a}>{a}</option>
                        ),
                      )}
                    </select>
                  </label>
                  {step.assignment === "Named employee" && (
                    <label className="field">
                      Named employee
                      <select
                        value={step.assigneeId}
                        onChange={(e) =>
                          updateStep(step.id, { assigneeId: e.target.value })
                        }
                      >
                        <option value="">Choose employee</option>
                        {values(d.users)
                          .filter(
                            (u) =>
                              u.active && u.departmentId === step.departmentId,
                          )
                          .map((u) => (
                            <option key={u.id} value={u.id}>
                              {u.name}
                            </option>
                          ))}
                      </select>
                    </label>
                  )}
                  <label className="field">
                    Due day offset
                    <input
                      type="number"
                      min="0"
                      max="730"
                      value={step.dueDays}
                      onChange={(e) =>
                        updateStep(step.id, { dueDays: Number(e.target.value) })
                      }
                    />
                  </label>
                  <label className="field">
                    Required evidence
                    <select
                      value={step.evidence}
                      onChange={(e) =>
                        updateStep(step.id, {
                          evidence: e.target.value as Step["evidence"],
                        })
                      }
                    >
                      {evidenceTypes.map((e) => (
                        <option key={e}>{e}</option>
                      ))}
                    </select>
                  </label>
                  <label className="check-label field-wide">
                    <input
                      type="checkbox"
                      checked={step.required}
                      onChange={(e) =>
                        updateStep(step.id, { required: e.target.checked })
                      }
                    />
                    Mandatory for stage handoff
                  </label>
                  <div className="field field-wide">
                    <span>Dependencies</span>
                    <div className="dependency-options">
                      {draft.steps
                        .filter((s) => s.id !== step.id)
                        .map((s) => (
                          <label className="check-label" key={s.id}>
                            <input
                              type="checkbox"
                              checked={step.dependencies.includes(s.id)}
                              onChange={(e) =>
                                updateStep(step.id, {
                                  dependencies: e.target.checked
                                    ? [...step.dependencies, s.id]
                                    : step.dependencies.filter(
                                        (id) => id !== s.id,
                                      ),
                                })
                              }
                            />
                            <span>{s.title}</span>
                          </label>
                        ))}
                      {draft.steps.length === 1 && (
                        <p className="field-hint">
                          Add another step to configure dependencies.
                        </p>
                      )}
                    </div>
                  </div>
                </fieldset>
              )}
            </div>
          ))}
        </div>
        <div className="workflow-editor-footer">
          <Button
            variant="secondary"
            size="sm"
            disabled={!editable}
            onClick={() => {
              const step = blankStep(d);
              setDraft({ ...draft, steps: [...draft.steps, step] });
              setExpanded(step.id);
            }}
          >
            <Plus size={15} />
            Add step
          </Button>
          <div>
            <Button
              variant="secondary"
              disabled={!editable}
              onClick={() => void save(false)}
            >
              <Save size={15} />
              Save draft
            </Button>
            <Button disabled={!editable} onClick={() => void save(true)}>
              <Send size={15} />
              Publish version
            </Button>
          </div>
        </div>
      </section>
      <div className="notice">
        <GitBranch size={18} />
        <span>
          Publishing validates assignments and dependencies, including cycles.
          Active instances always retain their exact published steps and stage
          target.
        </span>
      </div>
      <Dialog open={history} onOpenChange={setHistory}>
        <DialogContent className="wide-dialog">
          <div className="drawer-heading">
            <DialogTitle>Published version history</DialogTitle>
            <DialogDescription>
              {d.settings.stageLabels[draft.stage]} · Immutable snapshots for
              traceable handoffs.
            </DialogDescription>
          </div>
          <div className="version-history">
            {versions.map((v) => (
              <div key={v.id}>
                <div className="version-mark">
                  <GitBranch size={19} />
                </div>
                <div>
                  <h3>
                    Version {v.version}
                    <Badge tone="green">Published</Badge>
                  </h3>
                  <p>
                    {v.steps.length} steps · {v.targetDays} day target ·{" "}
                    {
                      values(d.instances).filter((i) => i.versionId === v.id)
                        .length
                    }{" "}
                    firm instances
                  </p>
                  <small>
                    {prettyDate(v.publishedAt)} · {d.users[v.publishedBy]?.name}
                  </small>
                  <details>
                    <summary>View published requirements</summary>
                    {v.steps.map((s) => (
                      <p key={s.id}>
                        {s.title} · Day {s.dueDays} ·{" "}
                        {s.required ? "Required" : "Optional"} · {s.evidence}
                      </p>
                    ))}
                  </details>
                </div>
              </div>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
const ruleLabels = {
  overdue: {
    when: "A step is overdue",
    then: "Notify the department manager",
    description:
      "One local notification per task. Days specify how long the task must be overdue.",
  },
  "stage-target": {
    when: "The stage target is exceeded",
    then: "Notify the firm owner",
    description:
      "Uses each firm’s published stage target, not the current default.",
  },
  handoff: {
    when: "All mandatory requirements are complete",
    then: "Request handoff approval",
    description:
      "Evidence and dependencies must be satisfied. Approval remains a human action.",
  },
  "implementation-project": {
    when: "Implementation entry is approved",
    then: "Create the implementation project",
    description:
      "Reuses the stage’s workflow tasks. A firm receives this project only once.",
  },
};
function RulesEditor() {
  const d = useData(),
    run = useApp((s) => s.run);
  const [rules, setRules] = useState(structuredClone(d.rules));
  useUnsavedChanges(
    canAdmin(d) && JSON.stringify(rules) !== JSON.stringify(d.rules),
    () => setRules(structuredClone(d.rules)),
  );
  return (
    <section className="panel">
      <SectionHeading
        title="A little automation. A lot of clarity."
        sub="Rules evaluate after hydration, after changes, and when the demo date advances. They do not run while the browser is closed."
      />
      <div className="rules-list">
        {values(rules).map((r) => (
          <div className="rule-row" key={r.id}>
            <label className="switch">
              <input
                aria-label={`Enable ${ruleLabels[r.type].when}`}
                type="checkbox"
                disabled={!canAdmin(d)}
                checked={r.enabled}
                onChange={(e) =>
                  setRules({
                    ...rules,
                    [r.id]: { ...r, enabled: e.target.checked },
                  })
                }
              />
              <span />
            </label>
            <div>
              <div className="rule-statement">
                <Badge tone="blue">WHEN</Badge>
                <strong>{ruleLabels[r.type].when}</strong>
                {r.type === "overdue" && (
                  <label>
                    <input
                      aria-label="Days overdue before notification"
                      type="number"
                      min="0"
                      max="365"
                      disabled={!canAdmin(d)}
                      value={r.days}
                      onChange={(e) =>
                        setRules({
                          ...rules,
                          [r.id]: { ...r, days: Number(e.target.value) },
                        })
                      }
                    />
                    days
                  </label>
                )}
              </div>
              <div className="rule-statement">
                <Badge tone="green">THEN</Badge>
                <strong>{ruleLabels[r.type].then}</strong>
              </div>
              <p>{ruleLabels[r.type].description}</p>
            </div>
            <Button
              variant="secondary"
              size="sm"
              disabled={!canAdmin(d)}
              onClick={() => {
                try {
                  run({
                    type: "rule.save",
                    id: r.id,
                    enabled: r.enabled,
                    days: r.days,
                  });
                  toast.success("Rule saved and evaluated.");
                } catch (e) {
                  toast.error(String(e));
                }
              }}
            >
              Save rule
            </Button>
          </div>
        ))}
      </div>
    </section>
  );
}
