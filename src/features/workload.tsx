"use client";
import Link from "next/link";
import { useState } from "react";
import { ColumnDef } from "@tanstack/react-table";
import { ArrowUpRight, Download, UsersRound } from "lucide-react";
import { useApp, useData } from "@/lib/store";
import { actor, canWorkload } from "@/lib/permissions";
import { dueThisWeek, overdue, scopedTasks, values } from "@/lib/selectors";
import { exportCSV } from "@/lib/csv";
import {
  Avatar,
  Badge,
  DataTable,
  Empty,
  PageHeading,
  TextSearch,
} from "@/components/common";
import { Button } from "@/components/ui/button";
export function Workload() {
  const d = useData(),
    u = actor(d),
    globalDep = useApp((s) => s.departmentId);
  const [query, setQuery] = useState("");
  if (!canWorkload(d))
    return (
      <Empty
        title="A view for team leaders"
        description="Team Workload is available to Admin and Manager personas. Managers see their own department."
      />
    );
  const dep = u.role === "Manager" ? u.departmentId : globalDep;
  const tasks = scopedTasks(d, dep),
    employees = values(d.users).filter(
      (u) =>
        u.active &&
        (!dep || u.departmentId === dep) &&
        u.name.toLowerCase().includes(query.toLowerCase()),
    );
  const rows = employees.map((u) => {
    const mine = tasks.filter((t) => t.assigneeId === u.id);
    return {
      id: u.id,
      name: u.name,
      department: d.departments[u.departmentId].name,
      role: u.role,
      open: mine.filter((t) => t.status !== "Completed").length,
      overdue: mine.filter((t) => overdue(d, t)).length,
      week: mine.filter((t) => dueThisWeek(d, t)).length,
      completed: mine.filter((t) => t.status === "Completed").length,
    };
  });
  type Row = (typeof rows)[number];
  const columns: ColumnDef<Row>[] = [
    {
      accessorKey: "name",
      header: "Employee",
      cell: ({ row }) => (
        <span className="table-person">
          <Avatar name={row.original.name} />
          <span>
            <strong>{row.original.name}</strong>
            <small>{row.original.role}</small>
          </span>
        </span>
      ),
    },
    { accessorKey: "department", header: "Department" },
    {
      accessorKey: "open",
      header: "Open tasks",
      cell: ({ getValue }) => <strong>{getValue<number>()}</strong>,
    },
    {
      accessorKey: "overdue",
      header: "Overdue",
      cell: ({ getValue }) => (
        <Badge tone={getValue<number>() ? "amber" : "green"}>
          {getValue<number>()}
        </Badge>
      ),
    },
    { accessorKey: "week", header: "Due this week" },
    { accessorKey: "completed", header: "Completed" },
    {
      id: "load",
      header: "Assignment distribution",
      cell: ({ row }) => (
        <div className="workload-bar">
          <span
            style={{
              width: `${Math.min(100, (row.original.open / Math.max(1, ...rows.map((r) => r.open))) * 100)}%`,
            }}
          />
        </div>
      ),
    },
    {
      id: "actions",
      header: "",
      cell: ({ row }) => (
        <Link href={`/tasks?assignee=${row.original.id}`} className="view-link">
          Manage tasks
          <ArrowUpRight size={14} />
        </Link>
      ),
    },
  ];
  return (
    <>
      <PageHeading
        title="Team Workload"
        description={
          u.role === "Manager"
            ? `A clear view of ${d.departments[u.departmentId].name} ownership and priorities.`
            : "Bring the right people to the work that matters."
        }
        actions={
          <Button
            variant="secondary"
            onClick={() => exportCSV("arkadios-workload.csv", rows)}
          >
            <Download size={16} />
            Export workload
          </Button>
        }
      />
      <div className="report-kpis">
        <div>
          <span>Active employees in scope</span>
          <strong>{employees.length}</strong>
          <small>Internal accounts only</small>
        </div>
        <div>
          <span>Open work</span>
          <strong>
            {tasks.filter((t) => t.status !== "Completed").length}
          </strong>
          <small>Across this scope</small>
        </div>
        <div>
          <span>Overdue tasks</span>
          <strong>{tasks.filter((t) => overdue(d, t)).length}</strong>
          <small>Needs a clear next step</small>
        </div>
        <div>
          <span>Unassigned work</span>
          <strong>
            {
              tasks.filter((t) => !t.assigneeId && t.status !== "Completed")
                .length
            }
          </strong>
          <Link
            href={`/tasks?view=unassigned${dep ? `&department=${dep}` : ""}`}
          >
            Assign from the department queue →
          </Link>
        </div>
      </div>
      <section className="panel">
        <div className="table-toolbar">
          <TextSearch
            value={query}
            onChange={setQuery}
            placeholder="Find an employee…"
          />
          <Badge tone="blue">
            {dep ? d.departments[dep].name : "Organization-wide"}
          </Badge>
        </div>
        <DataTable preferenceKey="workload" data={rows} columns={columns} />
      </section>
      <div className="notice">
        <UsersRound size={19} />
        <span>
          Bars compare open task counts within this view. They show assignment
          distribution, not employee capacity or performance.
        </span>
      </div>
    </>
  );
}
