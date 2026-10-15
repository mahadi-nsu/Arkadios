import Link from "next/link";
export default function NotFound() {
  return (
    <div className="empty">
      <h1>This page isn’t in the workspace</h1>
      <p>Find your way back to the Command Center.</p>
      <Link className="btn btn-primary" href="/">
        Return to Command Center
      </Link>
    </div>
  );
}
