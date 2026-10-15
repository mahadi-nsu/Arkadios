"use client";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { useMemo, useState } from "react";
import {
  ChangeScope,
  ChangeScopeContext,
  useDiscardChanges,
} from "../unsaved-changes";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";
export function Dialog({
  children,
  open,
  defaultOpen,
  onOpenChange,
  ...props
}: React.ComponentPropsWithoutRef<typeof DialogPrimitive.Root>) {
  const scope = useMemo<ChangeScope>(() => new Set(), []);
  const confirmDiscard = useDiscardChanges();
  const [internalOpen, setInternalOpen] = useState(defaultOpen ?? false);
  return (
    <ChangeScopeContext.Provider value={scope}>
      <DialogPrimitive.Root
        {...props}
        open={open ?? internalOpen}
        onOpenChange={async (next) => {
          if (!next && !(await confirmDiscard(scope))) return;
          setInternalOpen(next);
          onOpenChange?.(next);
        }}
      >
        {children}
      </DialogPrimitive.Root>
    </ChangeScopeContext.Provider>
  );
}
export const DialogTrigger = DialogPrimitive.Trigger;
export const DialogClose = DialogPrimitive.Close;
export function DialogContent({
  children,
  className,
  drawer = false,
  ...props
}: React.ComponentPropsWithoutRef<typeof DialogPrimitive.Content> & {
  drawer?: boolean;
}) {
  return (
    <DialogPrimitive.Portal>
      <DialogPrimitive.Overlay className="dialog-overlay" />
      <DialogPrimitive.Content
        className={cn("dialog-content", drawer && "drawer", className)}
        {...props}
      >
        {children}
        <DialogPrimitive.Close className="dialog-x" aria-label="Close dialog">
          <X size={19} />
        </DialogPrimitive.Close>
      </DialogPrimitive.Content>
    </DialogPrimitive.Portal>
  );
}
export const DialogTitle = DialogPrimitive.Title;
export const DialogDescription = DialogPrimitive.Description;
