"use client";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useState } from "react";
import { ArrowUpRight, Columns3, LayoutList, Plus, Timer } from "lucide-react";
import { useApp, useData } from "@/lib/store";
import { stages } from "@/lib/model";
import {
  activeFirms,
  checklist,
  handoffBlockers,
  progress,
  stageAge,
  stageColor,
  stageTarget,
} from "@/lib/selectors";
import { canWrite } from "@/lib/permissions";
import {
  Avatar,
  Badge,
  Empty,
  HealthBadge,
  PageHeading,
  Progress,
  StageBadge,
  TextSearch,
} from "@/components/common";
import { useEditor } from "@/components/editors";
import { Button } from "@/components/ui/button";
import { HandoffButton } from "./firms";
export function Pipeline() {
  const d = useData(),
    params = useSearchParams(),
    editor = useEditor(),
    department = useApp((s) => s.departmentId);
  const [view, setView] = useState("board"),
    [query, setQuery] = useState(""),
    [ready, setReady] = useState(params.get("ready") === "true");
  const firms = activeFirms(d).filter(
    (f) =>
      (!department || f.departmentId === department) &&
      f.name.toLowerCase().includes(query.toLowerCase()) &&
      (!ready || (f.stage !== "relationship" && !handoffBlockers(d, f).length)),
  );
  return (
    <>
      <PageHeading
        title="Lifecycle Pipeline"
        description="One journey. Five clear stages. Confident handoffs at every step."
        actions={
          <Button
            disabled={!canWrite(d)}
            onClick={() => editor({ type: "firm" })}
          >
            <Plus size={16} />
            Add prospect
          </Button>
        }
      />
      <div className="pipeline-toolbar">
        <TextSearch
          value={query}
          onChange={setQuery}
          placeholder="Find a firm in the journey…"
        />
        <label className="check-label">
          <input
            type="checkbox"
            checked={ready}
            onChange={(e) => setReady(e.target.checked)}
          />
          Ready for approval
        </label>
        <div className="view-toggle">
          <button
            aria-label="Board view"
            className={view === "board" ? "active" : ""}
            onClick={() => setView("board")}
          >
            <Columns3 size={16} />
            Board
          </button>
          <button
            aria-label="List view"
            className={view === "list" ? "active" : ""}
            onClick={() => setView("list")}
          >
            <LayoutList size={16} />
            List
          </button>
        </div>
      </div>
      {view === "board" ? (
        <div className="pipeline-board">
          {stages.map((s, i) => {
            const records = firms.filter((f) => f.stage === s);
            return (
              <section
                className="pipeline-column"
                key={s}
                style={
                  { "--stage-color": stageColor[s] } as React.CSSProperties
                }
              >
                <div className="pipeline-column-heading">
                  <span>
                    <i />
                    {d.settings.stageLabels[s]}
                    <Badge>{records.length}</Badge>
                  </span>
                  <small>0{i + 1}</small>
                </div>
                <p className="pipeline-column-sub">
                  {s === "relationship"
                    ? "Nurture the long-term connection"
                    : `${d.settings.defaultTargets[s]} day default target`}
                </p>
                <div className="pipeline-cards">
                  {records.map((f) => (
                    <article className="pipeline-card" key={f.id}>
                      <div className="pipeline-card-heading">
                        <span className="firm-monogram">{f.name[0]}</span>
                        <Link href={`/firms/detail?id=${f.id}`}>
                          <ArrowUpRight size={17} />
                          <span className="sr-only">Open {f.name}</span>
                        </Link>
                      </div>
                      <Link
                        href={`/firms/detail?id=${f.id}`}
                        className="pipeline-firm-name"
                      >
                        {f.name}
                      </Link>
                      <p className="pipeline-location">{f.location}</p>
                      <HealthBadge firm={f} />
                      <div className="pipeline-progress">
                        <span>Required checklist</span>
                        <Progress value={progress(checklist(d, f))} />
                      </div>
                      <p className="pipeline-next">
                        <strong>Next</strong>
                        {f.nextAction}
                      </p>
                      <div className="pipeline-card-bottom">
                        <span
                          className={
                            stageAge(d, f) > stageTarget(d, f)
                              ? "due-overdue"
                              : ""
                          }
                        >
                          <Timer size={13} />
                          {stageAge(d, f)} / {stageTarget(d, f)} days
                        </span>
                        <Avatar name={d.users[f.ownerId]?.name ?? ""} small />
                      </div>
                      {s !== "relationship" && <HandoffButton firm={f} />}
                    </article>
                  ))}
                  {!records.length && (
                    <div className="pipeline-empty">
                      No firms in this stage.
                    </div>
                  )}
                </div>
              </section>
            );
          })}
        </div>
      ) : (
        <section className="panel">
          <div className="table-scroll">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Firm partner</th>
                  <th>Stage</th>
                  <th>Stage age / target</th>
                  <th>Checklist</th>
                  <th>Health</th>
                  <th>Next action</th>
                  <th>Handoff</th>
                </tr>
              </thead>
              <tbody>
                {firms.map((f) => (
                  <tr key={f.id}>
                    <td>
                      <Link
                        className="text-link"
                        href={`/firms/detail?id=${f.id}`}
                      >
                        {f.name}
                      </Link>
                    </td>
                    <td>
                      <StageBadge stage={f.stage} />
                    </td>
                    <td>
                      {stageAge(d, f)} / {stageTarget(d, f)} days
                    </td>
                    <td>
                      <Progress value={progress(checklist(d, f))} />
                    </td>
                    <td>
                      <HealthBadge firm={f} />
                    </td>
                    <td>{f.nextAction}</td>
                    <td>
                      <HandoffButton firm={f} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!firms.length && (
              <Empty
                title="No matching firms"
                description="Try adjusting your filters."
              />
            )}
          </div>
        </section>
      )}
      <div className="pipeline-info">
        <Timer size={16} />
        <p>
          Targets shown on cards come from each firm’s versioned SOP. Stage
          changes require completed evidence and an authorized approval.
        </p>
      </div>
    </>
  );
}
