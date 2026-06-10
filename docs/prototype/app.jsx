// Atlas — root app

const TWEAK_DEFAULTS = /*EDITMODE-BEGIN*/{
  "accent": "#FACC00",
  "shadow": 4,
  "dark": false,
  "font": "Space Mono"
}/*EDITMODE-END*/;

const ACCENT_OPTIONS = ["#FACC00", "#FF4D50", "#00D696", "#3D7EFF", "#A78BFA"];

const FONTS = {
  "Space Mono": "'Space Mono', ui-monospace, monospace",
  "Space Grotesk": "'Space Grotesk', ui-sans-serif, system-ui, sans-serif",
  "VT323":    "'VT323', ui-monospace, monospace",
  "Archivo":  "'Archivo', ui-sans-serif, system-ui, sans-serif",
  "DM Sans":  "'DM Sans', ui-sans-serif, system-ui, sans-serif",
};

function App() {
  const [t, setTweak] = useTweaks(TWEAK_DEFAULTS);

  // Onboarding shown by default; user can re-open from sidebar
  const [onboarded, setOnboarded] = React.useState(false);
  const [onbStep, setOnbStep] = React.useState(0);

  const [view, setView] = React.useState("inbox"); // screener|inbox|feed|paper|tasks|settings
  const [selected, setSelected] = React.useState({ inbox: "i1", feed: null, paper: null });
  const [accepted, setAccepted] = React.useState({});  // {sid: category}
  const [rejected, setRejected] = React.useState({});
  const [composeOpen, setCompose] = React.useState(false);
  const [assistantOpen, setAssistant] = React.useState(false);
  const [setAsideSet, setSetAside] = React.useState({});
  const [replyLaterSet, setReplyLater] = React.useState({});

  // Apply tweaks to :root
  React.useEffect(() => {
    const r = document.documentElement;
    r.style.setProperty("--main", t.accent);
    r.style.setProperty("--shadow-x", t.shadow + "px");
    r.style.setProperty("--shadow-y", t.shadow + "px");
    r.style.setProperty("--shadow", t.shadow + "px " + t.shadow + "px 0 0 var(--border)");
    r.style.setProperty("--shadow-sm", Math.max(1, t.shadow/2) + "px " + Math.max(1, t.shadow/2) + "px 0 0 var(--border)");
    r.style.setProperty("--shadow-lg", (t.shadow+2) + "px " + (t.shadow+2) + "px 0 0 var(--border)");
    r.style.setProperty("--font-base", FONTS[t.font]);
    r.style.setProperty("--font-heading", FONTS[t.font]);
    document.documentElement.classList.toggle("dark", t.dark);
  }, [t.accent, t.shadow, t.dark, t.font]);

  // Build active lists (derived from base sample + accepted screener items)
  const inbox = React.useMemo(() => {
    const extras = Object.entries(accepted).filter(([id, cat]) => cat === "inbox").map(([id]) => {
      const s = SAMPLE.screener.find(x => x.id === id);
      return s && { id: "ns-" + s.id, from: s.from, addr: s.addr, subject: s.subject, preview: s.preview, time: s.time, unread: true, priority: 2 };
    }).filter(Boolean);
    return [...extras, ...SAMPLE.inbox];
  }, [accepted]);
  const feed = React.useMemo(() => {
    const extras = Object.entries(accepted).filter(([id, cat]) => cat === "feed").map(([id]) => {
      const s = SAMPLE.screener.find(x => x.id === id);
      return s && { id: "ns-" + s.id, from: s.from, addr: s.addr, subject: s.subject, preview: s.preview, time: s.time, unread: true };
    }).filter(Boolean);
    return [...extras, ...SAMPLE.feed];
  }, [accepted]);
  const paper = React.useMemo(() => {
    const extras = Object.entries(accepted).filter(([id, cat]) => cat === "paper").map(([id]) => {
      const s = SAMPLE.screener.find(x => x.id === id);
      return s && { id: "ns-" + s.id, from: s.from, addr: s.addr, subject: s.subject, preview: s.preview, time: s.time };
    }).filter(Boolean);
    return [...extras, ...SAMPLE.paper];
  }, [accepted]);

  const screenerPending = SAMPLE.screener.filter(i => !accepted[i.id] && !rejected[i.id]);

  // Find current thread
  const currentList = view === "inbox" ? inbox : view === "feed" ? feed : view === "paper" ? paper : [];
  const currentSelId = view === "inbox" ? selected.inbox : view === "feed" ? selected.feed : view === "paper" ? selected.paper : null;
  const currentMail = currentList.find(m => m.id === currentSelId);
  const currentThread = currentMail && {
    ...currentMail,
    body: SAMPLE.threadBody[currentMail.id] || null,
  };

  const handleAccept = (sid, cat) => {
    setAccepted(a => ({ ...a, [sid]: cat }));
  };
  const handleReject = (sid) => {
    setRejected(r => ({ ...r, [sid]: true }));
  };

  const onSelect = (id) => {
    if (view === "inbox") setSelected(s => ({ ...s, inbox: id }));
    if (view === "feed") setSelected(s => ({ ...s, feed: id }));
    if (view === "paper") setSelected(s => ({ ...s, paper: id }));
  };

  // Keyboard shortcuts
  React.useEffect(() => {
    const onKey = (e) => {
      if (e.target.tagName === "INPUT" || e.target.tagName === "TEXTAREA") return;
      if (e.metaKey || e.ctrlKey) {
        if (e.key === "k") { e.preventDefault(); setAssistant(true); }
        return;
      }
      if (e.key === "1") setView("screener");
      else if (e.key === "2") setView("inbox");
      else if (e.key === "3") setView("feed");
      else if (e.key === "4") setView("paper");
      else if (e.key === "c") setCompose(true);
      else if (e.key === "/") { e.preventDefault(); setAssistant(true); }
      else if (e.key === "Escape") { setAssistant(false); setCompose(false); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  if (!onboarded) {
    return <Onboarding step={onbStep} setStep={setOnbStep} onFinish={() => setOnboarded(true)} />;
  }

  const navItems = [
    { id: "screener", label: "Screener", icon: "screener", count: screenerPending.length, color: "var(--danger)" },
    { id: "inbox",    label: "Inbox",    icon: "inbox",    count: inbox.filter(i => i.unread).length, color: "var(--main)" },
    { id: "feed",     label: "Feed",     icon: "feed",     count: feed.filter(i => i.unread).length, color: "var(--feed)" },
    { id: "paper",    label: "Paper Trail", icon: "paper", count: paper.length, color: "var(--paper)" },
  ];
  const navItems2 = [
    { id: "tasks",    label: "Tasks & Dates", icon: "tasks", count: 5, color: "var(--ai)" },
    { id: "settings", label: "Settings",      icon: "settings", count: null, color: null },
  ];

  return (
    <div className="app" data-screen-label="Atlas app">
      <div className="topbar">
        <Logo markSize={26} />
        <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--muted)", marginLeft: 4, whiteSpace: "nowrap" }}>v0.1 · MVP</span>
        <div className="spacer" />
        <button className="btn sm" onClick={() => setAssistant(true)}>
          <Icon name="search" size={14} /> Search or ask
          <span className="kbd" style={{ marginLeft: 6 }}>⌘K</span>
        </button>
        <button className="btn sm primary" onClick={() => setCompose(true)}>
          <Icon name="compose" size={14} stroke={2.5} /> Compose
          <span className="kbd" style={{ marginLeft: 6, background: "var(--background)" }}>C</span>
        </button>
        <div style={{ width: 1, height: 24, background: "var(--border)" }} />
        <Avatar name="Rob Barrett" size="sm" />
      </div>

      <div className="sidebar">
        <div className="section-title">Mail</div>
        {navItems.map(item => (
          <div
            key={item.id}
            className={"nav-item" + (view === item.id ? " active" : "")}
            onClick={() => setView(item.id)}
            data-screen-label={item.label}
          >
            <span style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", width: 28, height: 28, border: "var(--border-w) solid var(--border)", borderRadius: 5, background: view === item.id ? "var(--background)" : item.color, color: "#000" }}>
              <Icon name={item.icon} size={15} stroke={2.5} />
            </span>
            <span>{item.label}</span>
            {item.count > 0 && <span className="count tabular">{item.count}</span>}
          </div>
        ))}
        <div className="section-title">Assist</div>
        {navItems2.map(item => (
          <div
            key={item.id}
            className={"nav-item" + (view === item.id ? " active" : "")}
            onClick={() => setView(item.id)}
            data-screen-label={item.label}
          >
            <span style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", width: 28, height: 28, border: "var(--border-w) solid var(--border)", borderRadius: 5, background: view === item.id ? "var(--background)" : (item.color || "var(--secondary-background)") , color: item.id === "tasks" ? "#fff" : "#000" }}>
              <Icon name={item.icon} size={15} stroke={2.5} color={view === item.id ? "#000" : (item.id === "tasks" ? "#fff" : "#000")} />
            </span>
            <span>{item.label}</span>
            {item.count && <span className="count tabular">{item.count}</span>}
          </div>
        ))}

        <div className="spacer" />

        <div style={{
          border: "var(--border-w) solid var(--border)",
          borderRadius: 5,
          padding: 10,
          background: "var(--ai)",
          color: "#fff",
          boxShadow: "var(--shadow-sm)",
        }}>
          <div className="row gap-6" style={{ marginBottom: 4 }}>
            <Icon name="sparkle" size={12} color="#fff" stroke={2.5} />
            <span style={{ fontSize: 10, fontWeight: 800, letterSpacing: ".06em", textTransform: "uppercase", whiteSpace: "nowrap" }}>AI usage</span>
          </div>
          <div style={{ height: 6, background: "rgba(255,255,255,.3)", borderRadius: 2, overflow: "hidden", marginTop: 4 }}>
            <div style={{ width: "34%", height: "100%", background: "#fff" }} />
          </div>
          <div className="mono" style={{ fontSize: 10, marginTop: 4, opacity: .85, whiteSpace: "nowrap" }}>34/100 monthly · Free tier</div>
        </div>

        <div className="nav-item" style={{ marginTop: 4 }} onClick={() => { setOnbStep(0); setOnboarded(false); }}>
          <span style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", width: 28, height: 28 }}>
            <Icon name="user" size={15} />
          </span>
          <span style={{ fontSize: 13 }}>Replay onboarding</span>
        </div>
      </div>

      {/* MIDDLE: list or full-pane view */}
      {view === "screener" ? (
        <div className="list" style={{ gridColumn: "2 / 4", borderRight: 0, background: "var(--background)" }}>
          <ScreenerScreen
            items={SAMPLE.screener}
            onAccept={handleAccept}
            onReject={handleReject}
            accepted={accepted}
            rejected={rejected}
          />
        </div>
      ) : view === "tasks" ? (
        <div style={{ gridColumn: "2 / 4" }}>
          <TasksScreen />
        </div>
      ) : view === "settings" ? (
        <div style={{ gridColumn: "2 / 4" }}>
          <SettingsScreen />
        </div>
      ) : (
        <>
          <div className="list">
            <MailList
              title={view === "inbox" ? "Inbox" : view === "feed" ? "The Feed" : "Paper Trail"}
              items={currentList}
              selectedId={currentSelId}
              onSelect={onSelect}
              aiBanner={view === "inbox" && (
                <div style={{
                  display: "flex", alignItems: "center", gap: 8,
                  padding: "8px 16px",
                  background: "var(--ai)", color: "#fff",
                  borderBottom: "var(--border-w) solid var(--border)",
                  fontSize: 12, fontWeight: 700,
                }}>
                  <Icon name="sparkle" size={12} color="#fff" stroke={2.5} />
                  <span>2 P1 threads need a reply today.</span>
                  <span className="spacer" />
                  <button className="btn sm" style={{ height: 22, padding: "0 8px", boxShadow: "none", border: "1.5px solid #000", fontSize: 11 }}>Sort by priority</button>
                </div>
              )}
            />
          </div>
          <div className="pane">
            <ThreadView
              thread={currentThread}
              onReplyClick={() => setCompose(true)}
              onArchive={() => {}}
              onTrash={() => {}}
              onSetAside={() => currentMail && setSetAside(s => ({ ...s, [currentMail.id]: !s[currentMail.id] }))}
              onReplyLater={() => currentMail && setReplyLater(s => ({ ...s, [currentMail.id]: !s[currentMail.id] }))}
              setAside={currentMail && setAsideSet[currentMail.id]}
              replyLater={currentMail && replyLaterSet[currentMail.id]}
            />
          </div>
        </>
      )}

      {composeOpen && <Compose onClose={() => setCompose(false)} replyTo={currentMail ? currentMail.addr : ""} />}
      {assistantOpen && <Assistant onClose={() => setAssistant(false)} onOpenThread={(id) => {
        // figure out which list it's in
        if (SAMPLE.inbox.find(x => x.id === id)) { setView("inbox"); setSelected(s => ({ ...s, inbox: id })); }
        else if (SAMPLE.feed.find(x => x.id === id)) { setView("feed"); setSelected(s => ({ ...s, feed: id })); }
        else if (SAMPLE.paper.find(x => x.id === id)) { setView("paper"); setSelected(s => ({ ...s, paper: id })); }
        else if (SAMPLE.screener.find(x => x.id === id)) { setView("screener"); }
      }} />}

      <TweaksPanel title="Tweaks">
        <TweakSection label="Theme" />
        <TweakColor
          label="Accent"
          value={t.accent}
          options={ACCENT_OPTIONS}
          onChange={(v) => setTweak("accent", v)}
        />
        <TweakToggle label="Dark mode" value={t.dark} onChange={(v) => setTweak("dark", v)} />
        <TweakSection label="Typography" />
        <TweakSelect
          label="Type pair"
          value={t.font}
          options={["Space Mono", "Space Grotesk", "VT323", "Archivo", "DM Sans"]}
          onChange={(v) => setTweak("font", v)}
        />
        <TweakSection label="Brutalism" />
        <TweakSlider label="Shadow offset" value={t.shadow} min={0} max={10} step={1} unit="px"
                     onChange={(v) => setTweak("shadow", v)} />
      </TweaksPanel>
    </div>
  );
}

window.App = App;
