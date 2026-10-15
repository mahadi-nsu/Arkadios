"use client";
import { create } from "zustand";
import { persist, createJSONStorage, StateStorage } from "zustand/middleware";
import { Dataset } from "./model";
import { Command, execute } from "./repository";
import { canAdmin, requirePermission } from "./permissions";
import { createSeed } from "./seed";
import { parseImport, validateDataset } from "./validation";
import { evaluateRules } from "./engine";
const KEY = "arkadios-home-office-v1";
let storageLocked = false;
let storageError = "";
let rawRecovery = "";
const storage: StateStorage = {
  getItem(name) {
    const raw = localStorage.getItem(name);
    if (!raw) return null;
    rawRecovery = raw;
    try {
      const envelope = JSON.parse(raw);
      if (envelope.version !== 1)
        throw new Error("Unsupported persistence version.");
      if (envelope.state?.data)
        envelope.state.data = validateDataset(envelope.state.data);
      else throw new Error("Saved dataset is missing.");
      return JSON.stringify(envelope);
    } catch (error) {
      storageLocked = true;
      throw error;
    }
  },
  setItem(name, value) {
    if (storageLocked) return;
    try {
      localStorage.setItem(name, value);
      storageError = "";
    } catch {
      storageLocked = true;
      storageError =
        "Browser storage is full or unavailable. Your changes remain in memory. Export a backup before leaving.";
      queueMicrotask(() => useApp.setState({ storageError }));
    }
  },
  removeItem(name) {
    localStorage.removeItem(name);
  },
};
interface AppStore {
  data: Dataset | null;
  hydrated: boolean;
  storageError: string;
  departmentId: string;
  setDepartment: (id: string) => void;
  run: (command: Command) => void;
  switchPersona: (id: string) => void;
  replace: (raw: string) => void;
  reset: () => void;
  finishHydration: (error?: unknown) => void;
  retryStorage: () => void;
  recover: () => string;
}
export const useApp = create<AppStore>()(
  persist(
    (set, get) => ({
      data: null,
      hydrated: false,
      storageError: "",
      departmentId: "",
      setDepartment: (departmentId) => set({ departmentId }),
      run(command) {
        const d = get().data;
        if (!d) throw new Error("The demo has not loaded.");
        set({ data: execute(d, command) });
      },
      switchPersona(id) {
        const d = get().data;
        if (!d?.users[id]?.active)
          throw new Error("Choose an active employee.");
        set({
          data: { ...d, settings: { ...d.settings, personaId: id } },
          departmentId: "",
        });
      },
      replace(raw) {
        const current = get().data;
        if (current) requirePermission(canAdmin(current));
        const d = parseImport(raw);
        const importedAdmin = Object.values(d.users).find(
          (u) => u.active && u.role === "Admin",
        );
        if (!importedAdmin)
          throw new Error("The dataset needs an active admin.");
        evaluateRules(d);
        storageLocked = false;
        storageError = "";
        set({ data: d, storageError: "", hydrated: true, departmentId: "" });
      },
      reset() {
        const d = get().data;
        if (d) requirePermission(canAdmin(d));
        storageLocked = false;
        storageError = "";
        set({
          data: createSeed(),
          storageError: "",
          hydrated: true,
          departmentId: "",
        });
      },
      finishHydration(error) {
        if (error) {
          storageLocked = true;
          set({
            hydrated: true,
            storageError: `Saved data could not be loaded: ${error instanceof Error ? error.message : "storage unavailable"}. The original data is preserved. Download recovery data, import a backup, or reset to recover.`,
          });
        } else {
          const d = get().data ?? createSeed();
          evaluateRules(d);
          set({ data: d, hydrated: true });
        }
      },
      retryStorage() {
        storageLocked = false;
        set({ storageError: "", data: get().data });
      },
      recover: () => rawRecovery,
    }),
    {
      name: KEY,
      version: 1,
      storage: createJSONStorage(() => storage),
      skipHydration: true,
      partialize: (state) => ({ data: state.data }),
      onRehydrateStorage: () => (_state, error) => {
        queueMicrotask(() => useApp.getState().finishHydration(error));
      },
    },
  ),
);
export const useData = () => {
  const data = useApp((s) => s.data);
  if (!data)
    throw new Error("Data must be accessed inside the hydrated workspace.");
  return data;
};
