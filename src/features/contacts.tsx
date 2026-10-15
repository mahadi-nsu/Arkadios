"use client";
import { useSearchParams } from "next/navigation";
import { useState } from "react";
import { ColumnDef } from "@tanstack/react-table";
import {
  Archive,
  Download,
  FileSpreadsheet,
  Plus,
  RotateCcw,
  Upload,
  Users,
} from "lucide-react";
import { toast } from "sonner";
import { Contact, contactSchema } from "@/lib/model";
import { useApp, useData } from "@/lib/store";
import { values } from "@/lib/selectors";
import { canEditFirm, canWrite } from "@/lib/permissions";
import { exportCSV, parseCSV } from "@/lib/csv";
import { uid } from "@/lib/utils";
import {
  Avatar,
  Badge,
  DataTable,
  FirmLink,
  PageHeading,
  TextSearch,
} from "@/components/common";
import { Button } from "@/components/ui/button";
import { useEditor } from "@/components/editors";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import { useConfirm } from "@/components/confirm";
export function Contacts({ firmId }: { firmId?: string }) {
  const d = useData(),
    params = useSearchParams(),
    editor = useEditor(),
    run = useApp((s) => s.run),
    confirm = useConfirm(),
    departmentId = useApp((s) => s.departmentId);
  const [query, setQuery] = useState(params.get("q") ?? ""),
    [category, setCategory] = useState(""),
    [archived, setArchived] = useState(false),
    [importOpen, setImportOpen] = useState(false);
  const contacts = values(d.contacts).filter(
    (c) =>
      c.archived === archived &&
      (!firmId || c.firmId === firmId) &&
      (!departmentId ||
        (c.firmId && d.firms[c.firmId].departmentId === departmentId)) &&
      (!category || c.category === category) &&
      `${c.name} ${c.email} ${c.title} ${c.tags.join(" ")}`
        .toLowerCase()
        .includes(query.toLowerCase()),
  );
  const canEdit = (c: Contact) =>
    c.firmId ? canEditFirm(d, d.firms[c.firmId]) : canWrite(d);
  const columns: ColumnDef<Contact>[] = [
    {
      accessorKey: "name",
      header: "Contact",
      cell: ({ row }) => (
        <button
          className="table-person"
          onClick={() =>
            editor({
              type: "contact",
              id: row.original.id,
              firmId: row.original.firmId,
            })
          }
        >
          <Avatar
            name={row.original.name}
            index={Number(row.original.id.slice(1))}
          />
          <span>
            <strong>
              {row.original.name}
              {row.original.primary && <Badge tone="green">Primary</Badge>}
            </strong>
            <small>{row.original.title}</small>
          </span>
        </button>
      ),
    },
    {
      accessorKey: "category",
      header: "Category",
      cell: ({ getValue }) => (
        <Badge tone={getValue() === "Advisor" ? "blue" : "neutral"}>
          {getValue<string>()}
        </Badge>
      ),
    },
    {
      id: "firm",
      header: "Firm partner",
      accessorFn: (c) => d.firms[c.firmId ?? ""]?.name ?? "Independent vendor",
      cell: ({ row }) => <FirmLink id={row.original.firmId} />,
    },
    {
      accessorKey: "email",
      header: "Email address",
      cell: ({ getValue }) => (
        <a className="subtle-link" href={`mailto:${getValue<string>()}`}>
          {getValue<string>()}
        </a>
      ),
    },
    { accessorKey: "phone", header: "Phone" },
    {
      id: "tags",
      header: "Tags",
      cell: ({ row }) =>
        row.original.tags.map((t) => <Badge key={t}>{t}</Badge>),
    },
    ...values(d.customFields)
      .filter((f) => f.entity === "contact")
      .map((f) => ({
        id: f.id,
        header: f.name,
        accessorFn: (c: Contact) => c.custom[f.id] ?? "—",
      })),
    { accessorKey: "id", header: "Record ID" },
    {
      id: "actions",
      header: "",
      cell: ({ row }) => (
        <div className="row-actions">
          <Button
            size="sm"
            variant="ghost"
            disabled={!canEdit(row.original)}
            onClick={() =>
              editor({
                type: "contact",
                id: row.original.id,
                firmId: row.original.firmId,
              })
            }
          >
            Edit
          </Button>
          <button
            className="icon-action"
            aria-label={`${archived ? "Restore" : "Archive"} ${row.original.name}`}
            disabled={!canEdit(row.original)}
            onClick={async () => {
              if (
                await confirm({
                  title: `${archived ? "Restore" : "Archive"} contact?`,
                  description: `${row.original.name} will ${archived ? "return to the active directory" : "be archived with their history retained"}.`,
                  label: archived ? "Restore" : "Archive",
                })
              ) {
                run({
                  type: "contact.archive",
                  id: row.original.id,
                  archived: !archived,
                });
                toast.success(
                  archived ? "Contact restored." : "Contact archived.",
                );
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
        title={firmId ? "Firm contacts" : "Contacts"}
        description={
          firmId
            ? "The people behind this partnership."
            : "Your external network of advisors, firm teams, support staff, and vendors."
        }
        actions={
          <>
            <Button
              variant="secondary"
              onClick={() =>
                exportCSV(
                  "arkadios-contacts.csv",
                  contacts.map((c) => ({
                    Name: c.name,
                    Category: c.category,
                    Firm: d.firms[c.firmId ?? ""]?.name ?? "",
                    Title: c.title,
                    Email: c.email,
                    Phone: c.phone,
                    Primary: c.primary,
                    Tags: c.tags.join("; "),
                    Notes: c.notes,
                    ...c.custom,
                  })),
                )
              }
            >
              <Download size={15} />
              Export
            </Button>
            <Button
              variant="secondary"
              disabled={!canWrite(d)}
              onClick={() => setImportOpen(true)}
            >
              <Upload size={15} />
              Import CSV
            </Button>
            <Button
              disabled={
                firmId ? !canEditFirm(d, d.firms[firmId]) : !canWrite(d)
              }
              onClick={() => editor({ type: "contact", firmId })}
            >
              <Plus size={16} />
              Add contact
            </Button>
          </>
        }
      />
      {!firmId && (
        <div className="contact-summary">
          {["Advisor", "Firm staff", "Support staff", "Vendor"].map(
            (cat, i) => (
              <button
                key={cat}
                onClick={() => setCategory(category === cat ? "" : cat)}
                className={category === cat ? "active" : ""}
              >
                <div
                  className={`metric-icon icon-${["blue", "teal", "green", "amber"][i]}`}
                >
                  <Users size={18} />
                </div>
                <span>
                  <strong>
                    {
                      values(d.contacts).filter(
                        (c) => c.category === cat && !c.archived,
                      ).length
                    }
                  </strong>
                  <small>{cat}</small>
                </span>
              </button>
            ),
          )}
        </div>
      )}
      <section className="panel">
        <div className="table-toolbar">
          <TextSearch
            value={query}
            onChange={setQuery}
            placeholder="Search names, emails, or titles…"
          />
          <div className="toolbar-filters">
            <select
              aria-label="Contact category"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
            >
              <option value="">All categories</option>
              {["Advisor", "Firm staff", "Support staff", "Vendor"].map((c) => (
                <option key={c}>{c}</option>
              ))}
            </select>
            <select
              aria-label="Contact archive status"
              value={String(archived)}
              onChange={(e) => setArchived(e.target.value === "true")}
            >
              <option value="false">Active contacts</option>
              <option value="true">Archived contacts</option>
            </select>
          </div>
        </div>
        <DataTable data={contacts} columns={columns} />
      </section>
      <ContactImport
        open={importOpen}
        onOpenChange={setImportOpen}
        firmId={firmId}
      />
    </>
  );
}
const mappingFields = [
  { id: "name", label: "Full name", required: true },
  { id: "email", label: "Email address", required: true },
  { id: "firm", label: "Firm name or ID" },
  { id: "category", label: "Category" },
  { id: "title", label: "Job title" },
  { id: "phone", label: "Phone" },
  { id: "notes", label: "Notes" },
];
function ContactImport({
  open,
  onOpenChange,
  firmId,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  firmId?: string;
}) {
  const d = useData(),
    run = useApp((s) => s.run),
    confirm = useConfirm();
  const [source, setSource] = useState<ReturnType<typeof parseCSV> | null>(
      null,
    ),
    [mapping, setMapping] = useState<Record<string, string>>({}),
    [step, setStep] = useState(1),
    [duplicateHandling, setDuplicateHandling] = useState<"skip" | "update">(
      "skip",
    );
  const customDefinitions = values(d.customFields).filter(
    (f) => f.entity === "contact",
  );
  const importFields = [
    ...mappingFields,
    ...customDefinitions.map((f) => ({
      id: f.id,
      label: f.name,
      required: f.required,
    })),
  ];
  const readFile = async (file?: File) => {
    if (!file) return;
    try {
      const parsed = parseCSV(await file.text());
      setSource(parsed);
      setMapping(
        Object.fromEntries(
          importFields.map((f) => [
            f.id,
            parsed.fields.find((h) =>
              h
                .toLowerCase()
                .replace(/[^a-z]/g, "")
                .includes(f.id),
            ) ?? "",
          ]),
        ),
      );
      setStep(2);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Unable to parse CSV.");
    }
  };
  const previews = (source?.rows ?? []).map((row, index) => {
    const cell = (field: string) => row[mapping[field]]?.trim() ?? "";
    const firm =
      firmId ??
      values(d.firms).find(
        (f) =>
          f.id === cell("firm") ||
          f.name.toLowerCase() === cell("firm").toLowerCase(),
      )?.id;
    const c = {
      id: `import_${index}`,
      name: cell("name"),
      email: cell("email"),
      category: cell("category") || "Advisor",
      firmId: firm,
      title: cell("title"),
      phone: cell("phone"),
      notes: cell("notes"),
      primary: false,
      tags: [],
      custom: Object.fromEntries(
        customDefinitions
          .filter((f) => cell(f.id) !== "")
          .map((f) => [
            f.id,
            f.type === "Number" ? Number(cell(f.id)) : cell(f.id),
          ]),
      ),
      archived: false,
    };
    const result = contactSchema.safeParse(c);
    const dup = values(d.contacts).find(
      (x) => !x.archived && x.email.toLowerCase() === c.email.toLowerCase(),
    );
    const repeated = source?.rows
      .slice(0, index)
      .some(
        (prev) =>
          prev[mapping.email]?.trim().toLowerCase() === c.email.toLowerCase(),
      );
    const errors = [
      ...(!result.success ? result.error.issues.map((e) => e.message) : []),
      ...(!firm && c.category !== "Vendor"
        ? ["Firm not found; map a valid firm name or ID."]
        : []),
      ...(repeated ? ["Repeated email within this file."] : []),
      ...customDefinitions.flatMap((f) => {
        const value = cell(f.id);
        if (f.required && !value) return [`${f.name} is required.`];
        if (!value) return [];
        if (f.type === "Number" && !Number.isFinite(Number(value)))
          return [`${f.name} must be a number.`];
        if (f.type === "Select" && !f.options.includes(value))
          return [`${f.name} needs a configured option.`];
        if (f.type === "Date" && !/^\d{4}-\d{2}-\d{2}$/.test(value))
          return [`${f.name} needs a valid date.`];
        return [];
      }),
    ];
    return {
      contact: result.success ? result.data : undefined,
      name: c.name,
      email: c.email,
      duplicate: !!dup,
      errors,
    };
  });
  const valid = previews.length > 0 && previews.every((p) => !p.errors.length);
  const duplicates = previews.filter((p) => p.duplicate).length;
  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        onOpenChange(v);
        if (!v) {
          setSource(null);
          setStep(1);
        }
      }}
    >
      <DialogContent className="wide-dialog">
        <div className="drawer-heading">
          <span className="eyebrow">STEP {step} OF 3</span>
          <DialogTitle>Bring your network together</DialogTitle>
          <DialogDescription>
            Import up to 2,000 contacts. Quoted values and escaped commas are
            supported.
          </DialogDescription>
        </div>
        {step === 1 ? (
          <div className="import-drop">
            <FileSpreadsheet size={38} />
            <h3>Start with a CSV file</h3>
            <p>
              Include a name, email, and firm name or ID. Vendors may have no
              firm.
            </p>
            <input
              type="file"
              accept=".csv,text/csv"
              aria-label="Choose contacts CSV"
              onChange={(e) => void readFile(e.target.files?.[0])}
            />
            <Button
              variant="ghost"
              onClick={() =>
                exportCSV("contacts-template.csv", [
                  {
                    Name: "Morgan Lee",
                    Email: "morgan.lee@example.com",
                    Firm: "Northgate Wealth",
                    Category: "Advisor",
                    Title: "Partner",
                    Phone: "(404) 555-0199",
                    Notes: "Prefers morning meetings",
                  },
                ])
              }
            >
              Download CSV template
            </Button>
          </div>
        ) : (
          <>
            {step === 2 ? (
              <>
                <div className="mapping-grid">
                  {importFields.map((f) => (
                    <label className="field" key={f.id}>
                      {f.label}
                      {f.required ? " *" : ""}
                      <select
                        value={mapping[f.id] ?? ""}
                        onChange={(e) =>
                          setMapping({ ...mapping, [f.id]: e.target.value })
                        }
                      >
                        <option value="">Do not import</option>
                        {source?.fields.map((h) => (
                          <option key={h}>{h}</option>
                        ))}
                      </select>
                    </label>
                  ))}
                </div>
                <div className="confirm-actions">
                  <Button variant="secondary" onClick={() => setStep(1)}>
                    Back
                  </Button>
                  <Button
                    disabled={!mapping.name || !mapping.email}
                    onClick={() => setStep(3)}
                  >
                    Preview {source?.rows.length} contacts
                  </Button>
                </div>
              </>
            ) : (
              <>
                <div className="notice">
                  {previews.length} rows · {duplicates} existing emails ·{" "}
                  {previews.filter((p) => p.errors.length).length} invalid rows.
                  Review before committing.
                </div>
                <label className="field">
                  Existing email handling
                  <select
                    value={duplicateHandling}
                    onChange={(e) =>
                      setDuplicateHandling(e.target.value as "skip" | "update")
                    }
                  >
                    <option value="skip">Skip existing contacts</option>
                    <option value="update">Update matching contacts</option>
                  </select>
                </label>
                <div className="import-preview">
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>Name</th>
                        <th>Email</th>
                        <th>Result</th>
                      </tr>
                    </thead>
                    <tbody>
                      {previews.slice(0, 30).map((p, i) => (
                        <tr key={i}>
                          <td>{p.name}</td>
                          <td>{p.email}</td>
                          <td>
                            {p.errors.length ? (
                              <span className="field-error">
                                {p.errors.join(" ")}
                              </span>
                            ) : (
                              <Badge tone={p.duplicate ? "amber" : "green"}>
                                {p.duplicate
                                  ? duplicateHandling === "skip"
                                    ? "Skip duplicate"
                                    : "Update existing"
                                  : "Create contact"}
                              </Badge>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {previews.length > 30 && (
                  <p className="field-hint">
                    Showing the first 30 rows. All {previews.length} rows have
                    been validated.
                  </p>
                )}
                <div className="confirm-actions">
                  <Button variant="secondary" onClick={() => setStep(2)}>
                    Back to mapping
                  </Button>
                  <Button
                    disabled={!valid}
                    onClick={async () => {
                      if (
                        !(await confirm({
                          title: "Import these contacts?",
                          description: `Commit ${previews.length} validated rows. ${duplicates} existing contacts will be ${duplicateHandling === "skip" ? "skipped" : "updated"}.`,
                          label: "Confirm import",
                        }))
                      )
                        return;
                      try {
                        run({
                          type: "contact.import",
                          values: previews.flatMap((p) =>
                            p.contact
                              ? [{ ...p.contact, id: uid("contact") }]
                              : [],
                          ),
                          duplicates: duplicateHandling,
                        });
                        toast.success("Contact import complete.");
                        onOpenChange(false);
                        setSource(null);
                        setStep(1);
                      } catch (e) {
                        toast.error(
                          e instanceof Error
                            ? e.message
                            : "Import failed. Current data was not changed.",
                        );
                      }
                    }}
                  >
                    Confirm import
                  </Button>
                </div>
              </>
            )}
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
