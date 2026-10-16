"use client";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { CalendarClock, Download, Plus, SlidersHorizontal } from "lucide-react";
import { toast } from "sonner";
import { useApp, useData } from "@/lib/store";
import { stages } from "@/lib/model";
import {
  activeFirms,
  overdue,
  stageAge,
  stageColor,
  stageCounts,
  values,
} from "@/lib/selectors";
import { canAdmin, canEditFirm, canWrite } from "@/lib/permissions";
import { dayDiff, prettyDate, shiftDate } from "@/lib/dates";
import { exportCSV } from "@/lib/csv";
import {
  Badge,
  Empty,
  PageHeading,
  Person,
  SectionHeading,
} from "@/components/common";
import { Button } from "@/components/ui/button";
import { useEditor } from "@/components/editors";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
export function Reports() {
  const d = useData(),
    router = useRouter(),
    params = useSearchParams(),
    editor = useEditor(),
    department = useApp((s) => s.departmentId);
  const [start, setStart] = useState(shiftDate(d.settings.demoDate, -180)),
    [end, setEnd] = useState(d.settings.demoDate),
    [tab, setTab] = useState(params.get("tab") ?? "overview");
  const firms = activeFirms(d).filter(
      (f) => !department || f.departmentId === department,
    ),
    ids = new Set(firms.map((f) => f.id));
  const counts = stageCounts(d, department);
  const history = values(d.history).filter(
    (h) => ids.has(h.firmId) && h.exited >= start && h.exited <= end,
  );
  const durations = stages
    .filter((s) => s !== "relationship")
    .map((s) => {
      const records = history.filter((h) => h.stage === s);
      return {
        name: d.settings.stageLabels[s],
        duration: records.length
          ? Math.round(
              (records.reduce((n, h) => n + dayDiff(h.exited, h.entered), 0) /
                records.length) *
                10,
            ) / 10
          : 0,
        target: records.length
          ? Math.round(
              (records.reduce((n, h) => n + h.targetDays, 0) / records.length) *
                10,
            ) / 10
          : 0,
        samples: records.length,
      };
    });
  const tasks = values(d.tasks).filter(
    (t) =>
      (!department || t.departmentId === department) &&
      t.dueDate >= start &&
      t.dueDate <= end &&
      (!t.firmId || !d.firms[t.firmId].archived),
  );
  const departments = values(d.departments)
    .filter((dep) => !department || dep.id === department)
    .map((dep) => ({
      name: dep.name,
      overdue: tasks.filter((t) => t.departmentId === dep.id && overdue(d, t))
        .length,
      departmentId: dep.id,
    }));
  const delayed = Object.entries(
    tasks
      .filter((t) => t.instanceId && overdue(d, t))
      .reduce<Record<string, number>>(
        (acc, t) => ({ ...acc, [t.title]: (acc[t.title] ?? 0) + 1 }),
        {},
      ),
  )
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([name, count]) => ({ name, count }));
  const reviews = values(d.reviews)
    .filter((r) => ids.has(r.firmId))
    .sort((a, b) => a.date.localeCompare(b.date));
  const months = Array.from({ length: 6 }, (_, i) => {
    const a = new Date(d.settings.demoDate + "T12:00:00");
    a.setMonth(a.getMonth() - 5 + i);
    const key = `${a.getFullYear()}-${String(a.getMonth() + 1).padStart(2, "0")}`;
    const rows = history.filter(
      (h) => h.stage === "onboarding" && h.exited.startsWith(key),
    );
    return {
      month: prettyDate(key + "-01", "MMM"),
      days: rows.length
        ? Math.round(
            (rows.reduce((n, h) => n + dayDiff(h.exited, h.entered), 0) /
              rows.length) *
              10,
          ) / 10
        : null,
      count: rows.length,
    };
  });
  const completedAverage = history.length
    ? Math.round(
        history.reduce((n, h) => n + dayDiff(h.exited, h.entered), 0) /
          history.length,
      )
    : 0;
  return (
    <>
      <PageHeading
        title="Reports"
        description="Understand the journey. Find the opportunities. Keep getting better."
        actions={
          <Button
            variant="secondary"
            onClick={() =>
              exportCSV("arkadios-report.csv", [
                ...durations.map((r) => ({
                  Metric: "Completed stage duration",
                  Group: r.name,
                  Value: r.duration,
                  Target: r.target,
                  Samples: r.samples,
                })),
                ...departments.map((r) => ({
                  Metric: "Overdue tasks",
                  Group: r.name,
                  Value: r.overdue,
                  Target: "",
                  Samples: "",
                })),
                ...counts.map((r) => ({
                  Metric: "Current firms",
                  Group: r.name,
                  Value: r.value,
                  Target: "",
                  Samples: "",
                })),
              ])
            }
          >
            <Download size={16} />
            Export report CSV
          </Button>
        }
      />
      <div className="report-filters panel">
        <span>
          <SlidersHorizontal size={16} />
          Reporting period
        </span>
        <label>
          From
          <input
            aria-label="Report start date"
            type="date"
            value={start}
            onChange={(e) => setStart(e.target.value)}
          />
        </label>
        <span>—</span>
        <label>
          To
          <input
            aria-label="Report end date"
            type="date"
            min={start}
            value={end}
            onChange={(e) => setEnd(e.target.value)}
          />
        </label>
        <Badge>
          Department scope:{" "}
          {department ? d.departments[department].name : "Organization"}
        </Badge>
      </div>
      {start > end && (
        <div className="notice">
          Choose an end date on or after the start date.
        </div>
      )}
      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="overview">Journey insights</TabsTrigger>
          <TabsTrigger value="reviews">
            Relationship reviews{" "}
            <Badge>
              {reviews.filter((r) => r.status === "Scheduled").length}
            </Badge>
          </TabsTrigger>
          <TabsTrigger value="delivery">Report delivery</TabsTrigger>
        </TabsList>
        <TabsContent value="overview">
          <div className="report-kpis">
            <div>
              <span>Completed stage transitions</span>
              <strong>{history.length}</strong>
              <small>Within reporting period</small>
            </div>
            <div>
              <span>Avg. completed stage duration</span>
              <strong>
                {completedAverage}
                <em> days</em>
              </strong>
              <small>Completed stages only</small>
            </div>
            <div>
              <span>Current active-stage age</span>
              <strong>
                {firms.length
                  ? Math.round(
                      firms.reduce((n, f) => n + stageAge(d, f), 0) /
                        firms.length,
                    )
                  : 0}
                <em> days</em>
              </strong>
              <small>Current snapshot · all lifecycle stages</small>
            </div>
            <div>
              <span>Overdue tasks in period</span>
              <strong>{tasks.filter((t) => overdue(d, t)).length}</strong>
              <small>Due in period, still incomplete</small>
            </div>
          </div>
          <div className="reports-grid">
            <section className="panel">
              <SectionHeading
                title="Where partnerships stand"
                sub="Current snapshot · click a stage to explore firms."
              />
              <div className="donut-layout">
                <div className="chart-container">
                  <ResponsiveContainer width="100%" height={235}>
                    <PieChart>
                      <Pie
                        data={counts}
                        innerRadius={65}
                        outerRadius={90}
                        dataKey="value"
                        paddingAngle={3}
                        stroke="none"
                        onClick={(_entry, index) => {
                          router.push(`/firms?stage=${counts[index].stage}`);
                        }}
                      >
                        {counts.map((c) => (
                          <Cell fill={stageColor[c.stage]} key={c.stage} />
                        ))}
                      </Pie>
                      <Tooltip
                        contentStyle={{
                          background: "var(--surface)",
                          border: "1px solid var(--border)",
                          borderRadius: 8,
                          fontSize: 12,
                        }}
                        labelStyle={{ color: "var(--text)" }}
                        itemStyle={{ color: "var(--text)" }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="donut-center">
                    <strong>{firms.length}</strong>
                    <span>firm partners</span>
                  </div>
                </div>
                <div className="chart-legend">
                  {counts.map((c) => (
                    <Link key={c.stage} href={`/firms?stage=${c.stage}`}>
                      <i style={{ background: stageColor[c.stage] }} />
                      <span>{c.name}</span>
                      <strong>{c.value}</strong>
                    </Link>
                  ))}
                </div>
              </div>
            </section>
            <section className="panel">
              <SectionHeading
                title="Stage duration vs. target"
                sub="Average days for completed stages in this period."
              />
              <div className="chart-padding">
                <ResponsiveContainer width="100%" height={245}>
                  <BarChart data={durations} barGap={3}>
                    <CartesianGrid vertical={false} stroke="var(--border)" />
                    <XAxis
                      dataKey="name"
                      axisLine={false}
                      tickLine={false}
                      tick={{ fontSize: 11, fill: "var(--muted)" }}
                    />
                    <YAxis
                      axisLine={false}
                      tickLine={false}
                      tick={{ fontSize: 11, fill: "var(--muted)" }}
                      unit="d"
                    />
                    <Tooltip
                      contentStyle={{
                        background: "var(--surface)",
                        border: "1px solid var(--border)",
                        borderRadius: 8,
                        fontSize: 12,
                      }}
                      labelStyle={{ color: "var(--text)" }}
                      itemStyle={{ color: "var(--text)" }}
                    />
                    <Legend wrapperStyle={{ fontSize: 12 }} />
                    <Bar
                      dataKey="duration"
                      name="Completed duration (days)"
                      fill="var(--chart-accent)"
                      radius={[3, 3, 0, 0]}
                      maxBarSize={27}
                    />
                    <Bar
                      dataKey="target"
                      name="Versioned target (days)"
                      fill="var(--chart-target)"
                      radius={[3, 3, 0, 0]}
                      maxBarSize={27}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </section>
            <section className="panel">
              <SectionHeading
                title="Onboarding, over time"
                sub="Average completed duration by exit month. Gaps mean no completed stages."
              />
              <div className="chart-padding">
                <ResponsiveContainer width="100%" height={240}>
                  <LineChart data={months}>
                    <CartesianGrid vertical={false} stroke="var(--border)" />
                    <XAxis
                      dataKey="month"
                      axisLine={false}
                      tickLine={false}
                      tick={{ fontSize: 12, fill: "var(--muted)" }}
                    />
                    <YAxis
                      axisLine={false}
                      tickLine={false}
                      tick={{ fontSize: 12, fill: "var(--muted)" }}
                      unit="d"
                    />
                    <Tooltip
                      contentStyle={{
                        background: "var(--surface)",
                        border: "1px solid var(--border)",
                        borderRadius: 8,
                        fontSize: 12,
                      }}
                      labelStyle={{ color: "var(--text)" }}
                      itemStyle={{ color: "var(--text)" }}
                    />
                    <Line
                      type="monotone"
                      dataKey="days"
                      name="Completed onboarding days"
                      stroke="var(--chart-accent)"
                      strokeWidth={2.5}
                      dot={{ r: 4, fill: "#fff", strokeWidth: 2 }}
                      connectNulls={false}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </section>
            <section className="panel">
              <SectionHeading
                title="Where overdue work sits"
                sub="Incomplete tasks due in the reporting period."
              />
              <div className="chart-padding">
                <ResponsiveContainer width="100%" height={240}>
                  <BarChart
                    data={departments}
                    layout="vertical"
                    margin={{ left: 12 }}
                  >
                    <CartesianGrid horizontal={false} stroke="var(--border)" />
                    <XAxis
                      type="number"
                      axisLine={false}
                      tickLine={false}
                      tick={{ fontSize: 11, fill: "var(--muted)" }}
                      allowDecimals={false}
                    />
                    <YAxis
                      dataKey="name"
                      type="category"
                      width={112}
                      axisLine={false}
                      tickLine={false}
                      tick={{ fontSize: 10, fill: "var(--muted)" }}
                    />
                    <Tooltip
                      contentStyle={{
                        background: "var(--surface)",
                        border: "1px solid var(--border)",
                        borderRadius: 8,
                        fontSize: 12,
                      }}
                      labelStyle={{ color: "var(--text)" }}
                      itemStyle={{ color: "var(--text)" }}
                    />
                    <Bar
                      dataKey="overdue"
                      name="Overdue tasks"
                      fill="#d2a05d"
                      radius={[0, 3, 3, 0]}
                      maxBarSize={17}
                      onClick={(_entry, index) => {
                        router.push(
                          `/tasks?overdue=true&department=${departments[index].departmentId}`,
                        );
                      }}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </section>
          </div>
          <section className="panel">
            <SectionHeading
              title="Frequently delayed SOP requirements"
              sub="Count of currently overdue workflow tasks in the reporting period."
            />
            {delayed.length ? (
              <div className="delayed-steps">
                {delayed.map((s, i) => (
                  <Link
                    href={`/tasks?overdue=true&q=${encodeURIComponent(s.name)}`}
                    key={s.name}
                  >
                    <span>0{i + 1}</span>
                    <strong>{s.name}</strong>
                    <div>
                      <i
                        style={{
                          width: `${(s.count / Math.max(...delayed.map((x) => x.count))) * 100}%`,
                        }}
                      />
                    </div>
                    <Badge tone="amber">{s.count} overdue</Badge>
                  </Link>
                ))}
              </div>
            ) : (
              <Empty
                title="No delayed SOP requirements"
                description="There are no matching overdue workflow tasks in this reporting period."
              />
            )}
          </section>
        </TabsContent>
        <TabsContent value="reviews">
          <section className="panel">
            <SectionHeading
              title="Stay close to every partnership"
              sub="Current review schedule and completed history. Independent of the stage-duration reporting period."
              action={
                <Button
                  disabled={!canWrite(d)}
                  onClick={() => editor({ type: "review" })}
                >
                  <Plus size={15} />
                  Schedule review
                </Button>
              }
            />
            <div className="table-scroll">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Firm partner</th>
                    <th>Review</th>
                    <th>Owner</th>
                    <th>Date</th>
                    <th>Status</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {reviews.map((r) => (
                    <tr key={r.id}>
                      <td>
                        <Link
                          className="text-link"
                          href={`/firms/detail?id=${r.firmId}&tab=reviews`}
                        >
                          {d.firms[r.firmId].name}
                        </Link>
                      </td>
                      <td>{r.type}</td>
                      <td>
                        <Person id={r.ownerId} d={d} />
                      </td>
                      <td>{prettyDate(r.date)}</td>
                      <td>
                        <Badge
                          tone={r.status === "Completed" ? "green" : "blue"}
                        >
                          {r.status}
                        </Badge>
                      </td>
                      <td>
                        <Button
                          size="sm"
                          variant="secondary"
                          disabled={!canEditFirm(d, d.firms[r.firmId])}
                          onClick={() =>
                            editor({
                              type: "review",
                              id: r.id,
                              firmId: r.firmId,
                            })
                          }
                        >
                          View / update
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </TabsContent>
        <TabsContent value="delivery">
          <ReportSchedule />
        </TabsContent>
      </Tabs>
    </>
  );
}
function ReportSchedule() {
  const d = useData(),
    run = useApp((s) => s.run);
  const [value, setValue] = useState(d.settings.reportSchedule);
  return (
    <section className="panel report-schedule">
      <CalendarClock size={30} />
      <h2>Make reporting a regular habit</h2>
      <p>
        Save a local delivery preference to demonstrate the configuration.
        Delivery is simulated. No background jobs or report emails are sent.
      </p>
      <label className="check-label">
        <input
          type="checkbox"
          checked={value.enabled}
          disabled={!canAdmin(d)}
          onChange={(e) => setValue({ ...value, enabled: e.target.checked })}
        />
        Enable simulated report schedule
      </label>
      <label className="field">
        Frequency
        <select
          value={value.frequency}
          disabled={!canAdmin(d)}
          onChange={(e) =>
            setValue({
              ...value,
              frequency: e.target.value as "Weekly" | "Monthly",
            })
          }
        >
          <option>Weekly</option>
          <option>Monthly</option>
        </select>
      </label>
      <label className="field">
        Department scope
        <select
          value={value.departmentId}
          disabled={!canAdmin(d)}
          onChange={(e) => setValue({ ...value, departmentId: e.target.value })}
        >
          <option value="">Organization</option>
          {values(d.departments).map((dep) => (
            <option key={dep.id} value={dep.id}>
              {dep.name}
            </option>
          ))}
        </select>
      </label>
      <Button
        disabled={!canAdmin(d)}
        onClick={() => {
          run({ type: "settings.save", value: { reportSchedule: value } });
          toast.success("Simulated reporting preference saved.");
        }}
      >
        Save configuration
      </Button>
    </section>
  );
}
