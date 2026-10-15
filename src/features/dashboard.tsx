"use client";
import Link from "next/link";
import {
  ArrowRight,
  ArrowUpRight,
  Building2,
  CalendarDays,
  Check,
  CheckCircle2,
  ChevronRight,
  CircleAlert,
  Clock3,
  Flag,
  ListTodo,
  Plus,
} from "lucide-react";
import { useApp, useData } from "@/lib/store";
import { actor, canWrite } from "@/lib/permissions";
import {
  activeFirms,
  dueThisWeek,
  handoffBlockers,
  health,
  overdue,
  scopedTasks,
  stageColor,
  stageCounts,
  values,
} from "@/lib/selectors";
import { prettyDate, shiftDate } from "@/lib/dates";
import {
  Avatar,
  Badge,
  Empty,
  PageHeading,
  Person,
  SectionHeading,
  StageBadge,
  ViewLink,
} from "@/components/common";
import { Button } from "@/components/ui/button";
import { useEditor } from "@/components/editors";
function MiniBars({
  values: nums,
  color,
}: {
  values: number[];
  color: string;
}) {
  const max = Math.max(1, ...nums);
  return (
    <div className="mini-bars" aria-hidden="true">
      {nums.map((n, i) => (
        <span
          key={i}
          style={{
            height: `${Math.max(8, (n / max) * 100)}%`,
            background: color,
            opacity: 0.35 + i * 0.09,
          }}
        />
      ))}
    </div>
  );
}
export function Dashboard() {
  const d = useData(),
    u = actor(d),
    departmentId = useApp((s) => s.departmentId),
    editor = useEditor();
  const firms = activeFirms(d).filter(
      (f) => !departmentId || f.departmentId === departmentId,
    ),
    tasks = scopedTasks(d, departmentId),
    open = tasks.filter((t) => t.status !== "Completed"),
    late = tasks.filter((t) => overdue(d, t));
  const ready = firms.filter(
    (f) => f.stage !== "relationship" && handoffBlockers(d, f).length === 0,
  );
  const attention = firms.filter((f) => health(d, f).label !== "On track");
  const counts = stageCounts(d, departmentId),
    reviews = values(d.reviews)
      .filter(
        (r) => r.status === "Scheduled" && firms.some((f) => f.id === r.firmId),
      )
      .sort((a, b) => a.date.localeCompare(b.date));
  const priority = [...open]
    .sort(
      (a, b) =>
        ({ Urgent: 0, High: 1, Medium: 2, Low: 3 })[a.priority] -
          { Urgent: 0, High: 1, Medium: 2, Low: 3 }[b.priority] ||
        a.dueDate.localeCompare(b.dueDate),
    )
    .slice(0, 5);
  const milestones = values(d.milestones)
    .filter(
      (m) =>
        m.status !== "Completed" &&
        (!departmentId ||
          d.firms[d.projects[m.projectId].firmId ?? ""]?.departmentId ===
            departmentId),
    )
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(0, 3);
  const weekly = Array.from(
    { length: 7 },
    (_, i) =>
      tasks.filter((t) => t.dueDate === shiftDate(d.settings.demoDate, i - 3))
        .length,
  );
  const metrics = [
    {
      title: "Active firm partners",
      value: firms.length,
      sub: `${firms.filter((f) => f.stage === "relationship").length} in relationship management`,
      icon: Building2,
      color: "#358c80",
      href: "/firms",
      bars: counts.map((c) => c.value),
      tone: "teal",
    },
    {
      title: "Open tasks",
      value: open.length,
      sub: `${tasks.filter((t) => dueThisWeek(d, t)).length} due in the next 7 days`,
      icon: ListTodo,
      color: "#7690b9",
      href: "/tasks?status=open",
      bars: weekly,
      tone: "blue",
    },
    {
      title: "Overdue tasks",
      value: late.length,
      sub: "A little attention goes a long way",
      icon: Clock3,
      color: "#c88b48",
      href: "/tasks?overdue=true",
      bars: Array.from(
        { length: 7 },
        (_, i) =>
          late.filter((t) => t.dueDate <= shiftDate(d.settings.demoDate, i - 7))
            .length,
      ),
      tone: "amber",
    },
    {
      title: "Ready for handoff",
      value: ready.length,
      sub: "Requirements complete. Next chapter ready.",
      icon: CheckCircle2,
      color: "#789684",
      href: "/pipeline?ready=true",
      bars: counts.map((c) => ready.filter((f) => f.stage === c.stage).length),
      tone: "green",
    },
  ];
  return (
    <>
      <PageHeading
        title="Command Center"
        description="Your people, your priorities, your partnerships. All in one place."
        actions={
          <>
            <div className="date-pill">
              <CalendarDays size={15} />
              {prettyDate(d.settings.demoDate, "EEEE, MMM d")}
              <Badge>Demo date</Badge>
            </div>
            <Button
              onClick={() => editor({ type: "task" })}
              disabled={!canWrite(d)}
            >
              <Plus size={16} />
              Create task
            </Button>
          </>
        }
      />
      <section className="welcome-banner">
        <div className="welcome-copy">
          <span className="welcome-eyebrow">
            <i />
            YOUR HOME OFFICE, CONNECTED
          </span>
          <h2>
            Good {new Date().getHours() < 12 ? "morning" : "afternoon"},{" "}
            {u.name.split(" ")[0]}.<br />
            Let’s move good partnerships forward.
          </h2>
          <p>
            {ready.length
              ? `${ready.length} ${ready.length === 1 ? "firm is" : "firms are"} ready for the next stage.`
              : "Every partnership starts with a clear next step."}{" "}
            {attention.length} partners could use your attention today.
          </p>
          <Link href="/pipeline">
            Explore your pipeline
            <ArrowRight size={16} />
          </Link>
        </div>
        <div className="welcome-visual" aria-hidden="true">
          <div className="orbital orbit-one" />
          <div className="orbital orbit-two" />
          <div className="orbit-line" />
          <div className="orbit-node node-one">
            <Building2 size={21} />
          </div>
          <div className="orbit-node node-two">
            <Check size={19} />
          </div>
          <div className="orbit-node node-three">
            <UsersIcon />
          </div>
          <div className="orbit-center">
            <svg viewBox="0 0 50 50">
              <path
                d="M25 5 46 45H35L25 24 15 45H4L25 5Z"
                fill="currentColor"
              />
              <path d="m25 35 5 10H20l5-10Z" fill="#87b7a9" />
            </svg>
          </div>
          <span className="visual-label">One team. Every stage.</span>
        </div>
      </section>
      <div className="personal-focus">
        <span>
          <Avatar name={u.name} small />
          Your focus
        </span>
        <Link href="/tasks?view=my&overdue=true">
          <strong>
            {tasks.filter((t) => t.assigneeId === u.id && overdue(d, t)).length}
          </strong>{" "}
          my overdue tasks
          <ChevronRight size={12} />
        </Link>
        <Link href="/tasks?view=my&due=today">
          <strong>
            {
              tasks.filter(
                (t) =>
                  t.assigneeId === u.id &&
                  t.status !== "Completed" &&
                  t.dueDate === d.settings.demoDate,
              ).length
            }
          </strong>{" "}
          due today
          <ChevronRight size={12} />
        </Link>
        <Link href="/tasks?view=my&due=week">
          <strong>
            {
              tasks.filter((t) => t.assigneeId === u.id && dueThisWeek(d, t))
                .length
            }
          </strong>{" "}
          due this week
          <ChevronRight size={12} />
        </Link>
      </div>
      <div className="metrics-grid">
        {metrics.map((m) => (
          <Link href={m.href} key={m.title} className="metric-card">
            <div className="metric-top">
              <span>{m.title}</span>
              <div className={`metric-icon icon-${m.tone}`}>
                <m.icon size={17} />
              </div>
            </div>
            <div className="metric-value">
              <strong>{m.value}</strong>
              <MiniBars values={m.bars} color={m.color} />
            </div>
            <div className="metric-bottom">
              <span>{m.sub}</span>
              <ArrowUpRight size={14} />
            </div>
          </Link>
        ))}
      </div>
      <section className="panel lifecycle-overview">
        <SectionHeading
          title="The partnership journey"
          sub="A shared view, from first conversation to lasting relationship."
          action={<ViewLink href="/pipeline">View pipeline</ViewLink>}
        />
        <div className="stage-overview">
          {counts.map((c, i) => {
            const onTrack = firms.filter(
              (f) => f.stage === c.stage && health(d, f).label === "On track",
            ).length;
            return (
              <Link
                href={`/firms?stage=${c.stage}`}
                className="stage-overview-item"
                key={c.stage}
                style={
                  {
                    "--stage-color": stageColor[c.stage],
                  } as React.CSSProperties
                }
              >
                <div className="stage-overview-title">
                  <span className="stage-number">0{i + 1}</span>
                  <span>{c.name}</span>
                  {i < 4 && <ChevronRight size={15} />}
                </div>
                <div className="stage-total">
                  <strong>{c.value}</strong>
                  <span>firm{c.value !== 1 ? "s" : ""}</span>
                </div>
                <div className="stage-track">
                  <span
                    style={{ width: `${(c.value / firms.length) * 100 || 0}%` }}
                  />
                </div>
                <p>
                  <i />
                  {onTrack} on track
                  <span>
                    {c.value - onTrack > 0
                      ? `${c.value - onTrack} need attention`
                      : "Looking good"}
                  </span>
                </p>
              </Link>
            );
          })}
        </div>
      </section>
      <div className="dashboard-main-grid">
        <section className="panel priority-panel">
          <SectionHeading
            title="Work that moves things forward"
            sub={`${late.length} overdue · ${tasks.filter((t) => t.status !== "Completed" && t.dueDate === d.settings.demoDate).length} due today · ${tasks.filter((t) => dueThisWeek(d, t)).length} due this week`}
            action={<ViewLink href="/tasks">All tasks</ViewLink>}
          />
          <div className="table-scroll">
            <table className="data-table dashboard-table">
              <thead>
                <tr>
                  <th>Task / firm partner</th>
                  <th>Assigned to</th>
                  <th>Due date</th>
                  <th>Priority</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {priority.map((t) => (
                  <tr key={t.id}>
                    <td>
                      <button
                        className="task-title-button"
                        onClick={() => editor({ type: "task", id: t.id })}
                      >
                        <span className="task-circle" />
                        <span>
                          <strong>{t.title}</strong>
                          <small>
                            {t.firmId
                              ? d.firms[t.firmId]?.name
                              : "Internal coordination"}
                          </small>
                        </span>
                      </button>
                    </td>
                    <td>
                      <Person id={t.assigneeId} d={d} compact />
                    </td>
                    <td>
                      <span className={overdue(d, t) ? "due-overdue" : "muted"}>
                        {prettyDate(t.dueDate, "MMM d")}
                        {overdue(d, t) && <small>Overdue</small>}
                      </span>
                    </td>
                    <td>
                      <Badge
                        tone={
                          t.priority === "High" || t.priority === "Urgent"
                            ? "amber"
                            : "neutral"
                        }
                      >
                        {t.priority}
                      </Badge>
                    </td>
                    <td>
                      <button
                        className="icon-action"
                        aria-label={`Open ${t.title}`}
                        onClick={() => editor({ type: "task", id: t.id })}
                      >
                        <ChevronRight size={16} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!priority.length && (
              <Empty
                title="A clear slate"
                description="No open tasks in this department."
              />
            )}
          </div>
        </section>
        <section className="panel handoff-panel">
          <SectionHeading
            title="Ready for the next chapter"
            action={
              <div className="section-icon">
                <ArrowUpRight size={18} />
              </div>
            }
          />
          <p className="panel-intro">
            A completed checklist. A confident handoff.
          </p>
          {ready.length ? (
            ready.slice(0, 3).map((f) => (
              <Link
                href={`/firms/detail?id=${f.id}&tab=checklist`}
                className="handoff-item"
                key={f.id}
              >
                <div className="firm-monogram">{f.name[0]}</div>
                <div>
                  <strong>{f.name}</strong>
                  <span>
                    {d.settings.stageLabels[f.stage]} <ArrowRight size={12} />{" "}
                    {
                      d.settings.stageLabels[
                        (
                          [
                            "prospect",
                            "onboarding",
                            "implementation",
                            "training",
                            "relationship",
                          ] as const
                        )[
                          (
                            [
                              "prospect",
                              "onboarding",
                              "implementation",
                              "training",
                              "relationship",
                            ] as const
                          ).indexOf(f.stage) + 1
                        ]
                      ]
                    }
                  </span>
                  <small>
                    <CheckCircle2 size={12} />
                    All required steps complete
                  </small>
                </div>
                <ChevronRight size={16} />
              </Link>
            ))
          ) : (
            <div className="handoff-empty">
              <CheckCircle2 size={25} />
              <p>
                Handoffs appear here when all mandatory requirements are
                complete.
              </p>
            </div>
          )}
          <div className="handoff-note">
            <ShieldIcon />
            <span>Every handoff includes an approval and a clear owner.</span>
          </div>
        </section>
      </div>
      <div className="dashboard-bottom-grid">
        <section className="panel">
          <SectionHeading
            title="A little extra attention"
            sub="Spot the blockers. Keep the momentum."
            action={
              <ViewLink href="/firms?health=attention">View all</ViewLink>
            }
          />
          <div className="attention-list">
            {attention.slice(0, 3).map((f) => (
              <Link key={f.id} href={`/firms/detail?id=${f.id}`}>
                <div className="attention-icon">
                  <CircleAlert size={17} />
                </div>
                <div>
                  <strong>{f.name}</strong>
                  <p>{health(d, f).reason}</p>
                </div>
                <StageBadge stage={f.stage} />
                <ChevronRight size={15} />
              </Link>
            ))}
          </div>
        </section>
        <section className="panel">
          <SectionHeading
            title="Keep the connection"
            sub="Your next relationship conversations."
            action={
              <ViewLink href="/reports?tab=reviews">All reviews</ViewLink>
            }
          />
          <div className="review-list">
            {reviews.slice(0, 3).map((r) => (
              <button
                key={r.id}
                onClick={() =>
                  editor({ type: "review", id: r.id, firmId: r.firmId })
                }
              >
                <div className="date-tile">
                  <span>{prettyDate(r.date, "MMM")}</span>
                  <strong>{prettyDate(r.date, "dd")}</strong>
                </div>
                <div>
                  <strong>{d.firms[r.firmId]?.name}</strong>
                  <p>{r.type}</p>
                </div>
                <Avatar name={d.users[r.ownerId]?.name ?? ""} small />
                <ChevronRight size={15} />
              </button>
            ))}
          </div>
        </section>
      </div>
      <div className="dashboard-bottom-grid">
        <section className="panel">
          <SectionHeading
            title="Department pulse"
            sub="Open work across the home office."
            action={<ViewLink href="/workload">Workload</ViewLink>}
          />
          <div className="department-pulse">
            {values(d.departments)
              .filter((dep) => !departmentId || dep.id === departmentId)
              .slice(0, 5)
              .map((dep) => {
                const count = open.filter(
                  (t) => t.departmentId === dep.id,
                ).length;
                return (
                  <Link href={`/tasks?department=${dep.id}`} key={dep.id}>
                    <span>{dep.name}</span>
                    <div>
                      <i
                        style={{
                          width: `${Math.min(100, (count / Math.max(1, open.length)) * 260)}%`,
                        }}
                      />
                    </div>
                    <strong>{count}</strong>
                  </Link>
                );
              })}
          </div>
        </section>
        <section className="panel">
          <SectionHeading
            title="Milestones on the horizon"
            action={<ViewLink href="/projects">All projects</ViewLink>}
          />
          <div className="milestone-preview">
            {milestones.map((m) => (
              <Link key={m.id} href={`/projects/detail?id=${m.projectId}`}>
                <span className="milestone-icon">
                  <Flag size={16} />
                </span>
                <div>
                  <strong>{m.name}</strong>
                  <p>{d.projects[m.projectId]?.name}</p>
                </div>
                <Badge
                  tone={m.date < d.settings.demoDate ? "amber" : "neutral"}
                >
                  {prettyDate(m.date, "MMM d")}
                </Badge>
              </Link>
            ))}
          </div>
        </section>
      </div>
    </>
  );
}
function UsersIcon() {
  return (
    <svg
      width="21"
      height="21"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
    >
      <circle cx="9" cy="8" r="3" />
      <path d="M3 21v-3a6 6 0 0 1 12 0v3M16 5a3 3 0 0 1 0 6M17 15a5 5 0 0 1 4 6" />
    </svg>
  );
}
function ShieldIcon() {
  return <CheckCircle2 size={17} />;
}
