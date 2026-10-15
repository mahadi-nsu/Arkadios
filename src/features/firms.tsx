"use client";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useState } from "react";
import { ColumnDef } from "@tanstack/react-table";
import {
  Archive,
  ArrowRight,
  ArrowUpRight,
  Check,
  CheckCircle2,
  ChevronRight,
  Download,
  Mail,
  MapPin,
  Plus,
  RotateCcw,
  Save,
  ShieldCheck,
  StickyNote,
  Timer,
} from "lucide-react";
import { toast } from "sonner";
import { useApp, useData } from "@/lib/store";
import { Firm, stages } from "@/lib/model";
import {
  activeFirms,
  checklist,
  currentInstance,
  handoffBlockers,
  firmTasks,
  health,
  progress,
  stageAge,
  stageTarget,
  taskBlockers,
  values,
} from "@/lib/selectors";
import {
  canApprove,
  canEditFirm,
  canEditTask,
  canWrite,
} from "@/lib/permissions";
import { prettyDate } from "@/lib/dates";
import { uid } from "@/lib/utils";
import { exportCSV } from "@/lib/csv";
import {
  Avatar,
  Badge,
  DataTable,
  Empty,
  HealthBadge,
  PageHeading,
  Person,
  Progress,
  SectionHeading,
  StageBadge,
  TextSearch,
} from "@/components/common";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useEditor } from "@/components/editors";
import { useConfirm } from "@/components/confirm";
import { Tasks } from "./tasks";
import { Contacts } from "./contacts";
import { Projects } from "./projects";
import { Documents } from "./documents";
export function Firms() {
  const d = useData(),
    params = useSearchParams(),
    editor = useEditor(),
    run = useApp((s) => s.run),
    confirm = useConfirm();
  const [query, setQuery] = useState(params.get("q") ?? ""),
    [stage, setStage] = useState(params.get("stage") ?? ""),
    [attention, setAttention] = useState(params.get("health") === "attention"),
    [archived, setArchived] = useState(false),
    [saveOpen, setSaveOpen] = useState(false),
    [viewName, setViewName] = useState("");
  const departmentId = useApp((s) => s.departmentId);
  const firms = values(d.firms).filter(
    (f) =>
      f.archived === archived &&
      (!departmentId || f.departmentId === departmentId) &&
      (!stage || f.stage === stage) &&
      (!attention || health(d, f).label !== "On track") &&
      `${f.name} ${f.location} ${f.tags.join(" ")}`
        .toLowerCase()
        .includes(query.toLowerCase()),
  );
  const columns: ColumnDef<Firm>[] = [
    {
      accessorKey: "name",
      header: "Firm partner",
      cell: ({ row }) => (
        <Link
          href={`/firms/detail?id=${row.original.id}`}
          className="table-firm"
        >
          <div className="firm-monogram">{row.original.name[0]}</div>
          <span>
            <strong>{row.original.name}</strong>
            <small>{row.original.type}</small>
          </span>
        </Link>
      ),
    },
    {
      accessorKey: "stage",
      header: "Lifecycle stage",
      cell: ({ row }) => <StageBadge stage={row.original.stage} />,
    },
    {
      id: "health",
      header: "Health",
      accessorFn: (f) => health(d, f).label,
      cell: ({ row }) => <HealthBadge firm={row.original} />,
    },
    {
      id: "owner",
      header: "Owner",
      accessorFn: (f) => d.users[f.ownerId]?.name,
      cell: ({ row }) => <Person id={row.original.ownerId} d={d} />,
    },
    {
      id: "progress",
      header: "Checklist",
      accessorFn: (f) => progress(checklist(d, f)),
      cell: ({ row }) => (
        <Progress value={progress(checklist(d, row.original))} small />
      ),
    },
    {
      id: "stageAge",
      header: "Stage age",
      accessorFn: (f) => stageAge(d, f),
      cell: ({ row }) => (
        <span
          className={
            stageAge(d, row.original) > stageTarget(d, row.original)
              ? "due-overdue"
              : ""
          }
        >
          {stageAge(d, row.original)} days
          <small className="cell-sub">
            Target {stageTarget(d, row.original)} days
          </small>
        </span>
      ),
    },
    {
      accessorKey: "nextAction",
      header: "Next action",
      cell: ({ getValue }) => (
        <span className="truncate-cell">{getValue<string>()}</span>
      ),
    },
    { accessorKey: "location", header: "Location" },
    {
      id: "contacts",
      header: "Contacts",
      accessorFn: (f) =>
        values(d.contacts).filter((c) => c.firmId === f.id && !c.archived)
          .length,
      cell: ({ row }) => (
        <span>
          {
            values(d.contacts).filter(
              (c) => c.firmId === row.original.id && !c.archived,
            ).length
          }
          <small className="cell-sub">
            {
              values(d.contacts).filter(
                (c) =>
                  c.firmId === row.original.id &&
                  c.category === "Advisor" &&
                  !c.archived,
              ).length
            }{" "}
            advisors
          </small>
        </span>
      ),
    },
    {
      accessorKey: "stageEntered",
      header: "Stage entered",
      cell: ({ getValue }) => prettyDate(getValue<string>()),
    },
    {
      accessorKey: "lastActivity",
      header: "Last activity",
      cell: ({ getValue }) => prettyDate(getValue<string>()),
    },
    {
      id: "tags",
      header: "Tags",
      cell: ({ row }) =>
        row.original.tags.map((tag) => <Badge key={tag}>{tag}</Badge>),
    },
    ...values(d.customFields)
      .filter((f) => f.entity === "firm")
      .map((field) => ({
        id: field.id,
        header: field.name,
        accessorFn: (f: Firm) => f.custom[field.id] ?? "—",
      })),
    {
      id: "actions",
      header: "",
      cell: ({ row }) => (
        <div className="row-actions">
          <Button
            variant="ghost"
            size="sm"
            disabled={!canEditFirm(d, row.original)}
            onClick={() => editor({ type: "firm", id: row.original.id })}
          >
            Edit
          </Button>
          <button
            className="icon-action"
            aria-label={`${archived ? "Restore" : "Archive"} ${row.original.name}`}
            disabled={!canEditFirm(d, row.original)}
            onClick={async () => {
              if (
                await confirm({
                  title: `${archived ? "Restore" : "Archive"} ${row.original.name}?`,
                  description: archived
                    ? "Return this firm to the active directory."
                    : "Linked tasks, contacts, documents, and history will be retained. You can restore the firm anytime.",
                  label: archived ? "Restore firm" : "Archive firm",
                })
              ) {
                run({
                  type: "firm.archive",
                  id: row.original.id,
                  archived: !archived,
                });
                toast.success(archived ? "Firm restored." : "Firm archived.");
              }
            }}
          >
            {archived ? <RotateCcw size={15} /> : <Archive size={15} />}
          </button>
        </div>
      ),
    },
  ];
  return (
    <>
      <PageHeading
        title="Firm Partners"
        description="Every partnership. One shared source of truth."
        actions={
          <>
            <Button
              variant="secondary"
              onClick={() =>
                exportCSV(
                  "arkadios-firms.csv",
                  firms.map((f) => ({
                    Name: f.name,
                    Type: f.type,
                    Location: f.location,
                    Stage: d.settings.stageLabels[f.stage],
                    Owner: d.users[f.ownerId]?.name,
                    StageEntered: f.stageEntered,
                    StageAge: stageAge(d, f),
                    Health: health(d, f).label,
                    Reason: health(d, f).reason,
                    NextAction: f.nextAction,
                    Checklist: progress(checklist(d, f)),
                    Contacts: values(d.contacts).filter(
                      (c) => c.firmId === f.id && !c.archived,
                    ).length,
                    Tags: f.tags.join("; "),
                    ...f.custom,
                  })),
                )
              }
            >
              <Download size={16} />
              Export CSV
            </Button>
            <Button
              disabled={!canWrite(d)}
              onClick={() => editor({ type: "firm" })}
            >
              <Plus size={16} />
              Add firm partner
            </Button>
          </>
        }
      />
      <div className="directory-stats">
        {[
          { label: "Active partners", value: activeFirms(d).length },
          {
            label: "In the journey",
            value: activeFirms(d).filter((f) => f.stage !== "relationship")
              .length,
          },
          {
            label: "Established relationships",
            value: activeFirms(d).filter((f) => f.stage === "relationship")
              .length,
          },
          {
            label: "Ready for handoff",
            value: activeFirms(d).filter(
              (f) =>
                f.stage !== "relationship" && !handoffBlockers(d, f).length,
            ).length,
          },
        ].map((s) => (
          <div key={s.label}>
            <span>{s.label}</span>
            <strong>{s.value}</strong>
          </div>
        ))}
      </div>
      <section className="panel">
        <div className="directory-tabs">
          <button
            className={!archived ? "selected" : ""}
            onClick={() => setArchived(false)}
          >
            Active partners <Badge>{activeFirms(d).length}</Badge>
          </button>
          <button
            className={archived ? "selected" : ""}
            onClick={() => setArchived(true)}
          >
            Archived
          </button>
        </div>
        <div className="table-toolbar">
          <TextSearch
            value={query}
            onChange={setQuery}
            placeholder="Search firms, locations, or tags…"
          />
          <div className="toolbar-filters">
            <select
              aria-label="Lifecycle stage"
              value={stage}
              onChange={(e) => setStage(e.target.value)}
            >
              <option value="">All lifecycle stages</option>
              {stages.map((s) => (
                <option key={s} value={s}>
                  {d.settings.stageLabels[s]}
                </option>
              ))}
            </select>
            <label className="check-label">
              <input
                type="checkbox"
                checked={attention}
                onChange={(e) => setAttention(e.target.checked)}
              />
              Needs attention
            </label>
            <Button
              variant="secondary"
              size="sm"
              disabled={!canWrite(d)}
              onClick={() => setSaveOpen(true)}
            >
              <Save size={14} />
              Save view
            </Button>
            {values(d.savedViews).filter((v) => v.entity === "firms").length >
              0 && (
              <select
                aria-label="Saved views"
                defaultValue=""
                onChange={(e) => {
                  const v = d.savedViews[e.target.value];
                  if (v) {
                    setQuery(v.query);
                    setAttention(v.attention);
                    setArchived(v.archived);
                    setStage(v.stage);
                    useApp.getState().setDepartment(v.departmentId);
                  }
                }}
              >
                <option value="">Saved views</option>
                {values(d.savedViews)
                  .filter((v) => v.entity === "firms")
                  .map((v) => (
                    <option key={v.id} value={v.id}>
                      {v.name}
                    </option>
                  ))}
              </select>
            )}
          </div>
        </div>
        <DataTable data={firms} columns={columns} />
      </section>
      <Dialog open={saveOpen} onOpenChange={setSaveOpen}>
        <DialogContent>
          <div className="drawer-heading">
            <DialogTitle>Save this firm view</DialogTitle>
            <DialogDescription>
              Keep the current search, stage, and department filters.
            </DialogDescription>
          </div>
          <label className="field">
            View name
            <input
              value={viewName}
              onChange={(e) => setViewName(e.target.value)}
              placeholder="e.g. Operations onboarding"
            />
          </label>
          <Button
            disabled={!viewName.trim()}
            onClick={() => {
              run({
                type: "view.save",
                value: {
                  id: uid("view"),
                  name: viewName,
                  entity: "firms",
                  query,
                  stage,
                  departmentId,
                  attention,
                  archived,
                },
              });
              setSaveOpen(false);
              toast.success("View saved.");
            }}
          >
            Save view
          </Button>
        </DialogContent>
      </Dialog>
    </>
  );
}
export function HandoffButton({ firm }: { firm: Firm }) {
  const d = useData(),
    run = useApp((s) => s.run);
  const [open, setOpen] = useState(false);
  const blockers = handoffBlockers(d, firm);
  const next = stages[stages.indexOf(firm.stage) + 1];
  if (!next)
    return (
      <Badge dot tone="green">
        Established relationship
      </Badge>
    );
  return (
    <>
      <Button
        onClick={() => setOpen(true)}
        variant={blockers.length ? "secondary" : "default"}
      >
        <ArrowRight size={16} />
        Review handoff
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <div className="drawer-heading">
            <span className="eyebrow">CONTROLLED LIFECYCLE HANDOFF</span>
            <DialogTitle>
              {d.settings.stageLabels[firm.stage]} →{" "}
              {d.settings.stageLabels[next]}
            </DialogTitle>
            <DialogDescription>
              Review {firm.name}’s readiness before approving the next stage.
            </DialogDescription>
          </div>
          {blockers.length ? (
            <div className="blocker-list">
              <h3>
                <CircleAlertIcon />
                Requirements need attention
              </h3>
              {blockers.map((b, i) => (
                <p key={i}>{b}</p>
              ))}
            </div>
          ) : (
            <div className="notice notice-success">
              <CheckCircle2 size={20} />
              <span>
                All mandatory requirements and evidence are complete. Next-stage
                tasks will be assigned with due dates from{" "}
                {prettyDate(d.settings.demoDate)}.
              </span>
            </div>
          )}
          <div className="approval-summary">
            <span>Approver</span>
            <Person id={d.settings.personaId} d={d} />
            <span>Next workflow</span>
            <strong>
              Version{" "}
              {Math.max(
                ...values(d.versions)
                  .filter((v) => v.stage === next)
                  .map((v) => v.version),
              )}
            </strong>
          </div>
          {!canApprove(d, firm) && (
            <p className="notice">
              An Admin or the firm’s department Manager must approve this
              handoff.
            </p>
          )}
          <div className="confirm-actions">
            <Button variant="secondary" onClick={() => setOpen(false)}>
              Close
            </Button>
            <Button
              disabled={!!blockers.length || !canApprove(d, firm)}
              onClick={() => {
                try {
                  run({
                    type: "firm.advance",
                    id: firm.id,
                    expectedStage: firm.stage,
                  });
                  setOpen(false);
                  toast.success(
                    `Approved entry into ${d.settings.stageLabels[next]}.`,
                  );
                } catch (e) {
                  toast.error(String(e));
                }
              }}
            >
              <ShieldCheck size={16} />
              Approve handoff
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
function CircleAlertIcon() {
  return <Timer size={17} />;
}
export function FirmDetail() {
  const d = useData(),
    params = useSearchParams(),
    editor = useEditor(),
    id = params.get("id") ?? "",
    firm = d.firms[id];
  const [tab, setTab] = useState(params.get("tab") ?? "overview");
  if (!firm)
    return (
      <Empty
        title="Firm not found"
        description="This record may be from another dataset."
        action={
          <Button asChild>
            <Link href="/firms">Back to firms</Link>
          </Button>
        }
      />
    );
  const instance = currentInstance(d, firm),
    tasks = checklist(d, firm),
    contacts = values(d.contacts).filter((c) => c.firmId === id && !c.archived),
    primary = contacts.find((c) => c.primary),
    reviews = values(d.reviews)
      .filter((r) => r.firmId === id)
      .sort((a, b) => a.date.localeCompare(b.date)),
    activities = values(d.activities)
      .filter((a) => a.firmId === id)
      .sort((a, b) => b.at.localeCompare(a.at));
  return (
    <>
      <Link href="/firms" className="back-link">
        ← Firm Partners
      </Link>
      <div className="firm-detail-heading">
        <div className="firm-monogram firm-monogram-lg">{firm.name[0]}</div>
        <div>
          <div className="firm-title-line">
            <h1>{firm.name}</h1>
            {firm.archived && <Badge>Archived</Badge>}
            <HealthBadge firm={firm} />
          </div>
          <p>
            <span>{firm.type}</span>
            <span>
              <MapPin size={13} />
              {firm.location}
            </span>
            <span>{contacts.length} contacts</span>
          </p>
        </div>
        <div className="heading-actions">
          <Button
            variant="secondary"
            disabled={!canEditFirm(d, firm)}
            onClick={() => editor({ type: "firm", id })}
          >
            Edit firm
          </Button>
          <HandoffButton firm={firm} />
        </div>
      </div>
      <div className="firm-stage-rail">
        {stages.map((stage, i) => {
          const current = stages.indexOf(firm.stage);
          return (
            <div
              key={stage}
              className={i < current ? "done" : i === current ? "current" : ""}
            >
              <span>{i < current ? <Check size={14} /> : i + 1}</span>
              <div>
                <strong>{d.settings.stageLabels[stage]}</strong>
                <small>
                  {i < current
                    ? "Completed"
                    : i === current
                      ? `${stageAge(d, firm)} days in stage`
                      : "Up next"}
                </small>
              </div>
              {i < 4 && <ChevronRight size={17} />}
            </div>
          );
        })}
      </div>
      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          {[
            "overview",
            "checklist",
            "contacts",
            "tasks",
            "projects",
            "documents",
            "communications",
            "reviews",
            "notes",
            "activity",
          ].map((t) => (
            <TabsTrigger key={t} value={t}>
              {t[0].toUpperCase() + t.slice(1)}
              {t === "checklist" && (
                <Badge>
                  {tasks.filter((t) => t.status === "Completed").length}/
                  {tasks.length}
                </Badge>
              )}
            </TabsTrigger>
          ))}
        </TabsList>
        <TabsContent value="overview">
          <div className="detail-grid">
            <div>
              <section className="panel">
                <SectionHeading
                  title="Partnership at a glance"
                  action={<StageBadge stage={firm.stage} />}
                />
                <div className="overview-details">
                  <div>
                    <span>Relationship owner</span>
                    <Person id={firm.ownerId} d={d} />
                  </div>
                  <div>
                    <span>Owning department</span>
                    <strong>{d.departments[firm.departmentId].name}</strong>
                  </div>
                  <div>
                    <span>Stage health</span>
                    <HealthBadge firm={firm} />
                    <small>{health(d, firm).reason}</small>
                  </div>
                  <div>
                    <span>Stage target</span>
                    <strong>
                      {stageAge(d, firm)} of {stageTarget(d, firm)} days
                    </strong>
                  </div>
                  <div className="detail-wide">
                    <span>Next action</span>
                    <strong>{firm.nextAction}</strong>
                  </div>
                  <div>
                    <span>Agreement renewal</span>
                    <strong>
                      {firm.renewalDate
                        ? prettyDate(firm.renewalDate)
                        : "Not scheduled"}
                    </strong>
                  </div>
                  <div>
                    <span>Last contact</span>
                    <strong>
                      {values(d.threads)
                        .filter((th) => th.firmId === id)
                        .sort((a, b) =>
                          b.updatedAt.localeCompare(a.updatedAt),
                        )[0]
                        ? prettyDate(
                            values(d.threads)
                              .filter((th) => th.firmId === id)
                              .sort((a, b) =>
                                b.updatedAt.localeCompare(a.updatedAt),
                              )[0].updatedAt,
                          )
                        : "No conversation logged"}
                    </strong>
                  </div>
                  <div>
                    <span>Next follow-up</span>
                    <strong>
                      {firmTasks(d, id)
                        .filter((t) => t.status !== "Completed")
                        .sort((a, b) => a.dueDate.localeCompare(b.dueDate))[0]
                        ? prettyDate(
                            firmTasks(d, id)
                              .filter((t) => t.status !== "Completed")
                              .sort((a, b) =>
                                a.dueDate.localeCompare(b.dueDate),
                              )[0].dueDate,
                          )
                        : "No open follow-up"}
                    </strong>
                  </div>
                  <div>
                    <span>Last activity</span>
                    <strong>{prettyDate(firm.lastActivity)}</strong>
                  </div>
                  {values(d.customFields)
                    .filter((f) => f.entity === "firm")
                    .map((field) => (
                      <div key={field.id}>
                        <span>{field.name}</span>
                        <strong>{firm.custom[field.id] ?? "Not set"}</strong>
                      </div>
                    ))}
                  <div>
                    <span>Tags</span>
                    <div>
                      {firm.tags.map((t) => (
                        <Badge key={t}>{t}</Badge>
                      ))}
                    </div>
                  </div>
                </div>
              </section>
              <section className="panel">
                <SectionHeading
                  title="Current stage checklist"
                  sub={`Published workflow v${instance?.snapshot.version} · changes to future SOPs won’t alter this instance.`}
                  action={
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setTab("checklist")}
                    >
                      View checklist
                      <ArrowUpRight size={14} />
                    </Button>
                  }
                />
                <div className="checklist-preview">
                  {tasks.map((t) => (
                    <button
                      key={t.id}
                      onClick={() => editor({ type: "task", id: t.id })}
                    >
                      <span
                        className={`checklist-status ${t.status === "Completed" ? "complete" : ""}`}
                      >
                        {t.status === "Completed" ? <Check size={13} /> : null}
                      </span>
                      <span>
                        {t.title}
                        <small>
                          {t.evidence} · {t.status}
                        </small>
                      </span>
                      <ChevronRight size={16} />
                    </button>
                  ))}
                </div>
                <div className="panel-padding">
                  <Progress value={progress(tasks)} />
                </div>
              </section>
              <section className="panel">
                <SectionHeading
                  title="Recent activity"
                  action={
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setTab("activity")}
                    >
                      Full timeline
                      <ArrowUpRight size={14} />
                    </Button>
                  }
                />
                <Timeline activities={activities.slice(0, 4)} />
              </section>
            </div>
            <aside>
              <section className="panel">
                <SectionHeading title="Your primary connection" />
                {primary ? (
                  <div className="primary-contact">
                    <Avatar name={primary.name} />
                    <h3>{primary.name}</h3>
                    <p>{primary.title}</p>
                    <Badge tone="green">Primary contact</Badge>
                    <a href={`mailto:${primary.email}`}>
                      <Mail size={15} />
                      {primary.email}
                    </a>
                    <span>{primary.phone}</span>
                    <Button
                      variant="secondary"
                      size="sm"
                      disabled={!canEditFirm(d, firm)}
                      onClick={() =>
                        editor({ type: "contact", id: primary.id, firmId: id })
                      }
                    >
                      View contact
                    </Button>
                  </div>
                ) : (
                  <Empty
                    title="Add your primary contact"
                    description="A verified primary contact is a prospect readiness requirement."
                    action={
                      <Button
                        size="sm"
                        disabled={!canEditFirm(d, firm)}
                        onClick={() => editor({ type: "contact", firmId: id })}
                      >
                        <Plus size={14} />
                        Add contact
                      </Button>
                    }
                  />
                )}
              </section>
              <section className="panel">
                <SectionHeading
                  title="Relationship cadence"
                  action={
                    <button
                      className="icon-action"
                      aria-label="Schedule review"
                      disabled={!canEditFirm(d, firm)}
                      onClick={() => editor({ type: "review", firmId: id })}
                    >
                      <Plus size={17} />
                    </button>
                  }
                />
                <div className="cadence-list">
                  {reviews
                    .filter((r) => r.status === "Scheduled")
                    .slice(0, 3)
                    .map((r) => (
                      <button
                        key={r.id}
                        onClick={() =>
                          editor({ type: "review", id: r.id, firmId: id })
                        }
                      >
                        <span>{r.type}</span>
                        <strong>{prettyDate(r.date)}</strong>
                      </button>
                    ))}
                  {!reviews.length && (
                    <p className="muted">
                      Schedule a review to keep the connection strong.
                    </p>
                  )}
                </div>
              </section>
              <section className="panel">
                <SectionHeading
                  title="Connected references"
                  action={<Badge>Simulated</Badge>}
                />
                <div className="integration-refs">
                  {d.settings.integrations.map((i, index) => (
                    <div key={i.name}>
                      <span
                        className={`integration-symbol integration-${index}`}
                      >
                        {i.name[0]}
                      </span>
                      <div>
                        <strong>{i.name}</strong>
                        <small>
                          {["SF", "ZD", "ES"][index]}-{firm.id.toUpperCase()} ·
                          Demo reference
                        </small>
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            </aside>
          </div>
        </TabsContent>
        <TabsContent value="checklist">
          <section className="panel">
            <SectionHeading
              title={`${d.settings.stageLabels[firm.stage]} requirements`}
              sub={`Workflow v${instance?.snapshot.version} · entered ${prettyDate(firm.stageEntered)} · target ${stageTarget(d, firm)} days`}
              action={<HandoffButton firm={firm} />}
            />
            <div className="panel-padding">
              <Progress value={progress(tasks)} />
            </div>
            <div className="full-checklist">
              {tasks.map((t, i) => {
                const step = instance?.snapshot.steps.find(
                    (s) => s.id === t.stepId,
                  ),
                  blockers = taskBlockers(d, t);
                return (
                  <div key={t.id}>
                    <span
                      className={`checklist-status ${t.status === "Completed" ? "complete" : ""}`}
                    >
                      {t.status === "Completed" ? <Check size={14} /> : i + 1}
                    </span>
                    <div className="checklist-body">
                      <h3>
                        {t.title}
                        {step?.required ? (
                          <Badge>Required</Badge>
                        ) : (
                          <Badge>Optional</Badge>
                        )}
                      </h3>
                      <p>{t.description}</p>
                      <div className="checklist-meta">
                        <span>{d.departments[t.departmentId].name}</span>
                        <span>Due {prettyDate(t.dueDate)}</span>
                        <span>Evidence: {t.evidence}</span>
                      </div>
                      {t.evidenceNote && (
                        <p className="evidence-note">{t.evidenceNote}</p>
                      )}
                      {t.meetingDate && (
                        <p className="evidence-note">
                          Meeting: {prettyDate(t.meetingDate)}
                        </p>
                      )}
                      {blockers.length > 0 && t.status !== "Completed" && (
                        <p className="blocker-summary">{blockers.join(" ")}</p>
                      )}
                    </div>
                    <div className="checklist-actions">
                      <Badge
                        tone={
                          t.status === "Completed"
                            ? "green"
                            : t.status === "Blocked"
                              ? "red"
                              : "neutral"
                        }
                      >
                        {t.status}
                      </Badge>
                      <Button
                        variant="secondary"
                        size="sm"
                        disabled={!canEditTask(d, t)}
                        onClick={() => editor({ type: "task", id: t.id })}
                      >
                        {t.status === "Completed"
                          ? "View / edit"
                          : "Update requirement"}
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        </TabsContent>
        <TabsContent value="contacts">
          <Contacts firmId={id} />
        </TabsContent>
        <TabsContent value="tasks">
          <Tasks firmId={id} />
        </TabsContent>
        <TabsContent value="projects">
          <Projects firmId={id} />
        </TabsContent>
        <TabsContent value="documents">
          <Documents firmId={id} />
        </TabsContent>
        <TabsContent value="communications">
          <section className="panel">
            <SectionHeading
              title="Communication history"
              action={
                <Button
                  size="sm"
                  disabled={!canEditFirm(d, firm)}
                  onClick={() => editor({ type: "thread", firmId: id })}
                >
                  <Plus size={15} />
                  New conversation
                </Button>
              }
            />
            {values(d.threads)
              .filter((t) => t.firmId === id)
              .map((t) => (
                <Link
                  className="communication-link"
                  href={`/communications?thread=${t.id}`}
                  key={t.id}
                >
                  <Mail size={18} />
                  <div>
                    <strong>{t.subject}</strong>
                    <p>
                      {
                        values(d.messages).filter((m) => m.threadId === t.id)
                          .length
                      }{" "}
                      messages · Updated {prettyDate(t.updatedAt)}
                    </p>
                  </div>
                  <Badge>{t.status}</Badge>
                  <ChevronRight size={17} />
                </Link>
              ))}
            {!values(d.threads).some((t) => t.firmId === id) && (
              <Empty
                title="Start the conversation"
                description="Log a message or keep an internal coordination note."
              />
            )}
          </section>
        </TabsContent>
        <TabsContent value="reviews">
          <section className="panel">
            <SectionHeading
              title="Relationship reviews"
              sub="Completing a review schedules the next cadence automatically."
              action={
                <Button
                  disabled={!canEditFirm(d, firm)}
                  onClick={() => editor({ type: "review", firmId: id })}
                >
                  <Plus size={15} />
                  Schedule review
                </Button>
              }
            />
            {reviews.map((r) => (
              <div className="review-row" key={r.id}>
                <div>
                  <h3>{r.type}</h3>
                  <p>{r.notes || "No agenda added yet."}</p>
                </div>
                <Person id={r.ownerId} d={d} />
                <span>{prettyDate(r.date)}</span>
                <Badge tone={r.status === "Completed" ? "green" : "blue"}>
                  {r.status}
                </Badge>
                <Button
                  variant="secondary"
                  size="sm"
                  disabled={!canEditFirm(d, firm)}
                  onClick={() =>
                    editor({ type: "review", id: r.id, firmId: id })
                  }
                >
                  {r.status === "Completed"
                    ? "View outcome"
                    : "Complete / edit"}
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  disabled={!canEditFirm(d, firm)}
                  onClick={() =>
                    editor({
                      type: "task",
                      firmId: id,
                      title: `Follow up: ${r.type}`,
                    })
                  }
                >
                  Follow-up
                </Button>
              </div>
            ))}
            {!reviews.length && (
              <Empty
                title="Plan your next conversation"
                description="Schedule a quarterly, annual, or relationship check-in review."
              />
            )}
          </section>
        </TabsContent>
        <TabsContent value="notes">
          <section className="panel">
            <SectionHeading
              title="Firm notes"
              action={
                <Button
                  variant="secondary"
                  size="sm"
                  disabled={!canEditFirm(d, firm)}
                  onClick={() => editor({ type: "firm", id })}
                >
                  <StickyNote size={15} />
                  Edit notes
                </Button>
              }
            />
            <div className="prose-note">{firm.notes || "No notes yet."}</div>
          </section>
        </TabsContent>
        <TabsContent value="activity">
          <section className="panel">
            <SectionHeading
              title="Partnership timeline"
              sub="Actions are recorded with the active demo employee."
            />
            <Timeline activities={activities} />
          </section>
        </TabsContent>
      </Tabs>
    </>
  );
}
function Timeline({
  activities,
}: {
  activities: ReturnType<typeof useData>["activities"][string][];
}) {
  const d = useData();
  return (
    <div className="timeline">
      {activities.map((a) => (
        <div key={a.id}>
          <Avatar name={d.users[a.actorId]?.name ?? "Team"} small />
          <div>
            <p>{a.label}</p>
            <small>
              {d.users[a.actorId]?.name} ·{" "}
              {prettyDate(a.at, "MMM d, yyyy · h:mm a")}
            </small>
          </div>
        </div>
      ))}
      {!activities.length && <p className="muted">No activity recorded yet.</p>}
    </div>
  );
}
