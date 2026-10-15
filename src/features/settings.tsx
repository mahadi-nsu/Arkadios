"use client";
import { useState } from "react";
import { ColumnDef } from "@tanstack/react-table";
import {
  CalendarDays,
  CheckCircle2,
  Download,
  FileJson,
  Link2,
  Plus,
  RefreshCw,
  RotateCcw,
  Save,
  ShieldCheck,
  Upload,
  Users,
} from "lucide-react";
import { toast } from "sonner";
import { CustomField, Dataset, User, roles, stages } from "@/lib/model";
import { useApp, useData } from "@/lib/store";
import { canAdmin } from "@/lib/permissions";
import { values } from "@/lib/selectors";
import { parseImport } from "@/lib/validation";
import { prettyDate } from "@/lib/dates";
import { download, uid } from "@/lib/utils";
import {
  Avatar,
  Badge,
  DataTable,
  PageHeading,
  SectionHeading,
  TextSearch,
} from "@/components/common";
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
import { BackupTools } from "./backup-tools";
export function Settings() {
  const d = useData(),
    [tab, setTab] = useState("users");
  return (
    <>
      <PageHeading
        title="Settings"
        description="Make the workspace work for your home office."
        actions={
          <Badge tone={canAdmin(d) ? "green" : "neutral"}>
            <ShieldCheck size={13} />
            {canAdmin(d) ? "Administrator access" : "View-only configuration"}
          </Badge>
        }
      />
      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          {[
            { id: "users", name: "Internal users" },
            { id: "roles", name: "Roles & permissions" },
            { id: "departments", name: "Departments" },
            { id: "lifecycle", name: "Lifecycle" },
            { id: "fields", name: "Custom fields" },
            { id: "integrations", name: "Integrations" },
            { id: "demo", name: "Demo controls" },
          ].map((t) => (
            <TabsTrigger key={t.id} value={t.id}>
              {t.name}
            </TabsTrigger>
          ))}
        </TabsList>
        <TabsContent value="users">
          <UsersSettings />
        </TabsContent>
        <TabsContent value="roles">
          <RolesSettings />
        </TabsContent>
        <TabsContent value="departments">
          <DepartmentsSettings />
        </TabsContent>
        <TabsContent value="lifecycle">
          <LifecycleSettings />
        </TabsContent>
        <TabsContent value="fields">
          <CustomFieldsSettings />
        </TabsContent>
        <TabsContent value="integrations">
          <IntegrationsSettings />
        </TabsContent>
        <TabsContent value="demo">
          <DemoSettings />
        </TabsContent>
      </Tabs>
    </>
  );
}
function UsersSettings() {
  const d = useData(),
    [query, setQuery] = useState(""),
    [edit, setEdit] = useState<string | null>(null);
  const users = values(d.users).filter((u) =>
    `${u.name} ${u.email}`.toLowerCase().includes(query.toLowerCase()),
  );
  const columns: ColumnDef<User>[] = [
    {
      accessorKey: "name",
      header: "Employee",
      cell: ({ row }) => (
        <span className="table-person">
          <Avatar name={row.original.name} />
          <span>
            <strong>{row.original.name}</strong>
            <small>{row.original.email}</small>
          </span>
        </span>
      ),
    },
    {
      id: "department",
      header: "Department",
      accessorFn: (u) => d.departments[u.departmentId].name,
    },
    {
      accessorKey: "role",
      header: "Role",
      cell: ({ getValue }) => (
        <Badge
          tone={
            getValue() === "Admin"
              ? "green"
              : getValue() === "Manager"
                ? "blue"
                : "neutral"
          }
        >
          {getValue<string>()}
        </Badge>
      ),
    },
    {
      id: "work",
      header: "Open assignments",
      accessorFn: (u) =>
        values(d.tasks).filter(
          (t) => t.assigneeId === u.id && t.status !== "Completed",
        ).length,
    },
    {
      accessorKey: "active",
      header: "Status",
      cell: ({ row }) => (
        <Badge dot tone={row.original.active ? "green" : "neutral"}>
          {row.original.active ? row.original.invitation : "Inactive"}
        </Badge>
      ),
    },
    {
      id: "actions",
      header: "",
      cell: ({ row }) => (
        <Button
          variant="secondary"
          size="sm"
          disabled={!canAdmin(d)}
          onClick={() => setEdit(row.original.id)}
        >
          Manage
        </Button>
      ),
    },
  ];
  return (
    <section className="panel">
      <SectionHeading
        title="The people behind the partnerships"
        sub={`${values(d.users).filter((u) => u.active).length} active internal employees. External contacts are separate business records.`}
        action={
          <Button disabled={!canAdmin(d)} onClick={() => setEdit("new")}>
            <Plus size={15} />
            Add employee
          </Button>
        }
      />
      <div className="table-toolbar">
        <TextSearch
          value={query}
          onChange={setQuery}
          placeholder="Search employees…"
        />
        <Badge>Invitations are local simulations</Badge>
      </div>
      <DataTable data={users} columns={columns} />
      <Dialog
        open={edit !== null}
        onOpenChange={(open) => !open && setEdit(null)}
      >
        {edit && (
          <UserEditor key={edit} id={edit} close={() => setEdit(null)} />
        )}
      </Dialog>
    </section>
  );
}
function UserEditor({ id, close }: { id: string; close: () => void }) {
  const d = useData(),
    run = useApp((s) => s.run),
    confirm = useConfirm();
  const u: User = d.users[id] ?? {
    id: uid("user"),
    name: "",
    email: "",
    departmentId: values(d.departments)[0].id,
    role: "Member",
    active: true,
    invitation: "Demo invited",
  };
  const work = values(d.tasks).filter(
    (t) => t.assigneeId === u.id && t.status !== "Completed",
  ).length;
  return (
    <DialogContent drawer>
      <div className="drawer-heading">
        <DialogTitle>
          {id === "new" ? "Add an internal employee" : "Manage employee"}
        </DialogTitle>
        <DialogDescription>
          Local demo account only. No email invitation or login provisioning.
        </DialogDescription>
      </div>
      <RecordForm
        fields={[
          { name: "name", label: "Full name", required: true, wide: true },
          {
            name: "email",
            label: "Email address",
            required: true,
            type: "email",
            wide: true,
          },
          {
            name: "departmentId",
            label: "Department",
            required: true,
            type: "select",
            options: values(d.departments).map((dep) => ({
              value: dep.id,
              label: dep.name,
            })),
          },
          {
            name: "role",
            label: "Role",
            required: true,
            type: "select",
            options: roles.map((role) => ({ value: role, label: role })),
          },
          {
            name: "active",
            label: "Active employee",
            type: "checkbox",
            hint: "Allow selection as a demo persona",
            wide: true,
          },
          {
            name: "reassignTo",
            label: "Reassign work on deactivation",
            type: "select",
            options: values(d.users)
              .filter((x) => x.id !== u.id && x.active)
              .map((x) => ({ value: x.id, label: x.name })),
            wide: true,
            hint: "Without a replacement, open tasks become unassigned. Firm ownership returns to the department manager.",
          },
        ]}
        defaults={{
          name: u.name,
          email: u.email,
          departmentId: u.departmentId,
          role: u.role,
          active: String(u.active),
          reassignTo: "",
        }}
        submitLabel={id === "new" ? "Add demo employee" : "Save employee"}
        onSubmit={(v) => {
          const save = () => {
            run({
              type: "user.save",
              value: {
                ...u,
                name: v.name,
                email: v.email,
                departmentId: v.departmentId,
                role: v.role as User["role"],
                active: v.active === "true",
              },
              reassignTo: v.reassignTo || undefined,
            });
            toast.success("Employee saved. No email was sent.");
            close();
          };
          if (v.active === "false" && u.active) {
            void confirm({
              title: `Deactivate ${u.name}?`,
              description: `${work} open task assignments will ${v.reassignTo ? "be reassigned" : "become unassigned"}. Firm ownership will be reassigned to the selected employee or department manager.`,
              danger: true,
              label: "Deactivate employee",
            }).then((ok) => {
              if (ok)
                try {
                  save();
                } catch (e) {
                  toast.error(String(e));
                }
            });
          } else save();
        }}
      >
        {work > 0 && (
          <div className="notice">
            <Users size={18} />
            <span>
              This employee has {work} open assignments. Choose a replacement
              before deactivating if you want to retain ownership.
            </span>
          </div>
        )}
      </RecordForm>
    </DialogContent>
  );
}
function RolesSettings() {
  const rows = [
    ["View shared firm, contact, and project records", true, true, true, true],
    [
      "Create firms and contacts",
      true,
      "Own department",
      "Assigned to self",
      false,
    ],
    ["Edit firm records", true, "Own department", "Assigned firms", false],
    ["Manage tasks and assignments", true, "Own department", "Own work", false],
    [
      "Add notes and demo communications",
      true,
      "Own department",
      "Relevant records",
      false,
    ],
    ["Approve lifecycle handoffs", true, "Own department", false, false],
    ["View Team Workload", true, "Own department", false, false],
    ["Configure users, SOPs, rules, and fields", true, false, false, false],
    [
      "Export / import / reset entire demo",
      "Admin controls",
      false,
      false,
      false,
    ],
  ];
  return (
    <section className="panel">
      <SectionHeading
        title="Clear roles. Consistent behavior."
        sub="One permission policy controls both UI actions and local mutation services. Assign roles from Internal users."
      />
      <div className="table-scroll">
        <table className="data-table permission-table">
          <thead>
            <tr>
              <th>Capability</th>
              {roles.map((role) => (
                <th key={role}>{role}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={String(row[0])}>
                {row.map((cell, i) => (
                  <td key={i}>
                    {cell === true ? (
                      <CheckCircle2 className="permission-check" size={17} />
                    ) : cell === false ? (
                      <span className="muted">—</span>
                    ) : (
                      String(cell)
                    )}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="notice">
        <ShieldCheck size={19} />
        <span>
          Client-side permissions demonstrate product behavior. Browser-local
          state and role controls do not provide real authorization or security.
        </span>
      </div>
    </section>
  );
}
function DepartmentsSettings() {
  const d = useData();
  return (
    <section className="panel">
      <SectionHeading
        title="Eight teams. One home office."
        sub="Keep department names and ownership current."
      />
      <div className="departments-settings">
        {values(d.departments).map((dep) => (
          <DepartmentForm
            key={`${dep.id}-${dep.name}-${dep.managerId}`}
            dep={dep}
          />
        ))}
      </div>
    </section>
  );
}
function DepartmentForm({ dep }: { dep: Dataset["departments"][string] }) {
  const d = useData(),
    run = useApp((s) => s.run);
  const [name, setName] = useState(dep.name),
    [manager, setManager] = useState(dep.managerId);
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        try {
          run({
            type: "department.save",
            id: dep.id,
            name,
            managerId: manager,
          });
          toast.success("Department saved.");
        } catch (err) {
          toast.error(String(err));
        }
      }}
    >
      <span className="department-icon">
        <Users size={20} />
      </span>
      <label className="field">
        Department name
        <input
          required
          disabled={!canAdmin(d)}
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
      </label>
      <label className="field">
        Department manager
        <select
          disabled={!canAdmin(d)}
          value={manager}
          onChange={(e) => setManager(e.target.value)}
        >
          {values(d.users)
            .filter((u) => u.active)
            .map((u) => (
              <option key={u.id} value={u.id}>
                {u.name}
              </option>
            ))}
        </select>
      </label>
      <Button
        size="sm"
        variant="secondary"
        disabled={!canAdmin(d)}
        type="submit"
      >
        <Save size={14} />
        Save
      </Button>
    </form>
  );
}
function LifecycleSettings() {
  const d = useData(),
    run = useApp((s) => s.run);
  const [labels, setLabels] = useState(d.settings.stageLabels),
    [targets, setTargets] = useState(d.settings.defaultTargets);
  return (
    <section className="panel">
      <SectionHeading
        title="A familiar journey, in your language"
        sub="The five-stage sequence remains fixed. Stable stage identifiers keep records and reports connected."
      />
      <div className="lifecycle-settings">
        {stages.map((stage, i) => (
          <div key={stage}>
            <span className="step-number">{i + 1}</span>
            <label className="field">
              Stage label
              <input
                disabled={!canAdmin(d)}
                required
                value={labels[stage]}
                onChange={(e) =>
                  setLabels({ ...labels, [stage]: e.target.value })
                }
              />
            </label>
            <label className="field">
              Default target (days)
              <input
                type="number"
                min="1"
                max="730"
                disabled={!canAdmin(d)}
                value={targets[stage]}
                onChange={(e) =>
                  setTargets({ ...targets, [stage]: Number(e.target.value) })
                }
              />
            </label>
            <code>{stage}</code>
          </div>
        ))}
      </div>
      <div className="notice">
        Target changes publish a new target snapshot for future stage entries.
        Active firms retain their original version and target.
      </div>
      <div className="panel-padding">
        <Button
          disabled={!canAdmin(d)}
          onClick={() => {
            try {
              if (Object.values(labels).some((s) => !s.trim()))
                throw new Error("Stage labels are required.");
              run({
                type: "settings.save",
                value: { stageLabels: labels, defaultTargets: targets },
              });
              toast.success(
                "Lifecycle settings saved. Active instances preserved.",
              );
            } catch (e) {
              toast.error(String(e));
            }
          }}
        >
          Save lifecycle settings
        </Button>
      </div>
    </section>
  );
}
function CustomFieldsSettings() {
  const d = useData(),
    [edit, setEdit] = useState<string | null>(null);
  return (
    <section className="panel">
      <SectionHeading
        title="Details that matter to your team"
        sub="Configured fields appear in firm and contact forms, details, and directories."
        action={
          <Button disabled={!canAdmin(d)} onClick={() => setEdit("new")}>
            <Plus size={15} />
            Add field
          </Button>
        }
      />
      <div className="table-scroll">
        <table className="data-table">
          <thead>
            <tr>
              <th>Field name</th>
              <th>Record type</th>
              <th>Field type</th>
              <th>Requirement</th>
              <th>Options</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            {values(d.customFields).map((f) => (
              <tr key={f.id}>
                <td>
                  <strong>{f.name}</strong>
                </td>
                <td className="capitalize">{f.entity}</td>
                <td>{f.type}</td>
                <td>
                  <Badge>{f.required ? "Required" : "Optional"}</Badge>
                </td>
                <td>{f.options.join(", ") || "—"}</td>
                <td>
                  <Button
                    variant="secondary"
                    size="sm"
                    disabled={!canAdmin(d)}
                    onClick={() => setEdit(f.id)}
                  >
                    Edit field
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <Dialog
        open={edit !== null}
        onOpenChange={(open) => !open && setEdit(null)}
      >
        {edit && <CustomFieldEditor id={edit} close={() => setEdit(null)} />}
      </Dialog>
    </section>
  );
}
function CustomFieldEditor({ id, close }: { id: string; close: () => void }) {
  const d = useData(),
    run = useApp((s) => s.run);
  const f: CustomField = d.customFields[id] ?? {
    id: uid("cf"),
    name: "",
    entity: "firm",
    type: "Text",
    required: false,
    options: [],
  };
  return (
    <DialogContent>
      <div className="drawer-heading">
        <DialogTitle>{id === "new" ? "Add" : "Edit"} custom field</DialogTitle>
        <DialogDescription>
          Required values are validated when the record is next saved. Existing
          records are retained.
        </DialogDescription>
      </div>
      <RecordForm
        fields={[
          { name: "name", label: "Field name", required: true, wide: true },
          {
            name: "entity",
            label: "Record type",
            required: true,
            type: "select",
            disabled: id !== "new",
            options: [
              { value: "firm", label: "Firm partner" },
              { value: "contact", label: "Contact" },
            ],
          },
          {
            name: "type",
            label: "Field type",
            required: true,
            type: "select",
            options: ["Text", "Number", "Date", "Select"].map((t) => ({
              value: t,
              label: t,
            })),
          },
          {
            name: "required",
            label: "Required value",
            type: "checkbox",
            hint: "Require this value when saving a record",
            wide: true,
          },
          {
            name: "options",
            label: "Select options",
            hint: "Separate options with commas. Used for Select fields only.",
            wide: true,
          },
        ]}
        defaults={{
          name: f.name,
          entity: f.entity,
          type: f.type,
          required: String(f.required),
          options: f.options.join(", "),
        }}
        onSubmit={(v) => {
          run({
            type: "custom.save",
            value: {
              ...f,
              name: v.name,
              entity: v.entity as CustomField["entity"],
              type: v.type as CustomField["type"],
              required: v.required === "true",
              options: v.options
                .split(",")
                .map((s) => s.trim())
                .filter(Boolean),
            },
          });
          close();
          toast.success("Custom field saved.");
        }}
      />
    </DialogContent>
  );
}
function IntegrationsSettings() {
  const d = useData(),
    run = useApp((s) => s.run);
  return (
    <>
      <div className="notice">
        <Link2 size={19} />
        <span>
          These are provider-neutral local simulations. Sync updates timestamps
          and records meaningful local activity. No external service is
          contacted.
        </span>
      </div>
      <div className="integrations-grid">
        {d.settings.integrations.map((integration, i) => (
          <section className="panel integration-card" key={integration.name}>
            <div className="integration-card-top">
              <span className={`integration-symbol integration-${i}`}>
                {integration.name[0]}
              </span>
              <Badge dot tone="amber">
                Demo connection
              </Badge>
            </div>
            <h2>{integration.name}</h2>
            <p>
              {
                [
                  "Prospect and onboarding reference records.",
                  "Firm-linked conversation reference records.",
                  "Agreement requests and signer progress.",
                ][i]
              }
            </p>
            <dl>
              <div>
                <dt>Linked demo records</dt>
                <dd>
                  {
                    [
                      values(d.firms).length,
                      values(d.threads).length,
                      values(d.documents).filter(
                        (doc) => doc.signers.length > 0,
                      ).length,
                    ][i]
                  }
                </dd>
              </div>
              <div>
                <dt>Last simulated sync</dt>
                <dd>
                  {integration.lastSync
                    ? prettyDate(integration.lastSync, "MMM d · h:mm a")
                    : "Never"}
                </dd>
              </div>
            </dl>
            <Button
              variant="secondary"
              disabled={!canAdmin(d)}
              onClick={() => {
                run({ type: "integration.sync", name: integration.name });
                toast.success(
                  `${integration.name} demo sync completed locally.`,
                );
              }}
            >
              <RefreshCw size={15} />
              Simulate sync
            </Button>
          </section>
        ))}
      </div>
      <section className="panel">
        <SectionHeading title="Recent simulated integration activity" />
        {values(d.activities)
          .filter((a) => a.label.includes("simulated record-reference"))
          .slice(-6)
          .reverse()
          .map((a) => (
            <p className="activity-line" key={a.id}>
              <span>{a.label}</span>
              <small>{prettyDate(a.at, "MMM d · h:mm a")}</small>
            </p>
          ))}
      </section>
    </>
  );
}
function DemoSettings() {
  const d = useData(),
    run = useApp((s) => s.run),
    confirm = useConfirm();
  const [candidate, setCandidate] = useState<{
      raw: string;
      data: Dataset;
      name: string;
    } | null>(null),
    [error, setError] = useState("");
  return (
    <div className="demo-settings-grid">
      <section className="panel">
        <SectionHeading
          title="Your demo clock"
          sub="A shared local calendar date keeps tasks, targets, and rules consistent."
        />
        <div className="demo-clock">
          <CalendarDays size={27} />
          <div>
            <span>Current demo date</span>
            <strong>
              {prettyDate(d.settings.demoDate, "EEEE, MMMM d, yyyy")}
            </strong>
            <small>Initialized {prettyDate(d.settings.anchorDate)}</small>
          </div>
        </div>
        <div className="panel-padding">
          <Button
            disabled={!canAdmin(d)}
            onClick={() => {
              run({ type: "date.advance" });
              toast.success("Advanced one day. Local rules evaluated.");
            }}
          >
            <Plus size={15} />
            Advance demo by one day
          </Button>
          <p className="field-hint">
            Rules run while the workspace is open, never in the background after
            closing the browser.
          </p>
        </div>
      </section>
      <section className="panel">
        <SectionHeading
          title="Take your workspace with you"
          sub="JSON includes all persistent records, workflow versions, configuration, and demo settings."
        />
        <div className="panel-padding">
          <Button
            variant="secondary"
            disabled={!canAdmin(d)}
            onClick={() => {
              download(
                `arkadios-workspace-${d.settings.demoDate}.json`,
                JSON.stringify(d, null, 2),
              );
              toast.success("Complete dataset exported.");
            }}
          >
            <Download size={16} />
            Export complete dataset
          </Button>
          <BackupTools mode="export" />
          <p className="field-hint">
            Selected file bytes are session-only and are excluded from the
            export. Bundled sample files remain available.
          </p>
        </div>
      </section>
      <section className="panel">
        <SectionHeading
          title="Restore a saved workspace"
          sub="Import a validated Arkadios JSON export. Invalid files leave the current dataset unchanged."
        />
        <div className="panel-padding">
          <label className="file-picker">
            <Upload size={22} />
            <strong>Choose a JSON backup</strong>
            <span>Schema v1 · maximum 12 MB · up to 50,000 records</span>
            <input
              aria-label="Import dataset JSON"
              type="file"
              disabled={!canAdmin(d)}
              accept=".json,application/json"
              onChange={async (e) => {
                const file = e.target.files?.[0];
                if (!file) return;
                setError("");
                try {
                  if (file.size > 12 * 1024 * 1024)
                    throw new Error("File exceeds 12 MB.");
                  const raw = await file.text();
                  const data = parseImport(raw);
                  setCandidate({ raw, data, name: file.name });
                } catch (err) {
                  setCandidate(null);
                  setError(
                    err instanceof Error ? err.message : "Invalid JSON file.",
                  );
                }
                e.target.value = "";
              }}
            />
          </label>
          <BackupTools mode="import" />
          {error && (
            <p className="field-error" role="alert">
              {error}
            </p>
          )}
          {candidate && (
            <div className="import-summary">
              <h3>
                <FileJson size={18} />
                {candidate.name}
              </h3>
              <p>
                {values(candidate.data.firms).length} firms ·{" "}
                {values(candidate.data.contacts).length} contacts ·{" "}
                {values(candidate.data.tasks).length} tasks
              </p>
              <Badge tone="green">Schema and references validated</Badge>
              <Button
                disabled={!canAdmin(d)}
                onClick={async () => {
                  if (
                    await confirm({
                      title: "Replace the current workspace?",
                      description: `Import ${candidate.name}. This replaces all browser-local records and configuration. Export your current workspace first if needed.`,
                      label: "Replace and import",
                    })
                  ) {
                    try {
                      useApp.getState().replace(candidate.raw);
                      setCandidate(null);
                      toast.success("Workspace restored successfully.");
                    } catch (err) {
                      setError(String(err));
                    }
                  }
                }}
              >
                Replace and import
              </Button>
            </div>
          )}
        </div>
      </section>
      <section className="panel reset-panel">
        <SectionHeading
          title="A fresh start"
          sub="Restore the fictional seed records, demo date, personas, and workflow versions."
        />
        <div className="panel-padding">
          <p>
            Reset replaces the current browser dataset. Export a backup to
            preserve your work.
          </p>
          <Button
            variant="destructive"
            disabled={!canAdmin(d)}
            onClick={async () => {
              if (
                await confirm({
                  title: "Reset the demo workspace?",
                  description:
                    "All browser-local changes will be replaced by the seed dataset. This includes new firms, tasks, SOP versions, and settings. Export a backup before resetting if you need them.",
                  danger: true,
                  label: "Reset demo",
                })
              ) {
                useApp.getState().reset();
                toast.success("Demo restored to the original seed data.");
              }
            }}
          >
            <RotateCcw size={16} />
            Reset demo
          </Button>
        </div>
      </section>
    </div>
  );
}
