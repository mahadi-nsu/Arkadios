import { Dataset, Firm, Task, User } from "./model";
export const actor = (d: Dataset): User => d.users[d.settings.personaId];
export const canAdmin = (d: Dataset) =>
  actor(d)?.active && actor(d).role === "Admin";
export const canWrite = (d: Dataset) =>
  actor(d)?.active && actor(d).role !== "Read-only";
export const canWorkload = (d: Dataset) =>
  actor(d)?.active && ["Admin", "Manager"].includes(actor(d).role);
export const canEditFirm = (d: Dataset, f?: Firm) => {
  const u = actor(d);
  return (
    !!u?.active &&
    (u.role === "Admin" ||
      (u.role === "Manager" && (!f || f.departmentId === u.departmentId)) ||
      (u.role === "Member" && (!f || f.ownerId === u.id)))
  );
};
export const canApprove = (d: Dataset, f: Firm) => {
  const u = actor(d);
  return (
    !!u?.active &&
    (u.role === "Admin" ||
      (u.role === "Manager" && f.departmentId === u.departmentId))
  );
};
export const canEditTask = (
  d: Dataset,
  t: Pick<Task, "departmentId" | "assigneeId">,
) => {
  const u = actor(d);
  return (
    !!u?.active &&
    (u.role === "Admin" ||
      (u.role === "Manager" && t.departmentId === u.departmentId) ||
      (u.role === "Member" && t.assigneeId === u.id))
  );
};
export function requirePermission(allowed: boolean | undefined) {
  if (!allowed)
    throw new Error(
      "Your demo role does not permit this action. Switch to an authorized persona.",
    );
}
