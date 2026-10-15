"use client";
import { useState } from "react";
import { Braces, ClipboardPaste } from "lucide-react";
import { toast } from "sonner";
import { useApp, useData } from "@/lib/store";
import { canAdmin } from "@/lib/permissions";
import { parseImport } from "@/lib/validation";
import { values } from "@/lib/selectors";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import { useConfirm } from "@/components/confirm";
export function BackupTools({ mode }: { mode: "export" | "import" }) {
  const d = useData(),
    confirm = useConfirm();
  const [open, setOpen] = useState(false),
    [text, setText] = useState(""),
    [error, setError] = useState("");
  return (
    <>
      <Button
        variant="ghost"
        size="sm"
        disabled={!canAdmin(d)}
        onClick={() => {
          setText(mode === "export" ? JSON.stringify(d, null, 2) : "");
          setError("");
          setOpen(true);
        }}
      >
        {mode === "export" ? (
          <Braces size={14} />
        ) : (
          <ClipboardPaste size={14} />
        )}{" "}
        {mode === "export" ? "View export JSON" : "Paste a JSON backup"}
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="wide-dialog">
          <div className="drawer-heading">
            <DialogTitle>
              {mode === "export"
                ? "Complete workspace JSON"
                : "Restore from JSON text"}
            </DialogTitle>
            <DialogDescription>
              {mode === "export"
                ? "A complete, restorable backup. You can select and copy this JSON or use the download action."
                : "Paste a complete Arkadios export. Validation happens before any data is replaced."}
            </DialogDescription>
          </div>
          <label className="field">
            Dataset JSON
            <textarea
              aria-label="Dataset JSON"
              className="json-text"
              value={text}
              readOnly={mode === "export"}
              onChange={(e) => setText(e.target.value)}
              rows={10}
              spellCheck={false}
            />
          </label>
          {error && (
            <p className="field-error" role="alert">
              {error}
            </p>
          )}
          <div className="confirm-actions">
            <Button variant="secondary" onClick={() => setOpen(false)}>
              Close JSON
            </Button>
            {mode === "import" && (
              <Button
                disabled={!text.trim()}
                onClick={async () => {
                  try {
                    const candidate = parseImport(text);
                    if (
                      !(await confirm({
                        title: "Replace the current workspace?",
                        description: `Validated ${values(candidate.firms).length} firms, ${values(candidate.contacts).length} contacts, and ${values(candidate.tasks).length} tasks. Import replaces all browser-local data.`,
                        label: "Replace and import",
                      }))
                    )
                      return;
                    useApp.getState().replace(text);
                    setText("");
                    setOpen(false);
                    toast.success("Workspace restored successfully.");
                  } catch (e) {
                    setError(e instanceof Error ? e.message : "Invalid JSON.");
                  }
                }}
              >
                Validate and import
              </Button>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
