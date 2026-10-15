"use client";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
} from "react";
import { useRouter } from "next/navigation";
import { useConfirm } from "./confirm";

type Entry = { discard: () => void };
export type ChangeScope = Set<Entry>;
export const ChangeScopeContext = createContext<ChangeScope | null>(null);
const ChangesContext = createContext<{
  entries: ChangeScope;
  confirmDiscard: (scope?: ChangeScope) => Promise<boolean>;
} | null>(null);

export function UnsavedChangesProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const entries = useMemo<ChangeScope>(() => new Set(), []);
  const confirm = useConfirm();
  const router = useRouter();
  const pending = useRef(false);
  const confirmDiscard = useCallback(
    async (scope = entries) => {
      if (!scope.size) return true;
      if (pending.current) return false;
      pending.current = true;
      try {
        const snapshot = [...scope];
        const discard = await confirm({
          title: "Discard unsaved changes?",
          description:
            "You have changes that have not been saved. Keep editing to preserve them, or discard them to continue.",
          label: "Discard changes",
          cancelLabel: "Keep editing",
          danger: true,
        });
        if (discard)
          snapshot.forEach((entry) => {
            entry.discard();
            scope.delete(entry);
            entries.delete(entry);
          });
        return discard;
      } finally {
        pending.current = false;
      }
    },
    [confirm, entries],
  );
  useEffect(() => {
    const beforeUnload = (event: BeforeUnloadEvent) => {
      if (!entries.size) return;
      event.preventDefault();
      event.returnValue = "";
    };
    const navigate = (event: MouseEvent) => {
      if (
        !entries.size ||
        event.defaultPrevented ||
        event.button !== 0 ||
        event.metaKey ||
        event.ctrlKey ||
        event.shiftKey ||
        event.altKey
      )
        return;
      const link =
        event.target instanceof Element
          ? event.target.closest<HTMLAnchorElement>("a[href]")
          : null;
      if (!link || link.target === "_blank" || link.hasAttribute("download"))
        return;
      const url = new URL(link.href, location.href);
      if (!["http:", "https:"].includes(url.protocol)) return;
      if (
        url.origin === location.origin &&
        url.pathname === location.pathname &&
        url.search === location.search
      )
        return;
      event.preventDefault();
      event.stopPropagation();
      void confirmDiscard().then((leave) => {
        if (!leave) return;
        if (url.origin === location.origin)
          router.push(url.pathname + url.search + url.hash);
        else location.assign(url.href);
      });
    };
    window.addEventListener("beforeunload", beforeUnload);
    document.addEventListener("click", navigate, true);
    return () => {
      window.removeEventListener("beforeunload", beforeUnload);
      document.removeEventListener("click", navigate, true);
    };
  }, [entries, confirmDiscard, router]);
  const value = useMemo(
    () => ({ entries, confirmDiscard }),
    [entries, confirmDiscard],
  );
  return (
    <ChangesContext.Provider value={value}>{children}</ChangesContext.Provider>
  );
}

export function useDiscardChanges() {
  const context = useContext(ChangesContext);
  return context?.confirmDiscard ?? (async () => true);
}

export function useUnsavedChanges(dirty: boolean, discard: () => void) {
  const context = useContext(ChangesContext);
  const scope = useContext(ChangeScopeContext);
  useEffect(() => {
    if (!dirty || !context) return;
    const entry = { discard };
    context.entries.add(entry);
    scope?.add(entry);
    return () => {
      context.entries.delete(entry);
      scope?.delete(entry);
    };
  }, [dirty, discard, context, scope]);
}

export function UnsavedChangesGuard({
  dirty,
  onDiscard,
}: {
  dirty: boolean;
  onDiscard: () => void;
}) {
  useUnsavedChanges(dirty, onDiscard);
  return null;
}
