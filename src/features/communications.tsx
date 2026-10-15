"use client";
import { useSearchParams } from "next/navigation";
import { useState } from "react";
import {
  ChevronLeft,
  ListTodo,
  Mail,
  Plus,
  Send,
  StickyNote,
} from "lucide-react";
import { toast } from "sonner";
import { useApp, useData } from "@/lib/store";
import { values } from "@/lib/selectors";
import { actor, canEditFirm, canWrite } from "@/lib/permissions";
import { prettyDate } from "@/lib/dates";
import {
  Avatar,
  Badge,
  Empty,
  FirmLink,
  PageHeading,
  TextSearch,
} from "@/components/common";
import { useEditor } from "@/components/editors";
import { Button } from "@/components/ui/button";
import {
  useDiscardChanges,
  useUnsavedChanges,
} from "@/components/unsaved-changes";
export function Communications() {
  const d = useData(),
    params = useSearchParams(),
    editor = useEditor(),
    run = useApp((s) => s.run),
    department = useApp((s) => s.departmentId),
    u = actor(d);
  const [query, setQuery] = useState(""),
    [status, setStatus] = useState(""),
    [selected, setSelected] = useState(
      params.get("thread") ?? values(d.threads)[0]?.id ?? "",
    ),
    [body, setBody] = useState(""),
    [internal, setInternal] = useState(false),
    [mobileThread, setMobileThread] = useState(false);
  const threads = values(d.threads)
    .filter(
      (th) =>
        (!department || d.firms[th.firmId].departmentId === department) &&
        (!status || th.status === status) &&
        `${th.subject} ${d.firms[th.firmId]?.name} ${values(d.messages)
          .filter((m) => m.threadId === th.id)
          .map((m) => m.body)
          .join(" ")}`
          .toLowerCase()
          .includes(query.toLowerCase()),
    )
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  const th = d.threads[selected];
  const messages = values(d.messages)
    .filter((m) => m.threadId === th?.id)
    .sort((a, b) => a.at.localeCompare(b.at));
  const allowed =
    th &&
    canWrite(d) &&
    (canEditFirm(d, d.firms[th.firmId]) ||
      (u.role === "Member" && th.ownerId === u.id));
  const confirmDiscard = useDiscardChanges();
  useUnsavedChanges(!!allowed && !!body.trim(), () => setBody(""));
  return (
    <>
      <PageHeading
        title="Communications"
        description="Keep the conversation connected to the partnership."
        actions={
          <Button
            disabled={!canWrite(d)}
            onClick={() => editor({ type: "thread" })}
          >
            <Plus size={16} />
            New conversation
          </Button>
        }
      />
      <div className="inbox panel">
        <aside
          className={`inbox-list ${mobileThread ? "mobile-thread-open" : ""}`}
        >
          <div className="inbox-list-toolbar">
            <div>
              <h2>Conversations</h2>
              <Badge>{threads.length}</Badge>
              <select
                aria-label="Conversation status filter"
                value={status}
                onChange={(e) => setStatus(e.target.value)}
              >
                <option value="">All statuses</option>
                {["Open", "Waiting", "Resolved"].map((s) => (
                  <option key={s}>{s}</option>
                ))}
              </select>
            </div>
            <TextSearch
              value={query}
              onChange={setQuery}
              placeholder="Search conversations…"
            />
          </div>
          <div className="thread-list">
            {threads.map((t) => {
              const last = values(d.messages)
                .filter((m) => m.threadId === t.id)
                .sort((a, b) => b.at.localeCompare(a.at))[0];
              return (
                <button
                  key={t.id}
                  className={selected === t.id ? "selected" : ""}
                  onClick={async () => {
                    if (t.id !== selected && !(await confirmDiscard())) return;
                    setSelected(t.id);
                    if (t.id !== selected) setBody("");
                    setMobileThread(true);
                  }}
                >
                  <div className="thread-item-top">
                    <span>{d.firms[t.firmId]?.name}</span>
                    <small>{prettyDate(t.updatedAt, "MMM d")}</small>
                  </div>
                  <strong>{t.subject}</strong>
                  <p>
                    {last?.body ??
                      "Start the conversation with a demo reply or an internal note."}
                  </p>
                  <div className="thread-item-bottom">
                    <Badge
                      tone={
                        t.status === "Open"
                          ? "blue"
                          : t.status === "Waiting"
                            ? "amber"
                            : "green"
                      }
                    >
                      {t.status}
                    </Badge>
                    <span>{d.users[t.ownerId]?.name}</span>
                  </div>
                </button>
              );
            })}
            {!threads.length && (
              <Empty
                title="No conversations found"
                description="Change your filters or start a new thread."
              />
            )}
          </div>
        </aside>
        <section
          className={`inbox-thread ${mobileThread ? "mobile-thread-open" : ""}`}
        >
          {th ? (
            <>
              <header className="thread-header">
                <Button
                  className="inbox-back"
                  variant="ghost"
                  size="icon"
                  aria-label="Back to conversations"
                  onClick={() => setMobileThread(false)}
                >
                  <ChevronLeft size={20} />
                </Button>
                <div>
                  <h2>{th.subject}</h2>
                  <div>
                    <FirmLink id={th.firmId} />
                    <span>·</span>
                    <span>Owner: {d.users[th.ownerId]?.name}</span>
                  </div>
                </div>
                <Button
                  variant="secondary"
                  size="sm"
                  disabled={!allowed}
                  onClick={() =>
                    editor({
                      type: "task",
                      firmId: th.firmId,
                      title: `Follow up: ${th.subject}`,
                    })
                  }
                >
                  <ListTodo size={15} />
                  Follow-up task
                </Button>
              </header>
              <div className="thread-participants">
                <span>Participants</span>
                {th.contactIds.length ? (
                  th.contactIds.map((id) => (
                    <span key={id} title={d.contacts[id]?.email}>
                      <Avatar name={d.contacts[id]?.name ?? ""} small />
                      {d.contacts[id]?.name}
                    </span>
                  ))
                ) : (
                  <span>Firm team</span>
                )}
                <select
                  aria-label="Thread status"
                  value={th.status}
                  disabled={!allowed}
                  onChange={(e) => {
                    try {
                      run({
                        type: "thread.save",
                        value: {
                          ...th,
                          status: e.target.value as typeof th.status,
                        },
                      });
                      toast.success("Conversation status updated.");
                    } catch (err) {
                      toast.error(String(err));
                    }
                  }}
                >
                  {["Open", "Waiting", "Resolved"].map((s) => (
                    <option key={s}>{s}</option>
                  ))}
                </select>
              </div>
              <div className="message-history">
                <div className="message-date-divider">
                  <span>Partnership conversation</span>
                </div>
                {messages.map((m) => (
                  <article
                    className={`message message-${m.kind === "Internal note" ? "internal" : m.kind === "Demo reply" ? "outgoing" : "incoming"}`}
                    key={m.id}
                  >
                    <Avatar name={m.author} />
                    <div className="message-content">
                      <div className="message-heading">
                        <strong>{m.author}</strong>
                        <Badge
                          tone={
                            m.kind === "Internal note"
                              ? "amber"
                              : m.kind === "Demo reply"
                                ? "green"
                                : "neutral"
                          }
                        >
                          {m.kind}
                        </Badge>
                        <time>{prettyDate(m.at, "MMM d · h:mm a")}</time>
                      </div>
                      <p>{m.body}</p>
                      {m.kind === "Demo reply" && (
                        <small className="simulated-label">
                          Simulated outgoing message · no email sent
                        </small>
                      )}
                    </div>
                  </article>
                ))}
                {!messages.length && (
                  <Empty
                    title="The conversation starts here"
                    description="Send a demo reply or leave an internal note for your team."
                  />
                )}
              </div>
              <form
                className={`message-composer ${internal ? "internal-composer" : ""}`}
                onSubmit={(e) => {
                  e.preventDefault();
                  try {
                    run({
                      type: "message.add",
                      threadId: th.id,
                      body,
                      internal,
                    });
                    setBody("");
                    toast.success(
                      internal
                        ? "Internal note added."
                        : "Demo reply recorded. No email was sent.",
                    );
                  } catch (err) {
                    toast.error(
                      err instanceof Error ? err.message : "Unable to send.",
                    );
                  }
                }}
              >
                <div className="composer-tabs">
                  <button
                    type="button"
                    onClick={() => setInternal(false)}
                    className={!internal ? "active" : ""}
                  >
                    <Mail size={14} />
                    Demo reply
                  </button>
                  <button
                    type="button"
                    onClick={() => setInternal(true)}
                    className={internal ? "active" : ""}
                  >
                    <StickyNote size={14} />
                    Internal note
                  </button>
                </div>
                <label className="sr-only" htmlFor="reply-body">
                  {internal ? "Internal note" : "Demo reply"}
                </label>
                <textarea
                  id="reply-body"
                  disabled={!allowed}
                  value={body}
                  onChange={(e) => setBody(e.target.value)}
                  placeholder={
                    internal
                      ? "Leave context for your internal team…"
                      : "Write a thoughtful reply…"
                  }
                  rows={4}
                />
                <div className="composer-footer">
                  <span>
                    {internal
                      ? "Visible to internal employees only"
                      : "Simulation only. No real email will be sent."}
                  </span>
                  <Button
                    type="submit"
                    size="sm"
                    disabled={!allowed || !body.trim()}
                  >
                    {internal ? <StickyNote size={14} /> : <Send size={14} />}{" "}
                    {internal ? "Add internal note" : "Send demo reply"}
                  </Button>
                </div>
              </form>
            </>
          ) : (
            <Empty
              title="A shared conversation, in context"
              description="Choose a conversation from the left."
            />
          )}
        </section>
      </div>
    </>
  );
}
