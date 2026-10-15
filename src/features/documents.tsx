"use client";
import { useState } from "react";
import {
  Check,
  CheckCircle2,
  Download,
  Eye,
  FileCheck2,
  FileText,
  PenLine,
  Send,
  Upload,
  XCircle,
} from "lucide-react";
import { toast } from "sonner";
import { useApp, useData } from "@/lib/store";
import { DocumentRecord } from "@/lib/model";
import { values } from "@/lib/selectors";
import { canEditFirm, canWrite } from "@/lib/permissions";
import { prettyDate } from "@/lib/dates";
import {
  Badge,
  Empty,
  FirmLink,
  PageHeading,
  TextSearch,
} from "@/components/common";
import { sessionFiles, useEditor } from "@/components/editors";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import { useConfirm } from "@/components/confirm";
export function Documents({ firmId }: { firmId?: string }) {
  const d = useData(),
    editor = useEditor(),
    run = useApp((s) => s.run),
    department = useApp((s) => s.departmentId),
    confirm = useConfirm();
  const [query, setQuery] = useState(""),
    [category, setCategory] = useState(""),
    [status, setStatus] = useState(""),
    [selected, setSelected] = useState(""),
    [preview, setPreview] = useState(false),
    [sessionTick, setSessionTick] = useState(0);
  const docs = values(d.documents).filter(
    (doc) =>
      (!firmId || doc.firmId === firmId) &&
      (!department ||
        (doc.firmId && d.firms[doc.firmId].departmentId === department)) &&
      (!category || doc.category === category) &&
      (!status || doc.status === status) &&
      doc.name.toLowerCase().includes(query.toLowerCase()),
  );
  const doc = d.documents[selected];
  const allowed = (doc: DocumentRecord) =>
    doc.firmId ? canEditFirm(d, d.firms[doc.firmId]) : canWrite(d);
  const fileURL = (doc: DocumentRecord) =>
    doc.source === "sample"
      ? `/samples/${doc.fileName}`
      : sessionFiles.has(doc.id)
        ? URL.createObjectURL(sessionFiles.get(doc.id)!)
        : "";
  const downloadDoc = (doc: DocumentRecord) => {
    const url = fileURL(doc);
    if (!url) {
      toast.error(
        "Select the original file again. Only metadata survives a reload.",
      );
      return;
    }
    const a = document.createElement("a");
    a.href = url;
    a.download = doc.fileName;
    a.click();
    if (doc.source === "session")
      setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
  const simulate = async (action: "send" | "sign" | "decline") => {
    if (!doc) return;
    if (
      action === "decline" &&
      !(await confirm({
        title: "Simulate a declined agreement?",
        description:
          "The agreement status will change locally. No message will be sent.",
        label: "Simulate decline",
      }))
    )
      return;
    try {
      run({ type: "document.simulate", id: doc.id, action });
      toast.success(
        action === "send"
          ? "Demo signature request created. No email sent."
          : action === "sign"
            ? "Demo signer completion recorded."
            : "Demo decline recorded.",
      );
    } catch (e) {
      toast.error(
        e instanceof Error ? e.message : "Unable to update document.",
      );
    }
  };
  return (
    <>
      <PageHeading
        title={firmId ? "Firm documents" : "Documents"}
        description="The right materials. A clear status. A complete shared record."
        actions={
          <Button
            disabled={!canWrite(d)}
            onClick={() => editor({ type: "document", firmId })}
          >
            <Upload size={16} />
            Add document
          </Button>
        }
      />
      <div className="document-summary">
        <div>
          <FileText size={22} />
          <strong>{docs.length}</strong>
          <span>Documents in view</span>
        </div>
        <div>
          <PenLine size={22} />
          <strong>
            {
              docs.filter((doc) =>
                ["Sent", "Partially signed"].includes(doc.status),
              ).length
            }
          </strong>
          <span>Awaiting signatures</span>
        </div>
        <div>
          <FileCheck2 size={22} />
          <strong>
            {docs.filter((doc) => doc.status === "Signed").length}
          </strong>
          <span>Fully signed</span>
        </div>
        <p>
          Signature actions are simulated.
          <br />
          No live provider. No binding signatures.
        </p>
      </div>
      <section className="panel">
        <div className="table-toolbar">
          <TextSearch
            value={query}
            onChange={setQuery}
            placeholder="Search documents…"
          />
          <div className="toolbar-filters">
            <select
              aria-label="Document category"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
            >
              <option value="">All categories</option>
              {[
                "Agreements",
                "Onboarding resources",
                "Training materials",
                "SOP templates",
                "Meeting notes",
                "Marketing documents",
              ].map((s) => (
                <option key={s}>{s}</option>
              ))}
            </select>
            <select
              aria-label="Signature status"
              value={status}
              onChange={(e) => setStatus(e.target.value)}
            >
              <option value="">All signature statuses</option>
              {[
                "Draft",
                "Sent",
                "Partially signed",
                "Signed",
                "Declined",
                "Expired",
              ].map((s) => (
                <option key={s}>{s}</option>
              ))}
            </select>
          </div>
        </div>
        <div className="table-scroll">
          <table className="data-table">
            <thead>
              <tr>
                <th>Document name</th>
                <th>Firm partner</th>
                <th>Category</th>
                <th>Added</th>
                <th>Signature status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {docs.map((doc) => (
                <tr key={doc.id}>
                  <td>
                    <button
                      className="document-name"
                      onClick={() => {
                        setSelected(doc.id);
                        setPreview(false);
                      }}
                    >
                      <div className="file-icon">
                        <FileText size={21} />
                      </div>
                      <span>
                        <strong>{doc.name}</strong>
                        <small>
                          Version {doc.version} · {doc.fileName}
                          {doc.source === "session" &&
                            !sessionFiles.has(doc.id) &&
                            " · Reselect file"}
                        </small>
                      </span>
                    </button>
                  </td>
                  <td>
                    <FirmLink id={doc.firmId} />
                  </td>
                  <td>{doc.category}</td>
                  <td>{prettyDate(doc.added)}</td>
                  <td>
                    <Badge
                      tone={
                        doc.status === "Signed"
                          ? "green"
                          : ["Declined", "Expired"].includes(doc.status)
                            ? "red"
                            : doc.status === "Partially signed"
                              ? "amber"
                              : "neutral"
                      }
                    >
                      {doc.status}
                    </Badge>
                    {doc.signers.length > 0 && (
                      <small className="cell-sub">
                        {doc.signers.filter((s) => s.signedAt).length}/
                        {doc.signers.length} signers
                      </small>
                    )}
                  </td>
                  <td>
                    <div className="row-actions">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setSelected(doc.id);
                          setPreview(true);
                        }}
                      >
                        <Eye size={15} />
                        Preview
                      </Button>
                      <button
                        className="icon-action"
                        aria-label={`Download ${doc.name}`}
                        onClick={() => downloadDoc(doc)}
                      >
                        <Download size={16} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {!docs.length && (
            <Empty
              title="A place for every document"
              description="Add a local file or use the bundled demonstration materials."
            />
          )}
        </div>
      </section>
      <Dialog open={!!doc} onOpenChange={(open) => !open && setSelected("")}>
        <DialogContent
          className={preview ? "document-preview-dialog" : "document-dialog"}
        >
          <div className="drawer-heading">
            <DialogTitle>{doc?.name}</DialogTitle>
            <DialogDescription>
              Version {doc?.version} · {doc?.category} ·{" "}
              {doc?.source === "sample"
                ? "Bundled fictional sample"
                : "Session file; only metadata is persisted"}
            </DialogDescription>
          </div>
          {doc && (
            <>
              <div className="document-dialog-toolbar">
                <Badge tone={doc.status === "Signed" ? "green" : "amber"}>
                  {doc.status}
                </Badge>
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => setPreview(!preview)}
                >
                  <Eye size={15} />
                  {preview ? "Signature details" : "Preview file"}
                </Button>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => downloadDoc(doc)}
                >
                  <Download size={15} />
                  Download
                </Button>
              </div>
              {doc.source === "session" && !sessionFiles.has(doc.id) ? (
                <div className="notice">
                  <div>
                    <h3>Select this file again to preview it</h3>
                    <p>
                      Metadata is saved. Original file bytes are available only
                      during the session.
                    </p>
                    <input
                      aria-label="Reselect original document"
                      type="file"
                      onChange={(e) => {
                        const f = e.target.files?.[0];
                        if (f) {
                          if (f.name !== doc.fileName) {
                            toast.error(`Choose ${doc.fileName}.`);
                            return;
                          }
                          sessionFiles.set(doc.id, f);
                          setSessionTick(sessionTick + 1);
                        }
                      }}
                    />
                  </div>
                </div>
              ) : preview ? (
                <DocumentPreview doc={doc} />
              ) : null}
              {!preview && (
                <>
                  <div className="signer-list">
                    {doc.signers.map((s, i) => (
                      <div key={s.email}>
                        <span
                          className={
                            s.signedAt ? "signer-check signed" : "signer-check"
                          }
                        >
                          {s.signedAt ? <Check size={16} /> : i + 1}
                        </span>
                        <div>
                          <strong>{s.name}</strong>
                          <small>{s.email}</small>
                        </div>
                        <span>
                          {s.signedAt
                            ? `Completed ${prettyDate(s.signedAt)}`
                            : "Awaiting signature"}
                        </span>
                      </div>
                    ))}
                  </div>
                  {doc.signers.length > 0 && (
                    <>
                      <div className="notice">
                        <PenLine size={18} />
                        <span>
                          Demo signature controls only. These actions update
                          local status without creating a legally binding
                          signature.
                        </span>
                      </div>
                      <div className="signature-actions">
                        <Button
                          disabled={
                            !allowed(doc) ||
                            !["Draft", "Declined", "Expired"].includes(
                              doc.status,
                            )
                          }
                          onClick={() => void simulate("send")}
                        >
                          <Send size={15} />
                          Simulate request
                        </Button>
                        <Button
                          variant="secondary"
                          disabled={
                            !allowed(doc) ||
                            !["Sent", "Partially signed"].includes(doc.status)
                          }
                          onClick={() => void simulate("sign")}
                        >
                          <CheckCircle2 size={15} />
                          Simulate signer completion
                        </Button>
                        <Button
                          variant="ghost"
                          disabled={
                            !allowed(doc) ||
                            !["Sent", "Partially signed"].includes(doc.status)
                          }
                          onClick={() => void simulate("decline")}
                        >
                          <XCircle size={15} />
                          Simulate decline
                        </Button>
                      </div>
                    </>
                  )}
                  <div className="document-events">
                    {doc.events.map((event, i) => (
                      <p key={i}>
                        <span>{event.label}</span>
                        <small>{prettyDate(event.at, "MMM d · h:mm a")}</small>
                      </p>
                    ))}
                  </div>
                </>
              )}
            </>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
function DocumentPreview({ doc }: { doc: DocumentRecord }) {
  const file = sessionFiles.get(doc.id);
  const [url] = useState(() =>
    doc.source === "sample"
      ? `/samples/${doc.fileName}`
      : file
        ? URL.createObjectURL(file)
        : "",
  );
  if (!url) return null;
  return (
    <iframe
      key={doc.id}
      title={`Preview ${doc.name}`}
      src={url}
      sandbox=""
      className="file-preview"
    />
  );
}
