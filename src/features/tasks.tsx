"use client";
import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { ColumnDef } from "@tanstack/react-table";
import { CheckCircle2, Download, Plus, UserRoundPlus } from "lucide-react";
import { toast } from "sonner";
import { Task, statuses } from "@/lib/model";
import { useApp, useData } from "@/lib/store";
import { actor, canEditTask, canWrite } from "@/lib/permissions";
import { overdue, scopedTasks, values } from "@/lib/selectors";
import { prettyDate, shiftDate } from "@/lib/dates";
import { exportCSV } from "@/lib/csv";
import {
  Badge,
  DataTable,
  FirmLink,
  PageHeading,
  Person,
  TextSearch,
} from "@/components/common";
import { Button } from "@/components/ui/button";
import { useEditor } from "@/components/editors";
export function Tasks({
  firmId,
  projectId,
}: {
  firmId?: string;
  projectId?: string;
}) {
  const d = useData(),
    u = actor(d),
    editor = useEditor(),
    params = useSearchParams(),
    run = useApp((s) => s.run),
    globalDepartment = useApp((s) => s.departmentId);
  const [view, setView] = useState(params.get("view") ?? "organization"),
    [query, setQuery] = useState(params.get("q") ?? ""),
    [status, setStatus] = useState(params.get("status") ?? ""),
    [late, setLate] = useState(params.get("overdue") === "true"),
    [department, setDepartment] = useState(params.get("department") ?? ""),
    [selected, setSelected] = useState<string[]>([]),
    [bulkAssignee, setBulkAssignee] = useState("");
  const taskId = params.get("task");
  const opened = useRef("");
  useEffect(() => {
    if (taskId && d.tasks[taskId] && opened.current !== taskId) {
      opened.current = taskId;
      editor({ type: "task", id: taskId });
    }
  }, [taskId, editor, d.tasks]);
  const tasks = scopedTasks(d, globalDepartment).filter(
    (t) =>
      (!firmId || t.firmId === firmId) &&
      (!projectId || t.projectId === projectId) &&
      (!params.get("assignee") || t.assigneeId === params.get("assignee")) &&
      (!department || t.departmentId === department) &&
      (!late || overdue(d, t)) &&
      (!params.get("due") ||
        (params.get("due") === "today"
          ? t.status !== "Completed" && t.dueDate === d.settings.demoDate
          : t.status !== "Completed" &&
            t.dueDate >= d.settings.demoDate &&
            t.dueDate <= shiftDate(d.settings.demoDate, 7))) &&
      (!status ||
        (status === "open" ? t.status !== "Completed" : t.status === status)) &&
      (view === "organization" ||
        (view === "my" && t.assigneeId === u.id) ||
        (view === "department" && t.departmentId === u.departmentId) ||
        (view === "unassigned" && !t.assigneeId)) &&
      `${t.title} ${t.firmId ? d.firms[t.firmId]?.name : ""}`
        .toLowerCase()
        .includes(query.toLowerCase()),
  );
  const columns: ColumnDef<Task>[] = [
    {
      id: "select",
      header: () => (
        <input
          type="checkbox"
          aria-label="Select all editable filtered tasks"
          checked={
            !!tasks.filter((t) => canEditTask(d, t)).length &&
            tasks
              .filter((t) => canEditTask(d, t))
              .every((t) => selected.includes(t.id))
          }
          onChange={(e) =>
            setSelected(
              e.target.checked
                ? tasks.filter((t) => canEditTask(d, t)).map((t) => t.id)
                : [],
            )
          }
        />
      ),
      cell: ({ row }) => (
        <input
          type="checkbox"
          aria-label={`Select ${row.original.title}`}
          disabled={!canEditTask(d, row.original)}
          checked={selected.includes(row.original.id)}
          onChange={(e) =>
            setSelected(
              e.target.checked
                ? [...selected, row.original.id]
                : selected.filter((id) => id !== row.original.id),
            )
          }
        />
      ),
    },
    {
      accessorKey: "title",
      header: "Task",
      cell: ({ row }) => (
        <button
          className="task-title-button"
          onClick={() => editor({ type: "task", id: row.original.id })}
        >
          <span
            className={`task-check ${row.original.status === "Completed" ? "complete" : ""}`}
          >
            {row.original.status === "Completed" && <CheckCircle2 size={16} />}
          </span>
          <span>
            <strong>{row.original.title}</strong>
            <small>
              {row.original.instanceId
                ? "SOP requirement"
                : "Coordination task"}{" "}
              · {row.original.evidence}
            </small>
          </span>
        </button>
      ),
    },
    {
      id: "firm",
      header: "Firm partner",
      accessorFn: (t) => d.firms[t.firmId ?? ""]?.name,
      cell: ({ row }) => <FirmLink id={row.original.firmId} />,
    },
    {
      accessorKey: "status",
      header: "Status",
      cell: ({ row }) => (
        <Badge
          tone={
            row.original.status === "Completed"
              ? "green"
              : row.original.status === "Blocked"
                ? "red"
                : row.original.status === "In progress"
                  ? "blue"
                  : "neutral"
          }
        >
          {row.original.status}
        </Badge>
      ),
    },
    {
      accessorKey: "priority",
      header: "Priority",
      cell: ({ getValue }) => (
        <Badge
          tone={
            ["High", "Urgent"].includes(getValue<string>())
              ? "amber"
              : "neutral"
          }
        >
          {getValue<string>()}
        </Badge>
      ),
    },
    {
      accessorKey: "dueDate",
      header: "Due date",
      cell: ({ row }) => (
        <span className={overdue(d, row.original) ? "due-overdue" : ""}>
          {prettyDate(row.original.dueDate, "MMM d, yyyy")}
          {overdue(d, row.original) && (
            <small className="cell-sub">Overdue</small>
          )}
        </span>
      ),
    },
    {
      id: "assignee",
      header: "Assignee",
      accessorFn: (t) => d.users[t.assigneeId]?.name ?? "Unassigned",
      cell: ({ row }) => <Person d={d} id={row.original.assigneeId} />,
    },
    {
      id: "department",
      header: "Department",
      accessorFn: (t) => d.departments[t.departmentId]?.name,
    },
    {
      id: "actions",
      header: "",
      cell: ({ row }) => (
        <Button
          variant="ghost"
          size="sm"
          disabled={!canEditTask(d, row.original)}
          onClick={() => editor({ type: "task", id: row.original.id })}
        >
          Update
        </Button>
      ),
    },
  ];
  return (
    <>
      <PageHeading
        title={projectId ? "Project tasks" : firmId ? "Firm tasks" : "Tasks"}
        description="Clear ownership. Meaningful progress. Nothing lost between teams."
        actions={
          <>
            <Button
              variant="secondary"
              onClick={() =>
                exportCSV(
                  "arkadios-tasks.csv",
                  tasks.map((t) => ({
                    Title: t.title,
                    Firm: d.firms[t.firmId ?? ""]?.name ?? "",
                    Status: t.status,
                    Priority: t.priority,
                    Due: t.dueDate,
                    Assignee: d.users[t.assigneeId]?.name ?? "Unassigned",
                    Department: d.departments[t.departmentId].name,
                  })),
                )
              }
            >
              <Download size={15} />
              Export
            </Button>
            <Button
              disabled={!canWrite(d)}
              onClick={() => editor({ type: "task", firmId, projectId })}
            >
              <Plus size={16} />
              Create task
            </Button>
          </>
        }
      />
      <section className="panel">
        <div className="directory-tabs">
          {[
            { id: "my", label: "My tasks" },
            { id: "department", label: "My department" },
            { id: "organization", label: "Organization" },
            { id: "unassigned", label: "Unassigned" },
          ].map((v) => (
            <button
              key={v.id}
              className={view === v.id ? "selected" : ""}
              onClick={() => {
                setView(v.id);
                setSelected([]);
              }}
            >
              {v.label}
              {v.id === "my" && (
                <Badge>
                  {
                    scopedTasks(d).filter(
                      (t) => t.assigneeId === u.id && t.status !== "Completed",
                    ).length
                  }
                </Badge>
              )}
            </button>
          ))}
        </div>
        <div className="table-toolbar">
          <TextSearch
            value={query}
            onChange={setQuery}
            placeholder="Search tasks or firm partners…"
          />
          <div className="toolbar-filters">
            <select
              aria-label="Task status"
              value={status}
              onChange={(e) => setStatus(e.target.value)}
            >
              <option value="">All statuses</option>
              <option value="open">Open tasks</option>
              {statuses.map((s) => (
                <option key={s}>{s}</option>
              ))}
            </select>
            <select
              aria-label="Task department"
              value={department}
              onChange={(e) => setDepartment(e.target.value)}
            >
              <option value="">All departments</option>
              {values(d.departments).map((dep) => (
                <option key={dep.id} value={dep.id}>
                  {dep.name}
                </option>
              ))}
            </select>
            <label className="check-label">
              <input
                type="checkbox"
                checked={late}
                onChange={(e) => setLate(e.target.checked)}
              />
              Overdue only
            </label>
          </div>
        </div>
        {selected.length > 0 && (
          <div className="bulk-toolbar">
            <strong>{selected.length} selected</strong>
            <select
              aria-label="Bulk assignee"
              value={bulkAssignee}
              onChange={(e) => setBulkAssignee(e.target.value)}
            >
              <option value="">Department queue (unassigned)</option>
              {values(d.users)
                .filter((u) => u.active)
                .map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.name}
                  </option>
                ))}
            </select>
            <Button
              size="sm"
              onClick={() => {
                try {
                  run({
                    type: "task.bulk",
                    ids: selected,
                    assigneeId: bulkAssignee,
                  });
                  setSelected([]);
                  toast.success("Assignment updated.");
                } catch (e) {
                  toast.error(
                    e instanceof Error ? e.message : "Unable to assign.",
                  );
                }
              }}
            >
              <UserRoundPlus size={14} />
              Assign selected
            </Button>
          </div>
        )}
        <DataTable preferenceKey="tasks" data={tasks} columns={columns} />
      </section>
    </>
  );
}
