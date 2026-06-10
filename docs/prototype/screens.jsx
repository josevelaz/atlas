// Atlas — screen components

// Avatar helper
const initials = (name) => name.split(/\s+/).slice(0, 2).map(s => s[0]).join("").toUpperCase();
const avatarColors = ["#7A83FF", "#FACC00", "#FF4D50", "#00D696", "#0099FF", "#FF7A05", "#A985FF", "#FF6B9D"];
const avatarColor = (name) => avatarColors[name.charCodeAt(0) % avatarColors.length];

const Avatar = ({ name, size }) => (
  <div className={"avatar " + (size === "sm" ? "sm" : size === "lg" ? "lg" : "")}
       style={{ background: avatarColor(name) }}>
    {initials(name)}
  </div>
);

// ====== Screener Screen ======
const ScreenerScreen = ({ items, onAccept, onReject, accepted, rejected }) => {
  const pending = items.filter(i => !accepted[i.id] && !rejected[i.id]);
  if (pending.length === 0) {
    return (
      <div className="empty">
        <div className="ic-box"><Icon name="check" size={40} stroke={3} /></div>
        <h3>Screener clear</h3>
        <p>You've decided on everyone in the screener. New first-time senders will land here when they arrive.</p>
      </div>
    );
  }
  return (
    <div className="thread-body" style={{ padding: "20px 24px 60px", maxWidth: 720, margin: "0 auto", width: "100%" }}>
      <div style={{ marginBottom: 20 }}>
        <h2 style={{ fontSize: 28, marginBottom: 4 }}>The Screener</h2>
        <p style={{ color: "var(--muted)", fontSize: 13, lineHeight: 1.5 }}>
          First-time senders. Decide once — Atlas routes the rest.
        </p>
      </div>
      {pending.map(item => (
        <div key={item.id} className="screener-card">
          <div className="screener-head">
            <Avatar name={item.from} size="lg" />
            <div style={{ flex: 1 }}>
              <div className="name">{item.from}</div>
              <div className="addr">{item.addr}</div>
            </div>
            <div className="mono" style={{ color: "var(--muted)", fontSize: 12 }}>{item.time}</div>
          </div>
          <div className="screener-preview">
            <div style={{ fontWeight: 800, marginBottom: 6 }}>{item.subject}</div>
            <div>{item.preview}</div>
          </div>
          <div className="screener-ai">
            <Icon name="sparkle" size={14} color="#fff" stroke={2.5} />
            <span style={{ flex: 1 }}>{item.aiHint}</span>
            <span className="pill">{item.aiCategory.toUpperCase()}</span>
          </div>
          <div className="screener-actions">
            <div className="accept" onClick={() => onAccept(item.id, item.aiCategory)}>
              <Icon name="check" size={18} stroke={3} />
              ACCEPT INTO {item.aiCategory.toUpperCase()}
            </div>
            <div className="reject" onClick={() => onReject(item.id)}>
              <Icon name="hide" size={18} stroke={3} />
              REJECT
            </div>
          </div>
        </div>
      ))}
    </div>
  );
};

// ====== Mail row ======
const priorityLabel = (p) => p === 1 ? "P1" : p === 2 ? "P2" : "P3";
const MailRow = ({ mail, selected, onClick }) => {
  return (
    <div className={"mail-row" + (mail.unread ? " unread" : "") + (selected ? " selected" : "")} onClick={onClick}>
      <Avatar name={mail.from} />
      <div style={{ minWidth: 0 }}>
        <div className="from">{mail.from}</div>
        <div className="subj" style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{mail.subject}</div>
        <div className="preview" style={{ display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>{mail.preview}</div>
        {(mail.tags || mail.priority) && (
          <div className="row-tags">
            {mail.priority && <span className={"priority p" + mail.priority}>{priorityLabel(mail.priority)}</span>}
            {(mail.tags || []).map(t => <span key={t} className="tag">{t.replace("-", " ")}</span>)}
          </div>
        )}
      </div>
      <div className="meta-text">{mail.time}</div>
    </div>
  );
};

// ====== Mail List ======
const MailList = ({ title, items, selectedId, onSelect, headerExtra, aiBanner }) => {
  return (
    <>
      <div className="list-header">
        <h2>{title}</h2>
        <div className="row gap-8">
          {headerExtra}
          <span className="meta tabular">{items.length}</span>
        </div>
      </div>
      {aiBanner}
      <div className="list-scroll">
        {items.length === 0 ? (
          <div className="empty" style={{ padding: 60 }}>
            <div className="ic-box" style={{ background: "var(--background)" }}>
              <Icon name="inbox" size={36} stroke={2.5} />
            </div>
            <h3>Nothing here yet</h3>
            <p>New mail you've accepted will appear here.</p>
          </div>
        ) : items.map(m => (
          <MailRow key={m.id} mail={m} selected={selectedId === m.id} onClick={() => onSelect(m.id)} />
        ))}
      </div>
    </>
  );
};

// ====== Thread View ======
const ThreadView = ({ thread, onReplyClick, onArchive, onTrash, onSetAside, onReplyLater, setAside, replyLater }) => {
  if (!thread) {
    return (
      <div className="empty">
        <div className="ic-box"><Icon name="inbox" size={36} stroke={2.5} /></div>
        <h3>No thread selected</h3>
        <p>Pick something from the list to read it here.</p>
      </div>
    );
  }
  return (
    <div className="thread">
      <div className="thread-toolbar">
        <div className="row gap-8">
          <button className="btn sm" onClick={onArchive}><Icon name="archive" size={14} /> Archive</button>
          <button className="btn sm" onClick={onTrash}><Icon name="trash" size={14} /> Trash</button>
          <div style={{ width: 1, height: 20, background: "var(--border)" }} />
          <button className={"btn sm " + (setAside ? "primary" : "")} onClick={onSetAside}>
            <Icon name="clock" size={14} /> Set aside
          </button>
          <button className={"btn sm " + (replyLater ? "primary" : "")} onClick={onReplyLater}>
            <Icon name="reply" size={14} /> Reply later
          </button>
        </div>
        <div className="row gap-8">
          <button className="btn sm icon"><Icon name="chevron-up" size={14} /></button>
          <button className="btn sm icon"><Icon name="chevron-down" size={14} /></button>
        </div>
      </div>
      <div className="thread-body">
        <div style={{ marginBottom: 18 }}>
          <h2 style={{ fontSize: 26, lineHeight: 1.2, marginBottom: 10 }}>{thread.subject}</h2>
          <div className="row gap-8">
            {thread.priority && <span className={"priority p" + thread.priority}>{priorityLabel(thread.priority)} priority</span>}
            <span className="tag"><Icon name="inbox" size={11} /> Inbox</span>
            {(thread.tags || []).map(t => <span key={t} className="tag">{t.replace("-"," ")}</span>)}
          </div>
        </div>

        {thread.body?.aiSummary && (
          <div className="ai-summary">
            <div className="head">
              <Icon name="sparkle" size={14} color="#fff" stroke={2.5} /> AI summary
              <span style={{ marginLeft: "auto", fontWeight: 600, opacity: .85, fontSize: 11 }}>3 messages · 2 tasks · 1 date</span>
            </div>
            <div className="body">{thread.body.aiSummary}</div>
            <div className="extracted">
              <div style={{ fontFamily: "var(--font-mono)", fontSize: 10, fontWeight: 800, letterSpacing: ".06em", textTransform: "uppercase", color: "var(--muted)" }}>EXTRACTED</div>
              {thread.body.tasks.map((t, i) => (
                <div key={"t"+i} className="extract-item">
                  <span className="ic task"><Icon name="check" size={12} stroke={3} /></span>
                  <span>{t.label}</span>
                  <span className="mono" style={{ color: "var(--muted)", fontSize: 11 }}>{t.due}</span>
                </div>
              ))}
              {thread.body.dates.map((t, i) => (
                <div key={"d"+i} className="extract-item">
                  <span className="ic date"><Icon name="calendar" size={12} stroke={2.5} /></span>
                  <span>{t.label}</span>
                  <span className="mono" style={{ color: "var(--muted)", fontSize: 11 }}>{t.due}</span>
                </div>
              ))}
              <div className="row gap-8" style={{ marginTop: 4 }}>
                <button className="btn sm primary"><Icon name="check" size={12} stroke={3} /> Confirm 2 tasks</button>
                <button className="btn sm"><Icon name="calendar" size={12} /> Add to Google Calendar</button>
              </div>
            </div>
          </div>
        )}

        {(thread.body?.messages || []).map((m, i) => (
          <div key={i} className="message">
            <div className="message-head">
              <Avatar name={m.from} />
              <div className="who">
                <div className="name">{m.from}</div>
                <div className="addr">{m.addr}</div>
              </div>
              <div className="date">{m.time}</div>
            </div>
            <div className="message-body">
              {m.body.map((p, j) => <p key={j}>{p}</p>)}
            </div>
          </div>
        ))}

        <div className="row gap-8" style={{ marginTop: 18 }}>
          <button className="btn primary" onClick={onReplyClick}><Icon name="reply" size={14} stroke={2.5} /> Reply</button>
          <button className="btn"><Icon name="reply-all" size={14} /> Reply all</button>
          <button className="btn"><Icon name="forward" size={14} /> Forward</button>
        </div>
      </div>
    </div>
  );
};

// ====== Compose overlay ======
const Compose = ({ onClose, replyTo }) => {
  return (
    <div className="overlay" onClick={onClose}>
      <div className="compose-card" onClick={e => e.stopPropagation()}>
        <div className="compose-head">
          <h3 style={{ fontSize: 16 }}>{replyTo ? "Reply" : "New message"}</h3>
          <button className="btn sm icon ghost" onClick={onClose}><Icon name="x" size={14} /></button>
        </div>
        <div className="compose-field">
          <label>From</label>
          <input defaultValue="rob@atlas.co" disabled />
        </div>
        <div className="compose-field">
          <label>To</label>
          <input defaultValue={replyTo || ""} placeholder="Recipient" />
        </div>
        <div className="compose-field">
          <label>Subject</label>
          <input placeholder="Subject" defaultValue={replyTo ? "Re: Q3 hiring plan — final review" : ""} />
        </div>
        <div className="compose-body">
          <textarea placeholder="Write your message…" defaultValue={replyTo ? "Priya — \n\nQuick replies inline:\n\n1. Pod A: the seventh req moved to pod C in March when we restructured. Will pull the doc and confirm before our 1:1.\n\n2. Moving design forward by six weeks works for me if recruiting can backfill the platform req we'd planned for that slot." : ""} />
        </div>
        <div className="compose-foot">
          <div className="row gap-8">
            <button className="btn sm"><Icon name="attach" size={14} /> Attach</button>
            <button className="btn sm"><Icon name="sparkle" size={14} /> Suggest reply (off)</button>
          </div>
          <div className="row gap-8">
            <button className="btn sm" onClick={onClose}>Discard</button>
            <button className="btn sm primary"><Icon name="send" size={14} /> Send</button>
          </div>
        </div>
      </div>
    </div>
  );
};

// ====== AI Assistant overlay (search + chat) ======
const Assistant = ({ onClose, onOpenThread }) => {
  const [q, setQ] = React.useState("");
  const [messages, setMessages] = React.useState([
    { role: "ai", text: "Search synced threads, ask about anything you've received, or issue a read-only bulk command. I won't send or delete without confirmation.", cites: [] },
  ]);
  const [busy, setBusy] = React.useState(false);

  const examples = [
    "What did Priya want me to confirm before our 1:1?",
    "Find all receipts from Stripe this month",
    "Anything urgent in the screener?",
    "Summarize Marcus's term sheet thread",
  ];

  const ask = (text) => {
    if (!text) return;
    setMessages(m => [...m, { role: "user", text }]);
    setBusy(true);
    setQ("");
    setTimeout(() => {
      let reply;
      if (/priya/i.test(text)) {
        reply = {
          role: "ai",
          text: "Priya wants you to confirm two things before your 1:1 tomorrow:\n\n1. Pod A staffing — was the seventh req rolled into pod C, or did it disappear?\n2. Whether you'll move the design hire forward by six weeks to support the marketing site rebuild.\n\nShe sent the latest review this morning at 10:42 AM.",
          cites: [{ num: 1, from: "Priya Ramanathan", subject: "Re: Q3 hiring plan — final review", time: "Today, 10:42 AM", id: "i1" }],
        };
      } else if (/stripe|receipt/i.test(text)) {
        reply = {
          role: "ai",
          text: "Found 2 Stripe receipts in your Paper Trail from May:\n\n• Linear — $96.00 (today)\n• Notion AI — $20.00 (Mon)\n\nTotal across both: $116.00.",
          cites: [
            { num: 1, from: "Stripe", subject: "Receipt from Linear — $96.00", time: "Today", id: "p1" },
            { num: 2, from: "Notion", subject: "Receipt — Notion AI add-on", time: "Mon", id: "p6" },
          ],
        };
      } else if (/urgent|screener/i.test(text)) {
        reply = {
          role: "ai",
          text: "Two screener items look time-sensitive:\n\n• Maya Chen (NorthStar) — angel intro, mentions \"this week\"\n• Liam Park — personal cold question, no urgency\n\nMaya is the only one I'd surface as potentially worth notifying about.",
          cites: [{ num: 1, from: "Maya Chen", subject: "Intro — angel check for your seed round", time: "9:14 AM", id: "s1" }],
        };
      } else if (/term sheet|marcus/i.test(text)) {
        reply = {
          role: "ai",
          text: "Marcus from Catalyst sent SAFE redlines this morning. Most language is standard, but he flagged the pro-rata clause for discussion. He's offering to walk through it on a call tomorrow.",
          cites: [{ num: 1, from: "Marcus Okafor", subject: "Term sheet — redlines attached", time: "10:18 AM", id: "i2" }],
        };
      } else {
        reply = {
          role: "ai",
          text: "I can search synced threads, summarize, surface tasks and dates, and propose bulk archives. I won't draft replies or compose for you in MVP.",
          cites: [],
        };
      }
      setMessages(m => [...m, reply]);
      setBusy(false);
    }, 500);
  };

  return (
    <div className="overlay" onClick={onClose}>
      <div className="overlay-card" style={{ maxWidth: 720, height: "82vh", display: "flex", flexDirection: "column" }} onClick={e => e.stopPropagation()}>
        <div className="overlay-head" style={{ background: "var(--ai)", color: "#fff" }}>
          <div className="row gap-8">
            <Icon name="sparkle" size={18} color="#fff" stroke={2.5} />
            <h3>Ask Atlas</h3>
            <span style={{ fontSize: 11, fontWeight: 700, padding: "2px 8px", background: "#fff", color: "#000", border: "2px solid #000", borderRadius: 4 }}>SEMANTIC SEARCH</span>
          </div>
          <button className="btn sm icon ghost" onClick={onClose} style={{ color: "#fff" }}><Icon name="x" size={14} color="#fff" /></button>
        </div>
        <div style={{ padding: 16, overflowY: "auto", flex: 1, display: "flex", flexDirection: "column", gap: 12 }}>
          {messages.map((m, i) => (
            <div key={i} className={"chat-bubble " + m.role} style={m.role === "user" ? { maxWidth: "75%" } : {}}>
              <div style={{ whiteSpace: "pre-wrap" }}>{m.text}</div>
              {m.cites && m.cites.map(c => (
                <div key={c.num} className="cite" onClick={() => { onOpenThread(c.id); onClose(); }} style={{ cursor: "default" }}>
                  <span className="cite-num">{c.num}</span>
                  <div style={{ flex: 1, fontFamily: "var(--font-base)" }}>
                    <div style={{ fontWeight: 800, fontSize: 12 }}>{c.from}</div>
                    <div style={{ fontSize: 11, color: "var(--muted)" }}>{c.subject}</div>
                  </div>
                  <span style={{ fontSize: 10, color: "var(--muted)" }}>{c.time}</span>
                </div>
              ))}
            </div>
          ))}
          {busy && <div className="chat-bubble ai" style={{ opacity: .6 }}>Thinking…</div>}
          {messages.length === 1 && (
            <div style={{ marginTop: 8 }}>
              <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: ".06em", textTransform: "uppercase", color: "var(--muted)", marginBottom: 8 }}>Try</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {examples.map(e => (
                  <button key={e} className="btn sm" style={{ justifyContent: "flex-start", height: "auto", padding: "8px 10px", textAlign: "left", whiteSpace: "normal", lineHeight: 1.4 }} onClick={() => ask(e)}>
                    {e}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
        <div style={{ padding: 12, borderTop: "var(--border-w) solid var(--border)", background: "var(--background)" }}>
          <form onSubmit={e => { e.preventDefault(); ask(q); }} className="row gap-8">
            <input className="input" placeholder="Ask anything about your synced mail…" value={q} onChange={e => setQ(e.target.value)} autoFocus />
            <button className="btn primary" type="submit"><Icon name="send" size={14} /></button>
          </form>
        </div>
      </div>
    </div>
  );
};

// ====== Tasks & Dates view ======
const TasksScreen = () => {
  const tasks = [
    { label: "Confirm pod A staffing — was the seventh req rolled into pod C?", due: "Before 1:1", source: "Priya Ramanathan · Q3 hiring plan", id: "i1" },
    { label: "Decide on moving design hire forward by 6 weeks", due: "Tomorrow", source: "Priya Ramanathan · Q3 hiring plan", id: "i1" },
    { label: "Review Marcus's SAFE redlines, esp. pro-rata clause", due: "Wed", source: "Marcus Okafor · Term sheet", id: "i2" },
    { label: "Review PR #482 (auth refactor) — third revision", due: "This week", source: "Jordan Vega · GitHub", id: "i5" },
    { label: "Reply to Anya re: illustration commission slot", due: "By Friday", source: "Anya Volkov · Silver Creek Design", id: "i7" },
  ];
  const dates = [
    { label: "1:1 with Priya — Q3 hiring follow-up", due: "Tomorrow, 9:00 AM", source: "Priya Ramanathan", id: "i1" },
    { label: "Intro call with Maya Chen — NorthStar", due: "Fri May 23, 2:30 PM", source: "Maya Chen · Calendly", id: "i8" },
    { label: "Walkthrough call with Marcus — SAFE redlines", due: "Tomorrow", source: "Marcus Okafor · Catalyst", id: "i2" },
    { label: "Amazon delivery — cable management sleeve", due: "Fri May 23", source: "Amazon shipping notice", id: "p3" },
    { label: "Flight DL 482 SFO→PDX", due: "Wed Nov 26, 6:14 PM", source: "Delta confirmation", id: "p2" },
  ];

  return (
    <div className="thread">
      <div className="thread-toolbar">
        <div>
          <h2 style={{ fontSize: 22 }}>Tasks &amp; Dates</h2>
          <div className="mono" style={{ color: "var(--muted)", fontSize: 11, marginTop: 2 }}>AI-extracted · sync to Google Tasks &amp; Calendar</div>
        </div>
        <div className="row gap-8">
          <button className="btn sm"><Icon name="check" size={12} stroke={3} /> Sync 5 tasks</button>
          <button className="btn sm primary"><Icon name="calendar" size={12} /> Sync 5 dates</button>
        </div>
      </div>
      <div className="tasks-grid">
        <div className="tasks-col">
          <h3><span className="badge solid-paper sq"><Icon name="check" size={12} stroke={3} /> TASKS</span><span style={{ fontSize: 12, color: "var(--muted)", fontFamily: "var(--font-mono)", fontWeight: 700 }}>{tasks.length}</span></h3>
          {tasks.map((t, i) => (
            <div key={i} className="task-card">
              <div className="row gap-10" style={{ alignItems: "flex-start" }}>
                <div style={{ width: 18, height: 18, border: "var(--border-w) solid var(--border)", borderRadius: 4, marginTop: 2, flexShrink: 0 }} />
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, lineHeight: 1.4 }}>{t.label}</div>
                  <div className="mono" style={{ fontSize: 11, color: "var(--muted)", marginTop: 4 }}>Due: {t.due}</div>
                </div>
              </div>
              <div className="src">From: {t.source}</div>
            </div>
          ))}
        </div>
        <div className="tasks-col">
          <h3><span className="badge solid-feed sq"><Icon name="calendar" size={12} /> DATES</span><span style={{ fontSize: 12, color: "var(--muted)", fontFamily: "var(--font-mono)", fontWeight: 700 }}>{dates.length}</span></h3>
          {dates.map((d, i) => (
            <div key={i} className="task-card">
              <div className="row gap-10" style={{ alignItems: "flex-start" }}>
                <div style={{ width: 36, height: 36, border: "var(--border-w) solid var(--border)", borderRadius: 4, marginTop: 2, flexShrink: 0, background: "var(--feed)", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", lineHeight: 1 }}>
                  <div style={{ fontSize: 9, fontWeight: 800, fontFamily: "var(--font-mono)" }}>{(d.due.match(/[A-Z][a-z]{2}/) || ["—"])[0].toUpperCase()}</div>
                  <div style={{ fontSize: 14, fontWeight: 900 }}>{(d.due.match(/\d{1,2}/) || ["?"])[0]}</div>
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, lineHeight: 1.4 }}>{d.label}</div>
                  <div className="mono" style={{ fontSize: 11, color: "var(--muted)", marginTop: 4 }}>{d.due}</div>
                </div>
              </div>
              <div className="src">From: {d.source}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

// ====== Settings ======
const SettingsScreen = () => (
  <div className="thread">
    <div className="thread-toolbar">
      <h2 style={{ fontSize: 22 }}>Settings</h2>
    </div>
    <div className="thread-body" style={{ maxWidth: 760, margin: "0 auto", width: "100%" }}>
      <h3 style={{ fontSize: 14, marginBottom: 8, textTransform: "uppercase", letterSpacing: ".06em", color: "var(--muted)", fontFamily: "var(--font-mono)" }}>Connected accounts</h3>
      <div className="card" style={{ marginBottom: 24 }}>
        <div className="settings-row">
          <div className="ic"><Icon name="google" size={24} /></div>
          <div>
            <div style={{ fontWeight: 800, fontSize: 15 }}>rob@atlas.co</div>
            <div className="mono" style={{ color: "var(--muted)", fontSize: 11, marginTop: 2 }}>Google Workspace · synced 24s ago · 142 threads</div>
          </div>
          <div className="row gap-8">
            <span className="badge solid-paper">Active</span>
            <button className="btn sm">Disconnect</button>
          </div>
        </div>
        <div className="settings-row">
          <div className="ic"><Icon name="outlook" size={24} /></div>
          <div>
            <div style={{ fontWeight: 800, fontSize: 15 }}>rob.barrett@outlook.com</div>
            <div className="mono" style={{ color: "var(--muted)", fontSize: 11, marginTop: 2 }}>Microsoft 365 personal · paid tier required</div>
          </div>
          <button className="btn sm primary">Upgrade to connect</button>
        </div>
        <div className="settings-row" style={{ background: "var(--background)" }}>
          <div className="ic" style={{ background: "var(--background)" }}><Icon name="plus" size={20} stroke={2.5} /></div>
          <div>
            <div style={{ fontWeight: 800, fontSize: 14 }}>Connect another account</div>
            <div style={{ color: "var(--muted)", fontSize: 12, marginTop: 2 }}>Gmail, Google Workspace, Outlook, or Microsoft 365</div>
          </div>
          <button className="btn sm">Connect</button>
        </div>
      </div>

      <h3 style={{ fontSize: 14, marginBottom: 8, textTransform: "uppercase", letterSpacing: ".06em", color: "var(--muted)", fontFamily: "var(--font-mono)" }}>AI &amp; Privacy</h3>
      <div className="card" style={{ marginBottom: 24 }}>
        <div className="settings-row">
          <div className="ic" style={{ background: "var(--ai)", color: "#fff" }}><Icon name="sparkle" size={20} color="#fff" /></div>
          <div>
            <div style={{ fontWeight: 800, fontSize: 15 }}>Category suggestions</div>
            <div style={{ color: "var(--muted)", fontSize: 12, marginTop: 2 }}>AI proposes Inbox / Feed / Paper Trail. You confirm.</div>
          </div>
          <Toggle defaultChecked />
        </div>
        <div className="settings-row">
          <div className="ic" style={{ background: "var(--feed)" }}><Icon name="bolt" size={20} /></div>
          <div>
            <div style={{ fontWeight: 800, fontSize: 15 }}>Priority badges</div>
            <div style={{ color: "var(--muted)", fontSize: 12, marginTop: 2 }}>Sort Inbox by P1/P2/P3 with explanations.</div>
          </div>
          <Toggle defaultChecked />
        </div>
        <div className="settings-row">
          <div className="ic" style={{ background: "var(--paper)" }}><Icon name="check" size={20} stroke={3} /></div>
          <div>
            <div style={{ fontWeight: 800, fontSize: 15 }}>Extract tasks &amp; dates</div>
            <div style={{ color: "var(--muted)", fontSize: 12, marginTop: 2 }}>Sync confirmed items to Google Tasks &amp; Calendar.</div>
          </div>
          <Toggle defaultChecked />
        </div>
        <div className="settings-row">
          <div className="ic" style={{ background: "var(--danger)" }}><Icon name="shield" size={20} /></div>
          <div>
            <div style={{ fontWeight: 800, fontSize: 15 }}>Mailbox-wide analysis</div>
            <div style={{ color: "var(--muted)", fontSize: 12, marginTop: 2 }}>Off — only synced new-mail threads are processed.</div>
          </div>
          <Toggle />
        </div>
      </div>

      <h3 style={{ fontSize: 14, marginBottom: 8, textTransform: "uppercase", letterSpacing: ".06em", color: "var(--muted)", fontFamily: "var(--font-mono)" }}>Notifications</h3>
      <div className="card" style={{ marginBottom: 24 }}>
        <div className="settings-row">
          <div className="ic"><Icon name="inbox" size={20} /></div>
          <div><div style={{ fontWeight: 800, fontSize: 15 }}>Inbox — high priority only</div><div style={{ color: "var(--muted)", fontSize: 12, marginTop: 2 }}>PWA notification when a P1 thread arrives.</div></div>
          <Toggle defaultChecked />
        </div>
        <div className="settings-row">
          <div className="ic"><Icon name="screener" size={20} /></div>
          <div><div style={{ fontWeight: 800, fontSize: 15 }}>Screener — urgent only</div><div style={{ color: "var(--muted)", fontSize: 12, marginTop: 2 }}>AI flags potentially urgent first-time senders.</div></div>
          <Toggle defaultChecked />
        </div>
        <div className="settings-row">
          <div className="ic"><Icon name="feed" size={20} /></div>
          <div><div style={{ fontWeight: 800, fontSize: 15 }}>Feed &amp; Paper Trail</div><div style={{ color: "var(--muted)", fontSize: 12, marginTop: 2 }}>Never notify.</div></div>
          <Toggle />
        </div>
      </div>
    </div>
  </div>
);

const Toggle = ({ defaultChecked }) => {
  const [on, setOn] = React.useState(!!defaultChecked);
  return (
    <button
      className="btn sm"
      onClick={() => setOn(!on)}
      style={{
        width: 52, height: 28, padding: 2, position: "relative",
        background: on ? "var(--main)" : "var(--secondary-background)",
        justifyContent: "flex-start",
      }}
    >
      <span style={{
        width: 20, height: 20, background: "#000", borderRadius: 3,
        position: "absolute", top: 2, left: on ? 28 : 2,
        transition: "left .12s ease",
      }} />
    </button>
  );
};

window.Avatar = Avatar;
window.ScreenerScreen = ScreenerScreen;
window.MailList = MailList;
window.MailRow = MailRow;
window.ThreadView = ThreadView;
window.Compose = Compose;
window.Assistant = Assistant;
window.TasksScreen = TasksScreen;
window.SettingsScreen = SettingsScreen;
