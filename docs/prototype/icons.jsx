// Atlas — inline icon set (brutalist stroke icons)
const Icon = ({ name, size = 16, stroke = 2.2, color = "currentColor", style }) => {
  const s = size;
  const sw = stroke;
  const common = {
    width: s, height: s, viewBox: "0 0 24 24", fill: "none",
    stroke: color, strokeWidth: sw, strokeLinecap: "round", strokeLinejoin: "round",
    style,
  };
  switch (name) {
    case "inbox":      return <svg {...common}><path d="M3 13l3-8h12l3 8M3 13v6a1 1 0 001 1h16a1 1 0 001-1v-6M3 13h5l1 3h6l1-3h5"/></svg>;
    case "feed":       return <svg {...common}><path d="M4 4h12v16H4zM16 8h4v12h-4M7 8h6M7 12h6M7 16h4"/></svg>;
    case "paper":      return <svg {...common}><path d="M6 3h9l4 4v14H6zM15 3v4h4M9 12h6M9 16h6M9 8h2"/></svg>;
    case "screener":   return <svg {...common}><circle cx="11" cy="11" r="6"/><path d="M16 16l5 5M8 11h6M11 8v6"/></svg>;
    case "ai":         return <svg {...common}><path d="M12 3l1.8 4.5L18 9l-4.2 1.5L12 15l-1.8-4.5L6 9l4.2-1.5z"/><path d="M19 16l.8 2 2 .8-2 .8-.8 2-.8-2-2-.8 2-.8z"/></svg>;
    case "search":     return <svg {...common}><circle cx="11" cy="11" r="7"/><path d="M16 16l5 5"/></svg>;
    case "tasks":      return <svg {...common}><path d="M4 6h16M4 12h16M4 18h10"/><path d="M3 6l1 1 1-2M3 12l1 1 1-2M3 18l1 1 1-2"/></svg>;
    case "settings":   return <svg {...common}><circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M4.2 4.2l2.1 2.1M17.7 17.7l2.1 2.1M2 12h3M19 12h3M4.2 19.8l2.1-2.1M17.7 6.3l2.1-2.1"/></svg>;
    case "archive":    return <svg {...common}><path d="M3 5h18v4H3zM5 9v11h14V9M9 13h6"/></svg>;
    case "trash":      return <svg {...common}><path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13M10 11v6M14 11v6"/></svg>;
    case "reply":      return <svg {...common}><path d="M9 7L4 12l5 5M4 12h10a6 6 0 016 6v2"/></svg>;
    case "reply-all":  return <svg {...common}><path d="M7 7l-4 5 4 5M11 7l-4 5 4 5M11 12h7a4 4 0 014 4v2"/></svg>;
    case "forward":    return <svg {...common}><path d="M15 7l5 5-5 5M20 12H10a6 6 0 00-6 6v2"/></svg>;
    case "compose":    return <svg {...common}><path d="M4 20h16M5 17l9-9 3 3-9 9H5v-3zM13 5l3 3"/></svg>;
    case "x":          return <svg {...common}><path d="M5 5l14 14M19 5L5 19"/></svg>;
    case "check":      return <svg {...common}><path d="M4 12l5 5L20 6"/></svg>;
    case "chevron-down": return <svg {...common}><path d="M6 9l6 6 6-6"/></svg>;
    case "chevron-up":   return <svg {...common}><path d="M6 15l6-6 6 6"/></svg>;
    case "chevron-right":return <svg {...common}><path d="M9 6l6 6-6 6"/></svg>;
    case "chevron-left": return <svg {...common}><path d="M15 6l-6 6 6 6"/></svg>;
    case "star":       return <svg {...common}><path d="M12 3l2.6 6 6.4.6-5 4.4 1.6 6.4L12 17l-5.6 3.4L8 14l-5-4.4 6.4-.6z"/></svg>;
    case "bolt":       return <svg {...common}><path d="M13 2L4 14h7l-1 8 9-12h-7l1-8z"/></svg>;
    case "clock":      return <svg {...common}><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>;
    case "calendar":   return <svg {...common}><rect x="3" y="5" width="18" height="16" rx="1"/><path d="M3 10h18M8 3v4M16 3v4"/></svg>;
    case "tag":        return <svg {...common}><path d="M3 12l9-9 9 9-9 9z"/><circle cx="9" cy="9" r="1.5"/></svg>;
    case "send":       return <svg {...common}><path d="M3 11l18-7-7 18-3-7z"/></svg>;
    case "user":       return <svg {...common}><circle cx="12" cy="8" r="4"/><path d="M4 21c0-4.4 3.6-8 8-8s8 3.6 8 8"/></svg>;
    case "google":     return <svg {...common}><circle cx="12" cy="12" r="9"/><path d="M12 8v4h5a5 5 0 11-1.5-3.5"/></svg>;
    case "outlook":    return <svg {...common}><rect x="3" y="5" width="13" height="14" rx="1"/><path d="M16 8h5v8h-5M7 9v6M7 9l5 3-5 3"/></svg>;
    case "plus":       return <svg {...common}><path d="M12 4v16M4 12h16"/></svg>;
    case "menu":       return <svg {...common}><path d="M4 6h16M4 12h16M4 18h16"/></svg>;
    case "dot":        return <svg {...common}><circle cx="12" cy="12" r="3" fill={color}/></svg>;
    case "sparkle":    return <svg {...common}><path d="M12 4l1.5 4.5L18 10l-4.5 1.5L12 16l-1.5-4.5L6 10l4.5-1.5z"/></svg>;
    case "shield":     return <svg {...common}><path d="M12 3l8 3v6c0 4.5-3.5 8.5-8 9-4.5-.5-8-4.5-8-9V6z"/></svg>;
    case "hide":       return <svg {...common}><path d="M3 12s3-6 9-6 9 6 9 6-3 6-9 6-9-6-9-6z"/><path d="M3 3l18 18"/></svg>;
    case "back":       return <svg {...common}><path d="M21 12H4M11 5l-7 7 7 7"/></svg>;
    case "attach":     return <svg {...common}><path d="M21 11l-9 9a5 5 0 01-7-7l9-9a3.5 3.5 0 015 5l-9 9a2 2 0 11-3-3l7-7"/></svg>;
    default:           return <svg {...common}><circle cx="12" cy="12" r="9"/></svg>;
  }
};

window.Icon = Icon;

// Atlas brandmark — compass star (option B). Solid vertical needle + outline horizontal.
const CompassMark = ({ size = 30, sw = 2.4 }) => {
  const p = size, c = p / 2, o = p * 0.30, i = p * 0.11;
  const vNeedle = `${c},${c - o} ${c + i},${c} ${c},${c + o} ${c - i},${c}`;
  const hNeedle = `${c - o},${c} ${c},${c - i} ${c + o},${c} ${c},${c + i}`;
  const pad = Math.round(size * 0.18);
  return (
    <span className="logo-mark" style={{ width: size + pad * 2, height: size + pad * 2 }}>
      <svg width={size} height={size} viewBox={`0 0 ${p} ${p}`} aria-hidden="true">
        <polygon points={hNeedle} fill="none" stroke="var(--border)" strokeWidth={sw} strokeLinejoin="round" />
        <polygon points={vNeedle} fill="var(--border)" stroke="var(--border)" strokeWidth={sw} strokeLinejoin="round" />
      </svg>
    </span>
  );
};

// Full lockup: compass chip + ATLAS wordmark.
const Logo = ({ markSize = 26, wordSize }) => (
  <div className="logo" aria-label="Atlas">
    <CompassMark size={markSize} />
    <span className="logo-word" style={wordSize ? { fontSize: wordSize } : undefined}>
      ATLAS<span className="logo-dot">.</span>
    </span>
  </div>
);

window.CompassMark = CompassMark;
window.Logo = Logo;
