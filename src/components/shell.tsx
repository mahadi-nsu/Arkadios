"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import {
  Activity,
  ArrowRight,
  ArrowUpRight,
  Bell,
  BookOpen,
  Building2,
  ChartNoAxesCombined,
  CheckCheck,
  ChevronDown,
  ChevronRight,
  CircleHelp,
  FileText,
  FolderKanban,
  LayoutDashboard,
  ListTodo,
  Menu,
  MessagesSquare,
  Plus,
  Search,
  Settings2,
  ShieldCheck,
  Users,
  UsersRound,
  Workflow,
} from "lucide-react";
import { Toaster, toast } from "sonner";
import { useApp, useData } from "@/lib/store";
import { actor, canWorkload, canWrite } from "@/lib/permissions";
import { values } from "@/lib/selectors";
import { prettyDate } from "@/lib/dates";
import { download } from "@/lib/utils";
import { Avatar, Badge, DepartmentSelect, Empty, TextSearch } from "./common";
import { Button } from "./ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "./ui/dialog";
import { EditorProvider, useEditor } from "./editors";
import { ConfirmProvider, useConfirm } from "./confirm";
import { UnsavedChangesProvider, useDiscardChanges } from "./unsaved-changes";
import { ThemeToggle, useTheme } from "./theme-provider";
const navigation = [
  {
    label: "WORKSPACE",
    items: [
      { title: "Command Center", path: "/", icon: LayoutDashboard },
      { title: "Firm Partners", path: "/firms", icon: Building2 },
      { title: "Contacts", path: "/contacts", icon: Users },
      { title: "Lifecycle Pipeline", path: "/pipeline", icon: Workflow },
      { title: "Tasks", path: "/tasks", icon: ListTodo },
      { title: "Projects", path: "/projects", icon: FolderKanban },
      {
        title: "Communications",
        path: "/communications",
        icon: MessagesSquare,
      },
      { title: "Documents", path: "/documents", icon: FileText },
    ],
  },
  {
    label: "INSIGHTS",
    items: [
      { title: "Reports", path: "/reports", icon: ChartNoAxesCombined },
      { title: "Team Workload", path: "/workload", icon: UsersRound },
    ],
  },
  {
    label: "ADMINISTRATION",
    items: [
      { title: "Workflows & SOPs", path: "/workflows", icon: BookOpen },
      { title: "Settings", path: "/settings", icon: Settings2 },
    ],
  },
];
export function AppShell({ children }: { children: React.ReactNode }) {
  const { theme } = useTheme();
  const hydrated = useApp((s) => s.hydrated),
    data = useApp((s) => s.data),
    storageError = useApp((s) => s.storageError);
  useEffect(() => {
    void useApp.persist.rehydrate();
  }, []);
  return (
    <ConfirmProvider>
      <UnsavedChangesProvider>
        <Toaster theme={theme} position="bottom-right" richColors closeButton />
        {!hydrated ? (
          <div className="boot">
            <Brand />
            <div className="boot-line" />
            <p>Opening your home office…</p>
          </div>
        ) : !data ? (
          <div className="recovery">
            <Brand />
            <h1>Let’s recover your workspace</h1>
            <p role="alert">{storageError}</p>
            <Button
              onClick={() =>
                download("arkadios-recovery.json", useApp.getState().recover())
              }
            >
              Download recovery data
            </Button>
            <input
              aria-label="Import recovery JSON"
              type="file"
              accept=".json"
              onChange={async (e) => {
                try {
                  const file = e.target.files?.[0];
                  if (file) useApp.getState().replace(await file.text());
                } catch (err) {
                  toast.error(String(err));
                }
              }}
            />
            <RecoveryReset />
          </div>
        ) : (
          <EditorProvider>
            <Workspace>{children}</Workspace>
          </EditorProvider>
        )}
      </UnsavedChangesProvider>
    </ConfirmProvider>
  );
}
function RecoveryReset() {
  const confirm = useConfirm();
  return (
    <Button
      variant="secondary"
      onClick={async () => {
        if (
          await confirm({
            title: "Reset saved demo?",
            description:
              "Download the recovery file first if you want to preserve it. Reset replaces browser-local data.",
            danger: true,
            label: "Reset demo",
          })
        )
          useApp.getState().reset();
      }}
    >
      Reset demo
    </Button>
  );
}
export function Brand() {
  return (
    <div className="brand">
      <svg
        width="29"
        height="32"
        viewBox="0 0 32 34"
        fill="none"
        aria-hidden="true"
      >
        <path d="M16 2 31 31H23L16 16 9 31H1L16 2Z" fill="currentColor" />
        <path d="m16 24 4 7h-8l4-7Z" fill="#6CB9AA" />
      </svg>
      <span>
        arkadios<small>HOME OFFICE</small>
      </span>
    </div>
  );
}
function Workspace({ children }: { children: React.ReactNode }) {
  const d = useData(),
    pathname = usePathname(),
    router = useRouter(),
    editor = useEditor();
  const u = actor(d);
  const confirmDiscard = useDiscardChanges();
  const [mobile, setMobile] = useState(false),
    [searchOpen, setSearchOpen] = useState(false),
    [query, setQuery] = useState(""),
    [notifications, setNotifications] = useState(false),
    [help, setHelp] = useState(false),
    [quickAdd, setQuickAdd] = useState(false);
  const departmentId = useApp((s) => s.departmentId),
    setDepartment = useApp((s) => s.setDepartment),
    run = useApp((s) => s.run),
    storageError = useApp((s) => s.storageError);
  const unread = values(d.notifications).filter(
    (n) => !n.read && (n.recipientId === u.id || u.role === "Admin"),
  );
  const page = navigation
    .flatMap((g) => g.items)
    .find((n) =>
      n.path === "/" ? pathname === "/" : pathname.startsWith(n.path),
    );
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setSearchOpen((o) => !o);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);
  useEffect(() => {
    if (!mobile) return;
    const sidebar = document.querySelector<HTMLElement>(".sidebar");
    const focusable = () =>
      Array.from(
        sidebar?.querySelectorAll<HTMLElement>(
          "a[href],button:not(:disabled)",
        ) ?? [],
      );
    focusable()[0]?.focus();
    const trap = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setMobile(false);
        document.querySelector<HTMLElement>(".mobile-toggle")?.focus();
      }
      if (e.key === "Tab") {
        const items = focusable(),
          first = items[0],
          last = items[items.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last?.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first?.focus();
        }
      }
    };
    document.addEventListener("keydown", trap);
    return () => document.removeEventListener("keydown", trap);
  }, [mobile]);
  const matches = query.trim().toLowerCase();
  const results = [
    ...values(d.firms)
      .filter((f) => !f.archived)
      .map((f) => ({
        id: f.id,
        title: f.name,
        kind: "Firm",
        href: `/firms/detail?id=${f.id}`,
      })),
    ...values(d.contacts)
      .filter((c) => !c.archived)
      .map((c) => ({
        id: c.id,
        title: c.name + " · " + c.email,
        kind: "Contact",
        href: `/contacts?q=${encodeURIComponent(c.email)}`,
      })),
    ...values(d.tasks).map((t) => ({
      id: t.id,
      title: t.title,
      kind: "Task",
      href: `/tasks?task=${t.id}`,
    })),
    ...values(d.projects).map((p) => ({
      id: p.id,
      title: p.name,
      kind: "Project",
      href: `/projects/detail?id=${p.id}`,
    })),
  ]
    .filter((r) => r.title.toLowerCase().includes(matches))
    .slice(0, 12);
  return (
    <div className="app-shell">
      <a className="skip-link" href="#main">
        Skip to content
      </a>
      {mobile && (
        <button
          aria-label="Close navigation"
          className="mobile-overlay"
          onClick={() => setMobile(false)}
        />
      )}
      <aside
        id="workspace-sidebar"
        aria-label="Workspace navigation"
        role={mobile ? "dialog" : undefined}
        aria-modal={mobile || undefined}
        className={`sidebar ${mobile ? "sidebar-open" : ""}`}
      >
        <Link href="/" className="brand-link" onClick={() => setMobile(false)}>
          <Brand />
        </Link>
        <div className="workspace-label">
          <div className="workspace-monogram">A</div>
          <div>
            Home Office<span>Internal workspace</span>
          </div>
          <ChevronDown size={14} />
        </div>
        <nav aria-label="Main navigation">
          {navigation.map((group) => (
            <div className="nav-group" key={group.label}>
              <p>{group.label}</p>
              {group.items
                .filter((n) => n.path !== "/workload" || canWorkload(d))
                .map((n) => (
                  <Link
                    key={n.path}
                    href={n.path}
                    onClick={() => setMobile(false)}
                    className={`nav-item ${page?.path === n.path ? "active" : ""}`}
                  >
                    <n.icon size={18} />
                    <span>{n.title}</span>
                    {n.path === "/tasks" && (
                      <span className="nav-count">
                        {
                          values(d.tasks).filter(
                            (t) =>
                              t.assigneeId === u.id && t.status !== "Completed",
                          ).length
                        }
                      </span>
                    )}
                    {n.path === "/communications" && (
                      <span className="nav-dot" />
                    )}
                  </Link>
                ))}
            </div>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="workspace-status">
            <i />
            All systems in demo mode
            <ShieldCheck size={14} />
          </div>
          <button
            className="help-link"
            onClick={() => {
              setMobile(false);
              setHelp(true);
            }}
          >
            <CircleHelp size={17} />
            Workspace guide
            <ArrowUpRight size={14} />
          </button>
          <div className="sidebar-person">
            <Avatar name={u.name} />
            <div>
              <strong>{u.name}</strong>
              <span>
                {u.role} · {d.departments[u.departmentId].name}
              </span>
            </div>
          </div>
        </div>
      </aside>
      <div className="workspace">
        <header className="topbar">
          <div className="breadcrumb">
            <Button
              variant="ghost"
              size="icon"
              className="mobile-toggle"
              aria-label="Open navigation"
              aria-expanded={mobile}
              aria-controls="workspace-sidebar"
              onClick={() => setMobile(true)}
            >
              <Menu size={21} />
            </Button>
            <span className="breadcrumb-home">Workspace</span>
            <ChevronRight size={13} />
            <span>{page?.title ?? "Workspace"}</span>
            {pathname.endsWith("/detail") && (
              <>
                <ChevronRight size={13} />
                <span>Overview</span>
              </>
            )}
          </div>
          <div className="topbar-actions">
            <button
              className="global-search"
              onClick={() => setSearchOpen(true)}
            >
              <Search size={16} />
              <span>Search anything…</span>
              <kbd>⌘ K</kbd>
            </button>
            <ThemeToggle />
            <button
              className="quick-add"
              aria-label="Quick add"
              disabled={!canWrite(d)}
              onClick={() => setQuickAdd(true)}
            >
              <Plus size={17} />
            </button>
            <div className="topbar-divider" />
            <button
              className="notification-button"
              aria-label={`Notifications, ${unread.length} unread`}
              onClick={() => setNotifications(true)}
            >
              <Bell size={19} />
              {unread.length > 0 && <i />}
            </button>
            <Avatar name={u.name} small />
          </div>
        </header>
        <div className="scopebar">
          <div className="demo-badge">
            <span className="demo-indicator" />
            DEMO WORKSPACE
            <span className="scopebar-copy">
              A connected view of every partnership.
            </span>
          </div>
          <div className="scope-controls">
            <label className="scope-control persona-select">
              <UsersRound
                className="scope-control-icon"
                size={19}
                aria-hidden="true"
              />
              <span className="scope-control-content">
                <span className="scope-control-label">Viewing as</span>
                <select
                  aria-label="Demo persona"
                  value={u.id}
                  onChange={async (e) => {
                    const persona = e.target.value;
                    if (await confirmDiscard())
                      useApp.getState().switchPersona(persona);
                  }}
                >
                  {values(d.users)
                    .filter((u) => u.active)
                    .sort(
                      (a, b) =>
                        ["Admin", "Manager", "Member", "Read-only"].indexOf(
                          a.role,
                        ) -
                        ["Admin", "Manager", "Member", "Read-only"].indexOf(
                          b.role,
                        ),
                    )
                    .map((employee) => (
                      <option key={employee.id} value={employee.id}>
                        {employee.name} · {employee.role}
                      </option>
                    ))}
                </select>
              </span>
              <ChevronDown
                className="scope-control-chevron"
                size={16}
                aria-hidden="true"
              />
            </label>
            <label
              className="scope-control scope-department"
              data-filtered={!!departmentId}
            >
              <Building2
                className="scope-control-icon"
                size={19}
                aria-hidden="true"
              />
              <span className="scope-control-content">
                <span className="scope-control-label">Department</span>
                <DepartmentSelect
                  value={departmentId}
                  onChange={setDepartment}
                />
              </span>
              <ChevronDown
                className="scope-control-chevron"
                size={16}
                aria-hidden="true"
              />
            </label>
          </div>
        </div>
        {storageError && (
          <div className="storage-error" role="alert">
            {storageError}
            <Button
              size="sm"
              variant="secondary"
              onClick={() =>
                download("arkadios-backup.json", JSON.stringify(d, null, 2))
              }
            >
              Export backup
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => useApp.getState().retryStorage()}
            >
              Retry saving
            </Button>
          </div>
        )}
        <main id="main" className="main-content">
          {children}
        </main>
        <footer className="app-footer">
          <span>
            Arkadios Home Office <i /> Built around better partnerships.
          </span>
          <span>
            <Activity size={12} /> Browser-local demo <span>·</span>{" "}
            {prettyDate(d.settings.demoDate)}
          </span>
        </footer>
      </div>
      <Dialog open={quickAdd} onOpenChange={setQuickAdd}>
        <DialogContent>
          <div className="drawer-heading">
            <DialogTitle>A clear next step</DialogTitle>
            <DialogDescription>
              Start a partnership or give an action a clear owner.
            </DialogDescription>
          </div>
          <div className="quick-add-options">
            <Button
              variant="secondary"
              onClick={() => {
                setQuickAdd(false);
                editor({ type: "firm" });
              }}
            >
              <Building2 size={20} />
              <span>
                Add firm partner
                <small>Start in Prospect with the current SOP</small>
              </span>
              <ArrowRight size={17} />
            </Button>
            <Button
              variant="secondary"
              onClick={() => {
                setQuickAdd(false);
                editor({ type: "task" });
              }}
            >
              <ListTodo size={20} />
              <span>
                Create task
                <small>Set the owner, priority, and next due date</small>
              </span>
              <ArrowRight size={17} />
            </Button>
          </div>
        </DialogContent>
      </Dialog>
      <Dialog open={searchOpen} onOpenChange={setSearchOpen}>
        <DialogContent className="search-dialog">
          <DialogTitle>Search your workspace</DialogTitle>
          <DialogDescription>
            Find firms, contacts, tasks, and projects.
          </DialogDescription>
          <TextSearch
            value={query}
            onChange={setQuery}
            placeholder="Search by name, email, or task…"
          />
          <div className="search-results">
            {results.map((r) => (
              <Link
                key={r.id}
                href={r.href}
                onClick={() => setSearchOpen(false)}
              >
                <span>
                  <Badge>{r.kind}</Badge>
                  {r.title}
                </span>
                <ArrowUpRight size={16} />
              </Link>
            ))}
            {!results.length && (
              <Empty
                title="No matches"
                description="Try a firm name, contact email, or task title."
              />
            )}
          </div>
        </DialogContent>
      </Dialog>
      <Dialog open={notifications} onOpenChange={setNotifications}>
        <DialogContent drawer>
          <div className="drawer-heading">
            <DialogTitle>Notifications</DialogTitle>
            <DialogDescription>
              Local workflow alerts for {u.name}.
            </DialogDescription>
          </div>
          <div className="notification-actions">
            <Button
              variant="secondary"
              size="sm"
              onClick={() => run({ type: "notification.read" })}
            >
              <CheckCheck size={15} />
              Mark all as read
            </Button>
          </div>
          <div className="notification-list">
            {values(d.notifications)
              .filter((n) => n.recipientId === u.id || u.role === "Admin")
              .sort((a, b) => b.at.localeCompare(a.at))
              .map((n) => (
                <button
                  key={n.id}
                  className={n.read ? "" : "unread"}
                  onClick={() => {
                    run({ type: "notification.read", id: n.id });
                    router.push(n.href);
                    setNotifications(false);
                  }}
                >
                  <span className="notification-icon">
                    <Bell size={17} />
                  </span>
                  <span>
                    <strong>{n.title}</strong>
                    <p>{n.body}</p>
                    <small>{prettyDate(n.at)}</small>
                  </span>
                  <ChevronRight size={15} />
                </button>
              ))}
          </div>
        </DialogContent>
      </Dialog>
      <Dialog open={help} onOpenChange={setHelp}>
        <DialogContent>
          <div className="drawer-heading">
            <DialogTitle>Your connected partner workspace</DialogTitle>
            <DialogDescription>
              Follow a firm from first conversation to a lasting relationship.
            </DialogDescription>
          </div>
          <div className="guide-steps">
            {[
              "Create a prospect firm and add its primary contact.",
              "Open the firm’s Checklist. Complete each requirement with its evidence.",
              "Approve the handoff. The next stage’s assigned tasks appear automatically.",
              "In Onboarding, simulate both agreement signatures in Documents.",
              "Complete Implementation and Training to enter Relationship.",
              "Schedule a review, capture outcomes, and add a follow-up.",
              "Edit and publish an SOP. Existing firms keep their original version.",
              "Export, reset, and import from Settings → Demo controls.",
            ].map((s, i) => (
              <p key={s}>
                <span>{i + 1}</span>
                {s}
              </p>
            ))}
          </div>
          <div className="notice">
            Use the Admin persona for the complete journey. All data and
            permissions are browser-local demonstrations. No emails, signatures,
            or integrations are live.
          </div>
          <Button
            onClick={() => {
              setHelp(false);
              editor({ type: "firm" });
            }}
            disabled={!canWrite(d)}
          >
            Start a new partnership
            <ArrowRight size={16} />
          </Button>
        </DialogContent>
      </Dialog>
    </div>
  );
}
