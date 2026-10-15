"use client";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useState } from "react";
import {
  ArrowUpRight,
  Calendar,
  CheckCircle2,
  Flag,
  FolderKanban,
  Plus,
} from "lucide-react";
import { toast } from "sonner";
import { useApp, useData } from "@/lib/store";
import { Project } from "@/lib/model";
import { progress, values } from "@/lib/selectors";
import { canEditFirm, canWrite } from "@/lib/permissions";
import { prettyDate } from "@/lib/dates";
import {
  Badge,
  Empty,
  FirmLink,
  PageHeading,
  Person,
  Progress,
  SectionHeading,
  TextSearch,
} from "@/components/common";
import { useEditor } from "@/components/editors";
import { Button } from "@/components/ui/button";
import { Tasks } from "./tasks";
export function ProjectCard({ project: p }: { project: Project }) {
  const d = useData();
  const tasks = p.taskIds.map((id) => d.tasks[id]);
  const late = p.targetDate < d.settings.demoDate && p.status !== "Completed";
  return (
    <Link className="project-card" href={`/projects/detail?id=${p.id}`}>
      <div className="project-card-top">
        <div className="project-icon">
          <FolderKanban size={22} />
        </div>
        <Badge
          tone={
            p.status === "Completed"
              ? "green"
              : p.status === "On hold"
                ? "amber"
                : "blue"
          }
        >
          {p.status}
        </Badge>
        <ArrowUpRight size={16} />
      </div>
      <span className="eyebrow">{p.type} PROJECT</span>
      <h3>{p.name}</h3>
      <p>{p.firmId ? d.firms[p.firmId]?.name : "Home office coordination"}</p>
      <div className="project-progress-label">
        <span>Task progress</span>
        <span>
          {tasks.filter((t) => t.status === "Completed").length} /{" "}
          {tasks.length}
        </span>
      </div>
      <Progress value={progress(tasks)} />
      <div className="project-card-footer">
        <Person id={p.ownerId} d={d} compact />
        <span className={late ? "due-overdue" : ""}>
          <Calendar size={13} />
          {prettyDate(p.targetDate, "MMM d")}
          {late && " · Delayed"}
        </span>
      </div>
    </Link>
  );
}
export function Projects({ firmId }: { firmId?: string }) {
  const d = useData(),
    editor = useEditor(),
    department = useApp((s) => s.departmentId);
  const [query, setQuery] = useState(""),
    [status, setStatus] = useState(""),
    [type, setType] = useState("");
  const projects = values(d.projects).filter(
    (p) =>
      (!firmId || p.firmId === firmId) &&
      (!department || d.users[p.ownerId]?.departmentId === department) &&
      (!status || p.status === status) &&
      (!type || p.type === type) &&
      p.name.toLowerCase().includes(query.toLowerCase()),
  );
  return (
    <>
      <PageHeading
        title={firmId ? "Firm projects" : "Projects"}
        description="Bring people, milestones, and delivery into focus."
        actions={
          <Button
            disabled={!canWrite(d)}
            onClick={() => editor({ type: "project", firmId })}
          >
            <Plus size={16} />
            New project
          </Button>
        }
      />
      <div className="project-summary">
        <div>
          <strong>
            {projects.filter((p) => p.status === "Active").length}
          </strong>
          <span>Active projects</span>
        </div>
        <div>
          <strong>
            {
              projects.filter(
                (p) =>
                  p.targetDate < d.settings.demoDate &&
                  p.status !== "Completed",
              ).length
            }
          </strong>
          <span>Past target date</span>
        </div>
        <div>
          <strong>
            {projects.filter((p) => p.status === "Completed").length}
          </strong>
          <span>Completed</span>
        </div>
        <p>
          <Flag size={19} />A shared plan turns a handoff into forward momentum.
        </p>
      </div>
      <div className="table-toolbar standalone-toolbar">
        <TextSearch
          value={query}
          onChange={setQuery}
          placeholder="Search projects…"
        />
        <div className="toolbar-filters">
          <select
            aria-label="Project type"
            value={type}
            onChange={(e) => setType(e.target.value)}
          >
            <option value="">All project types</option>
            {["Implementation", "Training", "Internal"].map((s) => (
              <option key={s}>{s}</option>
            ))}
          </select>
          <select
            aria-label="Project status"
            value={status}
            onChange={(e) => setStatus(e.target.value)}
          >
            <option value="">All statuses</option>
            {["Planning", "Active", "On hold", "Completed"].map((s) => (
              <option key={s}>{s}</option>
            ))}
          </select>
        </div>
      </div>
      <div className="projects-grid">
        {projects.map((p) => (
          <ProjectCard project={p} key={p.id} />
        ))}
      </div>
      {!projects.length && (
        <Empty
          title="Make room for the next big step"
          description="Create a project, or approve a firm’s Implementation handoff to generate one automatically."
        />
      )}
    </>
  );
}
export function ProjectDetail() {
  const d = useData(),
    params = useSearchParams(),
    editor = useEditor(),
    run = useApp((s) => s.run);
  const p = d.projects[params.get("id") ?? ""];
  if (!p)
    return (
      <Empty
        title="Project not found"
        action={
          <Button asChild>
            <Link href="/projects">Back to projects</Link>
          </Button>
        }
      />
    );
  const tasks = p.taskIds.map((id) => d.tasks[id]),
    allowed = p.firmId ? canEditFirm(d, d.firms[p.firmId]) : canWrite(d);
  return (
    <>
      <Link href="/projects" className="back-link">
        ← Projects
      </Link>
      <PageHeading
        eyebrow={`${p.type.toUpperCase()} PROJECT`}
        title={p.name}
        description={p.notes}
        actions={
          <>
            <Badge tone="blue">{p.status}</Badge>
            <Button
              variant="secondary"
              disabled={!allowed}
              onClick={() => editor({ type: "project", id: p.id })}
            >
              Edit project
            </Button>
          </>
        }
      />
      <div className="project-detail-meta panel">
        <div>
          <span>Firm partner</span>
          <FirmLink id={p.firmId} />
        </div>
        <div>
          <span>Project owner</span>
          <Person id={p.ownerId} d={d} />
        </div>
        <div>
          <span>Start date</span>
          <strong>{prettyDate(p.startDate)}</strong>
        </div>
        <div>
          <span>Target date</span>
          <strong
            className={
              p.targetDate < d.settings.demoDate && p.status !== "Completed"
                ? "due-overdue"
                : ""
            }
          >
            {prettyDate(p.targetDate)}
          </strong>
        </div>
        <div>
          <span>Task progress</span>
          <Progress value={progress(tasks)} />
        </div>
      </div>
      <section className="panel">
        <SectionHeading
          title="A clear path to delivery"
          sub="Milestone dates and status can be adjusted as the plan evolves."
        />
        <div className="milestone-list">
          {p.milestoneIds.map((id, i) => {
            const m = d.milestones[id];
            return (
              <div key={id}>
                <span
                  className={`milestone-step ${m.status === "Completed" ? "complete" : ""}`}
                >
                  {m.status === "Completed" ? (
                    <CheckCircle2 size={21} />
                  ) : (
                    i + 1
                  )}
                </span>
                <strong>{m.name}</strong>
                <label>
                  <span className="sr-only">{m.name} date</span>
                  <input
                    type="date"
                    value={m.date}
                    disabled={!allowed}
                    onChange={(e) => {
                      try {
                        run({
                          type: "milestone.save",
                          id,
                          status: m.status,
                          date: e.target.value,
                        });
                      } catch (err) {
                        toast.error(String(err));
                      }
                    }}
                  />
                </label>
                <select
                  aria-label={`${m.name} status`}
                  value={m.status}
                  disabled={!allowed}
                  onChange={(e) =>
                    run({
                      type: "milestone.save",
                      id,
                      status: e.target.value as
                        "Upcoming" | "In progress" | "Completed",
                      date: m.date,
                    })
                  }
                >
                  {["Upcoming", "In progress", "Completed"].map((s) => (
                    <option key={s}>{s}</option>
                  ))}
                </select>
                {m.date < d.settings.demoDate && m.status !== "Completed" && (
                  <Badge tone="amber">Delayed</Badge>
                )}
              </div>
            );
          })}
        </div>
        {!p.milestoneIds.length && (
          <div className="panel-padding muted">
            No milestones configured. Project templates create a delivery review
            milestone.
          </div>
        )}
      </section>
      <Tasks projectId={p.id} firmId={p.firmId} />
      <section className="panel">
        <SectionHeading title="Project activity" />
        {values(d.activities)
          .filter(
            (a) =>
              a.firmId === (p.firmId ?? "") &&
              (a.label.toLowerCase().includes("project") ||
                a.label.includes("milestone")),
          )
          .slice(-10)
          .reverse()
          .map((a) => (
            <p className="activity-line" key={a.id}>
              <span>{a.label}</span>
              <small>{prettyDate(a.at)}</small>
            </p>
          ))}
      </section>
    </>
  );
}
