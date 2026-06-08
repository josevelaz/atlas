// Atlas — onboarding walkthrough

const ONB_STEPS = [
  {
    title: "Welcome to Atlas.",
    sub: "A smarter inbox on top of your Gmail or Outlook account. We protect your attention — you keep your address.",
    visual: () => (
      <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
        <ConnectCard provider="Google" sub="Gmail · Google Workspace" />
        <ConnectCard provider="Microsoft" sub="Outlook · Microsoft 365" />
      </div>
    ),
  },
  {
    title: "Strangers go to the Screener.",
    sub: "First-time senders never reach your Inbox. You decide once — Accept into a category, or Reject. Atlas routes the rest.",
    visual: () => (
      <div style={{ border: "var(--border-w) solid var(--border)", borderRadius: 8, overflow: "hidden", boxShadow: "var(--shadow)", background: "var(--secondary-background)" }}>
        <div style={{ padding: 14, display: "flex", gap: 12, alignItems: "center", borderBottom: "var(--border-w) solid var(--border)" }}>
          <div className="avatar" style={{ background: "#FACC00" }}>MC</div>
          <div>
            <div style={{ fontWeight: 900 }}>Maya Chen</div>
            <div className="mono" style={{ fontSize: 11, color: "var(--muted)" }}>maya@northstarcap.com</div>
          </div>
        </div>
        <div style={{ padding: 14, fontSize: 13 }}>
          <div style={{ fontWeight: 800, marginBottom: 6 }}>Intro — angel check for your seed round</div>
          <div style={{ color: "var(--muted)" }}>Hi! I was forwarded your deck by Jamie. Quick context — I write $25–100k checks…</div>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", borderTop: "var(--border-w) solid var(--border)" }}>
          <div style={{ background: "#00D696", padding: "16px 0", textAlign: "center", fontWeight: 900, borderRight: "var(--border-w) solid var(--border)" }}>ACCEPT</div>
          <div style={{ background: "#FF4D50", padding: "16px 0", textAlign: "center", fontWeight: 900 }}>REJECT</div>
        </div>
      </div>
    ),
  },
  {
    title: "Three categories. No folders to manage.",
    sub: "Inbox is what demands attention. Feed is for newsletters and browse-later. Paper Trail holds receipts and confirmations.",
    visual: () => (
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        <CatRow color="#7A83FF" name="Inbox" desc="Work, replies needed, the things that matter today." icon="inbox" />
        <CatRow color="#FACC00" name="Feed" desc="Newsletters, marketing, browse-later content. No notifications." icon="feed" />
        <CatRow color="#00D696" name="Paper Trail" desc="Receipts, confirmations, shipping notices. Searchable, quiet." icon="paper" />
      </div>
    ),
  },
  {
    title: "AI helps you triage. You stay in charge.",
    sub: "Atlas suggests categories, summarizes long threads, surfaces tasks and dates, and answers questions about your mail. It never sends or deletes without you.",
    visual: () => (
      <div style={{ border: "var(--border-w) solid var(--border)", borderRadius: 8, boxShadow: "var(--shadow)", background: "var(--ai)", color: "#fff", overflow: "hidden" }}>
        <div style={{ padding: "10px 14px", display: "flex", alignItems: "center", gap: 8, borderBottom: "var(--border-w) solid var(--border)", fontWeight: 800, fontSize: 12, textTransform: "uppercase", letterSpacing: ".04em" }}>
          <Icon name="sparkle" size={14} color="#fff" stroke={2.5} /> AI summary
        </div>
        <div style={{ background: "#fff", color: "#000", padding: "14px 16px", fontSize: 13, lineHeight: 1.5 }}>
          Priya is reviewing the Q3 hiring plan. Two concerns: pod A is one head short of the February projection, and she wants to move the design hire forward by six weeks. She'd like to discuss tomorrow.
        </div>
        <div style={{ background: "#fff", color: "#000", padding: "10px 14px", borderTop: "var(--border-w) solid var(--border)", display: "flex", flexDirection: "column", gap: 6 }}>
          <ExtractedRow color="#00D696" label="Confirm pod A staffing" due="Before 1:1" />
          <ExtractedRow color="#FACC00" label="1:1 with Priya — Q3 hiring follow-up" due="Tomorrow, 9:00 AM" />
        </div>
      </div>
    ),
  },
  {
    title: "Atlas organizes new mail. Not old mail.",
    sub: "Your existing mailbox stays where it is. Atlas's Screener and categories begin with whatever lands after you connect. Empty for now — that's the point.",
    visual: () => (
      <div style={{ border: "var(--border-w) solid var(--border)", borderRadius: 8, boxShadow: "var(--shadow)", background: "var(--secondary-background)", padding: 36, textAlign: "center" }}>
        <div style={{ display: "inline-flex", width: 64, height: 64, border: "var(--border-w) solid var(--border)", borderRadius: 8, background: "var(--main)", alignItems: "center", justifyContent: "center", marginBottom: 12, boxShadow: "var(--shadow-sm)" }}>
          <Icon name="inbox" size={30} stroke={2.5} />
        </div>
        <h3 style={{ fontSize: 20, marginBottom: 4 }}>Your Inbox is empty.</h3>
        <p style={{ color: "var(--muted)", fontSize: 13, lineHeight: 1.5, maxWidth: 360, margin: "0 auto" }}>
          That's because everyone is still unscreened. New mail will land in the Screener as it arrives — we'll show you.
        </p>
      </div>
    ),
  },
];

const ConnectCard = ({ provider, sub }) => (
  <div style={{
    flex: 1, minWidth: 200,
    border: "var(--border-w) solid var(--border)",
    borderRadius: 8,
    padding: 16,
    background: "var(--secondary-background)",
    boxShadow: "var(--shadow)",
    cursor: "default",
  }}>
    <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
      <div style={{ width: 36, height: 36, border: "var(--border-w) solid var(--border)", borderRadius: 5, background: provider === "Google" ? "var(--main)" : "var(--ai)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
        <Icon name={provider === "Google" ? "google" : "outlook"} size={20} color="#fff" stroke={2.5} />
      </div>
      <div style={{ minWidth: 0, flex: 1 }}>
        <div style={{ fontWeight: 900, fontSize: 15, lineHeight: 1.2 }}>Connect {provider}</div>
        <div className="mono" style={{ fontSize: 10, color: "var(--muted)", marginTop: 4 }}>{sub}</div>
      </div>
    </div>
    <button className="btn sm primary" style={{ width: "100%" }}>Connect with OAuth</button>
  </div>
);

const CatRow = ({ color, name, desc, icon }) => (
  <div style={{
    border: "var(--border-w) solid var(--border)",
    borderRadius: 5, padding: 12,
    background: "var(--secondary-background)",
    boxShadow: "var(--shadow-sm)",
    display: "grid", gridTemplateColumns: "44px 1fr", gap: 12, alignItems: "center",
  }}>
    <div style={{ width: 44, height: 44, border: "var(--border-w) solid var(--border)", borderRadius: 5, background: color, display: "flex", alignItems: "center", justifyContent: "center" }}>
      <Icon name={icon} size={22} stroke={2.5} />
    </div>
    <div>
      <div style={{ fontWeight: 900, fontSize: 15 }}>{name}</div>
      <div style={{ color: "var(--muted)", fontSize: 12, marginTop: 2 }}>{desc}</div>
    </div>
  </div>
);

const ExtractedRow = ({ color, label, due }) => (
  <div style={{ display: "grid", gridTemplateColumns: "20px 1fr auto", gap: 10, alignItems: "center", padding: "6px 8px", border: "var(--border-w) solid var(--border)", borderRadius: 4, background: "var(--background)" }}>
    <div style={{ width: 20, height: 20, border: "var(--border-w) solid var(--border)", background: color, borderRadius: 3 }} />
    <span style={{ fontSize: 12, fontWeight: 700 }}>{label}</span>
    <span className="mono" style={{ fontSize: 10, color: "var(--muted)" }}>{due}</span>
  </div>
);

function Onboarding({ step, setStep, onFinish }) {
  const s = ONB_STEPS[step];
  const last = step === ONB_STEPS.length - 1;
  return (
    <div className="onboarding">
      <div className="onboarding-card">
        <div className="onboarding-head">
          <div className="row gap-8">
            <Logo markSize={24} />
            <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--muted)" }}>Get started — {step + 1}/{ONB_STEPS.length}</span>
          </div>
          <button className="btn sm ghost" onClick={onFinish}>Skip</button>
        </div>
        <div className="onboarding-body">
          <h1 style={{ fontSize: 32, lineHeight: 1.1, marginBottom: 8 }}>{s.title}</h1>
          <p style={{ color: "var(--muted)", fontSize: 14, lineHeight: 1.5, maxWidth: 540, marginBottom: 24 }}>{s.sub}</p>
          {s.visual()}
        </div>
        <div className="onboarding-foot">
          <button className="btn sm" disabled={step === 0} onClick={() => setStep(step - 1)}>
            <Icon name="back" size={14} /> Back
          </button>
          <div className="step-dots">
            {ONB_STEPS.map((_, i) => <div key={i} className={"step-dot" + (i === step ? " active" : "")} />)}
          </div>
          <button className="btn sm primary" onClick={() => last ? onFinish() : setStep(step + 1)}>
            {last ? "Open Atlas" : "Next"} <Icon name="chevron-right" size={14} stroke={2.5} />
          </button>
        </div>
      </div>
    </div>
  );
}

window.Onboarding = Onboarding;
