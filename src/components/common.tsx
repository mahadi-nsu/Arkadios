"use client";
import Link from "next/link";
import {
  ArrowDown,
  ArrowUp,
  ArrowUpRight,
  ChevronLeft,
  ChevronRight,
  ChevronsUpDown,
  Inbox,
  Columns3,
  Search,
} from "lucide-react";
import {
  ColumnDef,
  flexRender,
  getCoreRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  SortingState,
  VisibilityState,
  useReactTable,
} from "@tanstack/react-table";
import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "./ui/dialog";
import { Button } from "./ui/button";
import { cn, initials } from "@/lib/utils";
import { Dataset, Firm, Stage } from "@/lib/model";
import { health, stageColor, values } from "@/lib/selectors";
import { useData } from "@/lib/store";
export function Badge({
  children,
  tone = "neutral",
  dot = false,
}: {
  children: React.ReactNode;
  tone?: string;
  dot?: boolean;
}) {
  return (
    <span className={cn("badge", `badge-${tone}`)}>
      {dot && <i />}
      {children}
    </span>
  );
}
export function StageBadge({ stage }: { stage: Stage }) {
  const d = useData();
  return (
    <span
      className="stage-badge"
      style={{ "--stage-color": stageColor[stage] } as React.CSSProperties}
    >
      <i />
      {d.settings.stageLabels[stage]}
    </span>
  );
}
export function HealthBadge({ firm }: { firm: Firm }) {
  const d = useData(),
    h = health(d, firm);
  return (
    <span title={h.reason}>
      <Badge
        dot
        tone={
          h.label === "On track"
            ? "green"
            : h.label === "At risk"
              ? "red"
              : "amber"
        }
      >
        {h.label}
      </Badge>
    </span>
  );
}
export function Avatar({
  name,
  small = false,
  index = 0,
}: {
  name: string;
  small?: boolean;
  index?: number;
}) {
  return (
    <span
      className={cn("avatar", small && "avatar-sm", `avatar-${index % 5}`)}
      aria-label={name}
    >
      {initials(name)}
    </span>
  );
}
export function Person({
  id,
  d,
  compact = false,
}: {
  id: string;
  d: Dataset;
  compact?: boolean;
}) {
  const u = d.users[id];
  return (
    <span className="person">
      <Avatar name={u?.name ?? "Unassigned"} small />
      <span>
        {compact ? u?.name.split(" ")[0] : (u?.name ?? "Unassigned")}
        {u && !u.active && " (inactive)"}
      </span>
    </span>
  );
}
export function FirmLink({ id }: { id?: string }) {
  const d = useData();
  return id && d.firms[id] ? (
    <Link className="text-link" href={`/firms/detail?id=${id}`}>
      {d.firms[id].name}
    </Link>
  ) : (
    <span className="muted">Internal</span>
  );
}
export function PageHeading({
  eyebrow,
  title,
  description,
  actions,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  actions?: React.ReactNode;
}) {
  return (
    <div className="page-heading">
      <div>
        {eyebrow && <p className="eyebrow">{eyebrow}</p>}
        <h1>{title}</h1>
        {description && <p className="page-description">{description}</p>}
      </div>
      <div className="heading-actions">{actions}</div>
    </div>
  );
}
export function Empty({
  title = "Nothing here yet",
  description = "Add a record to get started.",
  action,
}: {
  title?: string;
  description?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="empty">
      <div className="empty-icon">
        <Inbox size={26} />
      </div>
      <h3>{title}</h3>
      <p>{description}</p>
      {action}
    </div>
  );
}
export function Progress({
  value,
  small = false,
}: {
  value: number;
  small?: boolean;
}) {
  return (
    <div className={cn("progress-wrap", small && "progress-small")}>
      <div className="progress-track">
        <span style={{ width: `${value}%` }} />
      </div>
      <span>{value}%</span>
    </div>
  );
}
export function SectionHeading({
  title,
  sub,
  action,
}: {
  title: string;
  sub?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="section-heading">
      <div>
        <h2>{title}</h2>
        {sub && <p>{sub}</p>}
      </div>
      {action}
    </div>
  );
}
export function TextSearch({
  value,
  onChange,
  placeholder = "Search records…",
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  return (
    <label className="search-input">
      <Search size={16} />
      <input
        aria-label={placeholder}
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    </label>
  );
}
export function DataTable<T>({
  data,
  columns,
  pageSize = 10,
  empty = "No matching records",
  onRowClick,
  preferenceKey,
}: {
  data: T[];
  columns: ColumnDef<T>[];
  pageSize?: number;
  empty?: string;
  onRowClick?: (row: T) => void;
  preferenceKey?: string;
}) {
  const [sorting, setSorting] = useState<SortingState>([]);
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({});
  const [pagination, setPagination] = useState({ pageIndex: 0, pageSize });
  const [preferencesOpen, setPreferencesOpen] = useState(false);
  const [loaded, setLoaded] = useState(false);
  useEffect(() => {
    if (preferenceKey) {
      try {
        const stored = JSON.parse(
          localStorage.getItem(`arkadios-table-${preferenceKey}-v1`) ?? "null",
        );
        if (stored && [10, 25, 50].includes(stored.pageSize))
          setPagination({ pageIndex: 0, pageSize: stored.pageSize });
        if (stored?.hidden && Array.isArray(stored.hidden))
          setColumnVisibility(
            Object.fromEntries(
              stored.hidden
                .filter(
                  (id: unknown) =>
                    typeof id === "string" &&
                    !["name", "title", "select"].includes(id),
                )
                .map((id: string) => [id, false]),
            ),
          );
      } catch {
        /* Table preferences are optional; records remain available. */
      }
    }
    setLoaded(true);
  }, [preferenceKey]);
  useEffect(() => {
    if (!preferenceKey || !loaded) return;
    try {
      localStorage.setItem(
        `arkadios-table-${preferenceKey}-v1`,
        JSON.stringify({
          pageSize: pagination.pageSize,
          hidden: Object.keys(columnVisibility).filter(
            (id) => columnVisibility[id] === false,
          ),
        }),
      );
    } catch {
      /* A blocked preference write must not block the table. */
    }
  }, [preferenceKey, loaded, pagination.pageSize, columnVisibility]);
  // TanStack owns its mutable table model; this component is intentionally not compiler-memoized.
  // eslint-disable-next-line react-hooks/incompatible-library
  const table = useReactTable({
    data,
    columns,
    state: { sorting, columnVisibility, pagination },
    onSortingChange: setSorting,
    onColumnVisibilityChange: setColumnVisibility,
    onPaginationChange: setPagination,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
  });
  const allColumns = table.getAllLeafColumns();
  const primary =
    allColumns.find((column) => ["name", "title"].includes(column.id)) ??
    allColumns.find((column) => column.id !== "select");
  const selectionVisible = table
    .getVisibleLeafColumns()
    .some((column) => column.id === "select");
  const cellProps = (id: string) =>
    id === primary?.id
      ? { className: "pinned-cell", style: { left: selectionVisible ? 44 : 0 } }
      : id === "select"
        ? { className: "selection-cell pinned-cell", style: { left: 0 } }
        : {};
  const label = (column: (typeof allColumns)[number]) =>
    typeof column.columnDef.header === "string"
      ? column.columnDef.header
      : column.id === "select"
        ? "Select rows"
        : column.id === "actions"
          ? "Actions"
          : column.id.replaceAll("_", " ");
  const visibleCount = table.getVisibleLeafColumns().length;
  return (
    <>
      <div className="data-table-controls">
        <span>
          {visibleCount} of {allColumns.length} columns
        </span>
        <div>
          <label className="table-page-size">
            Rows per page
            <select
              aria-label="Rows per page"
              value={pagination.pageSize}
              onChange={(event) =>
                table.setPageSize(Number(event.target.value))
              }
            >
              {[10, 25, 50].map((size) => (
                <option key={size} value={size}>
                  {size}
                </option>
              ))}
            </select>
          </label>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => setPreferencesOpen(true)}
          >
            <Columns3 size={15} />
            Columns
          </Button>
        </div>
      </div>
      <div
        className="table-scroll data-table-viewport"
        role="region"
        aria-label="Scrollable records"
        tabIndex={0}
      >
        <table className="data-table">
          <thead>
            {table.getHeaderGroups().map((hg) => (
              <tr key={hg.id}>
                {hg.headers.map((h) => (
                  <th
                    key={h.id}
                    {...cellProps(h.column.id)}
                    aria-sort={
                      h.column.getIsSorted() === "asc"
                        ? "ascending"
                        : h.column.getIsSorted() === "desc"
                          ? "descending"
                          : undefined
                    }
                  >
                    {h.isPlaceholder ? null : h.column.getCanSort() ? (
                      <button
                        className="sort-button"
                        onClick={h.column.getToggleSortingHandler()}
                      >
                        {flexRender(h.column.columnDef.header, h.getContext())}
                        {h.column.getIsSorted() === "asc" ? (
                          <ArrowUp size={12} />
                        ) : h.column.getIsSorted() === "desc" ? (
                          <ArrowDown size={12} />
                        ) : (
                          <ChevronsUpDown size={12} />
                        )}
                      </button>
                    ) : (
                      flexRender(h.column.columnDef.header, h.getContext())
                    )}
                  </th>
                ))}
              </tr>
            ))}
          </thead>
          <tbody>
            {table.getRowModel().rows.map((row) => (
              <tr
                key={row.id}
                onClick={
                  onRowClick ? () => onRowClick(row.original) : undefined
                }
                className={onRowClick ? "clickable-row" : ""}
              >
                {row.getVisibleCells().map((cell) => (
                  <td key={cell.id} {...cellProps(cell.column.id)}>
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
        {!data.length && (
          <Empty
            title={empty}
            description="Try another search or change your filters."
          />
        )}
      </div>
      <div className="table-footer">
        <span>
          {data.length ? pagination.pageIndex * pagination.pageSize + 1 : 0}–
          {Math.min(
            (pagination.pageIndex + 1) * pagination.pageSize,
            data.length,
          )}{" "}
          of {data.length} records
        </span>
        <div className="pagination">
          <span>
            Page {data.length ? pagination.pageIndex + 1 : 0} of{" "}
            {table.getPageCount()}
          </span>
          <Button
            variant="secondary"
            size="icon"
            aria-label="Previous page"
            disabled={!table.getCanPreviousPage()}
            onClick={() => table.previousPage()}
          >
            <ChevronLeft size={15} />
          </Button>
          <Button
            variant="secondary"
            size="icon"
            aria-label="Next page"
            disabled={!table.getCanNextPage()}
            onClick={() => table.nextPage()}
          >
            <ChevronRight size={15} />
          </Button>
        </div>
      </div>
      <Dialog open={preferencesOpen} onOpenChange={setPreferencesOpen}>
        <DialogContent className="table-columns-dialog">
          <div className="drawer-heading">
            <DialogTitle>Choose columns</DialogTitle>
            <DialogDescription>
              Keep the information you need. The name and row selection stay
              visible while you scroll.
            </DialogDescription>
          </div>
          <fieldset className="table-column-options">
            <legend className="sr-only">Visible columns</legend>
            {allColumns.map((column) => (
              <label className="check-label" key={column.id}>
                <input
                  type="checkbox"
                  checked={
                    column.id === primary?.id ||
                    column.id === "select" ||
                    column.getIsVisible()
                  }
                  disabled={column.id === primary?.id || column.id === "select"}
                  onChange={column.getToggleVisibilityHandler()}
                />
                <span>
                  {label(column)}
                  {column.id === primary?.id && <small>Always visible</small>}
                </span>
              </label>
            ))}
          </fieldset>
          <div className="confirm-actions">
            <Button
              variant="secondary"
              onClick={() => table.resetColumnVisibility()}
            >
              Show all
            </Button>
            <Button onClick={() => setPreferencesOpen(false)}>Done</Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
export const ViewLink = ({
  href,
  children = "View all",
}: {
  href: string;
  children?: React.ReactNode;
}) => (
  <Link className="view-link" href={href}>
    {children}
    <ArrowUpRight size={14} />
  </Link>
);
export function DepartmentSelect({
  value,
  onChange,
  all = true,
}: {
  value: string;
  onChange: (s: string) => void;
  all?: boolean;
}) {
  const d = useData();
  return (
    <select
      aria-label="Department scope"
      value={value}
      onChange={(e) => onChange(e.target.value)}
    >
      {all && <option value="">All departments</option>}
      {values(d.departments).map((dep) => (
        <option key={dep.id} value={dep.id}>
          {dep.name}
        </option>
      ))}
    </select>
  );
}
