import { useState, useRef, useEffect, useCallback } from "react";

/* ─────────────────────────────────────────────────────────────────────────────
   DESIGN SYSTEM
───────────────────────────────────────────────────────────────────────────── */
const DS = {
  // Surfaces — light chrome nav
  chrome:    "#1e2433",
  chromeAlt: "#252d3d",
  chromeMid: "#2d3650",
  chromeSub: "#354060",
  border:    "#3d4d6b",
  borderMid: "#4a5c7e",
  borderSoft:"#5a6d91",
  // Type on chrome
  textPri:   "#f0f2f8",
  textSec:   "#a8b2cc",
  textTer:   "#6e7d9e",
  textDis:   "#4a5570",
  // Canvas (working area) — bright white
  canvas:    "#ffffff",
  canvasAlt: "#f7f8fc",
  canvasBdr: "#e0e4f0",
  canvasMid: "#ccd2e6",
  // Text on canvas
  ink:       "#0d1020",
  inkSub:    "#2d3560",
  inkTer:    "#6b75a0",
  inkDis:    "#a8b0cc",
  // Accent — vivid blue
  accent:    "#2563eb",
  accentDim: "#1e50c4",
  accentSoft:"#eff4ff",
  accentLine:"#bfcfff",
  // Status
  success:   "#059669",
  successSoft:"#ecfdf5",
  successLine:"#a7f3d0",
  warning:   "#d97706",
  warnSoft:  "#fffbeb",
  warnLine:  "#fde68a",
  danger:    "#dc2626",
  dangerSoft:"#fef2f2",
  dangerLine:"#fecaca",
  amber:     "#b45309",
  // Strategy palette
  s: [
    { fill:"#2563eb", soft:"#eff4ff", line:"#bfdbfe", dark:"#1e40af" },
    { fill:"#7c3aed", soft:"#f5f3ff", line:"#ddd6fe", dark:"#5b21b6" },
    { fill:"#059669", soft:"#ecfdf5", line:"#a7f3d0", dark:"#047857" },
    { fill:"#dc2626", soft:"#fef2f2", line:"#fecaca", dark:"#b91c1c" },
    { fill:"#0891b2", soft:"#ecfeff", line:"#a5f3fc", dark:"#0e7490" },
    { fill:"#ca8a04", soft:"#fefce8", line:"#fef08a", dark:"#a16207" },
  ],
  sNames: ["Alpha","Beta","Gamma","Delta","Epsilon","Zeta"],
};

/* ─────────────────────────────────────────────────────────────────────────────
   UTILITIES
───────────────────────────────────────────────────────────────────────────── */
let _seq = 0;
const uid = (p="x") => `${p}_${++_seq}_${Math.random().toString(36).slice(2,7)}`;

// Safe prompt builder - avoids template literal issues in nested contexts
const buildPrompt = (...parts) => parts.filter(Boolean).join(" ");

// ── DQ CONSTITUTION ────────────────────────────────────────────────────────────
// Injected into every AI prompt to enforce DQ methodology compliance
const DQ_SYSTEM_BRIEF = [
  "You are a senior Decision Quality (DQ) expert and facilitator.",
  "You must strictly follow these DQ principles in every response:",
  "1. DECISION STATEMENTS must be genuine questions starting with How/What/Which/Should — never solutions or goals.",
  "2. STRATEGIES must be genuinely distinct — if two strategies share >60% of their choices they are not meaningfully different.",
  "3. ISSUES must distinguish between: facts (verified), assumptions (treated as true but unverified), uncertainties (unknown), and brutal truths (known but avoided).",
  "4. FOCUS DECISIONS are the strategic choices that drive strategy design — they must be decisions, not goals or actions.",
  "5. CRITERIA must reflect what the organisation genuinely values — not just what is easy to measure.",
  "6. RECOMMENDATIONS must be directly traceable to criteria scores — never assert a recommendation without showing the reasoning chain.",
  "7. COMMITMENT is a DQ element — flag explicitly when stakeholder alignment is weak or assumed.",
  "8. NEVER generate content that would mislead the team into thinking they have higher decision quality than they do.",
  "9. PUSH BACK when asked to do something that would violate DQ principles — explain why and suggest the correct approach.",
  "10. LABEL clearly: what is fact, what is assumption, what is inference from available data.",
].join(" ");

// DQ self-check appended to outputs that produce structured recommendations
const DQ_SELF_CHECK = [
  "BEFORE returning your response, verify:",
  "(a) Decision statements are questions not solutions.",
  "(b) Strategies are genuinely distinct from each other.",
  "(c) Issues clearly distinguish facts from assumptions from uncertainties.",
  "(d) Any recommendation is directly traceable to criteria.",
  "(e) Commitment and stakeholder alignment risks are flagged if relevant.",
  "If any check fails, correct it before responding.",
].join(" ");

// Harden any prompt with DQ methodology enforcement
const dqPrompt = (prompt, includeSelfCheck = true) => {
  return DQ_SYSTEM_BRIEF + " " + prompt + (includeSelfCheck ? " " + DQ_SELF_CHECK : "");
};

const useAI = () => {
  const [busy, setBusy] = useState(false);
  const [lastError, setLastError] = useState(null);
  const call = useCallback(async (prompt, cb) => {
    setBusy(true);
    setLastError(null);
    try {
      const r = await fetch("/api/claude", {
        method:"POST",
        headers:{ "Content-Type":"application/json" },
        body: JSON.stringify({ prompt }),
      });
      if (!r.ok) {
        const errData = await r.json().catch(()=>({error:`HTTP ${r.status}`}));
        const msg = errData?.error || `API error ${r.status}`;
        setLastError(msg);
        cb({ error: msg });
        setBusy(false);
        return;
      }
            const d = await r.json();
      // Proxy returns parsed JSON directly, or { _raw: text } if not JSON
      if (d._raw !== undefined) {
        // Try to parse the raw text
        try { cb(JSON.parse(d._raw.replace(/```json|```/g,"").trim())); }
        catch(e) { cb({ _raw: d._raw }); }
      } else if (d.error) {
        cb({ error: d.error });
      } else {
        // Already parsed JSON object
        cb(d);
      }
    } catch(e) {
      const msg = String(e);
      setLastError(msg);
      cb({ error: msg });
    }
    setBusy(false);
  }, []);
  // DQ output validator — checks AI output against DQ principles
  const validateDQOutput = useCallback(async (outputType, data, context, onResult) => {
    const checks = {
      decisionStatement: (d) => {
        const stmt = d?.frame?.decisionStatement || d?.decisionStatement || "";
        const isQuestion = /^(how|what|which|should|where|when|who|why)/i.test(stmt.trim());
        const isSolution = /^(we should|we will|implement|deploy|use|adopt|choose|select)/i.test(stmt.trim());
        if (!isQuestion) return "Decision statement is not framed as a question. DQ requires open questions, not predetermined answers.";
        if (isSolution) return "Decision statement reads as a solution. Reframe as an open question.";
        return null;
      },
      strategies: (d) => {
        const strats = d?.strategies || [];
        if (strats.length < 2) return null;
        // Check distinctiveness
        for (let i = 0; i < strats.length; i++) {
          for (let j = i+1; j < strats.length; j++) {
            const s1 = strats[i]; const s2 = strats[j];
            if (s1.name && s2.name && s1.name.toLowerCase() === s2.name.toLowerCase())
              return "Two strategies have identical names — they are not genuinely distinct.";
          }
        }
        return null;
      },
      issues: (d) => {
        const issues = d?.issues || [];
        const hasBrutal = issues.some(i=>i.category==="brutal-truth");
        const hasAssumption = issues.some(i=>i.category==="assumption");
        const hasUncertainty = issues.some(i=>i.category==="uncertainty-external"||i.category==="uncertainty-internal");
        if (!hasBrutal) return "No brutal truths in generated issues. Good DQ always surfaces uncomfortable realities.";
        if (!hasAssumption) return "No assumptions identified. Every decision rests on unverified assumptions.";
        return null;
      },
    };

    const check = checks[outputType];
    if (check) {
      const warning = check(data);
      if (warning && onResult) onResult(warning);
    }
  }, []);

  return { busy, call, lastError, validateDQOutput };
};

/* ─────────────────────────────────────────────────────────────────────────────
   MICRO COMPONENTS
───────────────────────────────────────────────────────────────────────────── */
const Svg = ({path, size=16, color="currentColor", sw=1.75, fill="none"}) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill={fill} stroke={color}
       strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round">
    {Array.isArray(path) ? path.map((p,i)=><path key={i} d={p}/>) : <path d={path}/>}
  </svg>
);

const ICONS = {
  plus:   "M12 5v14M5 12h14",
  x:      "M18 6L6 18M6 6l12 12",
  check:  "M20 6L9 17l-5-5",
  chevR:  "M9 6l6 6-6 6",
  chevD:  "M6 9l6 6 6-6",
  spark:  "M9.663 17h4.673M12 3v1m6.364 1.636-.707.707M21 12h-1M4 12H3M6.343 6.343l-.707-.707M6.343 17.657l-.707.707M15.536 8.464a5 5 0 1 1-7.072 7.072",
  send:   "M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z",
  warn:   "M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0zM12 9v4M12 17h.01",
  info:   "M12 16v-4M12 8h.01M22 12a10 10 0 1 1-20 0 10 10 0 0 1 20 0z",
  lock:   "M18 11H6a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-6a2 2 0 0 0-2-2zM7 11V7a5 5 0 0 1 10 0v4",
  export: "M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M17 8l-5-5-5 5M12 3v12",
  link:   "M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71",
  drag:   "M9 5h2M9 12h2M9 19h2M13 5h2M13 12h2M13 19h2",
  eye:    "M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8zM12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6z",
  filter: "M22 3H2l8 9.46V19l4 2v-8.54L22 3z",
  tag:    "M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82zM7 7h.01",
};

const Btn = ({ children, onClick, variant="ghost", size="md", icon, disabled, full, style={} }) => {
  const sz = { sm:{p:"4px 10px",fs:11}, md:{p:"7px 14px",fs:12}, lg:{p:"9px 18px",fs:13} }[size];
  const vars = {
    primary:   { bg:DS.accent, color:"#fff", border:`1px solid ${DS.accentDim}`, shadow:"0 1px 3px rgba(37,99,235,.35)" },
    secondary: { bg:DS.canvas, color:DS.ink, border:`1px solid ${DS.canvasBdr}`, shadow:"0 1px 2px rgba(0,0,0,.06)" },
    ghost:     { bg:"transparent", color:DS.textSec, border:"1px solid transparent", shadow:"none" },
    danger:    { bg:DS.dangerSoft, color:DS.danger, border:`1px solid ${DS.dangerLine}`, shadow:"none" },
    chrome:    { bg:DS.chromeSub, color:DS.textSec, border:`1px solid ${DS.border}`, shadow:"none" },
  };
  const v = vars[variant] || vars.ghost;
  return (
    <button onClick={onClick} disabled={disabled}
      style={{ display:"inline-flex", alignItems:"center", gap:6, padding:sz.p, fontSize:sz.fs,
        fontFamily:"inherit", fontWeight:600, cursor:disabled?"not-allowed":"pointer",
        borderRadius:6, border:v.border, background:v.bg, color:v.color, boxShadow:v.shadow,
        opacity:disabled?.5:1, transition:"all .12s", width:full?"100%":undefined,
        justifyContent:full?"center":undefined, letterSpacing:.2, ...style }}
      onMouseEnter={e=>{ if(!disabled){ if(variant==="primary") e.currentTarget.style.background=DS.accentDim;
        else if(variant==="secondary"){ e.currentTarget.style.borderColor=DS.canvasMid; e.currentTarget.style.background=DS.canvasAlt; }
        else if(variant==="ghost"){ e.currentTarget.style.background=DS.chromeSub; e.currentTarget.style.color=DS.textPri; }
        else if(variant==="chrome"){ e.currentTarget.style.borderColor=DS.borderMid; e.currentTarget.style.color=DS.textPri; }}}}
      onMouseLeave={e=>{ if(!disabled){ e.currentTarget.style.background=v.bg; e.currentTarget.style.color=v.color;
        e.currentTarget.style.borderColor=v.border.split(" ").pop(); }}}>
      {icon && <Svg path={ICONS[icon]} size={sz.fs+1} color="currentColor"/>}
      {children}
    </button>
  );
};

const Badge = ({ children, variant="default", size="sm" }) => {
  const v = {
    default: { bg:DS.canvasAlt, color:DS.inkSub, border:DS.canvasBdr },
    blue:    { bg:DS.accentSoft, color:DS.accent, border:DS.accentLine },
    green:   { bg:DS.successSoft, color:DS.success, border:DS.successLine },
    warn:    { bg:DS.warnSoft, color:DS.warning, border:DS.warnLine },
    danger:  { bg:DS.dangerSoft, color:DS.danger, border:DS.dangerLine },
    chrome:  { bg:DS.chromeSub, color:DS.textSec, border:DS.border },
    amber:   { bg:"#fffbeb", color:DS.amber, border:"#fde68a" },
  }[variant] || { bg:DS.canvasAlt, color:DS.inkSub, border:DS.canvasBdr };
  const fs = size==="xs"?10:11;
  return (
    <span style={{ display:"inline-flex", alignItems:"center", gap:4, padding: size==="xs"?"1px 7px":"2px 9px",
      fontSize:fs, fontWeight:700, letterSpacing:.4, textTransform:"uppercase",
      borderRadius:4, background:v.bg, color:v.color, border:`1px solid ${v.border}`,
      whiteSpace:"nowrap", flexShrink:0 }}>
      {children}
    </span>
  );
};

const Field = ({ label, required, hint, children, error }) => (
  <div style={{ marginBottom:20 }}>
    <div style={{ display:"flex", justifyContent:"space-between", alignItems:"baseline", marginBottom:6 }}>
      <label style={{ fontSize:11, fontWeight:700, color:DS.inkSub, letterSpacing:.8, textTransform:"uppercase" }}>
        {label}{required && <span style={{color:DS.danger, marginLeft:3}}>*</span>}
      </label>
      {hint && <span style={{ fontSize:10, color:DS.inkTer }}>{hint}</span>}
    </div>
    {children}
    {error && <div style={{ fontSize:11, color:DS.danger, marginTop:4, display:"flex", alignItems:"center", gap:4 }}>
      <Svg path={ICONS.warn} size={11} color={DS.danger}/>{error}
    </div>}
  </div>
);

const Input = ({ value, onChange, placeholder, onBlur, onFocus, disabled, style={} }) => (
  <input value={value} onChange={e=>onChange(e.target.value)} placeholder={placeholder}
    onBlur={onBlur} onFocus={onFocus} disabled={disabled}
    style={{ width:"100%", padding:"9px 12px", fontSize:13, fontFamily:"inherit",
      background:DS.canvas, border:`1px solid ${DS.canvasBdr}`, borderRadius:6,
      color:DS.ink, outline:"none", transition:"border-color .12s", boxSizing:"border-box",
      opacity:disabled?.6:1, ...style }}
    onMouseEnter={e=>{ if(!disabled) e.target.style.borderColor=DS.canvasMid; }}
    onMouseLeave={e=>{ if(document.activeElement!==e.target) e.target.style.borderColor=DS.canvasBdr; }}
    onFocusCapture={e=>e.target.style.borderColor=DS.accent}
    onBlurCapture={e=>e.target.style.borderColor=DS.canvasBdr}
  />
);

const Textarea = ({ value, onChange, placeholder, rows=3, style={} }) => (
  <textarea value={value} onChange={e=>onChange(e.target.value)} placeholder={placeholder} rows={rows}
    style={{ width:"100%", padding:"9px 12px", fontSize:13, fontFamily:"inherit",
      background:DS.canvas, border:`1px solid ${DS.canvasBdr}`, borderRadius:6,
      color:DS.ink, outline:"none", resize:"vertical", transition:"border-color .12s",
      boxSizing:"border-box", lineHeight:1.55, ...style }}
    onFocusCapture={e=>e.target.style.borderColor=DS.accent}
    onBlurCapture={e=>e.target.style.borderColor=DS.canvasBdr}
  />
);

const Select = ({ value, onChange, options, style={} }) => (
  <select value={value} onChange={e=>onChange(e.target.value)}
    style={{ width:"100%", padding:"9px 12px", fontSize:13, fontFamily:"inherit",
      background:DS.canvas, border:`1px solid ${DS.canvasBdr}`, borderRadius:6,
      color:DS.ink, outline:"none", cursor:"pointer", boxSizing:"border-box", ...style }}
    onFocusCapture={e=>e.target.style.borderColor=DS.accent}
    onBlurCapture={e=>e.target.style.borderColor=DS.canvasBdr}>
    {options.map(o=><option key={o.value} value={o.value}>{o.label}</option>)}
  </select>
);

const SectionCard = ({ title, subtitle, children, actions, chrome }) => (
  <div style={{ background: chrome ? DS.chromeMid : DS.canvas,
    border:`1px solid ${chrome ? DS.border : DS.canvasBdr}`,
    borderRadius:8, overflow:"hidden", marginBottom:20 }}>
    <div style={{ padding:"14px 20px", borderBottom:`1px solid ${chrome ? DS.border : DS.canvasBdr}`,
      display:"flex", alignItems:"center", justifyContent:"space-between",
      background: chrome ? DS.chromeSub : DS.canvasAlt }}>
      <div>
        <div style={{ fontSize:12, fontWeight:700, color:chrome?DS.textPri:DS.ink, letterSpacing:.3 }}>{title}</div>
        {subtitle && <div style={{ fontSize:11, color:chrome?DS.textTer:DS.inkTer, marginTop:2 }}>{subtitle}</div>}
      </div>
      {actions && <div style={{ display:"flex", gap:6 }}>{actions}</div>}
    </div>
    <div style={{ padding:20 }}>{children}</div>
  </div>
);

const AIPanel = ({ messages, onSend, loading, nudge }) => {
  const [input, setInput] = useState("");
  const bottomRef = useRef(null);
  useEffect(()=>{ bottomRef.current?.scrollIntoView({behavior:"smooth"}); }, [messages]);

  const send = (text) => {
    const t = text || input;
    if (!t.trim()) return;
    setInput("");
    onSend(t);
  };

  return (
    <div style={{ display:"flex", flexDirection:"column", height:"100%",
      background:DS.chromeAlt, borderLeft:`1px solid ${DS.border}` }}>
      <div style={{ padding:"14px 16px", borderBottom:`1px solid ${DS.border}`,
        display:"flex", alignItems:"center", gap:10 }}>
        <div style={{ width:30, height:30, borderRadius:6, background:DS.accent,
          display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0 }}>
          <Svg path={ICONS.spark} size={15} color="#fff"/>
        </div>
        <div>
          <div style={{ fontSize:12, fontWeight:700, color:DS.textPri, letterSpacing:.3 }}>AI Co‑Pilot</div>
          <div style={{ fontSize:10, color:DS.textTer }}>Decision Quality facilitator</div>
        </div>
        <div style={{ marginLeft:"auto" }}>
          <span style={{ width:7, height:7, borderRadius:"50%", background:"#22c55e",
            display:"inline-block", boxShadow:"0 0 6px #22c55e" }}/>
        </div>
      </div>

      {nudge && (
        <div style={{ margin:"10px 12px 0", padding:"9px 11px",
          background:"rgba(37,99,235,.12)", border:"1px solid rgba(37,99,235,.25)",
          borderRadius:6, cursor:"pointer" }} onClick={()=>send(nudge)}>
          <div style={{ fontSize:10, fontWeight:700, color:DS.accent, letterSpacing:.8,
            textTransform:"uppercase", marginBottom:3 }}>Suggested Analysis</div>
          <div style={{ fontSize:11, color:"#93b4fd", lineHeight:1.5 }}>{nudge}</div>
        </div>
      )}

      <div style={{ flex:1, overflowY:"auto", padding:"12px 14px", display:"flex",
        flexDirection:"column", gap:8 }}>
        {messages.length===0 && (
          <div style={{ fontSize:11, color:DS.textTer, textAlign:"center", marginTop:24, lineHeight:1.7 }}>
            Ask anything about your decision,<br/>or click the suggestion above.
          </div>
        )}
        {messages.map((m,i) => (
          <div key={i} style={{ display:"flex", flexDirection:"column",
            alignItems: m.role==="user"?"flex-end":"flex-start" }}>
            <div style={{ maxWidth:"90%", padding:"8px 11px", fontSize:11, lineHeight:1.6,
              borderRadius: m.role==="user" ? "8px 8px 2px 8px" : "8px 8px 8px 2px",
              background: m.role==="user" ? DS.accent : DS.chromeMid,
              color: m.role==="user" ? "#fff" : DS.textSec,
              border:`1px solid ${m.role==="user" ? DS.accentDim : DS.border}` }}>
              {m.text}
            </div>
          </div>
        ))}
        {loading && (
          <div style={{ display:"flex", gap:4, padding:"8px 11px", background:DS.chromeSub,
            borderRadius:"8px 8px 8px 2px", border:`1px solid ${DS.border}`, width:"fit-content" }}>
            {[0,1,2].map(i=>(
              <div key={i} style={{ width:5, height:5, borderRadius:"50%", background:DS.textTer,
                animation:`aipulse 1.2s ${i*.2}s infinite ease-in-out` }}/>
            ))}
          </div>
        )}
        <div ref={bottomRef}/>
      </div>

      <div style={{ padding:"10px 12px", borderTop:`1px solid ${DS.border}` }}>
        <div style={{ display:"flex", gap:6, alignItems:"flex-end" }}>
          <textarea value={input} onChange={e=>setInput(e.target.value)} rows={2}
            onKeyDown={e=>{ if(e.key==="Enter"&&!e.shiftKey){ e.preventDefault(); send(); }}}
            placeholder="Ask the co‑pilot…"
            style={{ flex:1, padding:"8px 10px", fontSize:11, fontFamily:"inherit",
              background:DS.chromeSub, border:`1px solid ${DS.border}`, borderRadius:6,
              color:DS.textPri, outline:"none", resize:"none", lineHeight:1.5 }}/>
          <button onClick={()=>send()} style={{ padding:"8px 10px", background:DS.accent,
            border:"none", borderRadius:6, cursor:"pointer", display:"flex",
            alignItems:"center", justifyContent:"center" }}>
            <Svg path={ICONS.send} size={13} color="#fff"/>
          </button>
        </div>
      </div>
    </div>
  );
};

/* ─────────────────────────────────────────────────────────────────────────────
   MODULE 1 — PROBLEM DEFINITION
───────────────────────────────────────────────────────────────────────────── */
const URGENCY_OPTS = ["Critical — Decide within days","High — Decide within weeks","Medium — Decide within months","Low — No immediate pressure"];
const IMPORTANCE_OPTS = ["Enterprise-critical","Strategically significant","Operationally important","Routine"];

const defaultProblem = () => ({
  id: uid("prob"),
  decisionStatement: "How should we enter the APAC market over the next 18 months while minimising capital exposure and managing regulatory risk?",
  context: "Our current revenue is concentrated in North America and Europe. The APAC region represents 38% of total addressable market but we have no presence. A competitor moved in 14 months ago.",
  background: "Board-approved expansion strategy requires entering at least one new major region by end of FY26. APAC was identified as highest priority in the 2024 strategic review.",
  trigger: "Competitor's successful APAC launch and approaching board deadline for expansion milestones.",
  symptoms: "Slowing North American growth, increasing inbound APAC inquiries, competitive pressure from new entrant.",
  rootDecision: "What is the optimal market entry model for APAC given our current capabilities, risk appetite, and capital constraints?",
  scopeIn: "Market entry mode selection, geographic prioritisation within APAC, initial partnership or acquisition targets.",
  scopeOut: "Product roadmap changes, pricing strategy, long-term headcount planning, European operations.",
  timeHorizon: "18 months to initial market entry; 36 months to break-even.",
  deadline: "Board decision required by Q2 FY26",
  owner: "Chief Strategy Officer",
  stakeholders: [
    { id:uid("sh"), name:"Board of Directors", role:"Decision Authority", influence:"High" },
    { id:uid("sh"), name:"CFO", role:"Capital Approval", influence:"High" },
    { id:uid("sh"), name:"Head of Sales", role:"Go-to-market execution", influence:"Medium" },
    { id:uid("sh"), name:"Legal & Compliance", role:"Regulatory advisory", influence:"Medium" },
    { id:uid("sh"), name:"Product", role:"Localisation requirements", influence:"Low" },
  ],
  constraints: "Capital budget ceiling of $25M for Year 1. Must comply with local data residency laws. No greenfield hiring of more than 30 FTEs in Year 1.",
  assumptions: "APAC regulatory environment remains broadly stable. Existing product requires only moderate localisation. Key partnership targets remain available.",
  successCriteria: "Signed partnership or entity established within 12 months. First revenue from APAC within 18 months. CAC within 130% of North American baseline.",
  failureConsequences: "Competitor cements first-mover advantage. Board confidence in management erodes. Revenue growth target missed by >15% in FY27.",
  urgency: "High — Decide within weeks",
  importance: "Strategically significant",
  risks: "Regulatory delays, currency exposure, cultural misalignment in go-to-market approach.",
  opportunities: "First-mover advantage in 3 sub-markets, potential strategic acquisition at attractive valuation, channel partner with existing APAC infrastructure.",
  aiValidation: null,
  facilitatorNotes: "",
  version: 1,
  lastModified: new Date().toISOString(),
});

const DECISION_TYPES = ["Strategic","Portfolio","Capital Allocation","Tactical","Operational","Investment","Governance","Regulatory","Technical","Emergency"];
const SECTORS = ["Technology / SaaS","Energy & Resources","Financial Services","Healthcare & Life Sciences","Consumer & Retail","Manufacturing","Infrastructure","Government & Public Sector","Professional Services","Other"];
const CONFIDENTIALITY_LEVELS = ["Public","Internal","Confidential","Strictly Confidential"];
const PROJECT_STATUSES = ["Active","On Hold","Completed","Archived"];

function ProjectSetupModal({ data, onChange, onClose }) {
  const upd = (key, val) => onChange({ ...data, [key]: val });
  return (
    <div style={{ position:"fixed", inset:0, background:"rgba(10,12,16,.72)", zIndex:350,
      display:"flex", alignItems:"center", justifyContent:"center", padding:24,
      fontFamily:"'IBM Plex Sans','Helvetica Neue',sans-serif" }}>
      <div style={{ background:DS.canvas, borderRadius:14, width:"100%", maxWidth:720,
        maxHeight:"90vh", display:"flex", flexDirection:"column",
        boxShadow:"0 32px 80px rgba(0,0,0,.25)", border:`1px solid ${DS.canvasBdr}`, overflow:"hidden" }}>
        <div style={{ padding:"18px 24px", borderBottom:`1px solid ${DS.canvasBdr}`,
          display:"flex", alignItems:"center", gap:14, background:DS.ink, flexShrink:0 }}>
          <div style={{ width:36, height:36, borderRadius:8, background:DS.accent,
            display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0 }}>
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round">
              <polygon points="12,2 22,8.5 22,15.5 12,22 2,15.5 2,8.5"/>
              <line x1="12" y1="2" x2="12" y2="22"/>
              <line x1="2" y1="8.5" x2="22" y2="8.5"/>
              <line x1="2" y1="15.5" x2="22" y2="15.5"/>
            </svg>
          </div>
          <div style={{ flex:1 }}>
            <div style={{ fontFamily:"'Libre Baskerville',Georgia,serif", fontSize:17, fontWeight:700, color:DS.textPri }}>Project Setup</div>
            <div style={{ fontSize:11, color:DS.textTer, marginTop:1 }}>Project identity appears on all exports and reports</div>
          </div>
          <button onClick={onClose} style={{ background:"none", border:"none", cursor:"pointer", color:DS.textSec }}>
            <Svg path={ICONS.x} size={18} color={DS.textSec}/>
          </button>
        </div>
        <div style={{ flex:1, overflowY:"auto", padding:"24px 28px" }}>
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:20 }}>
            <div>
              <Field label="Project Name" required>
                <Input value={data.projectName||""} onChange={v=>upd("projectName",v)} placeholder="e.g. APAC Market Entry Strategy"/>
              </Field>
              <Field label="Project Code" hint="Optional">
                <Input value={data.projectCode||""} onChange={v=>upd("projectCode",v)} placeholder="e.g. STR-2025-001"/>
              </Field>
              <Field label="Client / Organisation">
                <Input value={data.client||""} onChange={v=>upd("client",v)} placeholder="e.g. Acme Corp — Strategy Team"/>
              </Field>
              <Field label="Project Description">
                <Textarea value={data.projectDescription||""} onChange={v=>upd("projectDescription",v)} rows={3}
                  placeholder="Brief description of this project…"/>
              </Field>
              <Field label="Facilitator / Lead">
                <Input value={data.facilitator||""} onChange={v=>upd("facilitator",v)} placeholder="Name of session facilitator"/>
              </Field>
            </div>
            <div>
              <Field label="Sector">
                <Select value={data.sector||""} onChange={v=>upd("sector",v)}
                  options={[{value:"",label:"Select sector…"},...SECTORS.map(t=>({value:t,label:t}))]}/>
              </Field>
              <Field label="Decision Type">
                <Select value={data.decisionType||"Strategic"} onChange={v=>upd("decisionType",v)}
                  options={DECISION_TYPES.map(t=>({value:t,label:t}))}/>
              </Field>
              <Field label="Confidentiality">
                <Select value={data.confidentiality||"Confidential"} onChange={v=>upd("confidentiality",v)}
                  options={CONFIDENTIALITY_LEVELS.map(t=>({value:t,label:t}))}/>
              </Field>
              <Field label="Project Status">
                <Select value={data.projectStatus||"Active"} onChange={v=>upd("projectStatus",v)}
                  options={PROJECT_STATUSES.map(t=>({value:t,label:t}))}/>
              </Field>
              <Field label="Session Date">
                <Input value={data.sessionDate||""} onChange={v=>upd("sessionDate",v)} placeholder="YYYY-MM-DD"/>
              </Field>
              <Field label="Decision Owner">
                <Input value={data.owner||""} onChange={v=>upd("owner",v)} placeholder="Who has final authority?"/>
              </Field>
            </div>
          </div>
        </div>
        <div style={{ padding:"14px 24px", borderTop:`1px solid ${DS.canvasBdr}`,
          display:"flex", alignItems:"center", justifyContent:"space-between",
          background:DS.canvasAlt, flexShrink:0 }}>
          <div style={{ fontSize:11, color:DS.inkTer }}>This information appears on all exports, reports, and the DQi dashboard.</div>
          <Btn variant="primary" icon="check" onClick={onClose}>Save & Close</Btn>
        </div>
      </div>
    </div>
  );
}

function ModuleProblemDefinition({ data, onChange, aiCall, aiBusy, messages, onAIMsg, onAISend }) {
  const [tab, setTab] = useState("frame");
  const [checking, setChecking] = useState(false);

  const upd = (key, val) => onChange({ ...data, [key]: val });
  const updStakeholder = (id, key, val) =>
    upd("stakeholders", data.stakeholders.map(s => s.id===id ? {...s,[key]:val} : s));

  const validateWithAI = () => {
    setChecking(true);
    const prompt = `You are a senior Decision Quality expert. Perform a rigorous validation of this decision frame.

Decision Statement: "${data.decisionStatement}"
Context: "${data.context}"
Root Decision: "${data.rootDecision}"
Scope In: "${data.scopeIn}"
Scope Out: "${data.scopeOut}"
Owner: "${data.owner}"
Time Horizon: "${data.timeHorizon}"
Deadline: "${data.deadline}"
Constraints: "${data.constraints}"
Assumptions: "${data.assumptions}"
Success Criteria: "${data.successCriteria}"

Evaluate strictly. Return ONLY valid JSON:
{
  "overallScore": 0-100,
  "status": "strong"|"adequate"|"weak",
  "flags": [{"severity":"critical"|"warning"|"info","field":"fieldName","message":"specific issue"}],
  "improvedStatement": "rewritten decision statement if needed, else null",
  "hiddenAssumptions": ["assumption 1","assumption 2"],
  "missingElements": ["missing item 1"],
  "executiveSummary": "2-sentence summary of the decision frame quality"
}`;
    aiCall(dqPrompt(prompt), (r) => {
      upd("aiValidation", r);
      setChecking(false);
      onAIMsg({ role:"ai", text: r.executiveSummary || (r._raw ? r._raw.slice(0,200) : "Validation complete. Check the frame quality panel.") });
    });
  };

  const TABS = [
    { id:"identity",     label:"Project Identity" },
    { id:"frame",        label:"Decision Frame" },
    { id:"scope",        label:"Scope & Time" },
    { id:"stakeholders", label:"Stakeholders" },
    { id:"constraints",  label:"Constraints & Assumptions" },
    { id:"outcomes",     label:"Outcomes" },
    { id:"validation",   label:"AI Validation" },
  ];

  const scoreColor = (s) => s>=75 ? DS.success : s>=50 ? DS.warning : DS.danger;
  const statusVar = (s) => s==="strong"?"green":s==="adequate"?"warn":"danger";

  return (
    <div style={{ display:"flex", flexDirection:"column", height:"100%" }}>
      {/* Module header */}
      <div style={{ padding:"16px 28px", background:DS.canvas, borderBottom:`1px solid ${DS.canvasBdr}`,
        display:"flex", alignItems:"center", gap:16, flexShrink:0 }}>
        <div style={{ flex:1 }}>
          <div style={{ fontSize:11, color:DS.inkTer, letterSpacing:1, textTransform:"uppercase", fontWeight:700, marginBottom:3 }}>Module 01</div>
          <div style={{ fontFamily:"'Libre Baskerville', Georgia, serif", fontSize:22, fontWeight:700, color:DS.ink, letterSpacing:-.3 }}>Problem Definition</div>
          {data.projectName && (
            <div style={{ fontSize:11, color:DS.inkTer, marginTop:2 }}>{data.projectName}</div>
          )}
        </div>
        <Badge variant={data.aiValidation ? statusVar(data.aiValidation.status) : "default"}>
          {data.aiValidation ? `DQ Score: ${data.aiValidation.overallScore}` : "Not validated"}
        </Badge>
        <Btn variant="primary" icon="spark" onClick={validateWithAI} disabled={aiBusy||checking}>
          {checking ? "Validating…" : "AI Frame Check"}
        </Btn>
      </div>

      {/* Tab bar */}
      <div style={{ display:"flex", gap:0, background:DS.canvasAlt,
        borderBottom:`1px solid ${DS.canvasBdr}`, flexShrink:0, paddingLeft:28 }}>
        {TABS.map(t => (
          <button key={t.id} onClick={()=>setTab(t.id)}
            style={{ padding:"10px 16px", fontSize:11, fontWeight:700, fontFamily:"inherit",
              cursor:"pointer", border:"none", borderBottom:`2px solid ${tab===t.id?DS.accent:"transparent"}`,
              background:"transparent", color:tab===t.id?DS.accent:DS.inkTer,
              letterSpacing:.4, transition:"all .12s",
              ...(t.id==="validation" && data.aiValidation?.flags?.filter(f=>f.severity==="critical").length > 0
                ? { color:DS.danger } : {})
            }}>
            {t.label}
            {t.id==="validation" && data.aiValidation && (
              <span style={{ marginLeft:6, padding:"1px 5px", borderRadius:10, fontSize:9, fontWeight:700,
                background: scoreColor(data.aiValidation.overallScore), color:"#fff" }}>
                {data.aiValidation.overallScore}
              </span>
            )}
          </button>
        ))}
      </div>

      <div style={{ flex:1, overflowY:"auto", padding:"24px 28px" }}>

        {tab==="identity" && (
          <div style={{ maxWidth:900 }}>
            {/* Project identity summary card */}
            <div style={{ marginBottom:24, padding:"18px 22px",
              background:`linear-gradient(135deg, ${DS.ink} 0%, ${DS.chromeSub} 100%)`,
              borderRadius:10, border:`1px solid ${DS.border}` }}>
              <div style={{ display:"flex", alignItems:"flex-start", gap:20 }}>
                <div style={{ width:52, height:52, borderRadius:10, background:DS.accent,
                  display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0 }}>
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round">
                    <polygon points="12,2 22,8.5 22,15.5 12,22 2,15.5 2,8.5"/>
                    <line x1="12" y1="2" x2="12" y2="22"/>
                    <line x1="2" y1="8.5" x2="22" y2="8.5"/>
                    <line x1="2" y1="15.5" x2="22" y2="15.5"/>
                  </svg>
                </div>
                <div style={{ flex:1 }}>
                  <div style={{ fontFamily:"'Libre Baskerville',Georgia,serif", fontSize:20,
                    fontWeight:700, color:DS.textPri, marginBottom:4, lineHeight:1.25 }}>
                    {data.projectName||"Untitled Project"}
                  </div>
                  <div style={{ fontSize:12, color:DS.textSec, marginBottom:8 }}>
                    {data.projectDescription||"No description yet."}
                  </div>
                  <div style={{ display:"flex", gap:8, flexWrap:"wrap" }}>
                    {data.projectCode && <Badge variant="chrome">{data.projectCode}</Badge>}
                    {data.sector && <Badge variant="blue">{data.sector}</Badge>}
                    {data.decisionType && <Badge variant="chrome">{data.decisionType}</Badge>}
                    {data.confidentiality && <Badge variant={data.confidentiality==="Strictly Confidential"?"danger":data.confidentiality==="Confidential"?"warn":"default"}>{data.confidentiality}</Badge>}
                    {data.projectStatus && <Badge variant={data.projectStatus==="Active"?"green":data.projectStatus==="Completed"?"blue":"default"}>{data.projectStatus}</Badge>}
                  </div>
                </div>
                <div style={{ textAlign:"right", flexShrink:0 }}>
                  <div style={{ fontSize:10, color:DS.textTer, marginBottom:3 }}>Session date</div>
                  <div style={{ fontSize:13, fontWeight:700, color:DS.textSec }}>
                    {data.sessionDate ? new Date(data.sessionDate).toLocaleDateString("en-GB",{day:"numeric",month:"long",year:"numeric"}) : "Not set"}
                  </div>
                  <div style={{ fontSize:10, color:DS.textTer, marginTop:6 }}>Facilitator</div>
                  <div style={{ fontSize:12, fontWeight:600, color:DS.textSec }}>{data.facilitator||"—"}</div>
                </div>
              </div>
            </div>

            {/* Editable fields */}
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:20 }}>
              <div>
                <Field label="Project Name" required>
                  <Input value={data.projectName||""} onChange={v=>upd("projectName",v)}
                    placeholder="e.g. APAC Market Entry Strategy"/>
                </Field>
                <Field label="Project Code / Reference">
                  <Input value={data.projectCode||""} onChange={v=>upd("projectCode",v)}
                    placeholder="e.g. STR-2025-001"/>
                </Field>
                <Field label="Client / Organisation">
                  <Input value={data.client||""} onChange={v=>upd("client",v)}
                    placeholder="e.g. Acme Corp — Strategy Team"/>
                </Field>
                <Field label="Project Description">
                  <Textarea value={data.projectDescription||""} onChange={v=>upd("projectDescription",v)}
                    rows={3} placeholder="Brief description of this project…"/>
                </Field>
              </div>
              <div>
                <Field label="Decision Type">
                  <Select value={data.decisionType||"Strategic"} onChange={v=>upd("decisionType",v)}
                    options={DECISION_TYPES.map(t=>({value:t,label:t}))}/>
                </Field>
                <Field label="Sector">
                  <Select value={data.sector||""} onChange={v=>upd("sector",v)}
                    options={[{value:"",label:"Select sector…"},...SECTORS.map(t=>({value:t,label:t}))]}/>
                </Field>
                <Field label="Facilitator / Lead">
                  <Input value={data.facilitator||""} onChange={v=>upd("facilitator",v)}
                    placeholder="Name of session facilitator"/>
                </Field>
                <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12 }}>
                  <Field label="Confidentiality">
                    <Select value={data.confidentiality||"Confidential"} onChange={v=>upd("confidentiality",v)}
                      options={CONFIDENTIALITY_LEVELS.map(t=>({value:t,label:t}))}/>
                  </Field>
                  <Field label="Status">
                    <Select value={data.projectStatus||"Active"} onChange={v=>upd("projectStatus",v)}
                      options={PROJECT_STATUSES.map(t=>({value:t,label:t}))}/>
                  </Field>
                </div>
                <Field label="Session Date">
                  <Input value={data.sessionDate||""} onChange={v=>upd("sessionDate",v)}
                    placeholder="YYYY-MM-DD" style={{ padding:"8px 12px" }}/>
                </Field>
              </div>
            </div>
          </div>
        )}

        {tab==="frame" && (
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:24, maxWidth:1100 }}>
            <div>
              <Field label="Decision Statement" required hint="Start with 'How should we…' or 'What is the best…'">
                <Textarea value={data.decisionStatement} onChange={v=>upd("decisionStatement",v)} rows={3}
                  placeholder="What specific decision are we making?"/>
              </Field>
              <Field label="Business Context" required>
                <Textarea value={data.context} onChange={v=>upd("context",v)} rows={4}
                  placeholder="What is the situation driving this decision?"/>
              </Field>
              <Field label="Business Background">
                <Textarea value={data.background} onChange={v=>upd("background",v)} rows={3}
                  placeholder="Relevant history, prior decisions, strategic context"/>
              </Field>
            </div>
            <div>
              <Field label="Trigger / Precipitating Event">
                <Textarea value={data.trigger} onChange={v=>upd("trigger",v)} rows={2}
                  placeholder="What event or condition is forcing this decision now?"/>
              </Field>
              <Field label="Problem Symptoms" hint="Distinguish from root decision">
                <Textarea value={data.symptoms} onChange={v=>upd("symptoms",v)} rows={3}
                  placeholder="Observable symptoms — not the decision itself"/>
              </Field>
              <Field label="Root Decision Problem" required>
                <Textarea value={data.rootDecision} onChange={v=>upd("rootDecision",v)} rows={3}
                  placeholder="The underlying strategic choice beneath the symptoms"/>
              </Field>
              <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:14 }}>
                <Field label="Strategic Importance">
                  <Select value={data.importance} onChange={v=>upd("importance",v)}
                    options={IMPORTANCE_OPTS.map(o=>({value:o,label:o}))}/>
                </Field>
                <Field label="Decision Urgency">
                  <Select value={data.urgency} onChange={v=>upd("urgency",v)}
                    options={URGENCY_OPTS.map(o=>({value:o,label:o}))}/>
                </Field>
              </div>
            </div>
          </div>
        )}

        {tab==="scope" && (
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:24, maxWidth:1100 }}>
            <div>
              <Field label="In Scope" required>
                <Textarea value={data.scopeIn} onChange={v=>upd("scopeIn",v)} rows={4}
                  placeholder="Explicitly what this decision covers"/>
              </Field>
              <Field label="Out of Scope" required>
                <Textarea value={data.scopeOut} onChange={v=>upd("scopeOut",v)} rows={4}
                  placeholder="What is explicitly excluded — boundary setting"/>
              </Field>
            </div>
            <div>
              <Field label="Time Horizon">
                <Input value={data.timeHorizon} onChange={v=>upd("timeHorizon",v)}
                  placeholder="e.g. 18 months to entry, 36 months to break-even"/>
              </Field>
              <Field label="Decision Deadline" required>
                <Input value={data.deadline} onChange={v=>upd("deadline",v)}
                  placeholder="e.g. Board decision required by Q2 FY26"/>
              </Field>
              <Field label="Decision Owner" required>
                <Input value={data.owner} onChange={v=>upd("owner",v)}
                  placeholder="Who has final decision authority?"/>
              </Field>
              <Field label="Linked Risks">
                <Textarea value={data.risks} onChange={v=>upd("risks",v)} rows={3}
                  placeholder="Key risk factors connected to this decision"/>
              </Field>
              <Field label="Linked Opportunities">
                <Textarea value={data.opportunities} onChange={v=>upd("opportunities",v)} rows={3}
                  placeholder="Strategic opportunities enabled by this decision"/>
              </Field>
            </div>
          </div>
        )}

        {tab==="stakeholders" && (
          <div style={{ maxWidth:900 }}>
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:16 }}>
              <div style={{ fontSize:12, color:DS.inkSub }}>
                {data.stakeholders.length} stakeholder{data.stakeholders.length!==1?"s":""} identified
              </div>
              <Btn variant="secondary" icon="plus" size="sm"
                onClick={()=>upd("stakeholders",[...data.stakeholders, { id:uid("sh"), name:"", role:"", influence:"Medium" }])}>
                Add Stakeholder
              </Btn>
            </div>
            <div style={{ border:`1px solid ${DS.canvasBdr}`, borderRadius:8, overflow:"hidden" }}>
              <table style={{ width:"100%", borderCollapse:"collapse" }}>
                <thead>
                  <tr style={{ background:DS.canvasAlt }}>
                    {["Name","Role / Interest","Influence",""].map(h=>(
                      <th key={h} style={{ padding:"10px 14px", fontSize:10, fontWeight:700, color:DS.inkTer,
                        letterSpacing:.8, textTransform:"uppercase", textAlign:"left",
                        borderBottom:`1px solid ${DS.canvasBdr}` }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {data.stakeholders.map((s,i)=>(
                    <tr key={s.id} style={{ borderBottom: i<data.stakeholders.length-1 ? `1px solid ${DS.canvasBdr}` : "none" }}>
                      <td style={{ padding:"8px 14px", width:"30%" }}>
                        <Input value={s.name} onChange={v=>updStakeholder(s.id,"name",v)} placeholder="Stakeholder name"/>
                      </td>
                      <td style={{ padding:"8px 14px", width:"40%" }}>
                        <Input value={s.role} onChange={v=>updStakeholder(s.id,"role",v)} placeholder="Role or interest"/>
                      </td>
                      <td style={{ padding:"8px 14px", width:"20%" }}>
                        <Select value={s.influence} onChange={v=>updStakeholder(s.id,"influence",v)}
                          options={["High","Medium","Low"].map(o=>({value:o,label:o}))}/>
                      </td>
                      <td style={{ padding:"8px 14px", textAlign:"center" }}>
                        <button onClick={()=>upd("stakeholders",data.stakeholders.filter(x=>x.id!==s.id))}
                          style={{ background:"none", border:"none", cursor:"pointer", color:DS.inkDis, display:"flex" }}>
                          <Svg path={ICONS.x} size={13} color={DS.inkTer}/>
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {tab==="constraints" && (
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:24, maxWidth:1100 }}>
            <div>
              <Field label="Constraints" required hint="Hard limits — non-negotiable">
                <Textarea value={data.constraints} onChange={v=>upd("constraints",v)} rows={5}
                  placeholder="Budget ceiling, regulatory requirements, resource limits, policy boundaries"/>
              </Field>
              <Field label="Assumptions" hint="Identify hidden assumptions explicitly">
                <Textarea value={data.assumptions} onChange={v=>upd("assumptions",v)} rows={5}
                  placeholder="What are we assuming to be true that may not be?"/>
              </Field>
            </div>
            <div>
              <Field label="Facilitator Notes" hint="Internal only">
                <Textarea value={data.facilitatorNotes} onChange={v=>upd("facilitatorNotes",v)} rows={5}
                  placeholder="Workshop observations, unresolved tensions, process notes"/>
              </Field>
            </div>
          </div>
        )}

        {tab==="outcomes" && (
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:24, maxWidth:1100 }}>
            <div>
              <Field label="Success Criteria" required>
                <Textarea value={data.successCriteria} onChange={v=>upd("successCriteria",v)} rows={4}
                  placeholder="Measurable outcomes that define a successful decision"/>
              </Field>
            </div>
            <div>
              <Field label="Failure Consequences" required hint="What happens if we decide poorly?">
                <Textarea value={data.failureConsequences} onChange={v=>upd("failureConsequences",v)} rows={4}
                  placeholder="Consequences of making the wrong decision, or no decision"/>
              </Field>
            </div>
          </div>
        )}

        {tab==="validation" && (
          <div style={{ maxWidth:900 }}>
            {!data.aiValidation ? (
              <div style={{ padding:"60px 40px", textAlign:"center", border:`1.5px dashed ${DS.canvasMid}`,
                borderRadius:10, color:DS.inkTer }}>
                <Svg path={ICONS.spark} size={32} color={DS.inkDis}/>
                <div style={{ fontSize:14, marginTop:12, marginBottom:20 }}>Run AI Frame Check to validate this decision definition</div>
                <Btn variant="primary" icon="spark" onClick={validateWithAI} disabled={aiBusy||checking}>
                  {checking ? "Validating…" : "Run AI Frame Check"}
                </Btn>
              </div>
            ) : (
              <div>
                {/* Score banner */}
                <div style={{ display:"flex", alignItems:"center", gap:16, padding:"18px 22px",
                  background: data.aiValidation.overallScore>=75 ? DS.successSoft : data.aiValidation.overallScore>=50 ? DS.warnSoft : DS.dangerSoft,
                  border:`1px solid ${data.aiValidation.overallScore>=75 ? DS.successLine : data.aiValidation.overallScore>=50 ? DS.warnLine : DS.dangerLine}`,
                  borderRadius:8, marginBottom:20 }}>
                  <div style={{ fontSize:40, fontWeight:700, fontFamily:"'Libre Baskerville', Georgia, serif",
                    color:scoreColor(data.aiValidation.overallScore), lineHeight:1 }}>
                    {data.aiValidation.overallScore}
                  </div>
                  <div>
                    <Badge variant={statusVar(data.aiValidation.status)}>
                      Frame Quality: {data.aiValidation.status}
                    </Badge>
                    {data.aiValidation.executiveSummary && (
                      <div style={{ fontSize:12, color:DS.inkSub, marginTop:6, lineHeight:1.55 }}>
                        {data.aiValidation.executiveSummary}
                      </div>
                    )}
                  </div>
                </div>

                {/* Flags */}
                {data.aiValidation.flags?.length > 0 && (
                  <SectionCard title="Validation Flags">
                    <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
                      {data.aiValidation.flags.map((f,i) => (
                        <div key={i} style={{ display:"flex", alignItems:"flex-start", gap:10, padding:"10px 14px",
                          background: f.severity==="critical" ? DS.dangerSoft : f.severity==="warning" ? DS.warnSoft : DS.accentSoft,
                          border:`1px solid ${f.severity==="critical" ? DS.dangerLine : f.severity==="warning" ? DS.warnLine : DS.accentLine}`,
                          borderRadius:6 }}>
                          <Badge variant={f.severity==="critical"?"danger":f.severity==="warning"?"warn":"blue"} size="xs">
                            {f.severity}
                          </Badge>
                          <div>
                            <span style={{ fontSize:11, fontWeight:700, color:DS.inkSub }}>{f.field}: </span>
                            <span style={{ fontSize:12, color:DS.ink }}>{f.message}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </SectionCard>
                )}

                <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:16 }}>
                  {data.aiValidation.improvedStatement && (
                    <SectionCard title="Improved Decision Statement">
                      <div style={{ fontSize:13, color:DS.ink, lineHeight:1.6, fontStyle:"italic" }}>
                        "{data.aiValidation.improvedStatement}"
                      </div>
                      <div style={{ marginTop:12 }}>
                        <Btn variant="secondary" size="sm" onClick={()=>upd("decisionStatement", data.aiValidation.improvedStatement)}>
                          Apply Improvement
                        </Btn>
                      </div>
                    </SectionCard>
                  )}
                  {data.aiValidation.hiddenAssumptions?.length > 0 && (
                    <SectionCard title="Hidden Assumptions Detected">
                      {data.aiValidation.hiddenAssumptions.map((a,i)=>(
                        <div key={i} style={{ fontSize:12, color:DS.ink, marginBottom:6,
                          padding:"6px 10px", background:DS.warnSoft, borderRadius:5,
                          border:`1px solid ${DS.warnLine}` }}>⚠ {a}</div>
                      ))}
                    </SectionCard>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────────────────
   MODULE 2 — ISSUE RAISING & CATEGORISATION
───────────────────────────────────────────────────────────────────────────── */
const SEVERITY_LEVELS = ["Critical","High","Medium","Low"];
const ISSUE_STATUS    = ["Open","In Review","Resolved","Deferred","Escalated"];

// ── 12-CATEGORY DQ TAXONOMY ──────────────────────────────────────────────────
const ISSUE_CATEGORIES = [
  {
    key:    "focus-decision",
    label:  "Focus Decisions",
    short:  "Focus",
    icon:   "⊕",
    desc:   "Strategic choices that must be made now — become strategy table columns",
    color:  "#2563eb",
    soft:   "#eff4ff",
    line:   "#bfdbfe",
    flowTo: "Strategy Table columns",
    dqRole: "core",
  },
  {
    key:    "given-decision",
    label:  "Given Decisions",
    short:  "Given",
    icon:   "🔒",
    desc:   "Already decided, locked, or non-negotiable — constrain the decision space",
    color:  "#6b7280",
    soft:   "#f9fafb",
    line:   "#e5e7eb",
    flowTo: "Decision Hierarchy — Given tier",
    dqRole: "core",
  },
  {
    key:    "tactical-decision",
    label:  "Tactical Decisions",
    short:  "Tactical",
    icon:   "◎",
    desc:   "Decisions that flow from focus decisions — cannot be resolved yet",
    color:  "#7c3aed",
    soft:   "#f5f3ff",
    line:   "#ddd6fe",
    flowTo: "Decision Hierarchy — Tactical tier",
    dqRole: "core",
  },
  {
    key:    "decision-criteria",
    label:  "Decision Criteria",
    short:  "Criteria",
    icon:   "◫",
    desc:   "What the organisation values — how competing strategies will be judged",
    color:  "#059669",
    soft:   "#ecfdf5",
    line:   "#a7f3d0",
    flowTo: "Qualitative Assessment criteria",
    dqRole: "core",
  },
  {
    key:    "uncertainty-external",
    label:  "Uncertainties — External",
    short:  "Ext. Uncertainty",
    icon:   "◉",
    desc:   "Unknown external factors outside team control — market, regulatory, competitive",
    color:  "#dc2626",
    soft:   "#fef2f2",
    line:   "#fecaca",
    flowTo: "Influence Map",
    dqRole: "analysis",
  },
  {
    key:    "uncertainty-internal",
    label:  "Uncertainties — Internal",
    short:  "Int. Uncertainty",
    icon:   "◑",
    desc:   "Unknown internal factors the team could resolve with effort or research",
    color:  "#d97706",
    soft:   "#fffbeb",
    line:   "#fde68a",
    flowTo: "Influence Map",
    dqRole: "analysis",
  },
  {
    key:    "brutal-truth",
    label:  "Brutal Truths",
    short:  "Brutal Truth",
    icon:   "⚡",
    desc:   "Realities everyone knows but may avoid stating — must be surfaced explicitly",
    color:  "#b45309",
    soft:   "#fffbeb",
    line:   "#fcd34d",
    flowTo: "Frame validation",
    dqRole: "honesty",
  },
  {
    key:    "assumption",
    label:  "Assumptions",
    short:  "Assumption",
    icon:   "◷",
    desc:   "Things treated as true without verification — if wrong, the frame collapses",
    color:  "#0891b2",
    soft:   "#ecfeff",
    line:   "#a5f3fc",
    flowTo: "Frame validation",
    dqRole: "honesty",
  },
  {
    key:    "information-gap",
    label:  "Information Gaps",
    short:  "Info Gap",
    icon:   "◈",
    desc:   "Things we need to know but don\'t yet have — resolvable with research",
    color:  "#7c3aed",
    soft:   "#f5f3ff",
    line:   "#c4b5fd",
    flowTo: "Research priorities",
    dqRole: "analysis",
  },
  {
    key:    "constraint",
    label:  "Constraints",
    short:  "Constraint",
    icon:   "⛓",
    desc:   "Hard limits that bound the solution space — budget, legal, policy",
    color:  "#374151",
    soft:   "#f3f4f6",
    line:   "#d1d5db",
    flowTo: "Decision frame — constraints",
    dqRole: "frame",
  },
  {
    key:    "opportunity",
    label:  "Opportunities",
    short:  "Opportunity",
    icon:   "◆",
    desc:   "Upside possibilities worth preserving in the strategy design",
    color:  "#059669",
    soft:   "#ecfdf5",
    line:   "#6ee7b7",
    flowTo: "Strategy options",
    dqRole: "upside",
  },
  {
    key:    "stakeholder-concern",
    label:  "Stakeholder Concerns",
    short:  "Stakeholder",
    icon:   "◐",
    desc:   "Issues raised by or about stakeholders critical to alignment and commitment",
    color:  "#db2777",
    soft:   "#fdf2f8",
    line:   "#fbcfe8",
    flowTo: "Commitment — DQ element 6",
    dqRole: "commitment",
  },
];

const CAT_MAP = Object.fromEntries(ISSUE_CATEGORIES.map(c=>[c.key, c]));

const SEVERITY_COLOR = { Critical:"danger", High:"warn", Medium:"blue", Low:"default" };
const STATUS_COLOR   = { Open:"default", "In Review":"blue", Resolved:"green", Deferred:"chrome", Escalated:"danger" };

// DQ role grouping for the categorisation view
const DQ_ROLE_GROUPS = [
  { key:"core",       label:"Core DQ Decisions",       desc:"Drive the strategy table and hierarchy directly" },
  { key:"analysis",   label:"Analysis & Uncertainty",  desc:"Feed influence maps and research priorities" },
  { key:"honesty",    label:"Honesty & Frame Quality",  desc:"Force brutal clarity before strategy work begins" },
  { key:"frame",      label:"Frame Constraints",        desc:"Hard limits that bound all strategy options" },
  { key:"upside",     label:"Upside & Commitment",      desc:"Opportunities and stakeholder dynamics" },
  { key:"commitment", label:"Stakeholder Dynamics",     desc:"Alignment and commitment risks" },
];

const defaultIssues = () => [
  { id:uid("iss"), text:"Regulatory approval timelines in Singapore and Japan are highly uncertain and could delay entry by 6–18 months", category:"uncertainty-external", severity:"High",  status:"Open", owner:"Legal & Compliance", votes:3 },
  { id:uid("iss"), text:"We lack validated local distribution relationships in any APAC market", category:"uncertainty-internal", severity:"High",  status:"Open", owner:"Head of Sales", votes:5 },
  { id:uid("iss"), text:"Competitor has a 14-month head start — network effects are compounding monthly", category:"brutal-truth", severity:"Critical", status:"Open", owner:"CSO", votes:7 },
  { id:uid("iss"), text:"Currency exposure across JPY, SGD, and AUD adds P&L volatility under current hedging policy", category:"uncertainty-internal", severity:"Medium", status:"Open", owner:"CFO", votes:2 },
  { id:uid("iss"), text:"Product requires 4 months of engineering for Japanese market localisation", category:"constraint", severity:"High",  status:"In Review", owner:"Product", votes:4 },
  { id:uid("iss"), text:"Regional SaaS acquisition target available at 4x ARR — strategic window is time-limited", category:"opportunity", severity:"High",  status:"Open", owner:"CSO", votes:6 },
  { id:uid("iss"), text:"Customer data residency requirements differ significantly across APAC jurisdictions", category:"uncertainty-external", severity:"High",  status:"Open", owner:"Legal & Compliance", votes:3 },
  { id:uid("iss"), text:"APAC SaaS hiring is 60% more competitive than our North American benchmark", category:"constraint", severity:"Medium", status:"Open", owner:"HR", votes:2 },
  { id:uid("iss"), text:"Market entry mode: direct subsidiary vs. partnership vs. acquisition — must be decided before anything else", category:"focus-decision", severity:"Critical", status:"Open", owner:"CSO", votes:8 },
  { id:uid("iss"), text:"Board has mandated APAC entry by end of FY26 — this is non-negotiable", category:"given-decision", severity:"High",  status:"Open", owner:"Board", votes:5 },
  { id:uid("iss"), text:"We are assuming APAC regulatory environment stays stable — this may not hold for Japan", category:"assumption", severity:"High",  status:"Open", owner:"Legal", votes:4 },
  { id:uid("iss"), text:"We don\'t have validated APAC customer acquisition cost data — all modelling is guesswork", category:"information-gap", severity:"High",  status:"Open", owner:"Marketing", votes:6 },
  { id:uid("iss"), text:"Speed to market should take priority over capital efficiency — board expectation vs. CFO position are in tension", category:"decision-criteria", severity:"High",  status:"Open", owner:"CEO", votes:5 },
  { id:uid("iss"), text:"Regional HQ location decision depends on entry mode — cannot be made in isolation", category:"tactical-decision", severity:"Medium", status:"Open", owner:"COO", votes:3 },
  { id:uid("iss"), text:"Head of APAC hasn\'t been hired — we\'re planning market entry without the person who will execute it", category:"brutal-truth", severity:"Critical", status:"Open", owner:"CEO", votes:9 },
  { id:uid("iss"), text:"The CFO has significant reservations about the $25M budget — risk of mid-year budget pull", category:"stakeholder-concern", severity:"High",  status:"Open", owner:"CEO", votes:4 },
];

function ModuleIssueRaising({ issues, onChange, decisions, onDecisions, criteria, onCriteria, problem, aiCall, aiBusy, onAIMsg }) {
  const [view, setView]               = useState("raise");   // raise | categorise | heatmap
  const [input, setInput]             = useState("");
  const [newCat, setNewCat]           = useState("focus-decision");
  const [newSev, setNewSev]           = useState("Medium");
  const [filterCat, setFilterCat]     = useState("all");
  const [filterSev, setFilterSev]     = useState("all");
  const [workshopMode, setWorkshopMode] = useState(false);
  const [generating, setGenerating]   = useState(false);
  const [categorising, setCategorising] = useState(false);
  const [expandedCats, setExpandedCats] = useState({});
  const [selectedIssue, setSelectedIssue] = useState(null);
  const [promoting, setPromoting]     = useState(false);

  // ── CRUD ────────────────────────────────────────────────────────────────────
  const add = () => {
    if (!input.trim()) return;
    onChange([...issues, {
      id: uid("iss"), text: input.trim(), category: newCat,
      severity: newSev, status:"Open", owner:"", votes:0,
    }]);
    setInput("");
  };

  const remove    = id  => { onChange(issues.filter(i=>i.id!==id)); if(selectedIssue===id) setSelectedIssue(null); };
  const upd       = (id,k,v) => onChange(issues.map(i=>i.id===id ? {...i,[k]:v} : i));
  const vote      = id  => onChange(issues.map(i=>i.id===id ? {...i,votes:(i.votes||0)+1} : i));
  const toggleExp = key => setExpandedCats(e=>({...e,[key]:!e[key]}));

  // ── AI GENERATE ─────────────────────────────────────────────────────────────
  const generate = () => {
    setGenerating(true);
    aiCall(dqPrompt(`You are a Decision Quality facilitator. Generate 12 diverse, specific issues for this decision. Each issue must be grounded in the actual decision context provided — no generic placeholders.

Decision: "${problem.decisionStatement}"
Context: "${problem.context}"
Constraints: "${problem.constraints}"

Use ALL of these DQ categories — at least one per category where relevant:
- focus-decision: strategic choices that must be made now
- given-decision: locked or non-negotiable constraints  
- tactical-decision: downstream decisions that depend on focus decisions
- decision-criteria: what the org values — how strategies will be judged
- uncertainty-external: unknown external factors outside team control
- uncertainty-internal: unknown internal factors team could resolve
- brutal-truth: realities everyone knows but avoids stating
- assumption: things treated as true without verification
- information-gap: data or knowledge needed but not yet available
- constraint: hard limits bounding solution space
- opportunity: upside worth preserving in strategy design
- stakeholder-concern: concerns about specific stakeholders' alignment

Return ONLY JSON:
{"issues":[{"text":"specific issue","category":"category-key","severity":"Critical|High|Medium|Low"}]}`),
    (r) => {
      if (r.issues) {
        const newOnes = r.issues.map(i=>({ id:uid("iss"), ...i, status:"Open", owner:"", votes:0 }));
        onChange([...issues, ...newOnes]);
        onAIMsg({ role:"ai", text:`Generated ${newOnes.length} issues across ${new Set(newOnes.map(i=>i.category)).size} DQ categories.` });
      }
      setGenerating(false);
    });
  };

  // ── AI CATEGORISE ────────────────────────────────────────────────────────────
  const aiCategorise = () => {
    setCategorising(true);
    const uncategorised = issues.filter(i=>!i.category||i.category==="focus-decision"&&i.text.length<20);
    const ctx = issues.map(i=>`[${i.id}] "${i.text}" [currently: ${i.category||"unassigned"}]`).join("\n");
    aiCall(dqPrompt(`You are a DQ expert. Review these issues and assign the most accurate DQ category. Distinguish carefully between facts, assumptions, and uncertainties — miscategorising these is a common DQ error.

Categories:
- focus-decision: strategic choices that must be made now → strategy table columns
- given-decision: already decided, locked, non-negotiable
- tactical-decision: downstream from focus decisions — can't resolve yet
- decision-criteria: what we value — how strategies will be judged
- uncertainty-external: unknown, uncontrollable external factors
- uncertainty-internal: unknown internal factors team could resolve
- brutal-truth: known reality being avoided or understated
- assumption: treated as true without verification — could be wrong
- information-gap: need to know but don't have yet
- constraint: hard limit bounding the solution space
- opportunity: upside possibility worth preserving
- stakeholder-concern: specific stakeholder alignment or commitment risk

Issues:\n${ctx}

For any issue you think is miscategorised, suggest the better category with a brief reason.
Also identify which issues should flow to: (a) strategy table as decisions, (b) criteria panel.

Return ONLY JSON:
{
  "recategorisations": [{"id":"issue_id","suggestedCategory":"category-key","reason":"brief reason"}],
  "strategyTableSuggestions": [{"id":"issue_id","decisionLabel":"what to name this column","choices":["opt1","opt2","opt3"]}],
  "criteriaSuggestions": [{"id":"issue_id","criterionLabel":"criterion name","type":"financial|strategic|operational|risk","weight":"high|medium|low"}],
  "insight": "key observation about the issue landscape"
}`),
    (r) => {
      if (r.recategorisations?.length) {
        let updated = [...issues];
        r.recategorisations.forEach(rec => {
          updated = updated.map(i => i.id===rec.id ? {...i, category:rec.suggestedCategory, _aiReason:rec.reason} : i);
        });
        onChange(updated);
      }
      onAIMsg({ role:"ai", text: r.insight || `Categorisation complete. ${r.recategorisations?.length||0} issues reclassified.` });
      setCategorising(false);
    });
  };

  // ── PROMOTE TO DECISION ──────────────────────────────────────────────────────
  const promoteToDecision = (issue, tier) => {
    const alreadyExists = decisions.find(d=>d.sourceId===issue.id);
    if (alreadyExists) return;
    const tierMap = { "focus-decision":"focus", "given-decision":"given", "tactical-decision":"tactical" };
    onDecisions([...decisions, {
      id: uid("d"), label: issue.text.length>50 ? issue.text.slice(0,50)+"…" : issue.text,
      choices:["Option A","Option B","Option C"], tier: tierMap[issue.category]||tier||"focus",
      owner: issue.owner||"", rationale:`Promoted from Issue Raising`, sourceId: issue.id,
    }]);
    upd(issue.id, "status", "Resolved");
    onAIMsg({ role:"ai", text:`Issue promoted to Decision Hierarchy as a ${tierMap[issue.category]||"focus"} decision.` });
  };

  // ── PROMOTE TO CRITERION ─────────────────────────────────────────────────────
  const promoteToCriterion = (issue) => {
    const alreadyExists = criteria.find(c=>c.sourceId===issue.id);
    if (alreadyExists) return;
    onCriteria([...criteria, {
      id: uid("cr"), label: issue.text.length>60 ? issue.text.slice(0,60)+"…" : issue.text,
      type:"strategic", weight:"high", description: issue.text, sourceId: issue.id,
    }]);
    upd(issue.id, "status", "Resolved");
    onAIMsg({ role:"ai", text:`Issue promoted to Decision Criteria panel.` });
  };

  // ── COMPUTED ─────────────────────────────────────────────────────────────────
  const filtered = issues.filter(i => {
    const catOk  = filterCat==="all" || i.category===filterCat;
    const sevOk  = filterSev==="all" || i.severity===filterSev;
    return catOk && sevOk;
  }).sort((a,b)=>(b.votes||0)-(a.votes||0));

  const catCounts = Object.fromEntries(ISSUE_CATEGORIES.map(c=>[c.key, issues.filter(i=>i.category===c.key).length]));
  const uncategorised = issues.filter(i=>!i.category);
  const sel = issues.find(i=>i.id===selectedIssue);

  const TABS = [
    { id:"raise",       label:"Raise Issues",       count: issues.length },
    { id:"categorise",  label:"Categorise",         count: null },
    { id:"heatmap",     label:"Heat Map",           count: null },
  ];

  // ── RENDER ───────────────────────────────────────────────────────────────────
  return (
    <div style={{ display:"flex", flexDirection:"column", height:"100%" }}>

      {/* ── MODULE HEADER ── */}
      <div style={{ padding:"16px 28px", background:DS.canvas, borderBottom:`1px solid ${DS.canvasBdr}`,
        display:"flex", alignItems:"center", gap:12, flexShrink:0, flexWrap:"wrap" }}>
        <div style={{ flex:1 }}>
          <div style={{ fontSize:11, color:DS.inkTer, letterSpacing:1, textTransform:"uppercase", fontWeight:700, marginBottom:3 }}>Module 02</div>
          <div style={{ fontFamily:"'Libre Baskerville', Georgia, serif", fontSize:22, fontWeight:700, color:DS.ink, letterSpacing:-.3 }}>Issue Raising & Categorisation</div>
        </div>
        <div style={{ display:"flex", gap:6, alignItems:"center", flexWrap:"wrap" }}>
          <Badge variant="default">{issues.length} total</Badge>
          <Badge variant="danger">{issues.filter(i=>i.severity==="Critical").length} critical</Badge>
          <Badge variant="warn">{issues.filter(i=>i.severity==="High").length} high</Badge>
          <Badge variant="blue">{issues.filter(i=>i.category==="focus-decision").length} focus decisions</Badge>
          {uncategorised.length>0 && <Badge variant="amber">{uncategorised.length} uncategorised</Badge>}
        </div>
        <Btn variant={workshopMode?"primary":"chrome"} size="sm"
          onClick={()=>setWorkshopMode(w=>!w)}>
          {workshopMode?"Exit Workshop":"Workshop Mode"}
        </Btn>
        <Btn variant="secondary" icon="spark" size="sm"
          onClick={aiCategorise} disabled={aiBusy||categorising||issues.length<3}>
          {categorising?"Categorising…":"AI Categorise"}
        </Btn>
        <Btn variant="primary" icon="spark" size="sm"
          onClick={generate} disabled={aiBusy||generating}>
          {generating?"Generating…":"AI Generate"}
        </Btn>
      </div>

      {/* ── TAB BAR ── */}
      <div style={{ display:"flex", background:DS.canvasAlt, borderBottom:`1px solid ${DS.canvasBdr}`,
        flexShrink:0, paddingLeft:28 }}>
        {TABS.map(t=>(
          <button key={t.id} onClick={()=>setView(t.id)}
            style={{ padding:"10px 18px", fontSize:11, fontWeight:700, fontFamily:"inherit",
              cursor:"pointer", border:"none", background:"transparent",
              borderBottom:`2px solid ${view===t.id?DS.accent:"transparent"}`,
              color:view===t.id?DS.accent:DS.inkTer, letterSpacing:.4, transition:"all .12s",
              display:"flex", alignItems:"center", gap:6 }}>
            {t.label}
            {t.count!==null && (
              <span style={{ padding:"1px 6px", borderRadius:10, fontSize:9, fontWeight:700,
                background:view===t.id?DS.accent:DS.canvasBdr,
                color:view===t.id?"#fff":DS.inkTer }}>
                {t.count}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* ── RAISE VIEW ── */}
      {view==="raise" && (
        <div style={{ display:"flex", flexDirection:"column", flex:1, overflow:"hidden" }}>

          {/* Input bar */}
          <div style={{ padding:"12px 24px", background:DS.canvasAlt, borderBottom:`1px solid ${DS.canvasBdr}`,
            display:"flex", gap:10, flexShrink:0, flexWrap:"wrap" }}>
            <input value={input} onChange={e=>setInput(e.target.value)}
              onKeyDown={e=>e.key==="Enter"&&add()}
              placeholder={workshopMode ? "Submit issue anonymously and press Enter…" : "Describe an issue, decision, uncertainty, assumption, or brutal truth…"}
              style={{ flex:1, minWidth:260, padding:"9px 13px", fontSize:13, fontFamily:"inherit",
                background:DS.canvas, border:`1px solid ${DS.canvasBdr}`, borderRadius:6,
                color:DS.ink, outline:"none" }}
              onFocusCapture={e=>e.target.style.borderColor=DS.accent}
              onBlurCapture={e=>e.target.style.borderColor=DS.canvasBdr}/>
            <Select value={newCat} onChange={setNewCat}
              options={ISSUE_CATEGORIES.map(c=>({value:c.key, label:`${c.icon} ${c.label}`}))}
              style={{ width:220, fontSize:12 }}/>
            <Select value={newSev} onChange={setNewSev}
              options={SEVERITY_LEVELS.map(s=>({value:s,label:s}))}
              style={{ width:110 }}/>
            <Btn variant="primary" icon="plus" onClick={add}>Add</Btn>
          </div>

          {/* Filter chips */}
          <div style={{ padding:"8px 24px", background:DS.canvas, borderBottom:`1px solid ${DS.canvasBdr}`,
            display:"flex", gap:6, alignItems:"center", flexShrink:0, flexWrap:"wrap" }}>
            <Svg path={ICONS.filter} size={13} color={DS.inkTer}/>
            <button onClick={()=>setFilterCat("all")}
              style={{ padding:"3px 10px", fontSize:11, fontWeight:700, border:`1px solid ${filterCat==="all"?DS.accent:DS.canvasBdr}`,
                borderRadius:20, background:filterCat==="all"?DS.accentSoft:"transparent",
                color:filterCat==="all"?DS.accent:DS.inkTer, cursor:"pointer", fontFamily:"inherit" }}>
              All
            </button>
            {ISSUE_CATEGORIES.filter(c=>catCounts[c.key]>0).map(c=>(
              <button key={c.key} onClick={()=>setFilterCat(filterCat===c.key?"all":c.key)}
                style={{ padding:"3px 10px", fontSize:11, fontWeight:700,
                  border:`1px solid ${filterCat===c.key?c.color:DS.canvasBdr}`,
                  borderRadius:20,
                  background:filterCat===c.key?c.soft:"transparent",
                  color:filterCat===c.key?c.color:DS.inkTer,
                  cursor:"pointer", fontFamily:"inherit" }}>
                {c.icon} {c.short} <span style={{ opacity:.7 }}>({catCounts[c.key]})</span>
              </button>
            ))}
            <div style={{ marginLeft:"auto", display:"flex", gap:6, alignItems:"center" }}>
              {["Critical","High","Medium","Low"].map(s=>(
                <button key={s} onClick={()=>setFilterSev(filterSev===s?"all":s)}
                  style={{ padding:"3px 9px", fontSize:10, fontWeight:700,
                    border:`1px solid ${filterSev===s?DS.accent:DS.canvasBdr}`,
                    borderRadius:20, background:filterSev===s?DS.accentSoft:"transparent",
                    color:filterSev===s?DS.accent:DS.inkTer, cursor:"pointer", fontFamily:"inherit" }}>
                  {s}
                </button>
              ))}
              <span style={{ fontSize:11, color:DS.inkTer }}>{filtered.length} shown</span>
            </div>
          </div>

          {/* Issue list + detail panel */}
          <div style={{ flex:1, display:"flex", overflow:"hidden" }}>
            <div style={{ flex:1, overflowY:"auto", padding:"16px 24px", display:"flex", flexDirection:"column", gap:7 }}>

              {filtered.length===0 && (
                <div style={{ padding:"56px 40px", textAlign:"center", border:`1.5px dashed ${DS.canvasMid}`,
                  borderRadius:10, color:DS.inkTer, fontSize:13, marginTop:20 }}>
                  No issues yet. Type one above or use AI Generate.
                </div>
              )}

              {filtered.map(issue => {
                const cat = CAT_MAP[issue.category] || ISSUE_CATEGORIES[0];
                const isSel = selectedIssue===issue.id;
                return (
                  <div key={issue.id}
                    onClick={()=>setSelectedIssue(isSel?null:issue.id)}
                    style={{ background:DS.canvas, border:`1.5px solid ${isSel?cat.color:DS.canvasBdr}`,
                      borderLeft:`4px solid ${cat.color}`,
                      borderRadius:8, padding:"12px 14px", display:"flex", gap:12, alignItems:"flex-start",
                      cursor:"pointer", transition:"all .12s",
                      boxShadow:isSel?`0 0 0 2px ${cat.line}`:"0 1px 3px rgba(0,0,0,.04)",
                      background:isSel?cat.soft:DS.canvas }}>

                    {/* Vote */}
                    <div style={{ display:"flex", flexDirection:"column", alignItems:"center", gap:3, flexShrink:0, minWidth:34 }}>
                      <button onClick={e=>{e.stopPropagation();vote(issue.id);}}
                        style={{ width:26, height:26, borderRadius:5, background:DS.canvasAlt,
                          border:`1px solid ${DS.canvasBdr}`, cursor:"pointer", fontSize:12,
                          display:"flex", alignItems:"center", justifyContent:"center", fontWeight:700 }}>▲</button>
                      <span style={{ fontSize:12, fontWeight:700,
                        color:(issue.votes||0)>5?DS.accent:DS.inkSub }}>{issue.votes||0}</span>
                    </div>

                    {/* Content */}
                    <div style={{ flex:1, minWidth:0 }}>
                      <div style={{ fontSize:12, color:DS.ink, lineHeight:1.5, marginBottom:7 }}>{issue.text}</div>
                      <div style={{ display:"flex", gap:5, flexWrap:"wrap", alignItems:"center" }}>
                        <span style={{ display:"inline-flex", alignItems:"center", gap:4,
                          padding:"2px 8px", borderRadius:4, fontSize:10, fontWeight:700,
                          letterSpacing:.3, textTransform:"uppercase",
                          background:cat.soft, color:cat.color, border:`1px solid ${cat.line}` }}>
                          {cat.icon} {cat.label}
                        </span>
                        <Badge variant={SEVERITY_COLOR[issue.severity]||"default"} size="xs">{issue.severity}</Badge>
                        <Badge variant={STATUS_COLOR[issue.status]||"default"} size="xs">{issue.status}</Badge>
                        {issue.owner && <span style={{ fontSize:10, color:DS.inkTer }}>○ {issue.owner}</span>}
                        {issue._aiReason && (
                          <span style={{ fontSize:10, color:DS.inkTer, fontStyle:"italic" }}>
                            AI: {issue._aiReason}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Quick actions */}
                    {!workshopMode && (
                      <div style={{ display:"flex", gap:5, flexShrink:0, alignItems:"center" }}>
                        {(issue.category==="focus-decision"||issue.category==="given-decision"||issue.category==="tactical-decision") && (
                          <button onClick={e=>{e.stopPropagation();promoteToDecision(issue);}}
                            title="Promote to Decision Hierarchy"
                            style={{ padding:"4px 9px", fontSize:10, fontWeight:700, border:`1px solid ${DS.accentLine}`,
                              borderRadius:5, background:DS.accentSoft, color:DS.accent,
                              cursor:"pointer", fontFamily:"inherit", whiteSpace:"nowrap" }}>
                            → Hierarchy
                          </button>
                        )}
                        {issue.category==="decision-criteria" && (
                          <button onClick={e=>{e.stopPropagation();promoteToCriterion(issue);}}
                            title="Promote to Decision Criteria"
                            style={{ padding:"4px 9px", fontSize:10, fontWeight:700, border:`1px solid ${DS.successLine}`,
                              borderRadius:5, background:DS.successSoft, color:DS.success,
                              cursor:"pointer", fontFamily:"inherit", whiteSpace:"nowrap" }}>
                            → Criteria
                          </button>
                        )}
                        <button onClick={e=>{e.stopPropagation();remove(issue.id);}}
                          style={{ background:"none", border:"none", cursor:"pointer", color:DS.inkDis,
                            display:"flex", padding:3 }}>
                          <Svg path={ICONS.x} size={13} color={DS.inkTer}/>
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Issue detail panel */}
            {sel && (() => {
              const cat = CAT_MAP[sel.category]||ISSUE_CATEGORIES[0];
              return (
                <div style={{ width:300, borderLeft:`1px solid ${DS.canvasBdr}`, background:DS.canvas,
                  display:"flex", flexDirection:"column", flexShrink:0, overflow:"hidden" }}>
                  <div style={{ padding:"12px 16px", background:cat.soft,
                    borderBottom:`1px solid ${cat.line}`,
                    display:"flex", alignItems:"center", justifyContent:"space-between" }}>
                    <div>
                      <div style={{ fontSize:11, fontWeight:700, color:cat.color, letterSpacing:.5, textTransform:"uppercase" }}>
                        {cat.icon} {cat.label}
                      </div>
                      <div style={{ fontSize:10, color:DS.inkTer, marginTop:2 }}>→ flows to: {cat.flowTo}</div>
                    </div>
                    <button onClick={()=>setSelectedIssue(null)}
                      style={{ background:"none", border:"none", cursor:"pointer" }}>
                      <Svg path={ICONS.x} size={14} color={DS.inkTer}/>
                    </button>
                  </div>

                  <div style={{ flex:1, overflowY:"auto", padding:"14px 16px" }}>
                    <Field label="Issue Text">
                      <Textarea value={sel.text} onChange={v=>upd(sel.id,"text",v)} rows={4}/>
                    </Field>
                    <Field label="DQ Category">
                      <Select value={sel.category||"focus-decision"} onChange={v=>upd(sel.id,"category",v)}
                        options={ISSUE_CATEGORIES.map(c=>({value:c.key, label:`${c.icon} ${c.label}`}))}/>
                    </Field>
                    <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10 }}>
                      <Field label="Severity">
                        <Select value={sel.severity} onChange={v=>upd(sel.id,"severity",v)}
                          options={SEVERITY_LEVELS.map(s=>({value:s,label:s}))}/>
                      </Field>
                      <Field label="Status">
                        <Select value={sel.status} onChange={v=>upd(sel.id,"status",v)}
                          options={ISSUE_STATUS.map(s=>({value:s,label:s}))}/>
                      </Field>
                    </div>
                    <Field label="Owner">
                      <Input value={sel.owner||""} onChange={v=>upd(sel.id,"owner",v)} placeholder="Who owns this issue?"/>
                    </Field>

                    {/* Category description */}
                    <div style={{ padding:"10px 12px", background:cat.soft, borderRadius:7,
                      border:`1px solid ${cat.line}`, marginTop:4, marginBottom:14 }}>
                      <div style={{ fontSize:10, fontWeight:700, color:cat.color, marginBottom:4,
                        letterSpacing:.5, textTransform:"uppercase" }}>DQ Role</div>
                      <div style={{ fontSize:11, color:DS.inkSub, lineHeight:1.55 }}>{cat.desc}</div>
                    </div>

                    {/* Promote actions */}
                    <div style={{ display:"flex", flexDirection:"column", gap:6 }}>
                      {(sel.category==="focus-decision"||sel.category==="given-decision"||sel.category==="tactical-decision") && (
                        <Btn variant="secondary" full size="sm" onClick={()=>promoteToDecision(sel)}>
                          Promote → Decision Hierarchy
                        </Btn>
                      )}
                      {sel.category==="decision-criteria" && (
                        <Btn variant="secondary" full size="sm" onClick={()=>promoteToCriterion(sel)}>
                          Promote → Criteria Panel
                        </Btn>
                      )}
                      <Btn variant="danger" full size="sm" onClick={()=>remove(sel.id)}>Remove Issue</Btn>
                    </div>
                  </div>
                </div>
              );
            })()}
          </div>
        </div>
      )}

      {/* ── CATEGORISE VIEW ── */}
      {view==="categorise" && (
        <div style={{ flex:1, overflowY:"auto", padding:"20px 24px" }}>

          {/* DQ Role groups */}
          {DQ_ROLE_GROUPS.map(group => {
            const groupCats = ISSUE_CATEGORIES.filter(c=>c.dqRole===group.key);
            const groupIssues = issues.filter(i=>groupCats.find(c=>c.key===i.category));
            if (groupIssues.length===0 && !groupCats.some(c=>catCounts[c.key]>0)) return null;

            return (
              <div key={group.key} style={{ marginBottom:28 }}>
                <div style={{ display:"flex", alignItems:"baseline", gap:10, marginBottom:12 }}>
                  <div style={{ fontSize:13, fontWeight:700, color:DS.ink }}>{group.label}</div>
                  <div style={{ fontSize:11, color:DS.inkTer }}>{group.desc}</div>
                  <div style={{ marginLeft:"auto", fontSize:11, color:DS.inkSub, fontWeight:600 }}>
                    {groupIssues.length} issue{groupIssues.length!==1?"s":""}
                  </div>
                </div>

                <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill,minmax(280px,1fr))", gap:12 }}>
                  {groupCats.map(cat => {
                    const catIssues = issues.filter(i=>i.category===cat.key).sort((a,b)=>(b.votes||0)-(a.votes||0));
                    const isExpanded = expandedCats[cat.key] !== false; // default expanded

                    return (
                      <div key={cat.key} style={{ border:`1.5px solid ${cat.line}`, borderRadius:9, overflow:"hidden" }}>
                        {/* Category header */}
                        <div onClick={()=>toggleExp(cat.key)}
                          style={{ padding:"10px 14px", background:cat.soft, cursor:"pointer",
                            borderBottom: isExpanded ? `1px solid ${cat.line}` : "none",
                            display:"flex", alignItems:"center", gap:8, userSelect:"none" }}>
                          <span style={{ fontSize:14 }}>{cat.icon}</span>
                          <div style={{ flex:1 }}>
                            <div style={{ fontSize:12, fontWeight:700, color:cat.color }}>{cat.label}</div>
                            <div style={{ fontSize:10, color:DS.inkTer, marginTop:1, lineHeight:1.4 }}>→ {cat.flowTo}</div>
                          </div>
                          <div style={{ display:"flex", alignItems:"center", gap:6 }}>
                            <span style={{ fontSize:11, fontWeight:700, color:cat.color,
                              padding:"1px 7px", borderRadius:10,
                              background:"rgba(255,255,255,.6)", border:`1px solid ${cat.line}` }}>
                              {catIssues.length}
                            </span>
                            <Svg path={isExpanded?ICONS.chevD:ICONS.chevR} size={13} color={cat.color}/>
                          </div>
                        </div>

                        {/* Issues in category */}
                        {isExpanded && (
                          <div style={{ background:DS.canvas, padding:"8px 10px",
                            display:"flex", flexDirection:"column", gap:6, minHeight:60 }}>
                            {catIssues.length===0 ? (
                              <div style={{ fontSize:11, color:DS.inkDis, textAlign:"center",
                                padding:"12px 0", fontStyle:"italic" }}>
                                No issues in this category
                              </div>
                            ) : catIssues.map(issue => (
                              <div key={issue.id}
                                style={{ padding:"9px 11px", borderRadius:6,
                                  background:cat.soft, border:`1px solid ${cat.line}`,
                                  display:"flex", alignItems:"flex-start", gap:8 }}>
                                <div style={{ flex:1 }}>
                                  <div style={{ fontSize:11, color:DS.ink, lineHeight:1.4, marginBottom:5 }}>
                                    {issue.text}
                                  </div>
                                  <div style={{ display:"flex", gap:4, alignItems:"center" }}>
                                    <Badge variant={SEVERITY_COLOR[issue.severity]||"default"} size="xs">{issue.severity}</Badge>
                                    <Badge variant={STATUS_COLOR[issue.status]||"default"} size="xs">{issue.status}</Badge>
                                    {(issue.votes||0)>3 && (
                                      <span style={{ fontSize:10, color:DS.accent, fontWeight:700 }}>▲{issue.votes}</span>
                                    )}
                                  </div>
                                </div>
                                {/* Inline promote */}
                                {(cat.key==="focus-decision"||cat.key==="given-decision"||cat.key==="tactical-decision") && (
                                  <button onClick={()=>promoteToDecision(issue)}
                                    title="Promote to Hierarchy"
                                    style={{ padding:"3px 7px", fontSize:9, fontWeight:700,
                                      border:`1px solid ${DS.accentLine}`, borderRadius:4,
                                      background:DS.accentSoft, color:DS.accent,
                                      cursor:"pointer", fontFamily:"inherit", flexShrink:0 }}>
                                    → H
                                  </button>
                                )}
                                {cat.key==="decision-criteria" && (
                                  <button onClick={()=>promoteToCriterion(issue)}
                                    title="Promote to Criteria"
                                    style={{ padding:"3px 7px", fontSize:9, fontWeight:700,
                                      border:`1px solid ${DS.successLine}`, borderRadius:4,
                                      background:DS.successSoft, color:DS.success,
                                      cursor:"pointer", fontFamily:"inherit", flexShrink:0 }}>
                                    → C
                                  </button>
                                )}
                                <button onClick={()=>upd(issue.id,"category","focus-decision")}
                                  style={{ background:"none", border:"none", cursor:"pointer",
                                    color:DS.inkDis, display:"flex", padding:1 }}>
                                  <Svg path={ICONS.x} size={11} color={DS.inkTer}/>
                                </button>
                              </div>
                            ))}

                            {/* Drop hint */}
                            <div style={{ padding:"6px 0", textAlign:"center",
                              fontSize:10, color:DS.inkDis, fontStyle:"italic" }}>
                              Drag issues here, or use AI Categorise
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ── HEAT MAP VIEW ── */}
      {view==="heatmap" && (
        <div style={{ flex:1, overflowY:"auto", padding:"24px 28px" }}>

          <div style={{ marginBottom:24 }}>
            <div style={{ fontSize:13, fontWeight:700, color:DS.ink, marginBottom:4 }}>Issue Heat Map</div>
            <div style={{ fontSize:12, color:DS.inkSub }}>
              Concentration of issues by DQ category and severity — where your decision problem is loaded.
            </div>
          </div>

          {/* Summary bar */}
          <div style={{ display:"flex", gap:8, flexWrap:"wrap", marginBottom:24 }}>
            {ISSUE_CATEGORIES.filter(c=>catCounts[c.key]>0).map(c=>(
              <div key={c.key} style={{ padding:"8px 14px", borderRadius:7,
                background:c.soft, border:`1.5px solid ${c.line}`,
                display:"flex", alignItems:"center", gap:8 }}>
                <span style={{ fontSize:14 }}>{c.icon}</span>
                <div>
                  <div style={{ fontSize:11, fontWeight:700, color:c.color }}>{c.label}</div>
                  <div style={{ fontSize:10, color:DS.inkTer }}>{catCounts[c.key]} issue{catCounts[c.key]!==1?"s":""}</div>
                </div>
              </div>
            ))}
          </div>

          {/* Grid: category × severity */}
          <div style={{ overflowX:"auto" }}>
            <table style={{ width:"100%", borderCollapse:"separate", borderSpacing:"0 2px", minWidth:600 }}>
              <thead>
                <tr>
                  <th style={{ width:220, textAlign:"left", padding:"6px 12px 10px 0",
                    fontSize:10, color:DS.inkTer, fontWeight:700, letterSpacing:.8, textTransform:"uppercase" }}>
                    Category
                  </th>
                  {SEVERITY_LEVELS.map(s=>(
                    <th key={s} style={{ textAlign:"center", padding:"6px 8px 10px",
                      fontSize:10, color:DS.inkTer, fontWeight:700, letterSpacing:.8, textTransform:"uppercase" }}>
                      {s}
                    </th>
                  ))}
                  <th style={{ textAlign:"center", padding:"6px 8px 10px",
                    fontSize:10, color:DS.inkTer, fontWeight:700, letterSpacing:.8, textTransform:"uppercase" }}>
                    Total
                  </th>
                </tr>
              </thead>
              <tbody>
                {ISSUE_CATEGORIES.filter(c=>catCounts[c.key]>0).map(cat=>{
                  const sevCounts = Object.fromEntries(SEVERITY_LEVELS.map(s=>[
                    s, issues.filter(i=>i.category===cat.key&&i.severity===s).length
                  ]));
                  const total = catCounts[cat.key];
                  const maxCount = Math.max(...Object.values(sevCounts), 1);
                  return (
                    <tr key={cat.key}>
                      <td style={{ padding:"6px 12px 6px 0", verticalAlign:"middle" }}>
                        <div style={{ display:"flex", alignItems:"center", gap:7 }}>
                          <span style={{ fontSize:13 }}>{cat.icon}</span>
                          <div>
                            <div style={{ fontSize:11, fontWeight:700, color:cat.color }}>{cat.label}</div>
                            <div style={{ fontSize:10, color:DS.inkTer }}>→ {cat.flowTo}</div>
                          </div>
                        </div>
                      </td>
                      {SEVERITY_LEVELS.map(sev=>{
                        const count = sevCounts[sev];
                        const intensity = maxCount>0 ? count/maxCount : 0;
                        const cellIssues = issues.filter(i=>i.category===cat.key&&i.severity===sev);
                        const bg = count===0 ? DS.canvasAlt :
                          sev==="Critical" ? `rgba(220,38,38,${0.1+intensity*.6})` :
                          sev==="High"     ? `rgba(217,119,6,${0.1+intensity*.6})` :
                          sev==="Medium"   ? `rgba(37,99,235,${0.08+intensity*.4})` :
                                             `rgba(5,150,105,${0.06+intensity*.3})`;
                        const textColor = count===0 ? DS.inkDis :
                          sev==="Critical" ? "#991b1b" :
                          sev==="High"     ? "#92400e" :
                          sev==="Medium"   ? DS.accent :
                                             DS.success;
                        return (
                          <td key={sev} style={{ padding:"5px 8px", textAlign:"center" }}>
                            <div style={{ minHeight:44, padding:"8px 6px", borderRadius:6,
                              background:bg, display:"flex", flexDirection:"column",
                              alignItems:"center", justifyContent:"center", gap:3,
                              border:`1px solid ${count>0?"rgba(0,0,0,.06)":"transparent"}`,
                              cursor:count>0?"pointer":"default", transition:"all .12s" }}
                              onClick={()=>{ if(count>0){ setFilterCat(cat.key); setFilterSev(sev); setView("raise"); }}}>
                              {count>0 ? (
                                <>
                                  <span style={{ fontSize:18, fontWeight:700, color:textColor, lineHeight:1 }}>{count}</span>
                                  <span style={{ fontSize:9, color:textColor, opacity:.7 }}>
                                    {cellIssues.slice(0,1).map(i=>i.owner||"").filter(Boolean)[0]||""}
                                  </span>
                                </>
                              ) : (
                                <span style={{ fontSize:11, color:DS.inkDis }}>—</span>
                              )}
                            </div>
                          </td>
                        );
                      })}
                      <td style={{ padding:"5px 8px", textAlign:"center" }}>
                        <div style={{ padding:"8px 12px", borderRadius:6,
                          background:cat.soft, border:`1px solid ${cat.line}`,
                          fontSize:14, fontWeight:700, color:cat.color }}>
                          {total}
                        </div>
                      </td>
                    </tr>
                  );
                })}

                {/* Totals row */}
                <tr style={{ borderTop:`2px solid ${DS.canvasBdr}` }}>
                  <td style={{ padding:"10px 12px 6px 0" }}>
                    <div style={{ fontSize:11, fontWeight:700, color:DS.inkSub }}>Total by severity</div>
                  </td>
                  {SEVERITY_LEVELS.map(sev=>{
                    const total = issues.filter(i=>i.severity===sev).length;
                    return (
                      <td key={sev} style={{ padding:"10px 8px 6px", textAlign:"center" }}>
                        <div style={{ fontSize:13, fontWeight:700,
                          color:sev==="Critical"?DS.danger:sev==="High"?DS.warning:DS.inkSub }}>
                          {total}
                        </div>
                      </td>
                    );
                  })}
                  <td style={{ padding:"10px 8px 6px", textAlign:"center" }}>
                    <div style={{ fontSize:14, fontWeight:700, color:DS.ink }}>{issues.length}</div>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* Insight callouts */}
          <div style={{ marginTop:24, display:"grid", gridTemplateColumns:"1fr 1fr", gap:14 }}>
            {(() => {
              const topCat = ISSUE_CATEGORIES.reduce((a,b)=>catCounts[a.key]>catCounts[b.key]?a:b);
              const critCount = issues.filter(i=>i.severity==="Critical").length;
              const focusDecs = issues.filter(i=>i.category==="focus-decision").length;
              const unresolved = issues.filter(i=>i.status==="Open").length;
              return [
                { color:topCat.color, soft:topCat.soft, line:topCat.line,
                  label:"Dominant category",
                  value:`${topCat.icon} ${topCat.label}`,
                  note:`${catCounts[topCat.key]} issues — ${topCat.desc}` },
                { color:DS.danger, soft:DS.dangerSoft, line:DS.dangerLine,
                  label:"Critical issues",
                  value:`${critCount} critical`,
                  note:`Require immediate attention before strategy work proceeds` },
                { color:DS.accent, soft:DS.accentSoft, line:DS.accentLine,
                  label:"Focus decisions identified",
                  value:`${focusDecs} focus decisions`,
                  note:"Ready to promote to Decision Hierarchy as strategy table columns" },
                { color:DS.success, soft:DS.successSoft, line:DS.successLine,
                  label:"Open issues",
                  value:`${unresolved} unresolved`,
                  note:`${issues.length-unresolved} issues resolved or deferred` },
              ];
            })().map((ins,i)=>(
              <div key={i} style={{ padding:"14px 16px", borderRadius:8,
                background:ins.soft, border:`1px solid ${ins.line}` }}>
                <div style={{ fontSize:10, fontWeight:700, color:ins.color,
                  letterSpacing:.6, textTransform:"uppercase", marginBottom:5 }}>{ins.label}</div>
                <div style={{ fontSize:16, fontWeight:700, color:DS.ink, marginBottom:4 }}>{ins.value}</div>
                <div style={{ fontSize:11, color:DS.inkSub, lineHeight:1.5 }}>{ins.note}</div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────────────────
   MODULE 3 — DECISION HIERARCHY (six tiers + criteria)
───────────────────────────────────────────────────────────────────────────── */
const defaultDecisions = () => ([
  { id:uid("d"), label:"Market Entry Mode", sourceId:null, choices:["Direct subsidiary","Strategic partnership","Acquire local player","Agent / reseller model"], tier:"focus", owner:"CSO", rationale:"Most consequential variable — determines capital, speed, and control" },
  { id:uid("d"), label:"Geographic Priority", sourceId:null, choices:["Singapore first","Japan first","Australia first","Multi-market simultaneous"], tier:"focus", owner:"CEO", rationale:"Sets the operational blueprint for the full APAC build-out" },
  { id:uid("d"), label:"Investment Level Year 1", sourceId:null, choices:["$10M conservative","$20M base case","$25M aggressive (cap)"], tier:"focus", owner:"CFO", rationale:"Capital ceiling has been board-set — choices within it are live" },
  { id:uid("d"), label:"Technology Localisation Approach", sourceId:null, choices:["Build in-house","License local tech","Partner with regional SaaS"], tier:"focus", owner:"CTO", rationale:"Critical path dependency for any market entry within 12 months" },
  { id:uid("d"), label:"Long-term Ownership Model", sourceId:null, choices:["Wholly-owned","JV 50/50","Majority-owned JV"], tier:"tactical", owner:"Legal", rationale:"Depends on entry mode chosen — cannot be decided in isolation" },
  { id:uid("d"), label:"Brand Strategy in APAC", sourceId:null, choices:["Global brand unchanged","Co-brand with local partner","Standalone local brand"], tier:"tactical", owner:"CMO", rationale:"Flows from partnership model — premature to decide now" },
  { id:uid("d"), label:"Regional HQ Location", sourceId:null, choices:["Singapore","Hong Kong","Sydney"], tier:"deferred", owner:"COO", rationale:"Defer pending regulatory clarity and partner negotiations" },
  { id:uid("d"), label:"APAC product pricing model", sourceId:null, choices:["Mirror North America","Local market pricing","Partner-set pricing"], tier:"deferred", owner:"Head of Sales", rationale:"Requires market validation data — revisit after pilot launch" },
  { id:uid("d"), label:"Proceed with APAC expansion", sourceId:null, choices:["Yes — board mandate confirmed"], tier:"given", owner:"Board", rationale:"Board-approved in FY25 strategic plan — not up for debate" },
  { id:uid("d"), label:"Maximum Year 1 capital budget", sourceId:null, choices:["$25M ceiling — non-negotiable"], tier:"given", owner:"CFO", rationale:"Capital ceiling set by board. Hard constraint on all options." },
  { id:uid("d"), label:"Target acquisition shortlist", sourceId:null, choices:["Pending M&A advisor report","Subject to valuation"], tier:"dependency", owner:"CSO", rationale:"Blocked on external M&A advisor engagement — due Q1" },
  { id:uid("d"), label:"Regulatory approval — Japan", sourceId:null, choices:["Pending regulatory review","Timeline unknown"], tier:"dependency", owner:"Legal", rationale:"Cannot proceed with Japan-first strategy until regulatory path confirmed" },
]);

const defaultCriteria = () => ([
  { id:uid("cr"), label:"Risk-adjusted NPV (3-year)", type:"financial", weight:"high", description:"Net present value of APAC revenues discounted by probability of execution success" },
  { id:uid("cr"), label:"Time to first revenue", type:"financial", weight:"high", description:"Months from decision to first recognised APAC revenue" },
  { id:uid("cr"), label:"Capital efficiency", type:"financial", weight:"high", description:"Revenue generated per dollar of Year 1 capital deployed" },
  { id:uid("cr"), label:"Strategic flexibility", type:"strategic", weight:"medium", description:"Ability to pivot, scale, or exit the strategy without disproportionate cost" },
  { id:uid("cr"), label:"Competitive positioning", type:"strategic", weight:"high", description:"Degree to which the strategy counters competitor's existing APAC advantage" },
  { id:uid("cr"), label:"Execution complexity", type:"operational", weight:"medium", description:"Internal capability and bandwidth required to execute successfully" },
  { id:uid("cr"), label:"Regulatory risk exposure", type:"risk", weight:"high", description:"Probability and magnitude of regulatory delay or block across chosen markets" },
  { id:uid("cr"), label:"Stakeholder alignment", type:"strategic", weight:"medium", description:"Degree of internal and board alignment required to proceed confidently" },
]);

const CRITERIA_TYPES = ["financial","strategic","operational","risk","commercial","technical"];
const CRITERIA_WEIGHTS = ["high","medium","low"];

const H_TIERS = [
  {
    key:"given",
    label:"Given Decisions",
    shortLabel:"Given",
    desc:"Already made or non-negotiable — constraints on the decision space",
    icon:"🔒",
    color:"#6b7280",
    soft:"#f9fafb",
    line:"#e5e7eb",
    accent:"#9ca3af",
    chromeBg:"#1c2030",
    chromeLine:"#252b3b",
    cap: null,
    capLabel: null,
  },
  {
    key:"focus",
    label:"Focus Decisions",
    shortLabel:"Focus",
    desc:"The strategic core — decide now. Max 5 (the Focus Five).",
    icon:"⊕",
    color:DS.accent,
    soft:DS.accentSoft,
    line:DS.accentLine,
    accent:DS.accent,
    chromeBg:"#101a2e",
    chromeLine:"#1d3461",
    cap: 5,
    capLabel: "Focus Five",
    highlight: true,
  },
  {
    key:"tactical",
    label:"Tactical Decisions",
    shortLabel:"Tactical",
    desc:"Downstream from Focus — can only be made after strategic choices are set",
    icon:"◎",
    color:"#7c3aed",
    soft:"#f5f3ff",
    line:"#ddd6fe",
    accent:"#7c3aed",
    chromeBg:"#18102e",
    chromeLine:"#2e1a5e",
    cap: null,
    capLabel: null,
  },
  {
    key:"deferred",
    label:"Deferred Decisions",
    shortLabel:"Deferred",
    desc:"Consciously parked — revisit when trigger condition is met",
    icon:"◷",
    color:DS.success,
    soft:DS.successSoft,
    line:DS.successLine,
    accent:DS.success,
    chromeBg:"#0d1e16",
    chromeLine:"#133d28",
    cap: null,
    capLabel: null,
  },
  {
    key:"dependency",
    label:"Dependencies",
    shortLabel:"Depends",
    desc:"Blocked on external factors — decisions waiting on something outside our control",
    icon:"⛓",
    color:DS.warning,
    soft:DS.warnSoft,
    line:DS.warnLine,
    accent:DS.warning,
    chromeBg:"#1e1608",
    chromeLine:"#3d2e0f",
    cap: null,
    capLabel: null,
  },
];

function ModuleDecisionHierarchy({ decisions, criteria, onDecisions, onCriteria, issues, aiCall, aiBusy, onAIMsg }) {
  const [sorting, setSorting] = useState(false);
  const [selected, setSelected] = useState(null);
  const [activeTab, setActiveTab] = useState("hierarchy"); // hierarchy | criteria
  const [newCrit, setNewCrit] = useState({ label:"", type:"financial", weight:"high", description:"" });
  const [suggestingCrit, setSuggestingCrit] = useState(false);
  const [expandedTiers, setExpandedTiers] = useState({ given:true, focus:true, tactical:true, deferred:false, dependency:false });

  const assign = (id, tier) => onDecisions(decisions.map(d => d.id===id ? {...d, tier} : d));
  const upd = (id, key, val) => onDecisions(decisions.map(d => d.id===id ? {...d,[key]:val} : d));
  const addChoice = id => onDecisions(decisions.map(d=>d.id===id?{...d,choices:[...d.choices,"New option"]}:d));
  const removeChoice = (id,i) => onDecisions(decisions.map(d=>d.id===id?{...d,choices:d.choices.filter((_,j)=>j!==i)}:d));
  const updateChoice = (id,i,v) => onDecisions(decisions.map(d=>d.id===id?{...d,choices:d.choices.map((c,j)=>j===i?v:c)}:d));
  const addDecision = tier => onDecisions([...decisions, { id:uid("d"), label:"New Decision", choices:["Option A","Option B"], tier, sourceId:null, owner:"", rationale:"" }]);
  const removeDecision = id => { onDecisions(decisions.filter(d=>d.id!==id)); if(selected===id) setSelected(null); };

  const toggleTier = key => setExpandedTiers(e=>({...e,[key]:!e[key]}));

  const autoSort = () => {
    setSorting(true);
    const issueCtx = issues.slice(0,16).map(i=>`"${i.text}" [${i.severity}]`).join("\n");
    const decCtx = decisions.map(d=>`"${d.label}" [currently: ${d.tier}]`).join("\n");
    aiCall(dqPrompt(`You are a senior DQ facilitator. Classify these decisions into the correct hierarchy tiers. IMPORTANT: A FOCUS decision is one that must be made NOW and drives strategy design — not a goal or an action. Flag any item that is framed as a solution rather than a genuine decision.

Tier definitions:
- given: already decided, locked, board mandate, non-negotiable
- focus: most consequential strategic decisions to make NOW (max 5 — the Focus Five)
- tactical: downstream decisions that depend on focus decisions being made first
- deferred: consciously parked — more info needed or trigger event required
- dependency: blocked on external factor outside the team's control

Issues context:\n${issueCtx}

Current decisions:\n${decCtx}

Also suggest up to 2 new decisions if the issues reveal important gaps. Suggest 2 decision criteria based on what matters most.

Return ONLY JSON:
{
  "assignments": [{"label":"exact decision label","tier":"given|focus|tactical|deferred|dependency","rationale":"one sentence why"}],
  "newDecisions": [{"label":"new decision","choices":["A","B","C"],"tier":"focus|tactical","rationale":"why needed"}],
  "criteriaHints": [{"label":"criterion","type":"financial|strategic|operational|risk","weight":"high|medium|low"}],
  "insight": "key observation about the hierarchy structure"
}`),
    (r) => {
      let updated = [...decisions];
      r.assignments?.forEach(a => {
        updated = updated.map(d => d.label===a.label ? {...d, tier:a.tier, rationale: a.rationale||d.rationale } : d);
      });
      r.newDecisions?.forEach(nd => {
        if (!updated.find(d=>d.label===nd.label))
          updated.push({ id:uid("d"), label:nd.label, choices:nd.choices||["Option A","Option B"], tier:nd.tier, sourceId:null, owner:"", rationale:nd.rationale||"" });
      });
      onDecisions(updated);
      if (r.criteriaHints?.length) {
        const newCrits = r.criteriaHints.map(c=>({ id:uid("cr"), label:c.label, type:c.type||"strategic", weight:c.weight||"medium", description:"" }));
        onCriteria([...criteria, ...newCrits.filter(nc=>!criteria.find(c=>c.label===nc.label))]);
      }
      onAIMsg({ role:"ai", text: r.insight || "Hierarchy organised across all six tiers. Focus tier should have max 5 decisions." });
      setSorting(false);
    });
  };

  const suggestCriteria = () => {
    setSuggestingCrit(true);
    const focusDecs = decisions.filter(d=>d.tier==="focus").map(d=>d.label).join(", ");
    aiCall(dqPrompt(`You are a DQ expert. Suggest decision criteria that reflect what the organisation genuinely values — not just what is easy to measure. Each criterion must be evaluable, distinct, and collectively sufficient to differentiate between strategies.ecisions: ${focusDecs}.
Context: "${issues.slice(0,3).map(i=>i.text).join("; ")}"

Return ONLY JSON:
{"criteria":[{"label":"criterion name","type":"financial|strategic|operational|risk|commercial","weight":"high|medium|low","description":"one sentence explaining what this measures"}]}`),
    (r) => {
      if (r.criteria) {
        const newCrits = r.criteria.map(c=>({ id:uid("cr"), ...c })).filter(nc=>!criteria.find(c=>c.label===nc.label));
        onCriteria([...criteria, ...newCrits]);
        onAIMsg({ role:"ai", text:`Added ${newCrits.length} decision criteria. These will flow into the qualitative assessment.` });
      }
      setSuggestingCrit(false);
    });
  };

  const focusCount = decisions.filter(d=>d.tier==="focus").length;
  const sel = decisions.find(d=>d.id===selected);
  const selTier = sel ? H_TIERS.find(t=>t.key===sel.tier) : null;

  const criteriaTypeColor = t => ({ financial:"green", strategic:"blue", operational:"default", risk:"danger", commercial:"amber", technical:"chrome" })[t]||"default";
  const weightColor = w => ({ high:"danger", medium:"warn", low:"default" })[w]||"default";

  const TABS = [
    { id:"hierarchy", label:"Decision Hierarchy" },
    { id:"criteria",  label:"Decision Criteria" },
  ];

  return (
    <div style={{ display:"flex", flexDirection:"column", height:"100%" }}>
      {/* Header */}
      <div style={{ padding:"16px 28px", background:DS.canvas, borderBottom:`1px solid ${DS.canvasBdr}`,
        display:"flex", alignItems:"center", gap:12, flexShrink:0, flexWrap:"wrap" }}>
        <div style={{ flex:1 }}>
          <div style={{ fontSize:11, color:DS.inkTer, letterSpacing:1, textTransform:"uppercase", fontWeight:700, marginBottom:3 }}>Module 03</div>
          <div style={{ fontFamily:"'Libre Baskerville', Georgia, serif", fontSize:22, fontWeight:700, color:DS.ink, letterSpacing:-.3 }}>Decision Hierarchy</div>
        </div>
        <div style={{ display:"flex", gap:6, alignItems:"center" }}>
          {focusCount > 5 && <Badge variant="danger">⚠ {focusCount} Focus decisions — trim to five</Badge>}
          {focusCount > 0 && focusCount <= 5 && <Badge variant="blue">Focus Five: {focusCount}/5</Badge>}
          <Badge variant="default">{decisions.length} total decisions</Badge>
          <Badge variant="green">{criteria.length} criteria</Badge>
        </div>
        <Btn variant="primary" icon="spark" onClick={autoSort} disabled={aiBusy||sorting}>
          {sorting?"Organising…":"AI Auto-Sort"}
        </Btn>
      </div>

      {/* Sub-tabs */}
      <div style={{ display:"flex", background:DS.canvasAlt, borderBottom:`1px solid ${DS.canvasBdr}`,
        flexShrink:0, paddingLeft:28 }}>
        {TABS.map(t=>(
          <button key={t.id} onClick={()=>setActiveTab(t.id)}
            style={{ padding:"10px 18px", fontSize:11, fontWeight:700, fontFamily:"inherit",
              cursor:"pointer", border:"none", background:"transparent",
              borderBottom:`2px solid ${activeTab===t.id?DS.accent:"transparent"}`,
              color:activeTab===t.id?DS.accent:DS.inkTer, letterSpacing:.4, transition:"all .12s" }}>
            {t.label}
            {t.id==="criteria" && <span style={{ marginLeft:6, padding:"1px 6px", borderRadius:10,
              fontSize:9, fontWeight:700, background:DS.accent, color:"#fff" }}>{criteria.length}</span>}
          </button>
        ))}
      </div>

      <div style={{ flex:1, display:"flex", overflow:"hidden" }}>

        {/* ── HIERARCHY TAB ── */}
        {activeTab==="hierarchy" && (
          <>
            <div style={{ flex:1, overflowY:"auto", padding:"20px 24px" }}>

              {/* Legend strip */}
              <div style={{ display:"flex", gap:6, flexWrap:"wrap", marginBottom:20 }}>
                {H_TIERS.map(t=>(
                  <div key={t.key} style={{ display:"flex", alignItems:"center", gap:5,
                    padding:"4px 10px", borderRadius:5,
                    background:t.soft, border:`1px solid ${t.line}` }}>
                    <span style={{ fontSize:12 }}>{t.icon}</span>
                    <span style={{ fontSize:11, fontWeight:700, color:t.color }}>{t.label}</span>
                    {t.cap && <span style={{ fontSize:10, color:t.color, opacity:.7 }}>max {t.cap}</span>}
                  </div>
                ))}
              </div>

              {/* Tier sections */}
              {H_TIERS.map(tier => {
                const tierDecs = decisions.filter(d=>d.tier===tier.key);
                const isExpanded = expandedTiers[tier.key];
                const atCap = tier.cap && tierDecs.length >= tier.cap;

                return (
                  <div key={tier.key} style={{ marginBottom:16, borderRadius:8, overflow:"hidden",
                    border:`1.5px solid ${tier.line}`,
                    boxShadow: tier.highlight ? `0 0 0 1px ${tier.line}` : "none" }}>

                    {/* Tier header row */}
                    <div onClick={()=>toggleTier(tier.key)}
                      style={{ padding:"11px 16px", background:tier.soft,
                        borderBottom: isExpanded ? `1px solid ${tier.line}` : "none",
                        cursor:"pointer", display:"flex", alignItems:"center", gap:10,
                        userSelect:"none" }}>
                      <span style={{ fontSize:15 }}>{tier.icon}</span>
                      <div style={{ flex:1 }}>
                        <div style={{ display:"flex", alignItems:"center", gap:8 }}>
                          <span style={{ fontSize:13, fontWeight:700, color:tier.color, letterSpacing:.2 }}>
                            {tier.label}
                          </span>
                          {tier.highlight && (
                            <span style={{ fontSize:10, fontWeight:700, padding:"1px 7px",
                              borderRadius:10, background:tier.accent, color:"#fff" }}>
                              STRATEGY TABLE SOURCE
                            </span>
                          )}
                          {atCap && (
                            <Badge variant="warn" size="xs">At capacity</Badge>
                          )}
                        </div>
                        <div style={{ fontSize:11, color:DS.inkTer, marginTop:1 }}>{tier.desc}</div>
                      </div>
                      <div style={{ display:"flex", alignItems:"center", gap:8 }}>
                        <span style={{ fontSize:12, fontWeight:700, color:tier.color }}>
                          {tierDecs.length}{tier.cap ? `/${tier.cap}` : ""}
                        </span>
                        <Svg path={isExpanded ? ICONS.chevD : ICONS.chevR} size={14} color={tier.color}/>
                      </div>
                    </div>

                    {/* Decisions grid */}
                    {isExpanded && (
                      <div style={{ background:DS.canvas, padding:"12px 14px" }}>
                        {tierDecs.length === 0 ? (
                          <div style={{ padding:"16px", textAlign:"center", color:DS.inkDis, fontSize:12,
                            border:`1px dashed ${tier.line}`, borderRadius:6 }}>
                            No decisions in this tier yet
                          </div>
                        ) : (
                          <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill,minmax(280px,1fr))", gap:10, marginBottom:10 }}>
                            {tierDecs.map(d => (
                              <div key={d.id}
                                onClick={()=>setSelected(selected===d.id?null:d.id)}
                                style={{ padding:"12px 14px", borderRadius:7, cursor:"pointer",
                                  border:`1.5px solid ${selected===d.id ? tier.accent : DS.canvasBdr}`,
                                  background: selected===d.id ? tier.soft : DS.canvas,
                                  boxShadow: selected===d.id ? `0 0 0 2px ${tier.line}` : "0 1px 2px rgba(0,0,0,.04)",
                                  transition:"all .12s" }}>

                                {/* Decision label + owner */}
                                <div style={{ display:"flex", alignItems:"flex-start", justifyContent:"space-between", gap:8, marginBottom:8 }}>
                                  <div style={{ fontSize:12, fontWeight:700, color:DS.ink, lineHeight:1.35, flex:1 }}>{d.label}</div>
                                  {d.owner && (
                                    <span style={{ fontSize:10, color:DS.inkTer, whiteSpace:"nowrap",
                                      padding:"1px 6px", borderRadius:3, background:DS.canvasAlt,
                                      border:`1px solid ${DS.canvasBdr}`, flexShrink:0 }}>{d.owner}</span>
                                  )}
                                </div>

                                {/* Options chips */}
                                <div style={{ display:"flex", flexWrap:"wrap", gap:4, marginBottom:d.rationale?8:0 }}>
                                  {d.choices.slice(0,3).map((c,i)=>(
                                    <span key={i} style={{ fontSize:10, padding:"2px 7px", borderRadius:3,
                                      background: tier.soft, color:tier.color,
                                      border:`1px solid ${tier.line}` }}>{c}</span>
                                  ))}
                                  {d.choices.length>3 && (
                                    <span style={{ fontSize:10, color:DS.inkTer }}>+{d.choices.length-3} more</span>
                                  )}
                                </div>

                                {/* Rationale */}
                                {d.rationale && (
                                  <div style={{ fontSize:11, color:DS.inkTer, lineHeight:1.45,
                                    borderTop:`1px solid ${DS.canvasBdr}`, paddingTop:7, marginTop:4,
                                    fontStyle:"italic" }}>
                                    {d.rationale}
                                  </div>
                                )}
                              </div>
                            ))}
                          </div>
                        )}

                        {/* Add button — disabled if at cap */}
                        {!atCap && (
                          <button onClick={()=>addDecision(tier.key)}
                            style={{ padding:"7px 14px", border:`1.5px dashed ${tier.line}`,
                              borderRadius:6, background:"transparent", cursor:"pointer",
                              color:tier.color, fontSize:11, fontWeight:600, fontFamily:"inherit",
                              display:"inline-flex", alignItems:"center", gap:5,
                              transition:"all .12s" }}
                            onMouseEnter={e=>{e.currentTarget.style.background=tier.soft;}}
                            onMouseLeave={e=>{e.currentTarget.style.background="transparent";}}>
                            <Svg path={ICONS.plus} size={11} color="currentColor"/> Add {tier.shortLabel} Decision
                          </button>
                        )}
                        {atCap && (
                          <div style={{ fontSize:11, color:tier.color, padding:"4px 8px",
                            background:tier.soft, borderRadius:5, display:"inline-block",
                            border:`1px solid ${tier.line}` }}>
                            ✓ Focus Five complete — move lower-priority decisions to Tactical or Deferred
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Detail panel */}
            {sel && selTier && (
              <div style={{ width:310, borderLeft:`1px solid ${DS.canvasBdr}`, background:DS.canvas,
                display:"flex", flexDirection:"column", overflow:"hidden", flexShrink:0 }}>

                {/* Panel header */}
                <div style={{ padding:"13px 16px", borderBottom:`1px solid ${DS.canvasBdr}`,
                  background:selTier.soft, display:"flex", alignItems:"center", justifyContent:"space-between" }}>
                  <div>
                    <div style={{ fontSize:11, fontWeight:700, color:selTier.color, letterSpacing:.5, textTransform:"uppercase" }}>
                      {selTier.icon} {selTier.label}
                    </div>
                    <div style={{ fontSize:12, fontWeight:700, color:DS.ink, marginTop:3, lineHeight:1.3 }}>{sel.label}</div>
                  </div>
                  <button onClick={()=>setSelected(null)}
                    style={{ background:"none", border:"none", cursor:"pointer", color:DS.inkTer }}>
                    <Svg path={ICONS.x} size={15} color={DS.inkTer}/>
                  </button>
                </div>

                <div style={{ flex:1, overflowY:"auto", padding:"16px" }}>
                  <Field label="Decision Label">
                    <Input value={sel.label} onChange={v=>upd(sel.id,"label",v)}/>
                  </Field>

                  <Field label="Move to Tier">
                    <Select value={sel.tier} onChange={v=>assign(sel.id,v)}
                      options={H_TIERS.map(t=>({value:t.key,label:`${t.icon} ${t.label}`}))}/>
                  </Field>

                  <Field label="Decision Owner">
                    <Input value={sel.owner||""} onChange={v=>upd(sel.id,"owner",v)} placeholder="Who owns this decision?"/>
                  </Field>

                  <Field label="Rationale" hint="Why in this tier?">
                    <Textarea value={sel.rationale||""} onChange={v=>upd(sel.id,"rationale",v)} rows={2}
                      placeholder="Why does this belong in this tier?"/>
                  </Field>

                  <Field label="Options / Choices">
                    <div style={{ display:"flex", flexDirection:"column", gap:6, marginBottom:8 }}>
                      {sel.choices.map((c,i)=>(
                        <div key={i} style={{ display:"flex", gap:6, alignItems:"center" }}>
                          <Input value={c} onChange={v=>updateChoice(sel.id,i,v)} style={{ fontSize:12 }}/>
                          <button onClick={()=>removeChoice(sel.id,i)}
                            style={{ background:"none", border:"none", cursor:"pointer", flexShrink:0 }}>
                            <Svg path={ICONS.x} size={12} color={DS.inkTer}/>
                          </button>
                        </div>
                      ))}
                      <Btn variant="secondary" icon="plus" size="sm" onClick={()=>addChoice(sel.id)}>
                        Add option
                      </Btn>
                    </div>
                  </Field>

                  <div style={{ height:1, background:DS.canvasBdr, margin:"8px 0 16px" }}/>
                  <Btn variant="danger" size="sm" full onClick={()=>removeDecision(sel.id)}>
                    Remove Decision
                  </Btn>
                </div>
              </div>
            )}
          </>
        )}

        {/* ── CRITERIA TAB ── */}
        {activeTab==="criteria" && (
          <div style={{ flex:1, overflowY:"auto", padding:"24px 28px" }}>

            {/* Header row */}
            <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:20 }}>
              <div>
                <div style={{ fontSize:13, fontWeight:700, color:DS.ink, marginBottom:4 }}>Decision Criteria</div>
                <div style={{ fontSize:12, color:DS.inkSub, lineHeight:1.5 }}>
                  Define what you value and how you will judge competing strategies. These flow directly into the Qualitative Assessment.
                </div>
              </div>
              <div style={{ display:"flex", gap:8 }}>
                <Btn variant="secondary" icon="spark" size="sm" onClick={suggestCriteria} disabled={aiBusy||suggestingCrit}>
                  {suggestingCrit?"Suggesting…":"AI Suggest"}
                </Btn>
              </div>
            </div>

            {/* Add criteria form */}
            <div style={{ padding:"16px 18px", background:DS.canvasAlt, border:`1px solid ${DS.canvasBdr}`,
              borderRadius:8, marginBottom:20 }}>
              <div style={{ fontSize:11, fontWeight:700, color:DS.inkTer, letterSpacing:.8,
                textTransform:"uppercase", marginBottom:12 }}>Add Criterion</div>
              <div style={{ display:"grid", gridTemplateColumns:"2fr 1fr 1fr", gap:10, marginBottom:10 }}>
                <Field label="Criterion Name">
                  <Input value={newCrit.label} onChange={v=>setNewCrit(c=>({...c,label:v}))}
                    placeholder="e.g. Risk-adjusted NPV" />
                </Field>
                <Field label="Type">
                  <Select value={newCrit.type} onChange={v=>setNewCrit(c=>({...c,type:v}))}
                    options={CRITERIA_TYPES.map(t=>({value:t,label:t.charAt(0).toUpperCase()+t.slice(1)}))}/>
                </Field>
                <Field label="Weight">
                  <Select value={newCrit.weight} onChange={v=>setNewCrit(c=>({...c,weight:v}))}
                    options={CRITERIA_WEIGHTS.map(w=>({value:w,label:w.charAt(0).toUpperCase()+w.slice(1)}))}/>
                </Field>
              </div>
              <div style={{ display:"flex", gap:10, alignItems:"flex-end" }}>
                <div style={{ flex:1 }}>
                  <Field label="Description">
                    <Input value={newCrit.description} onChange={v=>setNewCrit(c=>({...c,description:v}))}
                      placeholder="What does this criterion measure?"/>
                  </Field>
                </div>
                <Btn variant="primary" icon="plus" onClick={()=>{
                  if(!newCrit.label.trim()) return;
                  onCriteria([...criteria, { id:uid("cr"), ...newCrit }]);
                  setNewCrit({ label:"", type:"financial", weight:"high", description:"" });
                }} style={{ marginBottom:20 }}>Add</Btn>
              </div>
            </div>

            {/* Criteria table */}
            {criteria.length === 0 ? (
              <div style={{ padding:"48px 40px", textAlign:"center", border:`1.5px dashed ${DS.canvasMid}`,
                borderRadius:10, color:DS.inkTer, fontSize:13 }}>
                No criteria defined yet. Add above or use AI Suggest.
              </div>
            ) : (
              <div style={{ border:`1px solid ${DS.canvasBdr}`, borderRadius:8, overflow:"hidden" }}>
                {/* Group by type */}
                {["financial","strategic","operational","risk","commercial","technical"].map(type => {
                  const typeCrits = criteria.filter(c=>c.type===type);
                  if (typeCrits.length===0) return null;
                  return (
                    <div key={type}>
                      <div style={{ padding:"8px 16px", background:DS.canvasAlt,
                        borderBottom:`1px solid ${DS.canvasBdr}`,
                        display:"flex", alignItems:"center", gap:8 }}>
                        <Badge variant={criteriaTypeColor(type)} size="xs">{type}</Badge>
                        <span style={{ fontSize:10, color:DS.inkTer }}>{typeCrits.length} criteria</span>
                      </div>
                      {typeCrits.map((c,i)=>(
                        <div key={c.id}
                          style={{ padding:"12px 16px", display:"flex", gap:14, alignItems:"flex-start",
                            background:DS.canvas,
                            borderBottom: i<typeCrits.length-1 ? `1px solid ${DS.canvasBdr}` : "none" }}>

                          {/* Weight indicator */}
                          <div style={{ width:4, alignSelf:"stretch", borderRadius:2, flexShrink:0,
                            background: c.weight==="high" ? DS.danger : c.weight==="medium" ? DS.warning : DS.inkDis }}/>

                          <div style={{ flex:1, minWidth:0 }}>
                            <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:4 }}>
                              <span style={{ fontSize:13, fontWeight:700, color:DS.ink }}>{c.label}</span>
                              <Badge variant={weightColor(c.weight)} size="xs">{c.weight} weight</Badge>
                            </div>
                            {c.description && (
                              <div style={{ fontSize:12, color:DS.inkSub, lineHeight:1.5 }}>{c.description}</div>
                            )}
                          </div>

                          <div style={{ display:"flex", gap:6, flexShrink:0, alignItems:"center" }}>
                            <Select value={c.weight} onChange={v=>onCriteria(criteria.map(x=>x.id===c.id?{...x,weight:v}:x))}
                              options={CRITERIA_WEIGHTS.map(w=>({value:w,label:w.charAt(0).toUpperCase()+w.slice(1)}))}
                              style={{ width:100, fontSize:11 }}/>
                            <button onClick={()=>onCriteria(criteria.filter(x=>x.id!==c.id))}
                              style={{ background:"none", border:"none", cursor:"pointer",
                                color:DS.inkDis, display:"flex", padding:2 }}>
                              <Svg path={ICONS.x} size={14} color={DS.inkTer}/>
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  );
                })}
              </div>
            )}

            {/* Summary */}
            {criteria.length > 0 && (
              <div style={{ marginTop:16, padding:"12px 16px", background:DS.accentSoft,
                border:`1px solid ${DS.accentLine}`, borderRadius:8,
                display:"flex", gap:16, flexWrap:"wrap" }}>
                {["high","medium","low"].map(w=>{
                  const count = criteria.filter(c=>c.weight===w).length;
                  return count > 0 ? (
                    <div key={w} style={{ display:"flex", alignItems:"center", gap:6 }}>
                      <Badge variant={weightColor(w)} size="xs">{w}</Badge>
                      <span style={{ fontSize:12, color:DS.inkSub }}>{count} criteria</span>
                    </div>
                  ) : null;
                })}
                <span style={{ fontSize:12, color:DS.accent, marginLeft:"auto" }}>
                  These criteria flow into the Qualitative Assessment →
                </span>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────────────────
   MODULE 4 — STRATEGY TABLE
───────────────────────────────────────────────────────────────────────────── */
const defaultStrategies = () => ([
  { id:uid("s"), colorIdx:0, name:"Alpha", description:"Full commitment direct entry via subsidiary", selections:{}, rationale:{} },
  { id:uid("s"), colorIdx:1, name:"Beta", description:"Asset-light partnership model", selections:{}, rationale:{} },
]);

function ModuleStrategyTable({ decisions, strategies, onChange, onChange2, aiCall, aiBusy, problem, onAIMsg }) {
  const [mode, setMode] = useState("builder"); // builder | compare | workshop | review
  const [compareSelected, setCompareSelected] = useState({});
  const [_activeSId, _setActiveSId] = useState(null);
  const [suggesting, setSuggesting] = useState(false);
  const [validating, setValidating] = useState(false);
  const [validation, setValidation] = useState(null);

  const nowDecisions = decisions.filter(d => d.tier === "focus");

  // Derive active strategy safely — never store stale IDs
  const activeS = strategies.find(s => s.id === _activeSId)
    ? _activeSId
    : (strategies[0]?.id || null);
  const setActiveS = id => _setActiveSId(id);
  const activeSData = strategies.find(s => s.id === activeS) || null;

  // ── Mutations ──────────────────────────────────────────────────────────────
  const [newDecLabel, setNewDecLabel] = useState("");
  const [showAddDec, setShowAddDec] = useState(false);

  const [editingDec, setEditingDec] = useState(null); // decId being edited

  const addFocusDecision = () => {
    const label = newDecLabel.trim();
    if (!label) return;
    const nd = {
      id: uid("d"), label,
      tier: "focus", owner: "", rationale: "",
      choices: ["Option A", "Option B", "Option C"],
    };
    onChange2([...decisions, nd]);
    setNewDecLabel("");
    setShowAddDec(false);
    setEditingDec(nd.id); // immediately open for editing
  };

  const updateDecision = (decId, patch) =>
    onChange2(decisions.map(d => d.id === decId ? { ...d, ...patch } : d));

  const updateChoice = (decId, choiceIdx, val) =>
    onChange2(decisions.map(d => {
      if (d.id !== decId) return d;
      const choices = [...d.choices];
      choices[choiceIdx] = val;
      return { ...d, choices };
    }));

  const addChoice = (decId) =>
    onChange2(decisions.map(d => d.id !== decId ? d :
      { ...d, choices: [...d.choices, "Option " + String.fromCharCode(65 + d.choices.length)] }
    ));

  const removeChoice = (decId, choiceIdx) =>
    onChange2(decisions.map(d => d.id !== decId ? d :
      { ...d, choices: d.choices.filter((_, i) => i !== choiceIdx) }
    ));

  const removeDecision = (decId) =>
    onChange2(decisions.filter(d => d.id !== decId));

  const addStrategy = () => {
    const used = strategies.map(s => s.colorIdx);
    const colorIdx = [0,1,2,3,4,5].find(i => !used.includes(i)) ?? strategies.length % 6;
    const ns = {
      id: uid("s"), colorIdx,
      name: DS.sNames[colorIdx] || ("S" + (strategies.length + 1)),
      description: "", objective: "", selections: {}, rationale: {}
    };
    onChange([...strategies, ns]);
    _setActiveSId(ns.id);
  };

  const removeStrategy = id => {
    onChange(strategies.filter(s => s.id !== id));
    if (activeS === id) _setActiveSId(strategies.find(s => s.id !== id)?.id || null);
  };

  const updStrategy = (id, key, val) =>
    onChange(strategies.map(s => s.id === id ? { ...s, [key]: val } : s));

  const selectCell = (stratId, decId, optIdx) => {
    onChange(strategies.map(s => {
      if (s.id !== stratId) return s;
      const sel = { ...s.selections };
      const cur = Array.isArray(sel[decId]) ? sel[decId] : (sel[decId] !== undefined ? [sel[decId]] : []);
      if (cur.includes(optIdx)) {
        const next = cur.filter(i => i !== optIdx);
        if (next.length === 0) delete sel[decId];
        else sel[decId] = next.length === 1 ? next[0] : next;
      } else {
        sel[decId] = cur.length === 0 ? optIdx : [...cur, optIdx];
      }
      return { ...s, selections: sel };
    }));
  };



  const hasSel = (s, decId) => {
    const v = s.selections[decId];
    return Array.isArray(v) ? v.length > 0 : v !== undefined;
  };

  const isChosen = (s, decId, optIdx) => {
    const v = s.selections[decId];
    if (Array.isArray(v)) return v.includes(optIdx);
    return v === optIdx;
  };


  const completeness = s => {
    if (nowDecisions.length === 0) return 0;
    const filled = nowDecisions.filter(d => hasSel(s, d.id)).length;
    return Math.round((filled / nowDecisions.length) * 100);
  };

  // ── AI ─────────────────────────────────────────────────────────────────────
  const aiSuggest = () => {
    if (nowDecisions.length === 0) {
      onAIMsg({ role:"ai", text:"Add at least one Focus decision in the Decision Hierarchy before suggesting strategies." });
      return;
    }
    setSuggesting(true);

    const decList = nowDecisions.map((d, di) =>
      (di+1) + ". " + d.label + " — options: " + d.choices.map((c,ci) => ci+"="+c).join(", ")
    ).join(" | ");

    const existingList = strategies.length > 0
      ? strategies.map(s => s.name + ": " + nowDecisions.map(d => {
          const v = s.selections[d.id];
          const idx = Array.isArray(v) ? v[0] : v;
          return idx !== undefined ? d.choices[idx] : "?";
        }).join("/")).join(" | ")
      : "none";

    aiCall(
      "You are a Decision Quality strategist. Build 2 distinct strategies for this decision. " +
      "Each strategy must choose a different combination of options across the decisions. " +
      "Decision: " + (problem.decisionStatement || "Not defined") + ". " +
      "Focus decisions with options (use option index numbers in selections array): " + decList + ". " +
      "Existing strategies to avoid duplicating: " + existingList + ". " +
      "Return ONLY a JSON object with this exact structure (use double quotes inside): " +
      '{"strategies":[{"name":"Strategy name","description":"one sentence","objective":"goal","selections":[0,1,0],"rationale":"why coherent"}],"insight":"observation"}. ' +
      "The selections array must have exactly " + nowDecisions.length + " numbers, one per decision above (0-based index of chosen option).",
    (r) => {
      let result = r;
      if (r._raw) {
        try { result = JSON.parse(r._raw.replace(/```json|```/g,"").trim()); }
        catch(e) { onAIMsg({ role:"ai", text:"Could not parse response. Try again." }); setSuggesting(false); return; }
      }
      if (result.error) { onAIMsg({ role:"ai", text:"AI error: " + result.error }); setSuggesting(false); return; }

      // Try multiple possible response keys
      const strats = result.strategies || result.Strategies || result.strategy || [];
      if (strats.length) {
        const used = strategies.map(s => s.colorIdx);
        const newSs = strats.map((s, i) => {
          const colorIdx = [0,1,2,3,4,5].find(c => !used.includes(c)) ?? (strategies.length + i) % 6;
          used.push(colorIdx);
          const selections = {};
          const sels = s.selections || s.choices || [];
          sels.forEach((optIdx, j) => {
            if (nowDecisions[j] && typeof optIdx === "number") {
              selections[nowDecisions[j].id] = optIdx;
            }
          });
          return {
            id: uid("s"), colorIdx,
            name: s.name || DS.sNames[colorIdx] || ("Strategy " + (strategies.length + i + 1)),
            description: s.description || s.rationale || "",
            objective: s.objective || "",
            rationale: {},
            selections
          };
        });
        onChange([...strategies, ...newSs]);
        onAIMsg({ role: "ai", text: result.insight || ("Added " + newSs.length + " strategies.") });
      } else {
        onAIMsg({ role:"ai", text:"AI returned no strategies. Check the console for details." });
        console.log("aiSuggest response:", JSON.stringify(result).slice(0,300));
      }
      setSuggesting(false);
    });
  };

  const aiValidate = () => {
    if (strategies.length === 0 || nowDecisions.length === 0) {
      onAIMsg({ role: "ai", text: "Add strategies and focus decisions before validating." });
      return;
    }
    setValidating(true);
    const tableDesc = nowDecisions.map(d => d.label + ": [" + d.choices.join(" / ") + "]").join(" | ");
    const stratDesc = strategies.map(s => {
      const path = nowDecisions.map(d => {
        const i = s.selections[d.id];
        return i !== undefined ? d.label + ":" + d.choices[i] : "MISSING";
      }).join(", ");
      return s.name + " | " + path;
    }).join(" ; ");

    aiCall(dqPrompt(
      "You are a DQ expert. Validate these strategies for coherence, completeness, and distinctiveness. " +
      "Decision: " + (problem.decisionStatement || "") + ". " +
      "Decisions: " + tableDesc + ". " +
      "Strategies: " + stratDesc + ". " +
      "Return ONLY JSON: " +
      '{"overall":"pass|warn|fail","completenessScores":[{"strategy":"name","score":0}],' +
      '"coherenceIssues":[{"strategy":"name","issue":"desc","severity":"critical|warning"}],' +
      '"distinctiveness":"high|medium|low","distinctivenessNote":"explanation",' +
      '"recommendations":["rec 1"]}'
    ), (r) => {
      let result = r;
      if (r._raw) {
        try { result = JSON.parse(r._raw.replace(/```json|```/g,"").trim()); }
        catch(e) { onAIMsg({ role:"ai", text:"Could not parse validation response. Try again." }); setValidating(false); return; }
      }
      if (result.error) {
        onAIMsg({ role: "ai", text: "Validation failed: " + result.error });
        setValidating(false);
        return;
      }
      setValidation(result);
      const msg = "Validation: " + (result.overall || "complete") + ". Distinctiveness: " +
        (result.distinctiveness || "—") + ". " + (result.recommendations?.[0] || "");
      onAIMsg({ role: "ai", text: msg });
      setValidating(false);
    });
  };

  const MODES = [
    { id: "builder", label: "Builder" },
    { id: "compare", label: "Compare" },
    { id: "workshop", label: "Workshop" },
    { id: "review", label: "Review" },
  ];

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", overflow: "hidden" }}>

      {/* ── Header ─────────────────────────────────────────────────────── */}
      <div style={{ padding: "14px 24px", background: DS.canvas,
        borderBottom: "1px solid " + DS.canvasBdr,
        display: "flex", alignItems: "center", gap: 12, flexShrink: 0, flexWrap: "wrap" }}>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 10, color: DS.inkTer, letterSpacing: 1,
            textTransform: "uppercase", fontWeight: 700, marginBottom: 2 }}>Module 04</div>
          <div style={{ fontFamily: "'Libre Baskerville', Georgia, serif",
            fontSize: 20, fontWeight: 700, color: DS.ink }}>Strategy Table</div>
        </div>
        <div style={{ display: "flex", border: "1px solid " + DS.canvasBdr,
          borderRadius: 7, overflow: "hidden" }}>
          {MODES.map(m => (
            <button key={m.id} onClick={() => setMode(m.id)}
              style={{ padding: "6px 13px", fontSize: 11, fontWeight: 700,
                fontFamily: "inherit", cursor: "pointer", border: "none",
                background: mode === m.id ? DS.accent : "transparent",
                color: mode === m.id ? "#fff" : DS.inkSub,
                transition: "all .12s" }}>
              {m.label}
            </button>
          ))}
        </div>
        {validation && (
          <Badge variant={validation.overall === "pass" ? "green" : validation.overall === "warn" ? "warn" : "danger"}>
            {validation.overall === "pass" ? "✓ Valid" : validation.overall === "warn" ? "⚠ Warnings" : "✗ Issues"}
          </Badge>
        )}
        <Btn variant="secondary" icon="spark" size="sm" onClick={aiValidate}
          disabled={aiBusy || validating || strategies.length === 0}>
          {validating ? "Validating…" : "Validate"}
        </Btn>
        <Btn variant="primary" icon="spark" size="sm" onClick={aiSuggest}
          disabled={aiBusy || suggesting || nowDecisions.length === 0}>
          {suggesting ? "Suggesting…" : "AI Suggest Strategies"}
        </Btn>
      </div>

      {/* ── Strategy selector ──────────────────────────────────────────── */}
      <div style={{ padding: "8px 24px", background: DS.canvasAlt,
        borderBottom: "1px solid " + DS.canvasBdr,
        display: "flex", gap: 8, alignItems: "center",
        flexShrink: 0, flexWrap: "wrap" }}>
        <span style={{ fontSize: 10, fontWeight: 700, color: DS.inkTer,
          letterSpacing: .5, textTransform: "uppercase" }}>Strategies:</span>
        {strategies.map(s => {
          const col = DS.s[s.colorIdx];
          const comp = completeness(s);
          const isActive = activeS === s.id;
          return (
            <div key={s.id} style={{ display: "flex", alignItems: "center",
              borderRadius: 6, overflow: "hidden",
              border: "1.5px solid " + (isActive ? col.fill : DS.canvasBdr),
              boxShadow: isActive ? "0 0 0 2px " + col.line + "40" : "none" }}>
              <button onClick={() => setActiveS(isActive ? null : s.id)}
                style={{ padding: "5px 11px", fontSize: 11, fontWeight: 700,
                  fontFamily: "inherit", cursor: "pointer", border: "none",
                  background: isActive ? col.fill : DS.canvas,
                  color: isActive ? "#fff" : col.fill,
                  display: "flex", alignItems: "center", gap: 6 }}>
                <div style={{ width: 7, height: 7, borderRadius: "50%",
                  background: isActive ? "#fff" : col.fill }}/>
                {s.name}
                <span style={{ fontSize: 10, opacity: .7 }}>{comp}%</span>
              </button>
              <button onClick={() => removeStrategy(s.id)}
                style={{ padding: "5px 7px", border: "none",
                  borderLeft: "1px solid " + (isActive ? col.fill + "80" : DS.canvasBdr),
                  background: isActive ? col.fill : DS.canvas,
                  cursor: "pointer", color: isActive ? "#ffffffaa" : DS.inkDis,
                  display: "flex", alignItems: "center" }}>
                ×
              </button>
            </div>
          );
        })}
        <Btn variant="secondary" icon="plus" size="sm" onClick={addStrategy}>New Strategy</Btn>
        <div style={{ marginLeft:"auto", display:"flex", alignItems:"center", gap:6 }}>
          {showAddDec ? (
            <>
              <input
                autoFocus
                value={newDecLabel}
                onChange={e=>setNewDecLabel(e.target.value)}
                onKeyDown={e=>{ if(e.key==="Enter") addFocusDecision(); if(e.key==="Escape") setShowAddDec(false); }}
                placeholder="New focus decision label..."
                style={{ padding:"5px 10px", fontSize:11, fontFamily:"inherit",
                  background:DS.canvas, border:"1px solid "+DS.accent,
                  borderRadius:5, color:DS.ink, outline:"none", width:220 }}/>
              <Btn variant="primary" size="sm" onClick={addFocusDecision}>Add</Btn>
              <Btn variant="secondary" size="sm" onClick={()=>setShowAddDec(false)}>Cancel</Btn>
            </>
          ) : (
            <Btn variant="secondary" size="sm" onClick={()=>setShowAddDec(true)}>+ Add Focus Decision</Btn>
          )}
        </div>
      </div>

      {/* ── Mode content ───────────────────────────────────────────────── */}
      <div style={{ flex: 1, overflow: "auto" }}>

        {/* ── BUILDER ───────────────────────────────────────────────────── */}
        {mode === "builder" && (
          <div>
            {nowDecisions.length === 0 ? (
              <div style={{ padding: "60px 40px", textAlign: "center", margin: 24,
                border: "1.5px dashed " + DS.canvasMid, borderRadius: 10, color: DS.inkTer }}>
                <div style={{ fontSize: 14, marginBottom: 8, fontWeight: 700 }}>No Focus decisions yet.</div>
                <div style={{ fontSize: 12 }}>Go to Decision Hierarchy and assign decisions to the Focus tier.</div>
              </div>
            ) : strategies.length === 0 ? (
              <div style={{ padding: "60px 40px", textAlign: "center", margin: 24,
                border: "1.5px dashed " + DS.canvasMid, borderRadius: 10, color: DS.inkTer }}>
                <div style={{ fontSize: 14, marginBottom: 8, fontWeight: 700 }}>No strategies yet.</div>
                <div style={{ fontSize: 12 }}>Click "New Strategy" above to add one, or use AI Suggest.</div>
              </div>
            ) : (
              <div>
                {/* Coherence flags */}
                {validation?.coherenceFlags?.length > 0 && (
                  <div style={{ margin: "16px 24px 0", padding: "12px 16px",
                    background: DS.warnSoft, border: "1px solid " + DS.warnLine, borderRadius: 8 }}>
                    <div style={{ fontSize: 10, fontWeight: 700, color: DS.warning,
                      marginBottom: 6, letterSpacing: .5, textTransform: "uppercase" }}>
                      ⚠ Coherence Flags
                    </div>
                    {validation.coherenceFlags.map((f, i) => (
                      <div key={i} style={{ fontSize: 12, color: DS.ink, marginBottom: 3 }}>
                        <strong>{f.strategy}:</strong> {f.issue}
                      </div>
                    ))}
                    {validation.insight && (
                      <div style={{ fontSize: 11, color: DS.inkSub, marginTop: 6,
                        fontStyle: "italic" }}>{validation.insight}</div>
                    )}
                  </div>
                )}

                {/* 
                  LAYOUT: 
                  - LEFT COLUMN: Strategy name + colour + objective + rationale (sticky)
                  - TOP HEADER: Each Focus Decision as a column
                  - CELLS: Options for that decision, highlighted in strategy colour when selected
                  - ROWS = STRATEGIES (each row is one strategy, same colour throughout)
                */}
                <div style={{ overflowX: "auto", marginTop: 14 }}>
                  <table style={{ borderCollapse: "collapse", width: "100%",
                    minWidth: 280 + nowDecisions.length * 200 }}>

                    <thead>
                      <tr>
                        {/* Top-left: Strategy label */}
                        <th style={{ width: 240, padding: "11px 16px",
                          background: DS.ink, textAlign: "left",
                          fontSize: 10, fontWeight: 700, color: "#5a6175",
                          letterSpacing: .8, textTransform: "uppercase",
                          borderRight: "2px solid " + DS.border,
                          position: "sticky", left: 0, zIndex: 3 }}>
                          Strategy
                        </th>
                        {/* Decision columns */}
                        {nowDecisions.map((d, di) => (
                          <th key={d.id}
                            style={{ padding: "10px 12px", background: DS.ink,
                              textAlign: "left", minWidth: 220,
                              borderLeft: "1px solid " + DS.border,
                              verticalAlign: "top" }}>
                            {editingDec === d.id ? (
                              /* Editing mode */
                              <div onClick={e=>e.stopPropagation()}>
                                <input
                                  value={d.label}
                                  onChange={e=>updateDecision(d.id, {label:e.target.value})}
                                  style={{ width:"100%", padding:"4px 7px", fontSize:11,
                                    fontFamily:"inherit", background:"#2d3650",
                                    border:"1px solid "+DS.accent, borderRadius:4,
                                    color:"#fff", outline:"none", marginBottom:6,
                                    boxSizing:"border-box" }}/>
                                {d.choices.map((c, ci) => (
                                  <div key={ci} style={{ display:"flex", gap:4,
                                    alignItems:"center", marginBottom:4 }}>
                                    <input
                                      value={c}
                                      onChange={e=>updateChoice(d.id, ci, e.target.value)}
                                      style={{ flex:1, padding:"3px 6px", fontSize:10,
                                        fontFamily:"inherit", background:"#1e2433",
                                        border:"1px solid #3d4d6b", borderRadius:3,
                                        color:"#e0e4f0", outline:"none" }}/>
                                    {d.choices.length > 2 && (
                                      <button onClick={()=>removeChoice(d.id, ci)}
                                        style={{ background:"none", border:"none",
                                          cursor:"pointer", color:"#dc2626",
                                          fontSize:12, padding:"0 3px" }}>×</button>
                                    )}
                                  </div>
                                ))}
                                <div style={{ display:"flex", gap:6, marginTop:4 }}>
                                  <button onClick={()=>addChoice(d.id)}
                                    style={{ fontSize:9, padding:"2px 7px",
                                      background:"#2d3650", border:"1px solid #3d4d6b",
                                      borderRadius:3, color:"#8b96b8",
                                      cursor:"pointer", fontFamily:"inherit" }}>
                                    + Option
                                  </button>
                                  <button onClick={()=>removeDecision(d.id)}
                                    style={{ fontSize:9, padding:"2px 7px",
                                      background:"none", border:"1px solid #dc262640",
                                      borderRadius:3, color:"#dc2626",
                                      cursor:"pointer", fontFamily:"inherit" }}>
                                    Remove
                                  </button>
                                  <button onClick={()=>setEditingDec(null)}
                                    style={{ marginLeft:"auto", fontSize:9,
                                      padding:"2px 8px", background:DS.accent,
                                      border:"none", borderRadius:3, color:"#fff",
                                      cursor:"pointer", fontFamily:"inherit" }}>
                                    Done
                                  </button>
                                </div>
                              </div>
                            ) : (
                              /* View mode */
                              <div>
                                <div style={{ display:"flex", alignItems:"center",
                                  gap:6, marginBottom:5 }}>
                                  <span style={{ fontSize:11, fontWeight:700,
                                    color:DS.textPri, flex:1 }}>{d.label}</span>
                                  <button onClick={()=>setEditingDec(d.id)}
                                    style={{ background:"none", border:"none",
                                      cursor:"pointer", color:"#5a6175",
                                      fontSize:10, padding:"1px 5px",
                                      borderRadius:3, fontFamily:"inherit" }}>
                                    ✎
                                  </button>
                                </div>
                                <div style={{ display:"flex", flexDirection:"column",
                                  gap:3 }}>
                                  {d.choices.map((c, ci) => (
                                    <span key={ci} style={{ fontSize:9,
                                      padding:"2px 7px", borderRadius:3,
                                      background:"#2d3650", color:"#8b96b8",
                                      fontWeight:500 }}>
                                      {ci}: {c}
                                    </span>
                                  ))}
                                </div>
                              </div>
                            )}
                          </th>
                        ))}
                      </tr>
                    </thead>

                    <tbody>
                      {strategies.map(s => {
                        const col = DS.s[s.colorIdx];
                        const comp = completeness(s);
                        const isActive = activeS === s.id;

                        return (
                          <tr key={s.id}
                            style={{ borderTop: "1px solid " + DS.canvasBdr }}>

                            {/* LEFT: Strategy identity — sticky */}
                            <td style={{ padding: 0,
                              background: isActive ? col.soft : DS.canvasAlt,
                              borderRight: "2px solid " + col.fill,
                              position: "sticky", left: 0, zIndex: 2,
                              verticalAlign: "top", minWidth: 240,
                              transition: "background .12s",
                              cursor: "pointer" }}
                              onClick={() => setActiveS(isActive ? null : s.id)}>
                              <div style={{ padding: "14px 16px" }}>
                                {/* Strategy header */}
                                <div style={{ display: "flex",
                                  alignItems: "center", gap: 8, marginBottom: 8 }}>
                                  <div style={{ width: 10, height: 10,
                                    borderRadius: "50%", flexShrink: 0,
                                    background: col.fill,
                                    boxShadow: isActive ? "0 0 0 3px " + col.line : "none" }}/>
                                  <span style={{ fontSize: 13, fontWeight: 700,
                                    color: col.fill, flex: 1, lineHeight: 1.2 }}>
                                    {s.name}
                                  </span>
                                  <span style={{ fontSize: 10,
                                    fontWeight: 700, color: DS.inkTer }}>
                                    {comp}%
                                  </span>
                                </div>

                                {/* Completeness bar */}
                                <div style={{ height: 3, background: DS.canvasBdr,
                                  borderRadius: 2, overflow: "hidden", marginBottom: 10 }}>
                                  <div style={{ width: comp + "%", height: "100%",
                                    background: comp === 100 ? DS.success : col.fill,
                                    borderRadius: 2, transition: "width .3s" }}/>
                                </div>

                                {/* Objective */}
                                <div style={{ fontSize: 9, fontWeight: 700,
                                  color: DS.inkTer, letterSpacing: .5,
                                  textTransform: "uppercase", marginBottom: 3 }}>
                                  Objective
                                </div>
                                <textarea
                                  value={s.objective || ""}
                                  onChange={e => { e.stopPropagation(); updStrategy(s.id, "objective", e.target.value); }}
                                  onClick={e => e.stopPropagation()}
                                  placeholder="What this strategy aims to achieve..."
                                  rows={2}
                                  style={{ width: "100%", padding: "5px 7px",
                                    fontSize: 11, fontFamily: "inherit",
                                    background: DS.canvas,
                                    border: "1px solid " + DS.canvasBdr,
                                    borderRadius: 4, color: DS.ink,
                                    outline: "none", resize: "none",
                                    lineHeight: 1.4, boxSizing: "border-box",
                                    marginBottom: 8 }}
                                  onFocus={e => { e.stopPropagation(); e.target.style.borderColor = col.fill; }}
                                  onBlur={e => e.target.style.borderColor = DS.canvasBdr}/>

                                {/* Rationale */}
                                <div style={{ fontSize: 9, fontWeight: 700,
                                  color: DS.inkTer, letterSpacing: .5,
                                  textTransform: "uppercase", marginBottom: 3 }}>
                                  Rationale
                                </div>
                                <textarea
                                  value={s.description || ""}
                                  onChange={e => { e.stopPropagation(); updStrategy(s.id, "description", e.target.value); }}
                                  onClick={e => e.stopPropagation()}
                                  placeholder="Why these choices form a coherent path..."
                                  rows={3}
                                  style={{ width: "100%", padding: "5px 7px",
                                    fontSize: 11, fontFamily: "inherit",
                                    background: DS.canvas,
                                    border: "1px solid " + DS.canvasBdr,
                                    borderRadius: 4, color: DS.ink,
                                    outline: "none", resize: "none",
                                    lineHeight: 1.4, boxSizing: "border-box" }}
                                  onFocus={e => { e.stopPropagation(); e.target.style.borderColor = col.fill; }}
                                  onBlur={e => e.target.style.borderColor = DS.canvasBdr}/>
                              </div>
                            </td>

                            {/* DECISION CELLS — one per focus decision */}
                            {nowDecisions.map(d => {
                              return (
                                <td key={d.id}
                                  style={{ padding: "12px 14px",
                                    verticalAlign: "top",
                                    borderLeft: "1px solid " + DS.canvasBdr,
                                    background: hasSel(s, d.id)
                                      ? col.soft
                                      : DS.canvas }}>
                                  <div style={{ display: "flex",
                                    flexDirection: "column", gap: 6 }}>
                                    {d.choices.map((choice, ri) => {
                                      const cellChosen = isChosen(s, d.id, ri);
                                      // Other strategies that also chose this option
                                      const others = strategies.filter(
                                        st => st.id !== s.id && st.selections[d.id] === ri
                                      );
                                      return (
                                        <div key={ri}
                                          onClick={() => selectCell(s.id, d.id, ri)}
                                          style={{ padding: "9px 12px",
                                            borderRadius: 7,
                                            border: cellChosen
                                              ? "2px solid " + col.fill
                                              : "1.5px solid " + DS.canvasBdr,
                                            background: cellChosen ? col.fill : "transparent",
                                            cursor: "pointer",
                                            display: "flex",
                                            alignItems: "center", gap: 8,
                                            transition: "all .1s",
                                            opacity: cellChosen ? 1 : 0.65 }}>
                                          {/* Filled circle when cellChosen */}
                                          <div style={{ width: 14, height: 14,
                                            borderRadius: "50%", flexShrink: 0,
                                            background: cellChosen ? "#fff" : "transparent",
                                            border: "2px solid " + (cellChosen ? "#fff" : col.fill + "60"),
                                            display: "flex", alignItems: "center",
                                            justifyContent: "center" }}>
                                            {cellChosen && (
                                              <div style={{ width: 6, height: 6,
                                                borderRadius: "50%",
                                                background: col.fill }}/>
                                            )}
                                          </div>
                                          <span style={{ fontSize: 12, flex: 1,
                                            fontWeight: cellChosen ? 700 : 400,
                                            color: cellChosen ? "#fff" : DS.inkSub,
                                            lineHeight: 1.3 }}>
                                            {choice}
                                          </span>
                                          {/* Dots showing other strategies with same choice */}
                                          {others.length > 0 && (
                                            <div style={{ display: "flex", gap: 2 }}>
                                              {others.map(os => (
                                                <div key={os.id} title={os.name}
                                                  style={{ width: 5, height: 5,
                                                    borderRadius: "50%",
                                                    background: DS.s[os.colorIdx].fill,
                                                    opacity: .8 }}/>
                                              ))}
                                            </div>
                                          )}
                                        </div>
                                      );
                                    })}
                                  </div>
                                </td>
                              );
                            })}
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── COMPARE ───────────────────────────────────────────────────── */}
        {mode === "compare" && (
          <div style={{ padding: "20px 24px" }}>
            {/* Strategy toggles */}
            <div style={{ display: "flex", alignItems: "center",
              gap: 10, flexWrap: "wrap", marginBottom: 16 }}>
              <span style={{ fontSize: 11, fontWeight: 700, color: DS.inkTer,
                textTransform: "uppercase", letterSpacing: .5 }}>
                Compare:
              </span>
              {strategies.map(s => {
                const col = DS.s[s.colorIdx];
                const on = compareSelected[s.id] !== false;
                return (
                  <button key={s.id}
                    onClick={() => setCompareSelected(cs => ({ ...cs, [s.id]: !on }))}
                    style={{ display: "flex", alignItems: "center", gap: 7,
                      padding: "5px 13px", borderRadius: 6,
                      fontFamily: "inherit", fontWeight: 700, fontSize: 12,
                      cursor: "pointer",
                      border: "2px solid " + (on ? col.fill : DS.canvasBdr),
                      background: on ? col.soft : "transparent",
                      color: on ? col.fill : DS.inkTer,
                      transition: "all .12s" }}>
                    <div style={{ width: 13, height: 13, borderRadius: 3,
                      background: on ? col.fill : "transparent",
                      border: "1.5px solid " + (on ? col.fill : DS.canvasBdr),
                      display: "flex", alignItems: "center",
                      justifyContent: "center" }}>
                      {on && (
                        <svg width="9" height="9" viewBox="0 0 12 12">
                          <polyline points="2,6 5,9 10,3" fill="none"
                            stroke="#fff" strokeWidth="2.5" strokeLinecap="round"/>
                        </svg>
                      )}
                    </div>
                    {s.name}
                  </button>
                );
              })}
              <button onClick={() => setCompareSelected(
                Object.fromEntries(strategies.map(s => [s.id, true]))
              )} style={{ fontSize: 11, color: DS.accent, background: "none",
                border: "none", cursor: "pointer", fontFamily: "inherit",
                fontWeight: 600 }}>
                All
              </button>
              <button onClick={() => setCompareSelected({})}
                style={{ fontSize: 11, color: DS.inkTer, background: "none",
                  border: "none", cursor: "pointer", fontFamily: "inherit" }}>
                Clear
              </button>
            </div>

            {(() => {
              const vis = strategies.filter(s => compareSelected[s.id] !== false);
              if (vis.length === 0) return (
                <div style={{ padding: "48px", textAlign: "center",
                  color: DS.inkTer, fontSize: 13 }}>
                  Select at least one strategy above to compare.
                </div>
              );

              const differingDecs = nowDecisions.filter(d => {
                const idxs = vis.map(s => s.selections[d.id]);
                return new Set(idxs.filter(x => x !== undefined)).size > 1;
              });
              const sameDecs = nowDecisions.filter(d => {
                const idxs = vis.map(s => s.selections[d.id]);
                return idxs.every(x => x !== undefined) && new Set(idxs).size === 1;
              });

              return (
                <div>
                  <div style={{ overflowX: "auto" }}>
                    <table style={{ borderCollapse: "collapse", width: "100%",
                      minWidth: 220 + vis.length * 200 }}>
                      <thead>
                        <tr>
                          <th style={{ width: 220, padding: "11px 16px",
                            background: DS.ink, textAlign: "left",
                            fontSize: 10, fontWeight: 700, color: "#5a6175",
                            letterSpacing: .8, textTransform: "uppercase",
                            borderRight: "1px solid " + DS.border,
                            position: "sticky", left: 0, zIndex: 3 }}>
                            Decision
                          </th>
                          {vis.map(s => {
                            const col = DS.s[s.colorIdx];
                            return (
                              <th key={s.id}
                                style={{ padding: "11px 16px", background: DS.ink,
                                  textAlign: "center", minWidth: 200,
                                  borderLeft: "1px solid " + DS.border }}>
                                <div style={{ display: "flex", alignItems: "center",
                                  justifyContent: "center", gap: 7 }}>
                                  <div style={{ width: 8, height: 8,
                                    borderRadius: "50%", background: col.fill }}/>
                                  <span style={{ fontSize: 12, fontWeight: 700,
                                    color: col.fill }}>{s.name}</span>
                                </div>
                                {s.objective && (
                                  <div style={{ fontSize: 10, color: "#4a5168",
                                    fontStyle: "italic", marginTop: 3 }}>
                                    {s.objective.slice(0, 50)}{s.objective.length > 50 ? "…" : ""}
                                  </div>
                                )}
                              </th>
                            );
                          })}
                        </tr>
                      </thead>
                      <tbody>
                        {nowDecisions.map((d, di) => {
                          const idxs = vis.map(s => s.selections[d.id]);
                          const differs = new Set(idxs.filter(x => x !== undefined)).size > 1;
                          const allSame = idxs.every(x => x !== undefined) && new Set(idxs).size === 1;
                          return (
                            <tr key={d.id}
                              style={{ borderTop: "1px solid " + DS.canvasBdr,
                                background: differs ? "#fffbf0" : DS.canvas }}>
                              <td style={{ padding: "12px 16px",
                                background: differs ? "#fff8e6" : DS.canvasAlt,
                                borderRight: "1px solid " + DS.canvasBdr,
                                position: "sticky", left: 0, zIndex: 1 }}>
                                <div style={{ display: "flex", alignItems: "flex-start", gap: 8 }}>
                                  <span style={{ width: 20, height: 20,
                                    borderRadius: 4, flexShrink: 0, marginTop: 1,
                                    background: differs ? DS.warning : DS.inkDis,
                                    display: "flex", alignItems: "center",
                                    justifyContent: "center",
                                    fontSize: 10, color: "#fff", fontWeight: 700 }}>
                                    {di + 1}
                                  </span>
                                  <div>
                                    <div style={{ fontSize: 12, fontWeight: 700,
                                      color: DS.ink, marginBottom: 3 }}>{d.label}</div>
                                    {differs && (
                                      <span style={{ fontSize: 9, fontWeight: 700,
                                        color: DS.warning, background: DS.warnSoft,
                                        padding: "1px 5px", borderRadius: 3,
                                        border: "1px solid " + DS.warnLine }}>
                                        ⚡ DIFFERS
                                      </span>
                                    )}
                                    {allSame && (
                                      <span style={{ fontSize: 9, fontWeight: 700,
                                        color: DS.success, background: DS.successSoft,
                                        padding: "1px 5px", borderRadius: 3,
                                        border: "1px solid " + DS.successLine }}>
                                        ✓ SAME
                                      </span>
                                    )}
                                  </div>
                                </div>
                              </td>
                              {vis.map((s, si) => {
                                const col = DS.s[s.colorIdx];
                                const idx = s.selections[d.id];
                                const choice = idx !== undefined ? d.choices[idx] : null;
                                const shared = vis.filter((os, oi) =>
                                  oi !== si && os.selections[d.id] === idx && idx !== undefined
                                );
                                return (
                                  <td key={s.id}
                                    style={{ padding: "12px 14px", textAlign: "center",
                                      borderLeft: "1px solid " + DS.canvasBdr,
                                      background: choice
                                        ? differs ? col.soft + "90" : col.soft + "50"
                                        : "transparent" }}>
                                    {choice ? (
                                      <div>
                                        <div style={{ fontSize: 13, fontWeight: 700,
                                          color: col.fill, marginBottom: 3 }}>
                                          {choice}
                                        </div>
                                        {shared.length > 0 && (
                                          <div style={{ fontSize: 9, color: DS.inkTer }}>
                                            same as {shared.map(os => os.name).join(", ")}
                                          </div>
                                        )}
                                      </div>
                                    ) : (
                                      <span style={{ fontSize: 12, color: DS.inkDis }}>—</span>
                                    )}
                                  </td>
                                );
                              })}
                            </tr>
                          );
                        })}
                        {/* Completeness footer */}
                        <tr style={{ borderTop: "2px solid " + DS.canvasBdr,
                          background: DS.canvasAlt }}>
                          <td style={{ padding: "12px 16px",
                            background: DS.canvasAlt, position: "sticky", left: 0, zIndex: 1,
                            borderRight: "1px solid " + DS.canvasBdr,
                            fontSize: 10, fontWeight: 700, color: DS.inkTer,
                            textTransform: "uppercase", letterSpacing: .6 }}>
                            Completeness
                          </td>
                          {vis.map(s => {
                            const col = DS.s[s.colorIdx];
                            const comp = completeness(s);
                            return (
                              <td key={s.id}
                                style={{ padding: "12px 14px", textAlign: "center",
                                  borderLeft: "1px solid " + DS.canvasBdr }}>
                                <div style={{ fontSize: 16, fontWeight: 700,
                                  color: comp === 100 ? DS.success : col.fill,
                                  marginBottom: 3 }}>
                                  {comp}%
                                </div>
                                <div style={{ height: 4, background: DS.canvasBdr,
                                  borderRadius: 2, overflow: "hidden",
                                  width: "70%", margin: "0 auto" }}>
                                  <div style={{ width: comp + "%", height: "100%",
                                    background: comp === 100 ? DS.success : col.fill,
                                    borderRadius: 2 }}/>
                                </div>
                              </td>
                            );
                          })}
                        </tr>
                      </tbody>
                    </table>
                  </div>

                  {/* Differs / Same summary */}
                  {vis.length >= 2 && (
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr",
                      gap: 14, marginTop: 20 }}>
                      <div style={{ padding: "14px 16px", background: DS.warnSoft,
                        border: "1px solid " + DS.warnLine, borderRadius: 8 }}>
                        <div style={{ fontSize: 10, fontWeight: 700, color: DS.warning,
                          textTransform: "uppercase", letterSpacing: .6, marginBottom: 8 }}>
                          ⚡ Where strategies differ ({differingDecs.length})
                        </div>
                        {differingDecs.length === 0
                          ? <div style={{ fontSize: 12, color: DS.inkTer }}>No differences yet</div>
                          : differingDecs.map(d => (
                            <div key={d.id} style={{ fontSize: 12, color: DS.ink,
                              marginBottom: 4 }}>• {d.label}</div>
                          ))
                        }
                      </div>
                      <div style={{ padding: "14px 16px", background: DS.successSoft,
                        border: "1px solid " + DS.successLine, borderRadius: 8 }}>
                        <div style={{ fontSize: 10, fontWeight: 700, color: DS.success,
                          textTransform: "uppercase", letterSpacing: .6, marginBottom: 8 }}>
                          ✓ Where strategies agree ({sameDecs.length})
                        </div>
                        {sameDecs.length === 0
                          ? <div style={{ fontSize: 12, color: DS.inkTer }}>No shared choices yet</div>
                          : sameDecs.map(d => {
                            const idx = vis[0].selections[d.id];
                            return (
                              <div key={d.id} style={{ fontSize: 12, color: DS.ink,
                                marginBottom: 4 }}>
                                • {d.label}: <strong>{d.choices[idx]}</strong>
                              </div>
                            );
                          })
                        }
                      </div>
                    </div>
                  )}
                </div>
              );
            })()}
          </div>
        )}

        {/* ── WORKSHOP ──────────────────────────────────────────────────── */}
        {mode === "workshop" && (
          <div style={{ padding: "28px 24px" }}>
            <div style={{ textAlign: "center", marginBottom: 24 }}>
              <div style={{ fontFamily: "'Libre Baskerville', Georgia, serif",
                fontSize: 18, color: DS.ink, marginBottom: 6 }}>
                {problem.decisionStatement?.slice(0, 80)}
              </div>
              <div style={{ fontSize: 12, color: DS.inkSub }}>
                Click a strategy to explore its path
              </div>
            </div>
            <div style={{ display: "flex", gap: 12, justifyContent: "center",
              flexWrap: "wrap", marginBottom: 28 }}>
              {strategies.map(s => {
                const col = DS.s[s.colorIdx];
                const isActive = activeS === s.id;
                return (
                  <button key={s.id}
                    onClick={() => setActiveS(isActive ? null : s.id)}
                    style={{ padding: "11px 20px", borderRadius: 8,
                      fontSize: 13, fontWeight: 700, fontFamily: "inherit",
                      cursor: "pointer",
                      border: "2px solid " + (isActive ? col.fill : DS.canvasBdr),
                      background: isActive ? col.fill : DS.canvas,
                      color: isActive ? "#fff" : col.fill,
                      boxShadow: isActive ? "0 4px 16px " + col.line : "none",
                      transition: "all .15s" }}>
                    {s.name}
                    {s.objective && (
                      <div style={{ fontSize: 10, fontWeight: 400,
                        marginTop: 3, opacity: .8 }}>
                        {s.objective.slice(0, 40)}{s.objective.length > 40 ? "…" : ""}
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
            {activeSData && (() => {
              const col = DS.s[activeSData.colorIdx];
              return (
                <div style={{ maxWidth: 760, margin: "0 auto" }}>
                  <div style={{ padding: "18px 22px",
                    background: col.soft, border: "2px solid " + col.fill,
                    borderRadius: 12, marginBottom: 20 }}>
                    <div style={{ fontSize: 16, fontWeight: 700,
                      color: col.fill, marginBottom: 4 }}>
                      {activeSData.name}
                    </div>
                    {activeSData.objective && (
                      <div style={{ fontSize: 12, color: DS.ink,
                        fontWeight: 600, marginBottom: 4 }}>
                        Objective: {activeSData.objective}
                      </div>
                    )}
                    {activeSData.description && (
                      <div style={{ fontSize: 12, color: DS.inkSub }}>
                        {activeSData.description}
                      </div>
                    )}
                  </div>
                  {nowDecisions.map(d => {
                    const idx = activeSData.selections[d.id];
                    return (
                      <div key={d.id}
                        style={{ padding: "14px 18px", background: DS.canvas,
                          border: "1px solid " + (idx !== undefined ? col.line : DS.canvasBdr),
                          borderRadius: 8, marginBottom: 10,
                          display: "flex", alignItems: "center", gap: 16 }}>
                        <div style={{ width: 120, fontSize: 11, fontWeight: 700,
                          color: DS.inkTer, letterSpacing: .3,
                          textTransform: "uppercase", flexShrink: 0 }}>
                          {d.label}
                        </div>
                        <div style={{ fontSize: 14, fontWeight: 600,
                          color: idx !== undefined ? col.fill : DS.inkDis }}>
                          {idx !== undefined ? d.choices[idx] : "— Not selected —"}
                        </div>
                      </div>
                    );
                  })}
                </div>
              );
            })()}
          </div>
        )}

        {/* ── REVIEW ────────────────────────────────────────────────────── */}
        {mode === "review" && (
          <div style={{ padding: "24px" }}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr",
              gap: 18, marginBottom: 20 }}>
              <SectionCard title="Decision Context">
                <div style={{ fontSize: 13, color: DS.ink,
                  lineHeight: 1.6, marginBottom: 8 }}>
                  {problem.decisionStatement || "No decision statement yet"}
                </div>
                <div style={{ fontSize: 11, color: DS.inkTer }}>
                  Owner: {problem.owner || "—"} · Deadline: {problem.deadline || "—"}
                </div>
              </SectionCard>
              <SectionCard title="Completeness">
                {strategies.map(s => {
                  const col = DS.s[s.colorIdx];
                  const comp = completeness(s);
                  return (
                    <div key={s.id}
                      style={{ display: "flex", alignItems: "center",
                        gap: 10, marginBottom: 10 }}>
                      <div style={{ width: 8, height: 8, borderRadius: "50%",
                        background: col.fill, flexShrink: 0 }}/>
                      <span style={{ fontSize: 12, fontWeight: 600,
                        color: col.fill, width: 80, flexShrink: 0 }}>
                        {s.name}
                      </span>
                      <div style={{ flex: 1, height: 6, background: DS.canvasAlt,
                        borderRadius: 3, overflow: "hidden" }}>
                        <div style={{ width: comp + "%", height: "100%",
                          background: comp === 100 ? DS.success
                            : comp > 60 ? DS.warning : DS.danger,
                          borderRadius: 3, transition: "width .4s" }}/>
                      </div>
                      <span style={{ fontSize: 11, color: DS.inkSub,
                        width: 36, textAlign: "right" }}>
                        {comp}%
                      </span>
                    </div>
                  );
                })}
              </SectionCard>
            </div>

            {validation && (
              <SectionCard title="AI Validation"
                actions={
                  <Badge variant={
                    validation.overall === "pass" ? "green"
                      : validation.overall === "warn" ? "warn" : "danger"
                  }>{validation.overall}</Badge>
                }>
                {validation.recommendations?.map((r, i) => (
                  <div key={i} style={{ fontSize: 12, color: DS.ink,
                    marginBottom: 6, padding: "8px 12px",
                    background: DS.accentSoft, borderRadius: 5,
                    border: "1px solid " + DS.accentLine }}>
                    {i + 1}. {r}
                  </div>
                ))}
              </SectionCard>
            )}

            <SectionCard title="Strategy Comparison">
              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "separate",
                  borderSpacing: "0 6px" }}>
                  <thead>
                    <tr>
                      <th style={{ textAlign: "left", padding: "0 12px 8px 0",
                        fontSize: 10, color: DS.inkTer, fontWeight: 700,
                        letterSpacing: .8, textTransform: "uppercase" }}>
                        Decision
                      </th>
                      {strategies.map(s => {
                        const col = DS.s[s.colorIdx];
                        return (
                          <th key={s.id}
                            style={{ textAlign: "center", padding: "0 8px 8px",
                              fontSize: 11, color: col.fill, fontWeight: 700 }}>
                            {s.name}
                          </th>
                        );
                      })}
                    </tr>
                  </thead>
                  <tbody>
                    {nowDecisions.map(d => (
                      <tr key={d.id}>
                        <td style={{ padding: "8px 12px 8px 0", fontSize: 12,
                          color: DS.inkSub, fontWeight: 600,
                          whiteSpace: "nowrap" }}>
                          {d.label}
                        </td>
                        {strategies.map(s => {
                          const col = DS.s[s.colorIdx];
                          const idx = s.selections[d.id];
                          return (
                            <td key={s.id}
                              style={{ padding: "6px 8px", textAlign: "center",
                                background: idx !== undefined ? col.soft : DS.canvasAlt,
                                borderRadius: 6,
                                border: "1px solid " + (idx !== undefined ? col.line : DS.canvasBdr) }}>
                              <span style={{ fontSize: 11,
                                color: idx !== undefined ? col.fill : DS.inkDis,
                                fontWeight: idx !== undefined ? 600 : 400 }}>
                                {idx !== undefined ? d.choices[idx] : "—"}
                              </span>
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </SectionCard>
          </div>
        )}

      </div>
    </div>
  );
}


/* ─────────────────────────────────────────────────────────────────────────────
   MODULE 5 — QUALITATIVE ASSESSMENT
───────────────────────────────────────────────────────────────────────────── */

// Radar / spider chart — pure SVG, no dependencies
function RadarChart({ labels, datasets, size = 220 }) {
  const cx = size / 2, cy = size / 2;
  const r  = size * 0.36;
  const n  = labels.length;
  if (n < 3) return null;

  const angle   = (i) => (Math.PI * 2 * i) / n - Math.PI / 2;
  const pt      = (i, val, max=5) => {
    const ratio = val / max;
    return { x: cx + r * ratio * Math.cos(angle(i)), y: cy + r * ratio * Math.sin(angle(i)) };
  };
  const outerPt = (i) => ({ x: cx + r * Math.cos(angle(i)), y: cy + r * Math.sin(angle(i)) });

  // Grid rings
  const rings = [1,2,3,4,5];
  const gridPaths = rings.map(ring => {
    const pts = labels.map((_,i) => pt(i, ring));
    return pts.map((p,i) => `${i===0?"M":"L"}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" ") + "Z";
  });

  // Spoke lines
  const spokes = labels.map((_,i) => {
    const o = outerPt(i);
    return { x1:cx, y1:cy, x2:o.x, y2:o.y };
  });

  // Dataset paths
  const datasetPaths = datasets.map(ds => {
    const pts = ds.values.map((v,i) => pt(i, Math.min(v, 5)));
    return {
      ...ds,
      path: pts.map((p,i) => `${i===0?"M":"L"}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" ") + "Z",
      points: pts,
    };
  });

  // Label positions
  const labelPts = labels.map((label, i) => {
    const o = outerPt(i);
    const dx = o.x - cx, dy = o.y - cy;
    const len = Math.sqrt(dx*dx+dy*dy);
    return { label, x: cx + (dx/len)*(r+18), y: cy + (dy/len)*(r+18), angle: angle(i) };
  });

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      {/* Grid */}
      {gridPaths.map((d,i) => (
        <path key={i} d={d} fill="none" stroke={DS.canvasBdr} strokeWidth={1}/>
      ))}
      {/* Spokes */}
      {spokes.map((s,i) => (
        <line key={i} x1={s.x1} y1={s.y1} x2={s.x2} y2={s.y2}
          stroke={DS.canvasBdr} strokeWidth={1}/>
      ))}
      {/* Dataset fills */}
      {datasetPaths.map((ds,di) => (
        <path key={di} d={ds.path}
          fill={ds.color+"28"} stroke={ds.color} strokeWidth={2}
          strokeLinejoin="round"/>
      ))}
      {/* Dataset dots */}
      {datasetPaths.map((ds,di) =>
        ds.points.map((p,pi) => (
          <circle key={`${di}-${pi}`} cx={p.x} cy={p.y} r={3.5}
            fill={ds.color} stroke="#fff" strokeWidth={1.5}/>
        ))
      )}
      {/* Labels */}
      {labelPts.map((lp,i) => {
        const anchor = lp.x < cx - 4 ? "end" : lp.x > cx + 4 ? "start" : "middle";
        const lines  = lp.label.length > 14 ? [lp.label.slice(0,14), lp.label.slice(14)] : [lp.label];
        return (
          <text key={i} x={lp.x} y={lp.y} textAnchor={anchor}
            fontSize="9" fontFamily="'IBM Plex Sans','Helvetica Neue',sans-serif"
            fontWeight="600" fill={DS.inkSub}>
            {lines.map((line, li) => (
              <tspan key={li} x={lp.x} dy={li===0?0:11}>{line}</tspan>
            ))}
          </text>
        );
      })}
    </svg>
  );
}

// Score button row 1-5
function ScoreRow({ value, onChange, color }) {
  return (
    <div style={{ display:"flex", gap:3 }}>
      {[1,2,3,4,5].map(v => (
        <button key={v} onClick={()=>onChange(v)}
          style={{ width:26, height:26, borderRadius:5, cursor:"pointer", fontFamily:"inherit",
            fontSize:11, fontWeight:700, transition:"all .1s",
            border:`1.5px solid ${v<=value ? color : DS.canvasBdr}`,
            background: v<=value ? color : "transparent",
            color: v<=value ? "#fff" : DS.inkTer }}>
          {v}
        </button>
      ))}
    </div>
  );
}

function ModuleQualitativeAssessment({
  strategies, decisions, criteria, problem,
  scores, onScores, brief: briefProp, onBrief, aiCall, aiBusy, onAIMsg,
}) {
  const [view, setView]           = useState("matrix");  // matrix | radar | brief
  const [generating, setGenerating] = useState(false);
  const [assessing, setAssessing]   = useState(false);
  const [brief, setBrief]         = useState(null);
  const [activeStrat, setActiveStrat] = useState(null);
  const [weightsOpen, setWeightsOpen] = useState(false);
  const [weights, setWeights]     = useState({});       // criterionId → 1|2|3

  const focusDecisions = decisions.filter(d => d.tier === "focus");

  // ── SCORE HELPERS ────────────────────────────────────────────────────────────
  const scoreKey  = (stratId, critId) => `${stratId}__${critId}`;
  const getScore  = (stratId, critId) => scores[scoreKey(stratId, critId)] || 0;
  const setScore  = (stratId, critId, val) =>
    onScores({ ...scores, [scoreKey(stratId, critId)]: val });
  const getWeight = (critId) => weights[critId] ?? 2;
  const setWeight = (critId, val) => setWeights(w => ({ ...w, [critId]: val }));

  // ── COMPUTED TOTALS ──────────────────────────────────────────────────────────
  const weightedTotal = (stratId) =>
    criteria.reduce((sum, c) => sum + getScore(stratId, c.id) * getWeight(c.id), 0);

  const maxPossible = criteria.reduce((sum, c) => sum + 5 * getWeight(c.id), 0);

  const pct = (stratId) =>
    maxPossible > 0 ? Math.round((weightedTotal(stratId) / maxPossible) * 100) : 0;

  const ranked = [...strategies].sort((a, b) => weightedTotal(b.id) - weightedTotal(a.id));

  const scoredCount = strategies.reduce((sum, s) =>
    sum + criteria.filter(c => getScore(s.id, c.id) > 0).length, 0);
  const totalCells  = strategies.length * criteria.length;

  // ── AI INITIAL ASSESSMENT ────────────────────────────────────────────────────
  const aiAssess = () => {
    setAssessing(true);
    const stratDescs = strategies.map(s => {
      const path = decisions.filter(d=>d.tier==="focus").map(d => {
        const idx = s.selections?.[d.id];
        return idx !== undefined ? d.label + ": " + d.choices[idx] : d.label + ": ?";
      }).join(", ");
      return (DS.sNames[s.colorIdx]||s.name) + " - " + (s.description||"No description") + ". Choices: " + path;
    }).join(" | ");

    const critDescs = criteria.map(c =>
      c.label + " [" + c.type + ", weight:" + c.weight + "]: " + (c.description||"")
    ).join(" | ");

    const prompt = "You are a senior Decision Quality analyst. Score each strategy against each criterion from 1-5 where 1=very poor fit, 2=weak, 3=adequate, 4=strong, 5=excellent fit. " +
      "Decision: " + (problem.decisionStatement||"") + ". " +
      "Context: " + (problem.context||"") + ". " +
      "Strategies: " + stratDescs + ". " +
      "Criteria: " + critDescs + ". " +
      "Be analytical and differentiated - strategies should score differently on different criteria. " +
      "Return ONLY valid JSON: {" +
      '"scores": [{"strategyName": "exact name", "criterionLabel": "exact label", "score": 4, "rationale": "one sentence"}], ' +
      '"overallInsight": "2 sentences on trade-offs"}';

    aiCall(dqPrompt(prompt),
    (r) => {
      let result = r;
      if (r._raw) {
        try { result = JSON.parse(r._raw.replace(/```json|```/g,"").trim()); }
        catch(e) { onAIMsg({ role:"ai", text:"Could not parse assessment response. Try again." }); setAssessing(false); return; }
      }
      if (result.error) {
        onAIMsg({ role:"ai", text:"Assessment failed: " + result.error });
        setAssessing(false);
        return;
      }
      if (result.scores?.length) {
        const newScores = { ...scores };
        result.scores.forEach(item => {
          const strat = strategies.find(s =>
            (DS.sNames[s.colorIdx]||s.name).toLowerCase() === item.strategyName?.toLowerCase() ||
            s.name?.toLowerCase() === item.strategyName?.toLowerCase()
          );
          const crit = criteria.find(c =>
            c.label.toLowerCase() === item.criterionLabel?.toLowerCase()
          );
          if (strat && crit && item.score >= 1 && item.score <= 5) {
            newScores[scoreKey(strat.id, crit.id)] = item.score;
          }
        });
        onScores(newScores);
        onAIMsg({ role:"ai", text: result.overallInsight || ("Initial assessment complete — " + result.scores.length + " scores generated.") });
      } else {
        onAIMsg({ role:"ai", text:"No scores returned. Make sure strategies and criteria are defined." });
      }
      setAssessing(false);
    });
  };

  // ── AI GENERATE BRIEF ────────────────────────────────────────────────────────
  const generateBrief = () => {
    setGenerating(true);

    const tableRows = criteria.map(c => {
      const row = strategies.map(s =>
        `${DS.sNames[s.colorIdx]||s.name}: ${getScore(s.id,c.id)||"—"}/5`
      ).join(" | ");
      return `${c.label} [wt:${getWeight(c.id)}]: ${row}`;
    }).join("\\n");

    const totals = strategies.map(s =>
      `${DS.sNames[s.colorIdx]||s.name}: ${pct(s.id)}% (${weightedTotal(s.id)}/${maxPossible} weighted)`
    ).join(", ");

    const stratDescs = strategies.map(s =>
      `${DS.sNames[s.colorIdx]||s.name} — ${s.description||"No description"}: ${
        focusDecisions.map(d => {
          const idx = s.selections?.[d.id];
          return idx !== undefined ? `${d.label}→${d.choices[idx]}` : `${d.label}→?`;
        }).join(", ")
      }`
    ).join("\n");

    aiCall(dqPrompt(`You are a senior Decision Quality expert writing a decision brief for an executive audience.

Decision: "${problem.decisionStatement}"
Owner: "${problem.owner}" | Deadline: "${problem.deadline}"
Context: "${problem.context}"

Strategies being compared:
${stratDescs}

Qualitative Assessment scores (weighted):
${tableRows}

Overall weighted totals: ${totals}

Write a structured executive decision brief. Be specific, direct, and commercially sharp. No hedging.

Return ONLY valid JSON:
{
  "headline": "One sentence decision brief headline — decisive, specific",
  "situationSummary": "2-3 sentences: the decision, why it matters now, key constraint",
  "recommendedStrategy": "${strategies[0]?.name||'Strategy name'}",
  "recommendedStrategyName": "exact strategy name from the list above",
  "recommendationRationale": "3-4 sentences: why this strategy wins on the criteria that matter most. Be specific about which criteria drove the recommendation.",
  "keyTradeoff": "The single most important trade-off the decision maker is accepting",
  "criticalAssumption": "The one assumption that, if wrong, would change the recommendation",
  "strategyComparisons": [
    {
      "name": "strategy name",
      "verdict": "one sentence verdict",
      "bestFor": "what conditions make this strategy optimal",
      "mainRisk": "primary downside or risk",
      "score": 0
    }
  ],
  "conditionsToRevisit": ["Condition 1 that would require revisiting this decision"],
  "recommendedNextStep": "The single most important immediate action",
  "dqReadiness": {
    "score": 0,
    "note": "one sentence on decision readiness — is the team ready to commit?"
  }
}`),
    (r) => {
      if (!r.error) {
        setBrief(r);
        if (onBrief) onBrief(r);
        setView("brief");
        onAIMsg({ role:"ai", text:`Brief generated. Recommended strategy: ${r.recommendedStrategyName}. ${r.keyTradeoff}` });
      } else {
        onAIMsg({ role:"ai", text:"Brief generation failed — try again." });
      }
      setGenerating(false);
    });
  };

  // ── RADAR DATA ────────────────────────────────────────────────────────────────
  const radarDatasets = strategies.map(s => ({
    color: DS.s[s.colorIdx]?.fill || DS.accent,
    name:  DS.sNames[s.colorIdx] || s.name,
    values: criteria.map(c => getScore(s.id, c.id) || 0),
  }));

  const TABS = [
    { id:"matrix", label:"Scoring Matrix" },
    { id:"radar",  label:"Radar Comparison" },
    { id:"brief",  label:"Decision Brief",  highlight: !!brief },
  ];

  const WEIGHT_LABELS = { 1:"Low", 2:"Medium", 3:"High" };
  const WEIGHT_COLORS = { 1:DS.inkDis, 2:DS.warning, 3:DS.danger };

  return (
    <div style={{ display:"flex", flexDirection:"column", height:"100%" }}>

      {/* ── HEADER ── */}
      <div style={{ padding:"16px 28px", background:DS.canvas, borderBottom:`1px solid ${DS.canvasBdr}`,
        display:"flex", alignItems:"center", gap:12, flexShrink:0, flexWrap:"wrap" }}>
        <div style={{ flex:1 }}>
          <div style={{ fontSize:11, color:DS.inkTer, letterSpacing:1, textTransform:"uppercase", fontWeight:700, marginBottom:3 }}>Module 05</div>
          <div style={{ fontFamily:"'Libre Baskerville', Georgia, serif", fontSize:22, fontWeight:700, color:DS.ink, letterSpacing:-.3 }}>Qualitative Assessment</div>
        </div>
        <div style={{ display:"flex", gap:6, alignItems:"center", flexWrap:"wrap" }}>
          {strategies.length > 0 && criteria.length > 0 && (
            <Badge variant={scoredCount===totalCells?"green":scoredCount>0?"warn":"default"}>
              {scoredCount}/{totalCells} cells scored
            </Badge>
          )}
          {ranked[0] && scoredCount > 0 && (
            <Badge variant="blue">
              Leading: {DS.sNames[ranked[0].colorIdx]||ranked[0].name} ({pct(ranked[0].id)}%)
            </Badge>
          )}
        </div>
        <Btn variant="secondary" size="sm" icon="filter"
          onClick={() => setWeightsOpen(w => !w)}>
          {weightsOpen ? "Hide Weights" : "Edit Weights"}
        </Btn>
        <Btn variant="secondary" size="sm" icon="spark"
          onClick={aiAssess}
          disabled={aiBusy || assessing || strategies.length === 0 || criteria.length === 0}>
          {assessing ? "Assessing…" : "AI Initial Assessment"}
        </Btn>
        <Btn variant="primary" size="sm" icon="spark"
          onClick={generateBrief}
          disabled={aiBusy || generating || scoredCount < strategies.length}>
          {generating ? "Writing Brief…" : "Generate Decision Brief"}
        </Btn>
      </div>

      {/* ── TAB BAR ── */}
      <div style={{ display:"flex", background:DS.canvasAlt, borderBottom:`1px solid ${DS.canvasBdr}`,
        flexShrink:0, paddingLeft:28 }}>
        {TABS.map(t => (
          <button key={t.id} onClick={() => setView(t.id)}
            style={{ padding:"10px 18px", fontSize:11, fontWeight:700, fontFamily:"inherit",
              cursor:"pointer", border:"none", background:"transparent",
              borderBottom:`2px solid ${view===t.id ? DS.accent : "transparent"}`,
              color: view===t.id ? DS.accent : DS.inkTer,
              letterSpacing:.4, transition:"all .12s",
              display:"flex", alignItems:"center", gap:6 }}>
            {t.label}
            {t.highlight && (
              <span style={{ width:6, height:6, borderRadius:"50%",
                background:DS.success, display:"inline-block" }}/>
            )}
          </button>
        ))}
      </div>

      {/* ── WEIGHT EDITOR ── */}
      {weightsOpen && (
        <div style={{ padding:"12px 28px", background:"#fff9f0",
          borderBottom:`1px solid ${DS.warnLine}`, flexShrink:0 }}>
          <div style={{ fontSize:11, fontWeight:700, color:DS.warning,
            letterSpacing:.6, textTransform:"uppercase", marginBottom:10 }}>
            Criterion Weights — drag importance of each criterion
          </div>
          <div style={{ display:"flex", flexWrap:"wrap", gap:10 }}>
            {criteria.map(c => (
              <div key={c.id} style={{ display:"flex", alignItems:"center", gap:8,
                padding:"6px 12px", background:DS.canvas, borderRadius:6,
                border:`1px solid ${DS.canvasBdr}` }}>
                <span style={{ fontSize:11, color:DS.ink, fontWeight:600 }}>{c.label}</span>
                <div style={{ display:"flex", gap:3 }}>
                  {[1,2,3].map(w => (
                    <button key={w} onClick={() => setWeight(c.id, w)}
                      style={{ padding:"3px 9px", fontSize:10, fontWeight:700,
                        borderRadius:4, cursor:"pointer", fontFamily:"inherit",
                        border:`1px solid ${getWeight(c.id)===w ? WEIGHT_COLORS[w] : DS.canvasBdr}`,
                        background: getWeight(c.id)===w ? WEIGHT_COLORS[w]+"22" : "transparent",
                        color: getWeight(c.id)===w ? WEIGHT_COLORS[w] : DS.inkTer }}>
                      {WEIGHT_LABELS[w]}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── MATRIX VIEW ── */}
      {view === "matrix" && (
        <div style={{ flex:1, overflowY:"auto" }}>

          {/* Empty states */}
          {criteria.length === 0 && (
            <div style={{ padding:"60px 40px", textAlign:"center", border:`1.5px dashed ${DS.canvasMid}`,
              borderRadius:10, color:DS.inkTer, fontSize:13, margin:28 }}>
              No decision criteria yet. Add criteria in the Decision Hierarchy module → Decision Criteria tab,
              or promote issues tagged as Decision Criteria.
            </div>
          )}
          {strategies.length === 0 && (
            <div style={{ padding:"60px 40px", textAlign:"center", border:`1.5px dashed ${DS.canvasMid}`,
              borderRadius:10, color:DS.inkTer, fontSize:13, margin:28 }}>
              No strategies yet. Build strategies in the Strategy Table module first.
            </div>
          )}

          {criteria.length > 0 && strategies.length > 0 && (
            <div style={{ padding:"20px 28px" }}>

              {/* Ranked summary strip */}
              <div style={{ display:"flex", gap:10, marginBottom:20, flexWrap:"wrap" }}>
                {ranked.map((s, rank) => {
                  const col = DS.s[s.colorIdx];
                  const p   = pct(s.id);
                  return (
                    <div key={s.id}
                      onClick={() => setActiveStrat(activeStrat===s.id ? null : s.id)}
                      style={{ padding:"11px 16px", borderRadius:8, cursor:"pointer",
                        border:`1.5px solid ${activeStrat===s.id ? col.fill : rank===0&&p>0 ? col.fill : DS.canvasBdr}`,
                        background: activeStrat===s.id ? col.soft : rank===0&&p>0 ? col.soft+"80" : DS.canvas,
                        display:"flex", alignItems:"center", gap:10, flex:1, minWidth:160,
                        boxShadow: rank===0&&p>0 ? `0 0 0 3px ${col.line}50` : "0 1px 3px rgba(0,0,0,.05)",
                        transition:"all .15s" }}>
                      <div style={{ width:28, height:28, borderRadius:"50%",
                        background: rank===0&&p>0 ? col.fill : DS.canvasAlt,
                        border:`2px solid ${rank===0&&p>0 ? col.fill : DS.canvasBdr}`,
                        display:"flex", alignItems:"center", justifyContent:"center",
                        fontSize:12, fontWeight:700,
                        color: rank===0&&p>0 ? "#fff" : DS.inkTer, flexShrink:0 }}>
                        {rank+1}
                      </div>
                      <div style={{ flex:1, minWidth:0 }}>
                        <div style={{ display:"flex", alignItems:"center", gap:6, marginBottom:4 }}>
                          <span style={{ fontSize:12, fontWeight:700, color:col.fill }}>{DS.sNames[s.colorIdx]||s.name}</span>
                          {rank===0 && p>0 && <Badge variant="green" size="xs">Leading</Badge>}
                        </div>
                        <div style={{ height:5, background:DS.canvasAlt, borderRadius:3, overflow:"hidden" }}>
                          <div style={{ width:`${p}%`, height:"100%",
                            background: rank===0 ? col.fill : DS.inkDis,
                            borderRadius:3, transition:"width .5s" }}/>
                        </div>
                        <div style={{ fontSize:10, color:DS.inkTer, marginTop:3 }}>
                          {weightedTotal(s.id)} pts · {p}%
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* The scoring grid */}
              <div style={{ overflowX:"auto", borderRadius:9, border:`1px solid ${DS.canvasBdr}` }}>
              <div style={{ minWidth: 240 + strategies.length * 180 + 90 }}>
                {/* Column headers */}
                <div style={{ display:"grid",
                  gridTemplateColumns:`240px repeat(${strategies.length}, minmax(160px, 1fr)) 90px`,
                  background:DS.ink }}>
                  <div style={{ padding:"11px 16px", fontSize:10, fontWeight:700,
                    color:"#5a6175", letterSpacing:.8, textTransform:"uppercase" }}>
                    Criterion
                  </div>
                  {strategies.map(s => {
                    const col = DS.s[s.colorIdx];
                    return (
                      <div key={s.id} style={{ padding:"11px 12px",
                        display:"flex", flexDirection:"column", alignItems:"center", gap:3 }}>
                        <div style={{ display:"flex", alignItems:"center", gap:5 }}>
                          <div style={{ width:8, height:8, borderRadius:"50%", background:col.fill }}/>
                          <span style={{ fontSize:11, fontWeight:700, color:col.fill }}>
                            {DS.sNames[s.colorIdx]||s.name}
                          </span>
                        </div>
                        <div style={{ fontSize:9, color:"#4a5168", textAlign:"center", lineHeight:1.4 }}>
                          {s.description?.slice(0,40)||""}
                        </div>
                      </div>
                    );
                  })}
                  <div style={{ padding:"11px 12px", textAlign:"center",
                    fontSize:10, fontWeight:700, color:"#5a6175", letterSpacing:.8, textTransform:"uppercase" }}>
                    Total
                  </div>
                </div>

                {/* Criteria rows */}
                {criteria.map((crit, ci) => {
                  const w = getWeight(crit.id);
                  return (
                    <div key={crit.id}
                      style={{ display:"grid",
                        gridTemplateColumns:`240px repeat(${strategies.length}, minmax(160px, 1fr)) 90px`,
                        background: ci%2===0 ? DS.canvas : DS.canvasAlt,
                        borderTop:`1px solid ${DS.canvasBdr}` }}>

                      {/* Criterion label */}
                      <div style={{ padding:"12px 16px", display:"flex",
                        flexDirection:"column", justifyContent:"center", gap:5 }}>
                        <div style={{ fontSize:12, fontWeight:700, color:DS.ink, lineHeight:1.35 }}>
                          {crit.label}
                        </div>
                        <div style={{ display:"flex", alignItems:"center", gap:5 }}>
                          <Badge variant={({financial:"green",strategic:"blue",operational:"default",risk:"danger",commercial:"amber",technical:"chrome"})[crit.type]||"default"} size="xs">
                            {crit.type}
                          </Badge>
                          <span style={{ fontSize:9, fontWeight:700, color:WEIGHT_COLORS[w],
                            padding:"1px 5px", borderRadius:3,
                            background: WEIGHT_COLORS[w]+"18",
                            border:`1px solid ${WEIGHT_COLORS[w]}40` }}>
                            {WEIGHT_LABELS[w]} weight
                          </span>
                        </div>
                        {crit.description && (
                          <div style={{ fontSize:10, color:DS.inkTer, lineHeight:1.4 }}>
                            {crit.description.slice(0,70)}{crit.description.length>70?"…":""}
                          </div>
                        )}
                      </div>

                      {/* Score cells */}
                      {strategies.map(s => {
                        const col     = DS.s[s.colorIdx];
                        const score   = getScore(s.id, crit.id);
                        const isActive = activeStrat === s.id || !activeStrat;
                        const rowBest  = Math.max(...strategies.map(st => getScore(st.id, crit.id)));
                        const isBest   = score > 0 && score === rowBest && strategies.length > 1;
                        return (
                          <div key={s.id}
                            style={{ padding:"12px 10px",
                              display:"flex", flexDirection:"column",
                              alignItems:"center", justifyContent:"center", gap:8,
                              opacity: isActive ? 1 : 0.35,
                              background: isBest && score > 0 ? col.soft : "transparent",
                              borderLeft:`1px solid ${DS.canvasBdr}`,
                              transition:"all .12s" }}>
                            <ScoreRow value={score} onChange={v => setScore(s.id, crit.id, v)} color={col.fill}/>
                            <div style={{ display:"flex", alignItems:"center", gap:4 }}>
                              <span style={{ fontSize:12, fontWeight:700,
                                color: score > 0 ? col.fill : DS.inkDis }}>
                                {score > 0 ? `${score}/5` : "—"}
                              </span>
                              {isBest && score > 0 && (
                                <span style={{ fontSize:9, fontWeight:700, color:col.fill,
                                  background:col.soft, padding:"1px 5px", borderRadius:3,
                                  border:`1px solid ${col.line}` }}>best</span>
                              )}
                            </div>
                          </div>
                        );
                      })}

                      {/* Row scores */}
                      <div style={{ padding:"12px 8px", display:"flex", flexDirection:"column",
                        alignItems:"center", justifyContent:"center", gap:4,
                        borderLeft:`1px solid ${DS.canvasBdr}`, background:DS.canvasAlt }}>
                        {strategies.map(s => {
                          const col   = DS.s[s.colorIdx];
                          const score = getScore(s.id, crit.id);
                          return score > 0 ? (
                            <div key={s.id} style={{ display:"flex", alignItems:"center", gap:4 }}>
                              <div style={{ width:5, height:5, borderRadius:"50%", background:col.fill }}/>
                              <span style={{ fontSize:10, fontWeight:700, color:col.fill }}>
                                {score * w}
                              </span>
                            </div>
                          ) : null;
                        })}
                        <div style={{ fontSize:9, color:DS.inkDis, marginTop:2 }}>
                          ×{w}
                        </div>
                      </div>
                    </div>
                  );
                })}

                {/* Totals footer */}
                <div style={{ display:"grid",
                  gridTemplateColumns:`240px repeat(${strategies.length}, minmax(160px, 1fr)) 90px`,
                  background:DS.ink, borderTop:`2px solid ${DS.border}` }}>
                  <div style={{ padding:"14px 16px" }}>
                    <div style={{ fontSize:10, fontWeight:700, color:"#5a6175",
                      letterSpacing:.8, textTransform:"uppercase" }}>
                      Weighted Total
                    </div>
                    <div style={{ fontSize:10, color:"#3a4159", marginTop:2 }}>
                      Max possible: {maxPossible} pts
                    </div>
                  </div>
                  {strategies.map(s => {
                    const col   = DS.s[s.colorIdx];
                    const total = weightedTotal(s.id);
                    const p     = pct(s.id);
                    const isTop = ranked[0]?.id === s.id && p > 0;
                    return (
                      <div key={s.id}
                        style={{ padding:"14px 12px", display:"flex", flexDirection:"column",
                          alignItems:"center", gap:6,
                          background: isTop ? col.fill+"20" : "transparent",
                          borderLeft:`1px solid ${DS.border}` }}>
                        <div style={{ fontSize:22, fontWeight:700, color:col.fill,
                          fontFamily:"'Libre Baskerville',Georgia,serif", lineHeight:1 }}>
                          {total > 0 ? total : "—"}
                        </div>
                        {total > 0 && (
                          <>
                            <div style={{ width:"80%", height:4, background:DS.border, borderRadius:2, overflow:"hidden" }}>
                              <div style={{ width:`${p}%`, height:"100%", background:col.fill,
                                borderRadius:2, transition:"width .5s" }}/>
                            </div>
                            <div style={{ fontSize:11, fontWeight:700, color:col.fill }}>{p}%</div>
                          </>
                        )}
                      </div>
                    );
                  })}
                  <div style={{ padding:"14px 12px", borderLeft:`1px solid ${DS.border}`,
                    display:"flex", alignItems:"center", justifyContent:"center" }}>
                    <span style={{ fontSize:11, color:"#5a6175", fontWeight:700 }}>{maxPossible}</span>
                  </div>
                </div>
              </div>
              </div>

              {/* Scoring guide */}
              <div style={{ marginTop:14, padding:"10px 14px", background:DS.canvasAlt,
                borderRadius:7, border:`1px solid ${DS.canvasBdr}`,
                display:"flex", gap:16, flexWrap:"wrap", alignItems:"center" }}>
                <span style={{ fontSize:10, fontWeight:700, color:DS.inkTer,
                  letterSpacing:.6, textTransform:"uppercase" }}>Scoring guide:</span>
                {[
                  {v:1, label:"Very poor fit"},
                  {v:2, label:"Weak"},
                  {v:3, label:"Adequate"},
                  {v:4, label:"Strong"},
                  {v:5, label:"Excellent fit"},
                ].map(g => (
                  <div key={g.v} style={{ display:"flex", alignItems:"center", gap:5 }}>
                    <span style={{ width:18, height:18, borderRadius:4, background:DS.accent,
                      display:"inline-flex", alignItems:"center", justifyContent:"center",
                      fontSize:10, fontWeight:700, color:"#fff" }}>{g.v}</span>
                    <span style={{ fontSize:11, color:DS.inkSub }}>{g.label}</span>
                  </div>
                ))}
                <span style={{ marginLeft:"auto", fontSize:11, color:DS.inkTer }}>
                  Cells highlighted in strategy colour = best score in that row
                </span>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── RADAR VIEW ── */}
      {view === "radar" && (
        <div style={{ flex:1, overflowY:"auto", padding:"24px 28px" }}>
          {criteria.length < 3 || strategies.length === 0 ? (
            <div style={{ padding:"60px 40px", textAlign:"center", border:`1.5px dashed ${DS.canvasMid}`,
              borderRadius:10, color:DS.inkTer, fontSize:13 }}>
              Score at least 3 criteria across your strategies to see the radar comparison.
            </div>
          ) : (
            <div>
              <div style={{ marginBottom:20 }}>
                <div style={{ fontSize:13, fontWeight:700, color:DS.ink, marginBottom:4 }}>
                  Strategy Radar Comparison
                </div>
                <div style={{ fontSize:12, color:DS.inkSub }}>
                  Visual overlay of how each strategy scores across all criteria. Larger area = stronger overall fit.
                </div>
              </div>

              <div style={{ display:"flex", gap:32, flexWrap:"wrap", alignItems:"flex-start" }}>
                {/* Radar chart */}
                <div style={{ padding:"24px", background:DS.canvas, borderRadius:12,
                  border:`1px solid ${DS.canvasBdr}`,
                  boxShadow:"0 2px 12px rgba(0,0,0,.06)", flexShrink:0 }}>
                  <RadarChart
                    labels={criteria.map(c => c.label)}
                    datasets={radarDatasets}
                    size={340}
                  />
                </div>

                {/* Legend + per-strategy breakdown */}
                <div style={{ flex:1, minWidth:240 }}>
                  {/* Legend */}
                  <div style={{ display:"flex", gap:12, flexWrap:"wrap", marginBottom:20 }}>
                    {strategies.map(s => {
                      const col = DS.s[s.colorIdx];
                      return (
                        <div key={s.id} style={{ display:"flex", alignItems:"center", gap:7 }}>
                          <div style={{ width:12, height:4, borderRadius:2, background:col.fill }}/>
                          <span style={{ fontSize:12, fontWeight:700, color:col.fill }}>
                            {DS.sNames[s.colorIdx]||s.name}
                          </span>
                          <span style={{ fontSize:11, color:DS.inkTer }}>{pct(s.id)}%</span>
                        </div>
                      );
                    })}
                  </div>

                  {/* Per-strategy strengths/weaknesses */}
                  {strategies.map(s => {
                    const col    = DS.s[s.colorIdx];
                    const sScores = criteria.map(c => ({ label:c.label, score:getScore(s.id,c.id), id:c.id }))
                      .filter(x => x.score > 0)
                      .sort((a,b) => b.score - a.score);
                    const strengths  = sScores.slice(0, 2);
                    const weaknesses = [...sScores].sort((a,b)=>a.score-b.score).slice(0, 2);

                    return (
                      <div key={s.id} style={{ marginBottom:14, padding:"14px 16px",
                        background:col.soft, borderRadius:8,
                        border:`1.5px solid ${col.line}` }}>
                        <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:10 }}>
                          <div style={{ width:9, height:9, borderRadius:"50%", background:col.fill }}/>
                          <span style={{ fontSize:13, fontWeight:700, color:col.fill }}>
                            {DS.sNames[s.colorIdx]||s.name}
                          </span>
                          <span style={{ marginLeft:"auto", fontSize:16, fontWeight:700,
                            color:col.fill, fontFamily:"'Libre Baskerville',Georgia,serif" }}>
                            {pct(s.id)}%
                          </span>
                        </div>

                        {strengths.length > 0 && (
                          <div style={{ marginBottom:6 }}>
                            <div style={{ fontSize:9, fontWeight:700, color:DS.success,
                              letterSpacing:.6, textTransform:"uppercase", marginBottom:4 }}>Strengths</div>
                            {strengths.map((x,i) => (
                              <div key={i} style={{ display:"flex", alignItems:"center", gap:6, marginBottom:3 }}>
                                <div style={{ width:"60%", height:4, background:"rgba(255,255,255,.5)",
                                  borderRadius:2, overflow:"hidden" }}>
                                  <div style={{ width:`${(x.score/5)*100}%`, height:"100%",
                                    background:DS.success, borderRadius:2 }}/>
                                </div>
                                <span style={{ fontSize:10, color:DS.inkSub }}>{x.label} ({x.score}/5)</span>
                              </div>
                            ))}
                          </div>
                        )}

                        {weaknesses.length > 0 && weaknesses[0].score < 4 && (
                          <div>
                            <div style={{ fontSize:9, fontWeight:700, color:DS.danger,
                              letterSpacing:.6, textTransform:"uppercase", marginBottom:4 }}>Watch points</div>
                            {weaknesses.filter(x=>x.score<=3).map((x,i) => (
                              <div key={i} style={{ display:"flex", alignItems:"center", gap:6, marginBottom:3 }}>
                                <div style={{ width:"60%", height:4, background:"rgba(255,255,255,.5)",
                                  borderRadius:2, overflow:"hidden" }}>
                                  <div style={{ width:`${(x.score/5)*100}%`, height:"100%",
                                    background:DS.danger, borderRadius:2 }}/>
                                </div>
                                <span style={{ fontSize:10, color:DS.inkSub }}>{x.label} ({x.score}/5)</span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Criteria coverage heatmap strip */}
              <div style={{ marginTop:24, border:`1px solid ${DS.canvasBdr}`, borderRadius:8, overflow:"hidden" }}>
                <div style={{ padding:"10px 16px", background:DS.canvasAlt,
                  borderBottom:`1px solid ${DS.canvasBdr}`, fontSize:11, fontWeight:700, color:DS.ink }}>
                  Score Distribution by Criterion
                </div>
                <div style={{ overflowX:"auto" }}>
                  <table style={{ width:"100%", borderCollapse:"collapse" }}>
                    <thead>
                      <tr style={{ background:DS.canvasAlt }}>
                        <th style={{ padding:"8px 14px", textAlign:"left", fontSize:10, color:DS.inkTer,
                          fontWeight:700, letterSpacing:.6, textTransform:"uppercase",
                          borderBottom:`1px solid ${DS.canvasBdr}`, width:200 }}>Criterion</th>
                        {strategies.map(s => (
                          <th key={s.id} style={{ padding:"8px 10px", textAlign:"center",
                            fontSize:10, color:DS.s[s.colorIdx]?.fill||DS.accent, fontWeight:700,
                            borderBottom:`1px solid ${DS.canvasBdr}` }}>
                            {DS.sNames[s.colorIdx]||s.name}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {criteria.map((c, ci) => (
                        <tr key={c.id} style={{ borderBottom:`1px solid ${DS.canvasBdr}`,
                          background: ci%2===0?DS.canvas:DS.canvasAlt }}>
                          <td style={{ padding:"8px 14px", fontSize:11, color:DS.ink, fontWeight:600 }}>
                            {c.label}
                          </td>
                          {strategies.map(s => {
                            const score = getScore(s.id, c.id);
                            const col   = DS.s[s.colorIdx];
                            const bg    = score===0 ? "transparent" :
                              score>=4 ? col.fill+"30" :
                              score===3 ? col.fill+"18" : DS.dangerSoft;
                            return (
                              <td key={s.id} style={{ padding:"8px 10px", textAlign:"center",
                                background:bg }}>
                                <span style={{ fontSize:13, fontWeight:700,
                                  color: score===0 ? DS.inkDis :
                                    score>=4 ? col.fill : score===3 ? DS.inkSub : DS.danger }}>
                                  {score || "—"}
                                </span>
                              </td>
                            );
                          })}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── DECISION BRIEF VIEW ── */}
      {view === "brief" && (
        <div style={{ flex:1, overflowY:"auto", padding:"28px 36px" }}>
          {!brief ? (
            <div style={{ padding:"60px 40px", textAlign:"center", border:`1.5px dashed ${DS.canvasMid}`,
              borderRadius:10, color:DS.inkTer, fontSize:13 }}>
              <div style={{ marginBottom:16 }}>Score your strategies in the Scoring Matrix first, then generate the AI decision brief.</div>
              <Btn variant="primary" icon="spark" onClick={generateBrief}
                disabled={aiBusy||generating||scoredCount<strategies.length}>
                {generating?"Writing…":"Generate Decision Brief"}
              </Btn>
            </div>
          ) : (
            <div style={{ maxWidth:860, margin:"0 auto" }}>

              {/* Brief header */}
              <div style={{ marginBottom:28 }}>
                <div style={{ fontSize:9, fontWeight:700, color:DS.inkTer,
                  letterSpacing:1.5, textTransform:"uppercase", marginBottom:8 }}>
                  Decision Brief · {new Date().toLocaleDateString("en-GB",{day:"numeric",month:"long",year:"numeric"})}
                </div>
                <div style={{ fontFamily:"'Libre Baskerville',Georgia,serif", fontSize:26,
                  fontWeight:700, color:DS.ink, lineHeight:1.25, marginBottom:12, letterSpacing:-.3 }}>
                  {brief.headline}
                </div>
                <div style={{ fontSize:13, color:DS.inkSub, lineHeight:1.7, paddingBottom:16,
                  borderBottom:`2px solid ${DS.ink}` }}>
                  {brief.situationSummary}
                </div>
              </div>

              {/* Recommendation banner */}
              {brief.recommendedStrategyName && (() => {
                const recStrat = strategies.find(s =>
                  (DS.sNames[s.colorIdx]||s.name).toLowerCase() === brief.recommendedStrategyName?.toLowerCase() ||
                  s.name?.toLowerCase() === brief.recommendedStrategyName?.toLowerCase()
                ) || strategies[0];
                const col = recStrat ? DS.s[recStrat.colorIdx] : DS.s[0];
                return (
                  <div style={{ marginBottom:28, padding:"20px 24px",
                    background:col.soft, border:`2px solid ${col.fill}`,
                    borderRadius:10 }}>
                    <div style={{ fontSize:10, fontWeight:700, color:col.fill,
                      letterSpacing:1, textTransform:"uppercase", marginBottom:8 }}>
                      Recommended Strategy
                    </div>
                    <div style={{ fontFamily:"'Libre Baskerville',Georgia,serif", fontSize:20,
                      fontWeight:700, color:DS.ink, marginBottom:10 }}>
                      {brief.recommendedStrategyName}
                    </div>
                    <div style={{ fontSize:13, color:DS.ink, lineHeight:1.7, marginBottom:16 }}>
                      {brief.recommendationRationale}
                    </div>
                    <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:14 }}>
                      {brief.keyTradeoff && (
                        <div style={{ padding:"12px 14px", background:"rgba(255,255,255,.6)",
                          borderRadius:7, border:`1px solid ${col.line}` }}>
                          <div style={{ fontSize:10, fontWeight:700, color:DS.warning,
                            letterSpacing:.6, textTransform:"uppercase", marginBottom:4 }}>Key Trade-off</div>
                          <div style={{ fontSize:12, color:DS.ink, lineHeight:1.55 }}>{brief.keyTradeoff}</div>
                        </div>
                      )}
                      {brief.criticalAssumption && (
                        <div style={{ padding:"12px 14px", background:"rgba(255,255,255,.6)",
                          borderRadius:7, border:`1px solid ${col.line}` }}>
                          <div style={{ fontSize:10, fontWeight:700, color:DS.danger,
                            letterSpacing:.6, textTransform:"uppercase", marginBottom:4 }}>Critical Assumption</div>
                          <div style={{ fontSize:12, color:DS.ink, lineHeight:1.55 }}>{brief.criticalAssumption}</div>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })()}

              {/* Strategy comparison table */}
              {brief.strategyComparisons?.length > 0 && (
                <div style={{ marginBottom:28 }}>
                  <div style={{ fontSize:13, fontWeight:700, color:DS.ink, marginBottom:14,
                    fontFamily:"'Libre Baskerville',Georgia,serif" }}>
                    Strategy Comparison
                  </div>
                  <div style={{ border:`1px solid ${DS.canvasBdr}`, borderRadius:8, overflow:"hidden" }}>
                    <table style={{ width:"100%", borderCollapse:"collapse" }}>
                      <thead>
                        <tr style={{ background:DS.canvasAlt }}>
                          {["Strategy","Verdict","Best When","Main Risk","Score"].map(h=>(
                            <th key={h} style={{ padding:"9px 14px", textAlign:"left",
                              fontSize:10, fontWeight:700, color:DS.inkTer,
                              letterSpacing:.6, textTransform:"uppercase",
                              borderBottom:`1px solid ${DS.canvasBdr}` }}>{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {brief.strategyComparisons.map((sc, i) => {
                          const matchStrat = strategies.find(s =>
                            (DS.sNames[s.colorIdx]||s.name).toLowerCase() === sc.name?.toLowerCase()
                          );
                          const col = matchStrat ? DS.s[matchStrat.colorIdx] : DS.s[i%DS.s.length];
                          const isRec = sc.name?.toLowerCase() === brief.recommendedStrategyName?.toLowerCase();
                          return (
                            <tr key={i} style={{ borderTop:`1px solid ${DS.canvasBdr}`,
                              background: isRec ? col.soft : DS.canvas }}>
                              <td style={{ padding:"11px 14px" }}>
                                <div style={{ display:"flex", alignItems:"center", gap:7 }}>
                                  <div style={{ width:8, height:8, borderRadius:"50%", background:col.fill }}/>
                                  <span style={{ fontSize:12, fontWeight:700, color:col.fill }}>{sc.name}</span>
                                  {isRec && <Badge variant="green" size="xs">Recommended</Badge>}
                                </div>
                              </td>
                              <td style={{ padding:"11px 14px", fontSize:12, color:DS.ink, lineHeight:1.45 }}>{sc.verdict}</td>
                              <td style={{ padding:"11px 14px", fontSize:11, color:DS.inkSub, lineHeight:1.45 }}>{sc.bestFor}</td>
                              <td style={{ padding:"11px 14px", fontSize:11, color:DS.danger, lineHeight:1.45 }}>{sc.mainRisk}</td>
                              <td style={{ padding:"11px 14px", textAlign:"center" }}>
                                <div style={{ fontSize:16, fontWeight:700, color:col.fill,
                                  fontFamily:"'Libre Baskerville',Georgia,serif" }}>
                                  {matchStrat ? pct(matchStrat.id) : sc.score}%
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Conditions + next step */}
              <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:16, marginBottom:28 }}>
                {brief.conditionsToRevisit?.length > 0 && (
                  <div style={{ padding:"16px 18px", background:DS.warnSoft,
                    border:`1px solid ${DS.warnLine}`, borderRadius:8 }}>
                    <div style={{ fontSize:10, fontWeight:700, color:DS.warning,
                      letterSpacing:.6, textTransform:"uppercase", marginBottom:10 }}>
                      Conditions to Revisit This Decision
                    </div>
                    {brief.conditionsToRevisit.map((c,i) => (
                      <div key={i} style={{ fontSize:12, color:DS.ink, marginBottom:5,
                        display:"flex", gap:6 }}>
                        <span style={{ color:DS.warning, flexShrink:0 }}>•</span>{c}
                      </div>
                    ))}
                  </div>
                )}
                {brief.recommendedNextStep && (
                  <div style={{ padding:"16px 18px", background:DS.successSoft,
                    border:`1px solid ${DS.successLine}`, borderRadius:8 }}>
                    <div style={{ fontSize:10, fontWeight:700, color:DS.success,
                      letterSpacing:.6, textTransform:"uppercase", marginBottom:8 }}>
                      Recommended Next Step
                    </div>
                    <div style={{ fontSize:13, color:DS.ink, lineHeight:1.6, fontWeight:600 }}>
                      {brief.recommendedNextStep}
                    </div>
                  </div>
                )}
              </div>

              {/* DQ Readiness */}
              {brief.dqReadiness && (
                <div style={{ padding:"16px 20px",
                  background: brief.dqReadiness.score >= 70 ? DS.successSoft :
                    brief.dqReadiness.score >= 50 ? DS.warnSoft : DS.dangerSoft,
                  border:`1px solid ${brief.dqReadiness.score>=70?DS.successLine:brief.dqReadiness.score>=50?DS.warnLine:DS.dangerLine}`,
                  borderRadius:8, display:"flex", alignItems:"center", gap:20 }}>
                  <div>
                    <div style={{ fontSize:9, fontWeight:700, letterSpacing:1,
                      textTransform:"uppercase", marginBottom:4,
                      color:brief.dqReadiness.score>=70?DS.success:brief.dqReadiness.score>=50?DS.warning:DS.danger }}>
                      Decision Readiness
                    </div>
                    <div style={{ fontSize:32, fontWeight:700, lineHeight:1,
                      fontFamily:"'Libre Baskerville',Georgia,serif",
                      color:brief.dqReadiness.score>=70?DS.success:brief.dqReadiness.score>=50?DS.warning:DS.danger }}>
                      {brief.dqReadiness.score}
                      <span style={{ fontSize:14, fontWeight:400 }}>/100</span>
                    </div>
                  </div>
                  <div style={{ flex:1 }}>
                    <div style={{ height:6, background:"rgba(0,0,0,.08)", borderRadius:3, marginBottom:8, overflow:"hidden" }}>
                      <div style={{ width:`${brief.dqReadiness.score}%`, height:"100%", borderRadius:3,
                        background:brief.dqReadiness.score>=70?DS.success:brief.dqReadiness.score>=50?DS.warning:DS.danger,
                        transition:"width .6s" }}/>
                    </div>
                    <div style={{ fontSize:12, color:DS.ink, lineHeight:1.55 }}>{brief.dqReadiness.note}</div>
                  </div>
                  <Btn variant="secondary" size="sm" onClick={generateBrief} disabled={aiBusy||generating}>
                    Refresh Brief
                  </Btn>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}


/* ─────────────────────────────────────────────────────────────────────────────
   MODULE 06 — DQ SCORECARD
───────────────────────────────────────────────────────────────────────────── */

const DQ_ELEMENTS = [
  {
    key:   "frame",
    num:   "01",
    label: "Appropriate Frame",
    desc:  "The right decision problem is being addressed at the right level with the right scope and perspective.",
    questions: [
      "Is the decision statement clear, specific, and well-formed?",
      "Is the scope — in and out — explicitly defined?",
      "Are we solving the root problem, not just a symptom?",
      "Is there alignment on purpose and perspective among decision makers?",
    ],
    good:  "Decision is clearly framed. Problem statement is precise. Scope is bounded. Root decision identified.",
    weak:  "Vague decision statement. Unclear scope. Team is solving symptoms rather than root causes.",
    icon:  "◎",
    color: DS.accent,
    soft:  DS.accentSoft,
    line:  DS.accentLine,
  },
  {
    key:   "alternatives",
    num:   "02",
    label: "Creative Alternatives",
    desc:  "Genuinely distinct strategies that meaningfully test the solution space — not variations of the same idea.",
    questions: [
      "Do we have at least 3 genuinely distinct strategies?",
      "Do strategies differ on the decisions that matter most?",
      "Have we avoided packaging our favourite with two straw men?",
      "Does each strategy represent a coherent, internally consistent path?",
    ],
    good:  "3+ distinct strategies. Each is internally coherent. No false diversity — real strategic difference.",
    weak:  "Only one real option presented. Strategies are minor variations. No genuine alternatives considered.",
    icon:  "⊞",
    color: "#7c3aed",
    soft:  "#f5f3ff",
    line:  "#ddd6fe",
  },
  {
    key:   "information",
    num:   "03",
    label: "Meaningful Information",
    desc:  "Key uncertainties are identified and understood. Information is reliable, relevant, and appropriately used.",
    questions: [
      "Have we identified the key uncertainties affecting strategy value?",
      "Do we know which uncertainties are deal-breakers?",
      "Is our information reliable — not just convenient?",
      "Have we distinguished facts from assumptions from uncertainties?",
    ],
    good:  "Key uncertainties mapped. Critical path uncertainties identified. Information quality assessed.",
    weak:  "Many unresolved uncertainties. Team is treating assumptions as facts. Information gaps unaddressed.",
    icon:  "◉",
    color: DS.success,
    soft:  DS.successSoft,
    line:  DS.successLine,
  },
  {
    key:   "values",
    num:   "04",
    label: "Clear Values & Trade-offs",
    desc:  "Decision criteria reflect what stakeholders actually value. Trade-off rules are explicit and agreed.",
    questions: [
      "Have we identified the right criteria to judge strategies?",
      "Do criteria reflect what stakeholders genuinely value?",
      "Are trade-off rules between criteria explicit?",
      "Is there alignment on what a good outcome looks like?",
    ],
    good:  "Criteria are clear, agreed, and weighted. Trade-offs are explicit. Stakeholders aligned on values.",
    weak:  "Criteria are vague or missing. No trade-off rules. Different stakeholders have conflicting values.",
    icon:  "◫",
    color: DS.warning,
    soft:  DS.warnSoft,
    line:  DS.warnLine,
  },
  {
    key:   "reasoning",
    num:   "05",
    label: "Sound Reasoning",
    desc:  "The logic connecting information to conclusions is valid. Analysis is correct and free of avoidable biases.",
    questions: [
      "Is the reasoning from evidence to recommendation logically sound?",
      "Have we checked for anchoring, confirmation bias, or groupthink?",
      "Are our models and analysis fit for purpose?",
      "Does the recommendation follow from the evidence?",
    ],
    good:  "Logic is sound. Biases identified and mitigated. Analysis is proportionate to decision complexity.",
    weak:  "Reasoning has gaps. Known biases not addressed. Recommendation doesn\'t clearly follow from analysis.",
    icon:  "◑",
    color: "#0891b2",
    soft:  "#ecfeff",
    line:  "#a5f3fc",
  },
  {
    key:   "commitment",
    num:   "06",
    label: "Commitment to Action",
    desc:  "All key stakeholders are aligned and ready to act. The organisation can and will execute the decision.",
    questions: [
      "Do all key decision makers support the recommended direction?",
      "Is the organisation ready and able to execute?",
      "Have dissenting views been heard and addressed?",
      "Is there a clear owner and next step?",
    ],
    good:  "Full stakeholder alignment. Clear owner. Organisation ready to act. Execution plan exists.",
    weak:  "Key stakeholders not bought in. No clear owner. Execution capability uncertain. Decision likely to recycle.",
    icon:  "◐",
    color: "#db2777",
    soft:  "#fdf2f8",
    line:  "#fbcfe8",
  },
];

function GaugeArc({ score, size=120, color }) {
  const r    = size * 0.38;
  const cx   = size / 2;
  const cy   = size / 2 + 10;
  const start = -Math.PI * 0.85;
  const end   = Math.PI * 0.85;
  const range = end - start;
  const angle = start + (score / 100) * range;

  const polarX = (a, radius) => cx + radius * Math.cos(a);
  const polarY = (a, radius) => cy + radius * Math.sin(a);

  const trackPath = `M ${polarX(start,r)} ${polarY(start,r)} A ${r} ${r} 0 1 1 ${polarX(end,r)} ${polarY(end,r)}`;
  const fillPath  = score > 0
    ? `M ${polarX(start,r)} ${polarY(start,r)} A ${r} ${r} 0 ${score>50?1:0} 1 ${polarX(angle,r)} ${polarY(angle,r)}`
    : null;

  return (
    <svg width={size} height={size*0.75} viewBox={`0 0 ${size} ${size*0.78}`}>
      <path d={trackPath} fill="none" stroke={DS.canvasBdr} strokeWidth={8}
        strokeLinecap="round"/>
      {fillPath && (
        <path d={fillPath} fill="none" stroke={color} strokeWidth={8}
          strokeLinecap="round"/>
      )}
      <text x={cx} y={cy+4} textAnchor="middle"
        fontSize={size*0.22} fontWeight="700"
        fontFamily="'Libre Baskerville',Georgia,serif"
        fill={score>0?color:DS.inkDis}>
        {score}
      </text>
      <text x={cx} y={cy+18} textAnchor="middle"
        fontSize={size*0.09} fontWeight="600"
        fontFamily="'IBM Plex Sans','Helvetica Neue',sans-serif"
        fill={DS.inkTer} letterSpacing="1">
        /100
      </text>
    </svg>
  );
}

function ModuleDQScorecard({ problem, issues, decisions, strategies, criteria, assessmentScores, brief,
  scores, onScores, aiCall, aiBusy, onAIMsg }) {

  const [generating, setGenerating]   = useState(false);
  const [narrative, setNarrative]     = useState(null);
  const [activeEl, setActiveEl]       = useState(null);
  const [view, setView]               = useState("scorecard"); // scorecard | chain | report

  const getScore    = (key) => scores[key] || 0;
  const setElScore  = (key, val) => onScores({ ...scores, [key]: val });
  const overall     = DQ_ELEMENTS.length > 0
    ? Math.round(DQ_ELEMENTS.reduce((s,e) => s+getScore(e.key), 0) / DQ_ELEMENTS.length)
    : 0;
  const weakest     = [...DQ_ELEMENTS].sort((a,b) => getScore(a.key)-getScore(b.key))[0];
  const unscored    = DQ_ELEMENTS.filter(e => getScore(e.key)===0).length;

  const scoreColor  = (s) => s===0?DS.inkDis:s>=70?DS.success:s>=45?DS.warning:DS.danger;
  const scoreVariant= (s) => s===0?"default":s>=70?"green":s>=45?"warn":"danger";

  // ── AI GENERATE NARRATIVE ────────────────────────────────────────────────────
  const generateNarrative = () => {
    setGenerating(true);

    const elementSummary = DQ_ELEMENTS.map(e =>
      `${e.label} [${e.num}]: ${getScore(e.key)}/100`
    ).join(" | ");

    const contextSummary = `
Decision: "${problem.decisionStatement}"
Issues raised: ${issues.length} | Focus decisions: ${decisions.filter(d=>d.tier==="focus").length} | Strategies: ${strategies.length} | Criteria: ${criteria.length}
Assessment scores available: ${Object.keys(assessmentScores).length > 0 ? "Yes" : "No"}
DQ Scores: ${elementSummary}
Overall DQ Score: ${overall}/100
Weakest element: ${weakest.label} (${getScore(weakest.key)}/100)`.trim();

    aiCall(dqPrompt(`You are a senior Decision Quality facilitator writing a formal DQ assessment narrative.

${contextSummary}

Write a rigorous, frank DQ narrative. Don't hedge — be direct about where quality is strong and where it is weak.
The weakest link principle: the chain is only as strong as its weakest link.

Return ONLY valid JSON:
{
  "overallVerdict": "one sentence overall DQ quality verdict — decisive and frank",
  "readinessStatement": "Is this decision ready to be made? One clear sentence.",
  "elementNarratives": {
    "frame": "2 sentences on frame quality",
    "alternatives": "2 sentences on alternatives quality",
    "information": "2 sentences on information quality",
    "values": "2 sentences on values/criteria quality",
    "reasoning": "2 sentences on reasoning quality",
    "commitment": "2 sentences on commitment quality"
  },
  "weakestLinkAnalysis": "3 sentences: what is the weakest link, why it matters, what specifically needs to improve",
  "strengthsToPreserve": ["strength 1", "strength 2"],
  "priorityActions": [
    {"action": "specific action", "element": "DQ element key", "urgency": "immediate|before-deciding|can-wait"}
  ],
  "decidingNow": "yes|no|conditional",
  "conditionalNote": "if conditional — what condition must be met first (null if yes/no)",
  "facilitatorRecommendation": "What the facilitator recommends the team do in the next session"
}`),
    (r) => {
      if (!r.error) {
        setNarrative(r);
        onAIMsg({ role:"ai", text:`DQ Scorecard complete. Overall: ${overall}/100. ${r.readinessStatement}` });
      }
      setGenerating(false);
    });
  };

  const urgencyColor = { immediate:DS.danger, "before-deciding":DS.warning, "can-wait":DS.success };
  const urgencyLabel = { immediate:"Immediate", "before-deciding":"Before Deciding", "can-wait":"Can Wait" };

  const TABS = [
    { id:"scorecard", label:"DQ Scorecard" },
    { id:"chain",     label:"Chain Analysis" },
    { id:"report",    label:"Full Report",   highlight:!!narrative },
  ];

  return (
    <div style={{ display:"flex", flexDirection:"column", height:"100%" }}>

      {/* Header */}
      <div style={{ padding:"16px 28px", background:DS.canvas, borderBottom:`1px solid ${DS.canvasBdr}`,
        display:"flex", alignItems:"center", gap:12, flexShrink:0, flexWrap:"wrap" }}>
        <div style={{ flex:1 }}>
          <div style={{ fontSize:11, color:DS.inkTer, letterSpacing:1, textTransform:"uppercase", fontWeight:700, marginBottom:3 }}>Module 06</div>
          <div style={{ fontFamily:"'Libre Baskerville', Georgia, serif", fontSize:22, fontWeight:700, color:DS.ink, letterSpacing:-.3 }}>DQ Scorecard</div>
        </div>
        <div style={{ display:"flex", gap:6, alignItems:"center" }}>
          {overall > 0 && <Badge variant={scoreVariant(overall)}>Overall: {overall}/100</Badge>}
          {unscored > 0 && <Badge variant="amber">{unscored} elements unscored</Badge>}
          {overall > 0 && unscored === 0 && (
            <Badge variant={overall>=70?"green":overall>=45?"warn":"danger"}>
              {overall>=70?"Ready to decide":overall>=45?"Proceed with caution":"Not ready"}
            </Badge>
          )}
        </div>
        <Btn variant="primary" icon="spark" onClick={generateNarrative}
          disabled={aiBusy||generating||unscored>2}>
          {generating?"Generating…":"Generate DQ Report"}
        </Btn>
      </div>

      {/* Tab bar */}
      <div style={{ display:"flex", background:DS.canvasAlt, borderBottom:`1px solid ${DS.canvasBdr}`,
        flexShrink:0, paddingLeft:28 }}>
        {TABS.map(t => (
          <button key={t.id} onClick={()=>setView(t.id)}
            style={{ padding:"10px 18px", fontSize:11, fontWeight:700, fontFamily:"inherit",
              cursor:"pointer", border:"none", background:"transparent",
              borderBottom:`2px solid ${view===t.id?DS.accent:"transparent"}`,
              color:view===t.id?DS.accent:DS.inkTer, letterSpacing:.4,
              display:"flex", alignItems:"center", gap:6 }}>
            {t.label}
            {t.highlight && <span style={{ width:6, height:6, borderRadius:"50%", background:DS.success }}/>}
          </button>
        ))}
      </div>

      {/* ── SCORECARD VIEW ── */}
      {view==="scorecard" && (
        <div style={{ flex:1, overflowY:"auto", padding:"24px 28px" }}>

          {/* Overall score ring */}
          {overall > 0 && (
            <div style={{ display:"flex", alignItems:"center", gap:28, marginBottom:28,
              padding:"20px 24px", background:DS.canvas, borderRadius:10,
              border:`1px solid ${DS.canvasBdr}`,
              boxShadow:"0 2px 12px rgba(0,0,0,.06)" }}>
              <div style={{ textAlign:"center", flexShrink:0 }}>
                <GaugeArc score={overall} size={140} color={scoreColor(overall)}/>
                <div style={{ fontSize:10, fontWeight:700, color:DS.inkTer,
                  letterSpacing:1, textTransform:"uppercase", marginTop:4 }}>
                  Overall DQ Score
                </div>
              </div>
              <div style={{ flex:1 }}>
                <div style={{ fontFamily:"'Libre Baskerville',Georgia,serif", fontSize:18,
                  fontWeight:700, color:DS.ink, marginBottom:8 }}>
                  {overall>=75 ? "Strong decision quality — proceed with confidence." :
                   overall>=55 ? "Adequate quality — address key gaps before committing." :
                   overall>=35 ? "Significant gaps — do not decide until weakest links are resolved." :
                                 "Insufficient quality — substantial rework required."}
                </div>
                <div style={{ display:"flex", gap:10, flexWrap:"wrap" }}>
                  {DQ_ELEMENTS.map(e => {
                    const s = getScore(e.key);
                    return s > 0 ? (
                      <div key={e.key} style={{ display:"flex", alignItems:"center", gap:5 }}>
                        <span style={{ fontSize:12 }}>{e.icon}</span>
                        <div style={{ width:50, height:4, background:DS.canvasBdr, borderRadius:2, overflow:"hidden" }}>
                          <div style={{ width:`${s}%`, height:"100%", background:scoreColor(s), borderRadius:2 }}/>
                        </div>
                        <span style={{ fontSize:10, fontWeight:700, color:scoreColor(s) }}>{s}</span>
                      </div>
                    ) : null;
                  })}
                </div>
              </div>
            </div>
          )}

          {/* Six element cards */}
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:14 }}>
            {DQ_ELEMENTS.map(el => {
              const s      = getScore(el.key);
              const isWeak = s > 0 && el.key === weakest.key && DQ_ELEMENTS.some(e=>getScore(e.key)>0);
              const isSel  = activeEl === el.key;

              return (
                <div key={el.key}
                  onClick={()=>setActiveEl(isSel?null:el.key)}
                  style={{ padding:"18px 20px", borderRadius:9, cursor:"pointer",
                    border:`1.5px solid ${isSel?el.color:isWeak&&s>0?DS.dangerLine:DS.canvasBdr}`,
                    background: isSel ? el.soft : isWeak&&s>0 ? DS.dangerSoft+"60" : DS.canvas,
                    boxShadow: isSel?`0 0 0 3px ${el.line}50`: isWeak&&s>0?`0 0 0 2px ${DS.dangerLine}50`:"0 1px 3px rgba(0,0,0,.05)",
                    transition:"all .15s" }}>

                  {/* Element header */}
                  <div style={{ display:"flex", alignItems:"flex-start", gap:12, marginBottom:12 }}>
                    <div style={{ width:36, height:36, borderRadius:8, background:el.soft,
                      border:`1.5px solid ${el.line}`, display:"flex", alignItems:"center",
                      justifyContent:"center", fontSize:18, flexShrink:0 }}>
                      {el.icon}
                    </div>
                    <div style={{ flex:1 }}>
                      <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:3 }}>
                        <span style={{ fontSize:9, color:el.color, fontWeight:700,
                          letterSpacing:.8, textTransform:"uppercase" }}>Element {el.num}</span>
                        {isWeak && s>0 && <Badge variant="danger" size="xs">WEAKEST LINK</Badge>}
                      </div>
                      <div style={{ fontSize:13, fontWeight:700, color:DS.ink }}>{el.label}</div>
                    </div>
                    <div style={{ flexShrink:0, textAlign:"center" }}>
                      <GaugeArc score={s} size={70} color={s>0?scoreColor(s):DS.inkDis}/>
                    </div>
                  </div>

                  <div style={{ fontSize:11, color:DS.inkSub, lineHeight:1.5, marginBottom:12 }}>
                    {el.desc}
                  </div>

                  {/* Manual score buttons */}
                  <div style={{ marginBottom:12 }}>
                    <div style={{ fontSize:9, fontWeight:700, color:DS.inkTer,
                      letterSpacing:.6, textTransform:"uppercase", marginBottom:6 }}>
                      Score this element
                    </div>
                    <div style={{ display:"flex", gap:4 }}>
                      {[0,10,20,30,40,50,60,70,80,90,100].map(v => (
                        <button key={v} onClick={e=>{e.stopPropagation();setElScore(el.key,v);}}
                          style={{ flex:1, padding:"5px 0", fontSize:9, fontWeight:700,
                            borderRadius:4, cursor:"pointer", fontFamily:"inherit",
                            border:`1px solid ${s===v?el.color:DS.canvasBdr}`,
                            background:s===v?el.soft:"transparent",
                            color:s===v?el.color:DS.inkDis,
                            transition:"all .1s" }}>
                          {v}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Expanded content */}
                  {isSel && (
                    <div style={{ borderTop:`1px solid ${DS.canvasBdr}`, paddingTop:12, marginTop:4 }}>
                      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10, marginBottom:12 }}>
                        <div style={{ padding:"10px 12px", background:DS.successSoft,
                          borderRadius:6, border:`1px solid ${DS.successLine}` }}>
                          <div style={{ fontSize:9, fontWeight:700, color:DS.success,
                            letterSpacing:.6, textTransform:"uppercase", marginBottom:5 }}>Strong score looks like</div>
                          <div style={{ fontSize:11, color:DS.ink, lineHeight:1.5 }}>{el.good}</div>
                        </div>
                        <div style={{ padding:"10px 12px", background:DS.dangerSoft,
                          borderRadius:6, border:`1px solid ${DS.dangerLine}` }}>
                          <div style={{ fontSize:9, fontWeight:700, color:DS.danger,
                            letterSpacing:.6, textTransform:"uppercase", marginBottom:5 }}>Weak score looks like</div>
                          <div style={{ fontSize:11, color:DS.ink, lineHeight:1.5 }}>{el.weak}</div>
                        </div>
                      </div>
                      <div>
                        <div style={{ fontSize:9, fontWeight:700, color:DS.inkTer,
                          letterSpacing:.6, textTransform:"uppercase", marginBottom:6 }}>Diagnostic questions</div>
                        {el.questions.map((q,i) => (
                          <div key={i} style={{ fontSize:11, color:DS.inkSub, lineHeight:1.55,
                            marginBottom:5, display:"flex", gap:7 }}>
                            <span style={{ color:el.color, flexShrink:0, fontWeight:700 }}>Q{i+1}</span>{q}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {unscored === DQ_ELEMENTS.length && (
            <div style={{ marginTop:20, padding:"16px 20px", background:DS.accentSoft,
              borderRadius:8, border:`1px solid ${DS.accentLine}`, fontSize:12, color:DS.accent }}>
              <strong>How to score:</strong> Click each element and use the 0–100 buttons. 0 = not assessed, 
              10–30 = significant gaps, 40–60 = adequate, 70–80 = strong, 90–100 = excellent. 
              Click any card to expand diagnostic questions and scoring guidance.
            </div>
          )}
        </div>
      )}

      {/* ── CHAIN VIEW ── */}
      {view==="chain" && (
        <div style={{ flex:1, overflowY:"auto", padding:"32px 40px" }}>
          <div style={{ marginBottom:24 }}>
            <div style={{ fontSize:13, fontWeight:700, color:DS.ink, marginBottom:4 }}>
              The DQ Chain — A Decision is Only as Strong as Its Weakest Link
            </div>
            <div style={{ fontSize:12, color:DS.inkSub, lineHeight:1.6 }}>
              All six elements must be strong for a high-quality decision. One weak link degrades the entire chain, regardless of how strong the other elements are.
            </div>
          </div>

          {/* Chain visualisation */}
          <div style={{ display:"flex", alignItems:"center", gap:0, flexWrap:"wrap",
            justifyContent:"center", marginBottom:40 }}>
            {DQ_ELEMENTS.map((el, i) => {
              const s      = getScore(el.key);
              const isWeak = s > 0 && el.key===weakest.key && DQ_ELEMENTS.some(e=>getScore(e.key)>0);
              return (
                <div key={el.key} style={{ display:"flex", alignItems:"center" }}>
                  <div style={{ display:"flex", flexDirection:"column", alignItems:"center", gap:8 }}
                    onClick={()=>{ setActiveEl(el.key); setView("scorecard"); }}>
                    <div style={{ width:80, height:80, borderRadius:"50%",
                      border:`3px solid ${s>0?scoreColor(s):DS.canvasBdr}`,
                      background: s>0?el.soft:DS.canvasAlt,
                      display:"flex", flexDirection:"column",
                      alignItems:"center", justifyContent:"center",
                      cursor:"pointer", transition:"all .15s",
                      boxShadow:isWeak?`0 0 0 4px ${DS.dangerLine}, 0 0 20px ${DS.danger}30`:"none" }}>
                      <span style={{ fontSize:20 }}>{el.icon}</span>
                      <span style={{ fontSize:13, fontWeight:700,
                        color:s>0?scoreColor(s):DS.inkDis }}>{s||"?"}</span>
                    </div>
                    <div style={{ textAlign:"center", width:90 }}>
                      <div style={{ fontSize:10, fontWeight:700, color:DS.inkSub,
                        lineHeight:1.3, textAlign:"center" }}>{el.label}</div>
                      {isWeak && (
                        <div style={{ fontSize:9, color:DS.danger, fontWeight:700, marginTop:2 }}>
                          ⚠ WEAKEST
                        </div>
                      )}
                    </div>
                  </div>
                  {i < DQ_ELEMENTS.length - 1 && (
                    <div style={{ width:32, height:3, margin:"0 2px 28px",
                      background:`linear-gradient(90deg, ${s>0?scoreColor(s):DS.canvasBdr}, ${scoreColor(getScore(DQ_ELEMENTS[i+1].key))||DS.canvasBdr})`,
                      borderRadius:2 }}/>
                  )}
                </div>
              );
            })}
          </div>

          {/* Weakest link callout */}
          {DQ_ELEMENTS.some(e=>getScore(e.key)>0) && (
            <div style={{ padding:"20px 24px", background:DS.dangerSoft,
              border:`1.5px solid ${DS.dangerLine}`, borderRadius:10, marginBottom:20 }}>
              <div style={{ fontSize:10, fontWeight:700, color:DS.danger,
                letterSpacing:.8, textTransform:"uppercase", marginBottom:8 }}>
                Weakest Link — {weakest.label} ({getScore(weakest.key)}/100)
              </div>
              <div style={{ fontSize:13, color:DS.ink, lineHeight:1.65, marginBottom:12 }}>
                {weakest.weak}
              </div>
              <div style={{ fontSize:12, color:DS.inkSub }}>
                <strong>Diagnostic questions for this element:</strong>
                <ul style={{ marginTop:8, paddingLeft:18 }}>
                  {weakest.questions.map((q,i)=>(
                    <li key={i} style={{ marginBottom:5, lineHeight:1.5 }}>{q}</li>
                  ))}
                </ul>
              </div>
            </div>
          )}

          {/* Score comparison bars */}
          <div style={{ border:`1px solid ${DS.canvasBdr}`, borderRadius:9, overflow:"hidden" }}>
            <div style={{ padding:"11px 16px", background:DS.canvasAlt,
              borderBottom:`1px solid ${DS.canvasBdr}`, fontSize:11, fontWeight:700, color:DS.ink }}>
              Element Scores
            </div>
            {DQ_ELEMENTS.map((el,i) => {
              const s = getScore(el.key);
              return (
                <div key={el.key} style={{ padding:"12px 16px", display:"flex", alignItems:"center", gap:14,
                  borderTop:i>0?`1px solid ${DS.canvasBdr}`:"none",
                  background:el.key===weakest.key&&s>0?DS.dangerSoft+"50":DS.canvas }}>
                  <div style={{ width:30, textAlign:"center", fontSize:16, flexShrink:0 }}>{el.icon}</div>
                  <div style={{ width:160, flexShrink:0 }}>
                    <div style={{ fontSize:12, fontWeight:700, color:DS.ink }}>{el.label}</div>
                    <div style={{ fontSize:10, color:DS.inkTer }}>Element {el.num}</div>
                  </div>
                  <div style={{ flex:1, height:8, background:DS.canvasBdr, borderRadius:4, overflow:"hidden" }}>
                    <div style={{ width:`${s}%`, height:"100%", borderRadius:4,
                      background:s>0?scoreColor(s):DS.canvasBdr,
                      transition:"width .5s" }}/>
                  </div>
                  <div style={{ width:50, textAlign:"right", fontSize:14, fontWeight:700,
                    fontFamily:"'Libre Baskerville',Georgia,serif",
                    color:s>0?scoreColor(s):DS.inkDis }}>
                    {s>0?s:"—"}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── FULL REPORT VIEW ── */}
      {view==="report" && (
        <div style={{ flex:1, overflowY:"auto", padding:"32px 40px" }}>
          {!narrative ? (
            <div style={{ padding:"60px 40px", textAlign:"center", border:`1.5px dashed ${DS.canvasMid}`,
              borderRadius:10, color:DS.inkTer, fontSize:13 }}>
              <div style={{ marginBottom:16 }}>Score all elements in the Scorecard view, then generate the AI DQ Report.</div>
              <Btn variant="primary" icon="spark" onClick={generateNarrative}
                disabled={aiBusy||generating||unscored>2}>
                {generating?"Generating…":"Generate DQ Report"}
              </Btn>
            </div>
          ) : (
            <div style={{ maxWidth:800, margin:"0 auto" }}>

              {/* Report header */}
              <div style={{ marginBottom:28, paddingBottom:20, borderBottom:`2px solid ${DS.ink}` }}>
                <div style={{ fontSize:9, fontWeight:700, color:DS.inkTer,
                  letterSpacing:1.5, textTransform:"uppercase", marginBottom:8 }}>
                  Decision Quality Assessment · {new Date().toLocaleDateString("en-GB",{day:"numeric",month:"long",year:"numeric"})}
                </div>
                <div style={{ fontFamily:"'Libre Baskerville',Georgia,serif", fontSize:28,
                  fontWeight:700, color:DS.ink, lineHeight:1.2, marginBottom:10 }}>
                  {problem.decisionStatement?.slice(0,80)}{problem.decisionStatement?.length>80?"…":""}
                </div>
                <div style={{ display:"flex", gap:16, alignItems:"center", flexWrap:"wrap" }}>
                  <div style={{ fontSize:13, color:DS.inkSub }}>Owner: {problem.owner||"—"}</div>
                  <div style={{ fontSize:13, color:DS.inkSub }}>Deadline: {problem.deadline||"—"}</div>
                  <div style={{ marginLeft:"auto" }}>
                    <span style={{ fontSize:28, fontWeight:700,
                      fontFamily:"'Libre Baskerville',Georgia,serif",
                      color:scoreColor(overall) }}>{overall}</span>
                    <span style={{ fontSize:13, color:DS.inkTer }}>/100 DQ Score</span>
                  </div>
                </div>
              </div>

              {/* Overall verdict */}
              <div style={{ marginBottom:24, padding:"18px 22px",
                background:overall>=70?DS.successSoft:overall>=45?DS.warnSoft:DS.dangerSoft,
                border:`1.5px solid ${overall>=70?DS.successLine:overall>=45?DS.warnLine:DS.dangerLine}`,
                borderRadius:10 }}>
                <div style={{ fontSize:10, fontWeight:700,
                  color:overall>=70?DS.success:overall>=45?DS.warning:DS.danger,
                  letterSpacing:.8, textTransform:"uppercase", marginBottom:8 }}>
                  Overall Verdict
                </div>
                <div style={{ fontFamily:"'Libre Baskerville',Georgia,serif", fontSize:17,
                  fontWeight:700, color:DS.ink, lineHeight:1.4, marginBottom:8 }}>
                  {narrative.overallVerdict}
                </div>
                <div style={{ fontSize:13, color:DS.ink, fontWeight:600 }}>
                  {narrative.readinessStatement}
                </div>
                <div style={{ marginTop:12 }}>
                  <Badge variant={narrative.decidingNow==="yes"?"green":narrative.decidingNow==="no"?"danger":"warn"}>
                    {narrative.decidingNow==="yes"?"✓ Ready to decide":
                     narrative.decidingNow==="no"?"✗ Not ready to decide":
                     "⚠ Conditional — see note"}
                  </Badge>
                  {narrative.conditionalNote && (
                    <div style={{ fontSize:12, color:DS.inkSub, marginTop:8, fontStyle:"italic" }}>
                      Condition: {narrative.conditionalNote}
                    </div>
                  )}
                </div>
              </div>

              {/* Element narratives */}
              <div style={{ marginBottom:24 }}>
                <div style={{ fontFamily:"'Libre Baskerville',Georgia,serif", fontSize:16,
                  fontWeight:700, color:DS.ink, marginBottom:16 }}>Element Assessment</div>
                <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
                  {DQ_ELEMENTS.map(el => {
                    const s      = getScore(el.key);
                    const text   = narrative.elementNarratives?.[el.key];
                    const isWeak = el.key===weakest.key && s>0;
                    return (
                      <div key={el.key} style={{ padding:"14px 16px", borderRadius:8,
                        border:`1px solid ${isWeak?DS.dangerLine:DS.canvasBdr}`,
                        background:isWeak?DS.dangerSoft+"40":DS.canvas,
                        display:"flex", gap:14 }}>
                        <div style={{ display:"flex", flexDirection:"column", alignItems:"center", gap:6, flexShrink:0, width:52 }}>
                          <span style={{ fontSize:18 }}>{el.icon}</span>
                          <span style={{ fontSize:14, fontWeight:700,
                            fontFamily:"'Libre Baskerville',Georgia,serif",
                            color:s>0?scoreColor(s):DS.inkDis }}>{s||"—"}</span>
                        </div>
                        <div style={{ flex:1 }}>
                          <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:5 }}>
                            <span style={{ fontSize:12, fontWeight:700, color:DS.ink }}>{el.label}</span>
                            {isWeak && <Badge variant="danger" size="xs">Weakest Link</Badge>}
                          </div>
                          <div style={{ fontSize:12, color:DS.inkSub, lineHeight:1.6 }}>
                            {text||"—"}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Weakest link deep dive */}
              {narrative.weakestLinkAnalysis && (
                <div style={{ marginBottom:24, padding:"18px 20px",
                  background:DS.dangerSoft, border:`1.5px solid ${DS.dangerLine}`, borderRadius:10 }}>
                  <div style={{ fontSize:10, fontWeight:700, color:DS.danger,
                    letterSpacing:.8, textTransform:"uppercase", marginBottom:8 }}>
                    Weakest Link Deep Dive — {weakest.label}
                  </div>
                  <div style={{ fontSize:13, color:DS.ink, lineHeight:1.7 }}>
                    {narrative.weakestLinkAnalysis}
                  </div>
                </div>
              )}

              {/* Priority actions */}
              {narrative.priorityActions?.length > 0 && (
                <div style={{ marginBottom:24 }}>
                  <div style={{ fontFamily:"'Libre Baskerville',Georgia,serif", fontSize:16,
                    fontWeight:700, color:DS.ink, marginBottom:14 }}>Priority Actions</div>
                  <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
                    {narrative.priorityActions.map((a,i) => {
                      const el = DQ_ELEMENTS.find(e=>e.key===a.element);
                      return (
                        <div key={i} style={{ padding:"12px 16px", borderRadius:8,
                          background:DS.canvas, border:`1px solid ${DS.canvasBdr}`,
                          display:"flex", alignItems:"flex-start", gap:12 }}>
                          <div style={{ width:24, height:24, borderRadius:6, flexShrink:0,
                            background:urgencyColor[a.urgency]||DS.accent,
                            display:"flex", alignItems:"center", justifyContent:"center",
                            fontSize:11, fontWeight:700, color:"#fff" }}>
                            {i+1}
                          </div>
                          <div style={{ flex:1 }}>
                            <div style={{ fontSize:13, color:DS.ink, lineHeight:1.5, marginBottom:5 }}>
                              {a.action}
                            </div>
                            <div style={{ display:"flex", gap:6 }}>
                              {el && <Badge variant="default" size="xs">{el.icon} {el.label}</Badge>}
                              <Badge variant={a.urgency==="immediate"?"danger":a.urgency==="before-deciding"?"warn":"green"} size="xs">
                                {urgencyLabel[a.urgency]||a.urgency}
                              </Badge>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Strengths + facilitator recommendation */}
              <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:14, marginBottom:20 }}>
                {narrative.strengthsToPreserve?.length > 0 && (
                  <div style={{ padding:"16px 18px", background:DS.successSoft,
                    border:`1px solid ${DS.successLine}`, borderRadius:8 }}>
                    <div style={{ fontSize:10, fontWeight:700, color:DS.success,
                      letterSpacing:.8, textTransform:"uppercase", marginBottom:8 }}>
                      Strengths to Preserve
                    </div>
                    {narrative.strengthsToPreserve.map((s,i)=>(
                      <div key={i} style={{ fontSize:12, color:DS.ink, marginBottom:5,
                        display:"flex", gap:7 }}>
                        <span style={{ color:DS.success }}>✓</span>{s}
                      </div>
                    ))}
                  </div>
                )}
                {narrative.facilitatorRecommendation && (
                  <div style={{ padding:"16px 18px", background:DS.accentSoft,
                    border:`1px solid ${DS.accentLine}`, borderRadius:8 }}>
                    <div style={{ fontSize:10, fontWeight:700, color:DS.accent,
                      letterSpacing:.8, textTransform:"uppercase", marginBottom:8 }}>
                      Facilitator Recommendation
                    </div>
                    <div style={{ fontSize:12, color:DS.ink, lineHeight:1.6 }}>
                      {narrative.facilitatorRecommendation}
                    </div>
                  </div>
                )}
              </div>

            </div>
          )}
        </div>
      )}
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────────────────
   MODULE 07 — EXPORT & REPORT
───────────────────────────────────────────────────────────────────────────── */

function ModuleExport({ problem, issues, decisions, criteria, strategies, assessmentScores,
  dqScores, brief, narrative, aiCall, aiBusy, onAIMsg }) {

  const [generating, setGenerating]     = useState(false);
  const [executivePack, setExecutivePack] = useState(null);
  const [copying, setCopying]           = useState(null);

  const focusDecisions = decisions.filter(d=>d.tier==="focus");

  const scoreColor = (s) => s>=70?"#059669":s>=45?"#d97706":"#dc2626";

  // ── BUILD FULL EXPORT PACK ────────────────────────────────────────────────────
  const generatePack = () => {
    setGenerating(true);

    const strategyPaths = strategies.map(s => {
      const path = focusDecisions.map(d => {
        const idx = s.selections?.[d.id];
        return idx !== undefined ? `${d.label} → ${d.choices[idx]}` : `${d.label} → ?`;
      }).join(" | ");
      return `${DS.sNames[s.colorIdx]||s.name}: ${path}`;
    }).join("\\n");

    const dqSummary = DQ_ELEMENTS.map(e =>
      `${e.label}: ${dqScores[e.key]||0}/100`
    ).join(" | ");

    aiCall(dqPrompt(`You are a senior Decision Quality consultant preparing a complete executive decision package.

Decision: "${problem.decisionStatement}"
Owner: ${problem.owner} | Deadline: ${problem.deadline}
Context: ${problem.context}
Success criteria: ${problem.successCriteria}

Issues raised: ${issues.length} (${issues.filter(i=>i.severity==="Critical").length} critical)
Focus decisions: ${focusDecisions.map(d=>d.label).join(", ")}
Strategies compared:
${strategyPaths}

Criteria: ${criteria.map(c=>c.label).join(", ")}
DQ Scores: ${dqSummary}
${brief?.recommendedStrategyName ? `Recommended strategy: ${brief.recommendedStrategyName}` : ""}

Produce a complete executive decision package. Be specific, direct, and authoritative.

Return ONLY valid JSON:
{
  "executiveSummary": {
    "onePager": "Complete executive summary in 4-5 paragraphs — situation, decision, alternatives, recommendation, next step",
    "bulletPoints": ["Key point 1", "Key point 2", "Key point 3", "Key point 4", "Key point 5"],
    "tweetVersion": "The decision in 280 characters or fewer"
  },
  "decisionPackage": {
    "problemStatement": "Crisp 2-sentence problem statement",
    "whyNow": "Why this decision cannot be deferred",
    "whatIsAtStake": "What is won or lost by this decision",
    "constraints": "Hard constraints in one sentence",
    "recommendation": "The recommended course of action in 2 sentences",
    "keyRisks": ["Risk 1", "Risk 2", "Risk 3"],
    "successMetrics": ["Metric 1", "Metric 2", "Metric 3"],
    "decisionCriteria": "How the recommendation was evaluated"
  },
  "boardNarrative": "A board-ready narrative — 6-8 sentences covering the situation, the options considered, the recommended direction, the key trade-off, the critical assumption, and the requested action from the board",
  "stakeholderMessages": {
    "board": "2-sentence message for the board",
    "executiveTeam": "2-sentence message for the exec team",
    "projectTeam": "2-sentence message for the execution team"
  },
  "riskRegister": [
    {"risk": "risk description", "likelihood": "High|Medium|Low", "impact": "High|Medium|Low", "mitigation": "mitigation action"}
  ],
  "nextSteps": [
    {"action": "specific next action", "owner": "role", "deadline": "timeframe", "dependency": "what it depends on"}
  ]
}`),
    (r) => {
      if (!r.error) {
        setExecutivePack(r);
        onAIMsg({ role:"ai", text:"Executive package generated. All export formats are now available." });
      }
      setGenerating(false);
    });
  };

  const copyToClipboard = async (text, id) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopying(id);
      setTimeout(() => setCopying(null), 2000);
    } catch {}
  };

  const CopyBtn = ({ text, id, label="Copy" }) => (
    <button onClick={() => copyToClipboard(text, id)}
      style={{ padding:"5px 11px", fontSize:11, fontWeight:700, border:`1px solid ${DS.canvasBdr}`,
        borderRadius:5, background:copying===id?DS.successSoft:"transparent",
        color:copying===id?DS.success:DS.inkSub, cursor:"pointer",
        fontFamily:"inherit", transition:"all .15s",
        display:"flex", alignItems:"center", gap:5 }}>
      {copying===id ? <><Svg path={ICONS.check} size={12} color={DS.success}/> Copied!</> : label}
    </button>
  );

  // Platform completion snapshot
  const completionItems = [
    { label:"Problem Definition",     done: problem.decisionStatement?.length > 20,    note:`${problem.owner||"No owner set"}` },
    { label:"Issues Raised",          done: issues.length > 0,                          note:`${issues.length} issues · ${issues.filter(i=>i.severity==="Critical").length} critical` },
    { label:"Decision Hierarchy",     done: focusDecisions.length > 0,                  note:`${focusDecisions.length} focus decisions · ${criteria.length} criteria` },
    { label:"Strategy Table",         done: strategies.some(s=>Object.keys(s.selections||{}).length>0), note:`${strategies.length} strategies` },
    { label:"Qualitative Assessment", done: Object.keys(assessmentScores).length > 0,   note:`${Object.keys(assessmentScores).length} scores recorded` },
    { label:"DQ Scorecard",           done: Object.values(dqScores).some(s=>s>0),       note:Object.values(dqScores).some(s=>s>0)?`Overall: ${Math.round(DQ_ELEMENTS.reduce((s,e)=>s+(dqScores[e.key]||0),0)/DQ_ELEMENTS.length)}/100`:"Not scored" },
  ];
  const completionPct = Math.round((completionItems.filter(i=>i.done).length / completionItems.length) * 100);

  return (
    <div style={{ display:"flex", flexDirection:"column", height:"100%" }}>

      {/* Header */}
      <div style={{ padding:"16px 28px", background:DS.canvas, borderBottom:`1px solid ${DS.canvasBdr}`,
        display:"flex", alignItems:"center", gap:12, flexShrink:0, flexWrap:"wrap" }}>
        <div style={{ flex:1 }}>
          <div style={{ fontSize:11, color:DS.inkTer, letterSpacing:1, textTransform:"uppercase", fontWeight:700, marginBottom:3 }}>Module 07</div>
          <div style={{ fontFamily:"'Libre Baskerville', Georgia, serif", fontSize:22, fontWeight:700, color:DS.ink, letterSpacing:-.3 }}>Export & Report</div>
        </div>
        <Badge variant={completionPct===100?"green":completionPct>60?"warn":"default"}>
          {completionPct}% complete
        </Badge>
        <Btn variant="primary" icon="spark" onClick={generatePack}
          disabled={aiBusy||generating||completionPct<50}>
          {generating?"Building Package…":"Generate Executive Package"}
        </Btn>
      </div>

      <div style={{ flex:1, overflowY:"auto", padding:"24px 28px" }}>
        <div style={{ maxWidth:900, margin:"0 auto" }}>

          {/* Project identity banner */}
          <div style={{ marginBottom:24, padding:"18px 22px",
            background:`linear-gradient(135deg, ${DS.ink} 0%, ${DS.chromeSub} 100%)`,
            borderRadius:10, border:`1px solid ${DS.border}` }}>
            <div style={{ display:"flex", alignItems:"flex-start", gap:20 }}>
              <div style={{ flex:1 }}>
                <div style={{ fontSize:9, color:DS.textTer, letterSpacing:1.5,
                  textTransform:"uppercase", marginBottom:5 }}>Vantage DQ · Decision Package</div>
                <div style={{ fontFamily:"'Libre Baskerville',Georgia,serif", fontSize:20,
                  fontWeight:700, color:DS.textPri, marginBottom:6, lineHeight:1.25 }}>
                  {problem.projectName || problem.decisionStatement?.slice(0,60) || "Untitled"}
                </div>
                <div style={{ display:"flex", gap:7, flexWrap:"wrap", marginBottom:8 }}>
                  {problem.projectCode && <Badge variant="chrome">{problem.projectCode}</Badge>}
                  {problem.client && <span style={{ fontSize:11, color:DS.textSec }}>{problem.client}</span>}
                  {problem.sector && <Badge variant="blue">{problem.sector.split("/")[0].trim()}</Badge>}
                  {problem.decisionType && <Badge variant="chrome">{problem.decisionType}</Badge>}
                  {problem.confidentiality && (
                    <Badge variant={problem.confidentiality==="Strictly Confidential"?"danger":
                      problem.confidentiality==="Confidential"?"warn":"default"}>
                      {problem.confidentiality}
                    </Badge>
                  )}
                </div>
              </div>
              <div style={{ textAlign:"right", flexShrink:0, minWidth:130 }}>
                {problem.facilitator && (
                  <div style={{ marginBottom:8 }}>
                    <div style={{ fontSize:9, color:DS.textTer, marginBottom:2 }}>Facilitator</div>
                    <div style={{ fontSize:12, fontWeight:600, color:DS.textSec }}>{problem.facilitator}</div>
                  </div>
                )}
                {problem.sessionDate && (
                  <div style={{ marginBottom:8 }}>
                    <div style={{ fontSize:9, color:DS.textTer, marginBottom:2 }}>Session Date</div>
                    <div style={{ fontSize:12, fontWeight:600, color:DS.textSec }}>
                      {new Date(problem.sessionDate).toLocaleDateString("en-GB",{day:"numeric",month:"short",year:"numeric"})}
                    </div>
                  </div>
                )}
                {problem.owner && (
                  <div>
                    <div style={{ fontSize:9, color:DS.textTer, marginBottom:2 }}>Decision Owner</div>
                    <div style={{ fontSize:12, fontWeight:600, color:DS.textSec }}>{problem.owner}</div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Completion checklist */}
          <div style={{ marginBottom:28 }}>
            <div style={{ fontSize:13, fontWeight:700, color:DS.ink, marginBottom:14,
              fontFamily:"'Libre Baskerville',Georgia,serif" }}>
              Platform Completion
            </div>
            <div style={{ border:`1px solid ${DS.canvasBdr}`, borderRadius:9, overflow:"hidden" }}>
              {completionItems.map((item, i) => (
                <div key={i} style={{ padding:"11px 16px", display:"flex", alignItems:"center", gap:12,
                  borderTop: i>0?`1px solid ${DS.canvasBdr}`:"none",
                  background:item.done?DS.canvas:DS.canvasAlt }}>
                  <div style={{ width:22, height:22, borderRadius:5, flexShrink:0,
                    background:item.done?DS.success:DS.canvasBdr,
                    display:"flex", alignItems:"center", justifyContent:"center" }}>
                    {item.done
                      ? <Svg path={ICONS.check} size={12} color="#fff" sw={2.5}/>
                      : <span style={{ fontSize:9, color:DS.inkTer }}>○</span>}
                  </div>
                  <div style={{ flex:1 }}>
                    <span style={{ fontSize:12, fontWeight:700,
                      color:item.done?DS.ink:DS.inkTer }}>{item.label}</span>
                  </div>
                  <span style={{ fontSize:11, color:DS.inkSub }}>{item.note}</span>
                </div>
              ))}
              <div style={{ padding:"10px 16px", background:DS.ink, borderTop:`1px solid ${DS.border}`,
                display:"flex", alignItems:"center", gap:12 }}>
                <div style={{ flex:1, height:5, background:DS.border, borderRadius:3, overflow:"hidden" }}>
                  <div style={{ width:`${completionPct}%`, height:"100%", borderRadius:3,
                    background:`linear-gradient(90deg, ${DS.accent}, #60a5fa)`,
                    transition:"width .5s" }}/>
                </div>
                <span style={{ fontSize:11, fontWeight:700, color:DS.textSec }}>{completionPct}% complete</span>
              </div>
            </div>
          </div>

          {/* Export formats */}
          {!executivePack ? (
            <div style={{ padding:"48px 40px", textAlign:"center", border:`1.5px dashed ${DS.canvasMid}`,
              borderRadius:10, color:DS.inkTer }}>
              <div style={{ fontSize:32, marginBottom:12 }}>📋</div>
              <div style={{ fontSize:14, marginBottom:6, color:DS.ink, fontWeight:600 }}>
                Generate the Executive Package
              </div>
              <div style={{ fontSize:12, marginBottom:20, lineHeight:1.6 }}>
                Produces a complete decision brief, board narrative, stakeholder messages,
                risk register, and next steps — ready to copy or present.
              </div>
              <Btn variant="primary" icon="spark" size="lg" onClick={generatePack}
                disabled={aiBusy||generating||completionPct<50}>
                {generating?"Building…":"Generate Executive Package"}
              </Btn>
              {completionPct < 50 && (
                <div style={{ fontSize:11, color:DS.danger, marginTop:10 }}>
                  Complete at least 3 modules before generating the package.
                </div>
              )}
            </div>
          ) : (
            <div style={{ display:"flex", flexDirection:"column", gap:16 }}>

              {/* Tweet version */}
              {executivePack.executiveSummary?.tweetVersion && (
                <div style={{ padding:"16px 20px", background:"#eff9ff",
                  border:`1px solid #bae6fd`, borderRadius:9 }}>
                  <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:8 }}>
                    <div style={{ fontSize:10, fontWeight:700, color:"#0369a1",
                      letterSpacing:.8, textTransform:"uppercase" }}>Decision in One Sentence</div>
                    <CopyBtn text={executivePack.executiveSummary.tweetVersion} id="tweet" label="Copy"/>
                  </div>
                  <div style={{ fontSize:14, color:DS.ink, lineHeight:1.6, fontStyle:"italic",
                    fontFamily:"'Libre Baskerville',Georgia,serif" }}>
                    "{executivePack.executiveSummary.tweetVersion}"
                  </div>
                </div>
              )}

              {/* Board narrative */}
              {executivePack.boardNarrative && (
                <div style={{ border:`1px solid ${DS.canvasBdr}`, borderRadius:9, overflow:"hidden" }}>
                  <div style={{ padding:"11px 16px", background:DS.canvasAlt,
                    borderBottom:`1px solid ${DS.canvasBdr}`,
                    display:"flex", alignItems:"center", justifyContent:"space-between" }}>
                    <div style={{ fontSize:11, fontWeight:700, color:DS.ink }}>📋 Board Narrative</div>
                    <CopyBtn text={executivePack.boardNarrative} id="board"/>
                  </div>
                  <div style={{ padding:"18px 20px", fontSize:13, color:DS.ink, lineHeight:1.8 }}>
                    {executivePack.boardNarrative}
                  </div>
                </div>
              )}

              {/* Executive summary */}
              {executivePack.executiveSummary?.onePager && (
                <div style={{ border:`1px solid ${DS.canvasBdr}`, borderRadius:9, overflow:"hidden" }}>
                  <div style={{ padding:"11px 16px", background:DS.canvasAlt,
                    borderBottom:`1px solid ${DS.canvasBdr}`,
                    display:"flex", alignItems:"center", justifyContent:"space-between" }}>
                    <div style={{ fontSize:11, fontWeight:700, color:DS.ink }}>📄 Executive Summary</div>
                    <CopyBtn text={executivePack.executiveSummary.onePager} id="exec"/>
                  </div>
                  <div style={{ padding:"18px 20px", fontSize:13, color:DS.ink, lineHeight:1.8,
                    whiteSpace:"pre-wrap" }}>
                    {executivePack.executiveSummary.onePager}
                  </div>
                </div>
              )}

              {/* Key bullets */}
              {executivePack.executiveSummary?.bulletPoints?.length > 0 && (
                <div style={{ border:`1px solid ${DS.canvasBdr}`, borderRadius:9, overflow:"hidden" }}>
                  <div style={{ padding:"11px 16px", background:DS.canvasAlt,
                    borderBottom:`1px solid ${DS.canvasBdr}`,
                    display:"flex", alignItems:"center", justifyContent:"space-between" }}>
                    <div style={{ fontSize:11, fontWeight:700, color:DS.ink }}>⚡ Key Points (Slide Ready)</div>
                    <CopyBtn text={executivePack.executiveSummary.bulletPoints.map((b,i)=>`${i+1}. ${b}`).join("\n")} id="bullets"/>
                  </div>
                  <div style={{ padding:"14px 20px" }}>
                    {executivePack.executiveSummary.bulletPoints.map((b,i)=>(
                      <div key={i} style={{ display:"flex", gap:10, marginBottom:8 }}>
                        <span style={{ width:22, height:22, borderRadius:5,
                          background:DS.accent, color:"#fff", fontSize:11, fontWeight:700,
                          display:"inline-flex", alignItems:"center", justifyContent:"center",
                          flexShrink:0 }}>{i+1}</span>
                        <span style={{ fontSize:13, color:DS.ink, lineHeight:1.5 }}>{b}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Stakeholder messages */}
              {executivePack.stakeholderMessages && (
                <div style={{ border:`1px solid ${DS.canvasBdr}`, borderRadius:9, overflow:"hidden" }}>
                  <div style={{ padding:"11px 16px", background:DS.canvasAlt,
                    borderBottom:`1px solid ${DS.canvasBdr}` }}>
                    <div style={{ fontSize:11, fontWeight:700, color:DS.ink }}>💬 Stakeholder Messages</div>
                  </div>
                  <div style={{ padding:"14px 20px", display:"grid",
                    gridTemplateColumns:"1fr 1fr 1fr", gap:12 }}>
                    {[
                      { key:"board",         label:"Board",          icon:"🏛" },
                      { key:"executiveTeam",  label:"Executive Team", icon:"👔" },
                      { key:"projectTeam",    label:"Project Team",   icon:"⚙" },
                    ].map(({ key, label, icon }) => {
                      const msg = executivePack.stakeholderMessages[key];
                      return msg ? (
                        <div key={key} style={{ padding:"12px 14px", background:DS.canvasAlt,
                          borderRadius:7, border:`1px solid ${DS.canvasBdr}` }}>
                          <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:6 }}>
                            <div style={{ fontSize:11, fontWeight:700, color:DS.ink }}>
                              {icon} {label}
                            </div>
                            <CopyBtn text={msg} id={`msg-${key}`} label="Copy"/>
                          </div>
                          <div style={{ fontSize:12, color:DS.inkSub, lineHeight:1.55 }}>{msg}</div>
                        </div>
                      ) : null;
                    })}
                  </div>
                </div>
              )}

              {/* Risk register */}
              {executivePack.riskRegister?.length > 0 && (
                <div style={{ border:`1px solid ${DS.canvasBdr}`, borderRadius:9, overflow:"hidden" }}>
                  <div style={{ padding:"11px 16px", background:DS.canvasAlt,
                    borderBottom:`1px solid ${DS.canvasBdr}` }}>
                    <div style={{ fontSize:11, fontWeight:700, color:DS.ink }}>⚠ Risk Register</div>
                  </div>
                  <table style={{ width:"100%", borderCollapse:"collapse" }}>
                    <thead>
                      <tr style={{ background:DS.canvasAlt }}>
                        {["Risk","Likelihood","Impact","Mitigation"].map(h=>(
                          <th key={h} style={{ padding:"8px 14px", textAlign:"left",
                            fontSize:10, fontWeight:700, color:DS.inkTer, letterSpacing:.6,
                            textTransform:"uppercase", borderBottom:`1px solid ${DS.canvasBdr}` }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {executivePack.riskRegister.map((r,i)=>(
                        <tr key={i} style={{ borderTop:i>0?`1px solid ${DS.canvasBdr}`:"none",
                          background:i%2===0?DS.canvas:DS.canvasAlt }}>
                          <td style={{ padding:"10px 14px", fontSize:12, color:DS.ink }}>{r.risk}</td>
                          <td style={{ padding:"10px 14px" }}>
                            <Badge variant={r.likelihood==="High"?"danger":r.likelihood==="Medium"?"warn":"default"} size="xs">{r.likelihood}</Badge>
                          </td>
                          <td style={{ padding:"10px 14px" }}>
                            <Badge variant={r.impact==="High"?"danger":r.impact==="Medium"?"warn":"default"} size="xs">{r.impact}</Badge>
                          </td>
                          <td style={{ padding:"10px 14px", fontSize:11, color:DS.inkSub }}>{r.mitigation}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {/* Next steps */}
              {executivePack.nextSteps?.length > 0 && (
                <div style={{ border:`1px solid ${DS.canvasBdr}`, borderRadius:9, overflow:"hidden" }}>
                  <div style={{ padding:"11px 16px", background:DS.canvasAlt,
                    borderBottom:`1px solid ${DS.canvasBdr}` }}>
                    <div style={{ fontSize:11, fontWeight:700, color:DS.ink }}>→ Next Steps</div>
                  </div>
                  <div style={{ padding:"14px 20px", display:"flex", flexDirection:"column", gap:8 }}>
                    {executivePack.nextSteps.map((step,i)=>(
                      <div key={i} style={{ padding:"12px 14px", background:DS.canvas,
                        border:`1px solid ${DS.canvasBdr}`, borderRadius:7,
                        display:"grid", gridTemplateColumns:"24px 1fr auto", gap:12, alignItems:"start" }}>
                        <div style={{ width:24, height:24, borderRadius:5, background:DS.accent,
                          display:"flex", alignItems:"center", justifyContent:"center",
                          fontSize:11, fontWeight:700, color:"#fff" }}>{i+1}</div>
                        <div>
                          <div style={{ fontSize:12, fontWeight:700, color:DS.ink, marginBottom:3 }}>{step.action}</div>
                          <div style={{ fontSize:11, color:DS.inkSub }}>
                            Owner: {step.owner} · {step.deadline}
                            {step.dependency && ` · Depends on: ${step.dependency}`}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Regenerate */}
              <div style={{ display:"flex", justifyContent:"flex-end", paddingTop:8 }}>
                <Btn variant="secondary" icon="spark" onClick={generatePack} disabled={aiBusy||generating}>
                  Regenerate Package
                </Btn>
              </div>

            </div>
          )}
        </div>
      </div>
    </div>
  );
}


/* ─────────────────────────────────────────────────────────────────────────────
   PHASE 2 — MODULE 08: INFLUENCE MAP & UNCERTAINTY ANALYSIS
───────────────────────────────────────────────────────────────────────────── */

const IMPACT_LEVELS      = ["Critical","High","Medium","Low"];
const CONTROL_LEVELS     = ["High Control","Some Control","Low Control","No Control"];
const UNCERTAINTY_TYPES  = ["Market","Regulatory","Technical","Financial","Competitive","Operational","Political","Stakeholder"];

function ModuleInfluenceMap({ issues, decisions, strategies, aiCall, aiBusy, onAIMsg, problem }) {
  // ── Node types per spec ───────────────────────────────────────────────────
  const NODE_TYPES = {
    decision:      { label:"Decision",      shape:"rect",    color:"#2563eb", bg:"#eff4ff", border:"#bfcfff", icon:"▣", desc:"A controllable choice" },
    uncertainty:   { label:"Uncertainty",   shape:"oval",    color:"#d97706", bg:"#fffbeb", border:"#fde68a", icon:"◎", desc:"An unknown variable" },
    value:         { label:"Value / Outcome", shape:"diamond", color:"#059669", bg:"#ecfdf5", border:"#a7f3d0", icon:"◆", desc:"An objective or result" },
    deterministic: { label:"Deterministic", shape:"hex",     color:"#7c3aed", bg:"#f5f3ff", border:"#ddd6fe", icon:"⬡", desc:"A calculated relationship" },
  };

  // ── State ─────────────────────────────────────────────────────────────────
  const [view, setView]             = useState("diagram"); // diagram | matrix | metadata | validate
  const [nodes, setNodes]           = useState([]);
  const [edges, setEdges]           = useState([]);
  const [selected, setSelected]     = useState(null);     // node id
  const [linkMode, setLinkMode]     = useState(false);
  const [linkSource, setLinkSource] = useState(null);
  const [addType, setAddType]       = useState("uncertainty");
  const [generating, setGenerating] = useState(false);
  const [validating, setValidating] = useState(false);
  const [validation, setValidation] = useState(null);
  const [metaOpen, setMetaOpen]     = useState(null);    // node id for metadata panel
  const [showAddPanel, setShowAddPanel] = useState(false);
  const [newNodeLabel, setNewNodeLabel] = useState("");

  // ── Drag ──────────────────────────────────────────────────────────────────
  const dragRef = useRef({ dragging:false, id:null, startX:0, startY:0, origX:0, origY:0 });

  const onMouseDown = (e, id) => {
    if (linkMode || e.button !== 0) return;
    e.preventDefault(); e.stopPropagation();
    const n = nodes.find(n=>n.id===id);
    if (!n) return;
    dragRef.current = { dragging:true, id, startX:e.clientX, startY:e.clientY, origX:n.x, origY:n.y };
  };

  const onMouseMove = (e) => {
    const d = dragRef.current;
    if (!d.dragging) return;
    setNodes(prev=>prev.map(n=>n.id===d.id
      ? {...n, x:Math.max(20, d.origX+(e.clientX-d.startX)), y:Math.max(20, d.origY+(e.clientY-d.startY))}
      : n));
  };

  const onMouseUp = (e) => {
    const d = dragRef.current;
    if (!d.dragging) return;
    const dx = Math.abs(e.clientX-d.startX), dy = Math.abs(e.clientY-d.startY);
    if (dx < 5 && dy < 5) {
      if (linkMode) handleLink(d.id);
      else setSelected(sel=>sel===d.id?null:d.id);
    }
    dragRef.current = {...dragRef.current, dragging:false};
  };

  // ── Link logic ────────────────────────────────────────────────────────────
  const handleLink = (targetId) => {
    if (!linkSource) { setLinkSource(targetId); return; }
    if (linkSource === targetId) { setLinkSource(null); return; }

    // Validate: value nodes cannot influence upstream
    const src = nodes.find(n=>n.id===linkSource);
    const tgt = nodes.find(n=>n.id===targetId);
    if (src?.type === "value") {
      onAIMsg({ role:"ai", text:"Value/Outcome nodes cannot influence other nodes — they are terminal. Reverse the arrow direction." });
      setLinkSource(null); return;
    }
    // Prevent duplicate edges
    if (edges.find(e=>e.from===linkSource&&e.to===targetId)) {
      setLinkSource(null); return;
    }
    // Prevent circular dependencies (simple check)
    const wouldCycle = (from, to) => {
      const visited = new Set();
      const dfs = (id) => {
        if (id === from) return true;
        if (visited.has(id)) return false;
        visited.add(id);
        return edges.filter(e=>e.from===id).some(e=>dfs(e.to));
      };
      return dfs(to);
    };
    if (wouldCycle(linkSource, targetId)) {
      onAIMsg({ role:"ai", text:"This link would create a circular dependency. Circular logic is not permitted in influence diagrams." });
      setLinkSource(null); return;
    }

    setEdges(prev=>[...prev, { id:uid("e"), from:linkSource, to:targetId, label:"influences" }]);
    setLinkSource(null);
  };

  // ── Node CRUD ─────────────────────────────────────────────────────────────
  const addNode = () => {
    const label = newNodeLabel.trim();
    if (!label) return;
    const nt = NODE_TYPES[addType];
    const n = {
      id: uid("n"), type: addType, label,
      x: 200 + Math.random()*400, y: 150 + Math.random()*300,
      description: "", owner: "", assumptions: "",
      impact: "High", control: "Low",
      tags: [],
    };
    setNodes(prev=>[...prev, n]);
    setNewNodeLabel("");
    setShowAddPanel(false);
    setSelected(n.id);
  };

  const updateNode = (id, patch) => setNodes(prev=>prev.map(n=>n.id===id?{...n,...patch}:n));
  const removeNode = (id) => {
    setNodes(prev=>prev.filter(n=>n.id!==id));
    setEdges(prev=>prev.filter(e=>e.from!==id&&e.to!==id));
    if (selected===id) setSelected(null);
    if (metaOpen===id) setMetaOpen(null);
  };

  // ── Seed from issues on first load ────────────────────────────────────────
  useEffect(()=>{
    if (nodes.length > 0) return;
    const uncertainIssues = issues.filter(i=>
      i.category==="uncertainty-external"||i.category==="uncertainty-internal"
    );
    if (uncertainIssues.length > 0) {
      setNodes(uncertainIssues.slice(0,8).map((i,idx)=>({
        id: uid("n"), type:"uncertainty",
        label: i.text.length>60?i.text.slice(0,60)+"…":i.text,
        description: i.text, owner:"", assumptions:"",
        impact: i.severity==="Critical"||i.severity==="High"?"High":"Medium",
        control: i.category==="uncertainty-external"?"Low":"Medium",
        tags:[], x:180+idx%4*220, y:120+Math.floor(idx/4)*200,
      })));
    }
  }, [issues.length]);

  // ── Validation engine ─────────────────────────────────────────────────────
  const runValidation = () => {
    const issues_found = [];
    // Orphan nodes (no edges at all)
    nodes.forEach(n=>{
      const connected = edges.some(e=>e.from===n.id||e.to===n.id);
      if (!connected) issues_found.push({ type:"orphan", node:n.label, msg:"Node has no connections — either link it or remove it." });
    });
    // Value nodes with no incoming
    nodes.filter(n=>n.type==="value").forEach(n=>{
      const hasIncoming = edges.some(e=>e.to===n.id);
      if (!hasIncoming) issues_found.push({ type:"disconnected-value", node:n.label, msg:"Value node has no incoming influences — what drives this outcome?" });
    });
    // Decision nodes with no outgoing
    nodes.filter(n=>n.type==="decision").forEach(n=>{
      const hasOutgoing = edges.some(e=>e.from===n.id);
      if (!hasOutgoing) issues_found.push({ type:"disconnected-decision", node:n.label, msg:"Decision node has no outgoing influence — what does this decision affect?" });
    });
    // Duplicate labels
    const labels = nodes.map(n=>n.label.toLowerCase());
    labels.forEach((l,i)=>{
      if (labels.indexOf(l)!==i) issues_found.push({ type:"duplicate", node:nodes[i].label, msg:"Duplicate node label detected." });
    });
    setValidation(issues_found);
  };

  // ── AI Generate ───────────────────────────────────────────────────────────
  const generateNodes = () => {
    setGenerating(true);
    const decList = decisions.filter(d=>d.tier==="focus").map(d=>d.label).join(", ");
    const stratList = strategies.map(s=>s.name).join(", ");
    const existing = nodes.map(n=>n.label).join(", ");

    aiCall(
      "You are a decision analyst building an influence diagram. " +
      "Decision: " + (problem?.decisionStatement||"") + ". " +
      "Focus decisions: " + (decList||"none") + ". " +
      "Strategies being considered: " + (stratList||"none") + ". " +
      "Existing nodes (do not duplicate): " + (existing||"none") + ". " +
      "Generate nodes for an influence diagram. Include a mix of: decision nodes (controllable choices), " +
      "uncertainty nodes (unknown variables), and value nodes (outcomes/objectives). " +
      "Suggest realistic influence edges between them. " +
      'Return ONLY JSON: {"nodes":[{"type":"uncertainty","label":"Oil Price","description":"Global crude oil price","impact":"High","control":"Low"}],' +
      '"edges":[{"from":"Oil Price","to":"Revenue","label":"influences"}],"insight":"Key observation"}',
    (r)=>{
      let result = r;
      if (r._raw) { try { result=JSON.parse(r._raw.replace(/```json|```/g,"").trim()); } catch(e) { setGenerating(false); return; } }
      if (result.nodes?.length) {
        const newNodes = result.nodes.map((n,i)=>({
          id:uid("n"), type:n.type||"uncertainty",
          label:n.label, description:n.description||"",
          owner:"", assumptions:"", tags:[],
          impact:n.impact||"Medium", control:n.control||"Low",
          x:150+i%4*220, y:120+Math.floor(i/4)*200,
        }));
        setNodes(prev=>[...prev, ...newNodes]);
        // Add suggested edges
        if (result.edges?.length) {
          const allNodes = [...nodes, ...newNodes];
          const newEdges = result.edges.map(e=>{
            const src = allNodes.find(n=>n.label.toLowerCase()===e.from?.toLowerCase());
            const tgt = allNodes.find(n=>n.label.toLowerCase()===e.to?.toLowerCase());
            return src&&tgt ? { id:uid("e"), from:src.id, to:tgt.id, label:e.label||"influences" } : null;
          }).filter(Boolean);
          setEdges(prev=>[...prev, ...newEdges]);
        }
        onAIMsg({ role:"ai", text: result.insight||("Added "+result.nodes.length+" nodes to the influence diagram.") });
      }
      setGenerating(false);
    });
  };

  // ── Canvas dimensions ─────────────────────────────────────────────────────
  const CANVAS_W = Math.max(1000, nodes.reduce((m,n)=>Math.max(m,n.x+240),1000));
  const CANVAS_H = Math.max(700,  nodes.reduce((m,n)=>Math.max(m,n.y+160),700));

  const selectedNode = nodes.find(n=>n.id===selected);

  // ── Node shape renderer ───────────────────────────────────────────────────
  const NodeShape = ({node}) => {
    const nt = NODE_TYPES[node.type]||NODE_TYPES.uncertainty;
    const isSel = selected===node.id;
    const isSrc = linkSource===node.id;
    const W = 180, H = node.type==="value"?60:52;

    const baseStyle = {
      position:"absolute", left:node.x, top:node.y, width:W,
      cursor: linkMode?"crosshair":dragRef.current.dragging&&dragRef.current.id===node.id?"grabbing":"grab",
      userSelect:"none", zIndex:isSel||isSrc?10:1,
    };

    const boxStyle = {
      padding:"10px 13px",
      background: isSrc?nt.color:nt.bg,
      border:"2px solid "+(isSel||isSrc?nt.color:nt.border),
      borderRadius: node.type==="uncertainty"?"50px": node.type==="value"?"0":8,
      boxShadow: isSel?"0 0 0 3px "+nt.border+"80":"0 2px 8px rgba(0,0,0,.08)",
      transform: node.type==="value"?"rotate(-2deg) skewX(-5deg)":"none",
      transition:"box-shadow .12s",
    };

    return (
      <div style={baseStyle}
        onMouseDown={e=>onMouseDown(e,node.id)}
        onClick={e=>{ if(linkMode){e.stopPropagation();handleLink(node.id);} }}>
        <div style={boxStyle}>
          <div style={{ display:"flex", alignItems:"center", gap:6, marginBottom:3 }}>
            <span style={{ fontSize:11, color:isSrc?"#fff":nt.color, flexShrink:0 }}>{nt.icon}</span>
            <span style={{ fontSize:11, fontWeight:700,
              color:isSrc?"#fff":nt.color, flex:1, lineHeight:1.25 }}>
              {node.label}
            </span>
          </div>
          <div style={{ fontSize:9, color:isSrc?"rgba(255,255,255,.7)":"#6b7280",
            textTransform:"uppercase", letterSpacing:.5 }}>
            {nt.label}
            {node.type==="uncertainty" && " · "+node.impact+" impact"}
          </div>
          {/* Drag handle dots */}
          <div style={{ position:"absolute", top:5, right:6, display:"flex", gap:2, opacity:.3 }}>
            {[0,1].map(i=><div key={i} style={{ display:"flex", flexDirection:"column", gap:2 }}>
              {[0,1].map(j=><div key={j} style={{ width:2,height:2,borderRadius:"50%",background:nt.color }}/>)}
            </div>)}
          </div>
        </div>
        {/* Action buttons on select */}
        {isSel && !linkMode && (
          <div style={{ position:"absolute", top:-28, right:0,
            display:"flex", gap:4 }}>
            <button
              onMouseDown={e=>e.stopPropagation()}
              onClick={e=>{e.stopPropagation();setMetaOpen(node.id);}}
              style={{ padding:"2px 7px", fontSize:9, fontWeight:700,
                background:nt.color, border:"none", borderRadius:3,
                color:"#fff", cursor:"pointer", fontFamily:"inherit" }}>
              Edit
            </button>
            <button
              onMouseDown={e=>e.stopPropagation()}
              onClick={e=>{e.stopPropagation();removeNode(node.id);}}
              style={{ padding:"2px 7px", fontSize:9, fontWeight:700,
                background:"#dc2626", border:"none", borderRadius:3,
                color:"#fff", cursor:"pointer", fontFamily:"inherit" }}>
              ×
            </button>
          </div>
        )}
      </div>
    );
  };

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div style={{ display:"flex", flexDirection:"column", height:"100%", overflow:"hidden" }}>

      {/* Header */}
      <div style={{ padding:"14px 24px", background:DS.canvas,
        borderBottom:"1px solid "+DS.canvasBdr,
        display:"flex", alignItems:"center", gap:12,
        flexShrink:0, flexWrap:"wrap" }}>
        <div style={{ flex:1 }}>
          <div style={{ fontSize:10, color:DS.inkTer, letterSpacing:1,
            textTransform:"uppercase", fontWeight:700, marginBottom:2 }}>Phase 2 · Module 08</div>
          <div style={{ fontFamily:"'Libre Baskerville',Georgia,serif",
            fontSize:20, fontWeight:700, color:DS.ink }}>Influence Diagram</div>
        </div>

        {/* View tabs */}
        <div style={{ display:"flex", border:"1px solid "+DS.canvasBdr,
          borderRadius:7, overflow:"hidden" }}>
          {[
            { id:"diagram",  label:"Diagram" },
            { id:"matrix",   label:"Impact Matrix" },
            { id:"metadata", label:"Node List" },
            { id:"validate", label:"Validate" },
          ].map(v=>(
            <button key={v.id} onClick={()=>setView(v.id)}
              style={{ padding:"6px 12px", fontSize:11, fontWeight:700,
                fontFamily:"inherit", cursor:"pointer", border:"none",
                background:view===v.id?DS.accent:"transparent",
                color:view===v.id?"#fff":DS.inkSub,
                transition:"all .12s" }}>
              {v.label}
            </button>
          ))}
        </div>

        {/* Actions */}
        <Btn variant="secondary" size="sm" onClick={()=>setShowAddPanel(p=>!p)}>
          + Add Node
        </Btn>
        <Btn variant="secondary" size="sm"
          onClick={()=>{ setLinkMode(l=>!l); setLinkSource(null); }}
          style={{ background:linkMode?DS.accentSoft:"transparent",
            border:"1px solid "+(linkMode?DS.accent:DS.canvasBdr),
            color:linkMode?DS.accent:DS.inkSub }}>
          {linkMode?(linkSource?"Click target…":"Click source…"):"Draw Links"}
        </Btn>
        <Btn variant="secondary" size="sm" onClick={runValidation}>Validate</Btn>
        <Btn variant="primary" icon="spark" size="sm"
          onClick={generateNodes} disabled={aiBusy||generating}>
          {generating?"Generating…":"AI Generate"}
        </Btn>
      </div>

      {/* Add node panel */}
      {showAddPanel && (
        <div style={{ padding:"12px 24px", background:DS.accentSoft,
          borderBottom:"1px solid "+DS.accentLine,
          display:"flex", gap:10, alignItems:"center", flexWrap:"wrap" }}>
          <span style={{ fontSize:11, fontWeight:700, color:DS.accent }}>Node type:</span>
          {Object.entries(NODE_TYPES).map(([key,nt])=>(
            <button key={key} onClick={()=>setAddType(key)}
              style={{ padding:"4px 11px", fontSize:11, fontWeight:700,
                fontFamily:"inherit", cursor:"pointer",
                border:"1.5px solid "+(addType===key?nt.color:DS.canvasBdr),
                borderRadius:5, background:addType===key?nt.bg:"transparent",
                color:addType===key?nt.color:DS.inkSub,
                transition:"all .1s" }}>
              {nt.icon} {nt.label}
            </button>
          ))}
          <input
            autoFocus
            value={newNodeLabel}
            onChange={e=>setNewNodeLabel(e.target.value)}
            onKeyDown={e=>{ if(e.key==="Enter") addNode(); if(e.key==="Escape") setShowAddPanel(false); }}
            placeholder={"Label for new "+NODE_TYPES[addType].label.toLowerCase()+"..."}
            style={{ flex:1, minWidth:200, padding:"6px 11px", fontSize:12,
              fontFamily:"inherit", background:DS.canvas,
              border:"1px solid "+DS.accentLine, borderRadius:6,
              color:DS.ink, outline:"none" }}/>
          <Btn variant="primary" size="sm" onClick={addNode}>Add</Btn>
          <Btn variant="secondary" size="sm" onClick={()=>setShowAddPanel(false)}>Cancel</Btn>
        </div>
      )}

      {/* Validation results */}
      {validation && validation.length > 0 && (
        <div style={{ padding:"8px 24px", background:"#fff5f5",
          borderBottom:"1px solid #fecaca", display:"flex",
          gap:8, alignItems:"flex-start", flexWrap:"wrap" }}>
          <span style={{ fontSize:11, fontWeight:700, color:DS.danger, flexShrink:0 }}>
            ⚠ {validation.length} issue{validation.length!==1?"s":""}:
          </span>
          {validation.map((v,i)=>(
            <span key={i} style={{ fontSize:10, color:"#7f1d1d",
              background:"#fee2e2", padding:"2px 8px", borderRadius:3 }}>
              {v.node}: {v.msg}
            </span>
          ))}
          <button onClick={()=>setValidation(null)}
            style={{ marginLeft:"auto", background:"none", border:"none",
              cursor:"pointer", color:DS.danger, fontSize:12 }}>×</button>
        </div>
      )}
      {validation && validation.length === 0 && (
        <div style={{ padding:"8px 24px", background:DS.successSoft,
          borderBottom:"1px solid "+DS.successLine,
          fontSize:11, color:DS.success, fontWeight:700 }}>
          ✓ Diagram is structurally valid — no orphans, circular dependencies, or duplicate nodes detected.
          <button onClick={()=>setValidation(null)}
            style={{ marginLeft:16, background:"none", border:"none",
              cursor:"pointer", color:DS.success, fontSize:11 }}>Dismiss</button>
        </div>
      )}

      {/* Main content */}
      <div style={{ flex:1, overflow:"hidden", display:"flex" }}>

        {/* ── DIAGRAM VIEW ─────────────────────────────────────────── */}
        {view==="diagram" && (
          <div style={{ flex:1, overflow:"auto", background:"#f8f9fb",
            backgroundImage:"radial-gradient(circle, #d0d4e0 1px, transparent 1px)",
            backgroundSize:"24px 24px",
            position:"relative" }}
            onMouseMove={onMouseMove}
            onMouseUp={onMouseUp}
            onMouseLeave={onMouseUp}>
            <div style={{ position:"relative", width:CANVAS_W, height:CANVAS_H,
              minWidth:"100%", minHeight:"100%" }}>

              {/* SVG edges */}
              <svg style={{ position:"absolute", top:0, left:0,
                width:CANVAS_W, height:CANVAS_H, pointerEvents:"none" }}>
                <defs>
                  <marker id="arrowhead" markerWidth="10" markerHeight="7"
                    refX="9" refY="3.5" orient="auto">
                    <polygon points="0 0, 10 3.5, 0 7" fill={DS.accent} opacity=".7"/>
                  </marker>
                  <marker id="arrowhead-red" markerWidth="10" markerHeight="7"
                    refX="9" refY="3.5" orient="auto">
                    <polygon points="0 0, 10 3.5, 0 7" fill="#dc2626" opacity=".7"/>
                  </marker>
                </defs>
                {edges.map(e=>{
                  const from = nodes.find(n=>n.id===e.from);
                  const to   = nodes.find(n=>n.id===e.to);
                  if (!from||!to) return null;
                  const fx=from.x+90, fy=from.y+30;
                  const tx=to.x+90,   ty=to.y+30;
                  const mx=(fx+tx)/2,  my=(fy+ty)/2-35;
                  const ntFrom = NODE_TYPES[from.type]||NODE_TYPES.uncertainty;
                  return (
                    <g key={e.id}>
                      <path d={"M"+fx+","+fy+" Q"+mx+","+my+" "+tx+","+ty}
                        fill="none" stroke={ntFrom.color} strokeWidth={1.8}
                        strokeDasharray="6,3" markerEnd="url(#arrowhead)"
                        opacity={.7}/>
                      <text x={(fx+tx)/2} y={(fy+ty)/2-20}
                        textAnchor="middle" fontSize="9" fill={ntFrom.color}
                        fontFamily="'IBM Plex Sans',sans-serif" opacity=".8">
                        {e.label}
                      </text>
                      {/* Click to remove */}
                      <circle cx={(fx+tx)/2} cy={(fy+ty)/2-20} r={10}
                        fill="transparent" style={{ cursor:"pointer" }}
                        onClick={()=>setEdges(prev=>prev.filter(x=>x.id!==e.id))}/>
                    </g>
                  );
                })}
              </svg>

              {/* Nodes */}
              {nodes.map(node=><NodeShape key={node.id} node={node}/>)}

              {/* Empty state */}
              {nodes.length===0 && (
                <div style={{ position:"absolute", top:"50%", left:"50%",
                  transform:"translate(-50%,-50%)", textAlign:"center",
                  color:DS.inkTer, pointerEvents:"none" }}>
                  <div style={{ fontSize:36, marginBottom:12 }}>◎</div>
                  <div style={{ fontSize:14, fontWeight:600, marginBottom:6 }}>
                    No nodes yet
                  </div>
                  <div style={{ fontSize:12 }}>
                    Click "+ Add Node" to add Decisions, Uncertainties, or Value nodes.
                    Or use "AI Generate" to build a first draft.
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── IMPACT MATRIX VIEW ───────────────────────────────────── */}
        {view==="matrix" && (
          <div style={{ flex:1, overflow:"auto", padding:24 }}>
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr",
              gridTemplateRows:"1fr 1fr", gap:3,
              height:"calc(100% - 48px)", minHeight:400 }}>
              {[
                { impact:"High", control:"High", label:"Manage Actively",
                  sub:"High leverage — these are your key levers", color:"#059669", bg:"#ecfdf5" },
                { impact:"High", control:"Low",  label:"Monitor Closely",
                  sub:"External forces with major impact — watch and respond", color:"#d97706", bg:"#fffbeb" },
                { impact:"Low",  control:"High", label:"Exploit",
                  sub:"Easy wins — low stakes but you control them", color:"#2563eb", bg:"#eff4ff" },
                { impact:"Low",  control:"Low",  label:"Accept / Track",
                  sub:"Background noise — monitor but don't over-invest", color:"#6b7280", bg:"#f9fafb" },
              ].map(q=>{
                const qNodes = nodes.filter(n=>
                  n.type==="uncertainty"&&n.impact===q.impact&&n.control===q.control
                );
                return (
                  <div key={q.label} style={{ background:q.bg,
                    border:"1px solid "+q.color+"30", borderRadius:10,
                    padding:"16px 18px" }}>
                    <div style={{ fontSize:12, fontWeight:700, color:q.color,
                      marginBottom:2 }}>{q.label}</div>
                    <div style={{ fontSize:10, color:"#6b7280",
                      marginBottom:12 }}>{q.sub}</div>
                    <div style={{ display:"flex", flexDirection:"column", gap:7 }}>
                      {qNodes.map(n=>(
                        <div key={n.id}
                          onClick={()=>{ setView("diagram"); setSelected(n.id); }}
                          style={{ padding:"8px 11px", background:"white",
                            border:"1px solid "+q.color+"40", borderRadius:6,
                            cursor:"pointer", fontSize:11, fontWeight:600,
                            color:q.color, transition:"all .1s" }}
                          onMouseEnter={e=>e.currentTarget.style.borderColor=q.color}
                          onMouseLeave={e=>e.currentTarget.style.borderColor=q.color+"40"}>
                          {n.label}
                          {n.description && (
                            <div style={{ fontSize:10, color:"#6b7280",
                              fontWeight:400, marginTop:2 }}>
                              {n.description.slice(0,60)}{n.description.length>60?"…":""}
                            </div>
                          )}
                        </div>
                      ))}
                      {qNodes.length===0 && (
                        <div style={{ fontSize:11, color:"#9ca3af",
                          fontStyle:"italic" }}>
                          No uncertainties here yet
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Axis labels */}
            <div style={{ display:"flex", justifyContent:"space-between",
              marginTop:8, paddingInline:4 }}>
              <span style={{ fontSize:10, color:DS.inkTer }}>← Low Control</span>
              <span style={{ fontSize:10, color:DS.inkTer, fontWeight:700 }}>CONTROLLABILITY →</span>
              <span style={{ fontSize:10, color:DS.inkTer }}>High Control →</span>
            </div>
          </div>
        )}

        {/* ── NODE LIST (METADATA) VIEW ─────────────────────────────── */}
        {view==="metadata" && (
          <div style={{ flex:1, overflowY:"auto", padding:24 }}>
            {nodes.length===0 ? (
              <div style={{ textAlign:"center", color:DS.inkTer, padding:48, fontSize:13 }}>
                No nodes yet. Add nodes in the Diagram view or use AI Generate.
              </div>
            ) : (
              <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
                {/* Group by type */}
                {Object.entries(NODE_TYPES).map(([type,nt])=>{
                  const typeNodes = nodes.filter(n=>n.type===type);
                  if (typeNodes.length===0) return null;
                  return (
                    <div key={type}>
                      <div style={{ fontSize:10, fontWeight:700, color:nt.color,
                        letterSpacing:.6, textTransform:"uppercase",
                        marginBottom:8, display:"flex", alignItems:"center", gap:6 }}>
                        {nt.icon} {nt.label} ({typeNodes.length})
                      </div>
                      {typeNodes.map(n=>(
                        <div key={n.id}
                          style={{ padding:"14px 16px", marginBottom:8,
                            background:nt.bg, border:"1px solid "+nt.border,
                            borderRadius:8, borderLeft:"3px solid "+nt.color }}>
                          <div style={{ display:"flex", alignItems:"flex-start",
                            gap:10, marginBottom:8 }}>
                            <div style={{ flex:1 }}>
                              <input value={n.label}
                                onChange={e=>updateNode(n.id,{label:e.target.value})}
                                style={{ fontSize:13, fontWeight:700, color:nt.color,
                                  background:"transparent", border:"none",
                                  outline:"none", width:"100%",
                                  fontFamily:"inherit" }}/>
                            </div>
                            {n.type==="uncertainty" && (
                              <div style={{ display:"flex", gap:6 }}>
                                <select value={n.impact}
                                  onChange={e=>updateNode(n.id,{impact:e.target.value})}
                                  style={{ fontSize:10, padding:"2px 6px",
                                    border:"1px solid "+nt.border, borderRadius:4,
                                    background:nt.bg, color:nt.color,
                                    fontFamily:"inherit", cursor:"pointer" }}>
                                  {["Critical","High","Medium","Low"].map(v=>(
                                    <option key={v}>{v} Impact</option>
                                  ))}
                                </select>
                                <select value={n.control}
                                  onChange={e=>updateNode(n.id,{control:e.target.value})}
                                  style={{ fontSize:10, padding:"2px 6px",
                                    border:"1px solid "+nt.border, borderRadius:4,
                                    background:nt.bg, color:nt.color,
                                    fontFamily:"inherit", cursor:"pointer" }}>
                                  {["High","Medium","Low","No Control"].map(v=>(
                                    <option key={v}>{v} Control</option>
                                  ))}
                                </select>
                              </div>
                            )}
                            <button onClick={()=>removeNode(n.id)}
                              style={{ background:"none", border:"none",
                                cursor:"pointer", color:"#9ca3af",
                                fontSize:14, padding:"0 4px" }}>×</button>
                          </div>
                          <textarea value={n.description||""}
                            onChange={e=>updateNode(n.id,{description:e.target.value})}
                            placeholder="Description, context, or notes..."
                            rows={2}
                            style={{ width:"100%", fontSize:11, padding:"6px 8px",
                              fontFamily:"inherit", background:"white",
                              border:"1px solid "+nt.border, borderRadius:5,
                              color:DS.inkSub, outline:"none", resize:"vertical",
                              boxSizing:"border-box", marginBottom:6 }}/>
                          <div style={{ display:"flex", gap:10 }}>
                            <input value={n.owner||""}
                              onChange={e=>updateNode(n.id,{owner:e.target.value})}
                              placeholder="Owner..."
                              style={{ flex:1, fontSize:10, padding:"4px 7px",
                                fontFamily:"inherit", background:"white",
                                border:"1px solid "+nt.border, borderRadius:4,
                                color:DS.inkSub, outline:"none" }}/>
                            <input value={n.assumptions||""}
                              onChange={e=>updateNode(n.id,{assumptions:e.target.value})}
                              placeholder="Key assumptions..."
                              style={{ flex:2, fontSize:10, padding:"4px 7px",
                                fontFamily:"inherit", background:"white",
                                border:"1px solid "+nt.border, borderRadius:4,
                                color:DS.inkSub, outline:"none" }}/>
                          </div>
                          {/* Connections summary */}
                          {edges.filter(e=>e.from===n.id||e.to===n.id).length>0 && (
                            <div style={{ marginTop:8, fontSize:10, color:"#6b7280" }}>
                              <strong>Influences:</strong>{" "}
                              {edges.filter(e=>e.from===n.id).map(e=>{
                                const t=nodes.find(x=>x.id===e.to);
                                return t?.label;
                              }).filter(Boolean).join(", ")||"—"}
                              {" · "}
                              <strong>Influenced by:</strong>{" "}
                              {edges.filter(e=>e.to===n.id).map(e=>{
                                const s=nodes.find(x=>x.id===e.from);
                                return s?.label;
                              }).filter(Boolean).join(", ")||"—"}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* ── VALIDATE VIEW ────────────────────────────────────────── */}
        {view==="validate" && (
          <div style={{ flex:1, overflowY:"auto", padding:24 }}>
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:16, marginBottom:20 }}>
              {/* Stats */}
              {Object.entries(NODE_TYPES).map(([type,nt])=>{
                const count = nodes.filter(n=>n.type===type).length;
                return (
                  <div key={type} style={{ padding:"16px 18px",
                    background:nt.bg, border:"1px solid "+nt.border,
                    borderRadius:8, display:"flex", alignItems:"center", gap:12 }}>
                    <span style={{ fontSize:24 }}>{nt.icon}</span>
                    <div>
                      <div style={{ fontSize:22, fontWeight:700,
                        color:nt.color, fontFamily:"'Libre Baskerville',serif" }}>
                        {count}
                      </div>
                      <div style={{ fontSize:11, color:"#6b7280" }}>{nt.label} nodes</div>
                    </div>
                  </div>
                );
              })}
              <div style={{ padding:"16px 18px", background:DS.accentSoft,
                border:"1px solid "+DS.accentLine, borderRadius:8,
                display:"flex", alignItems:"center", gap:12 }}>
                <span style={{ fontSize:24 }}>→</span>
                <div>
                  <div style={{ fontSize:22, fontWeight:700,
                    color:DS.accent, fontFamily:"'Libre Baskerville',serif" }}>
                    {edges.length}
                  </div>
                  <div style={{ fontSize:11, color:"#6b7280" }}>Influence edges</div>
                </div>
              </div>
            </div>

            <Btn variant="primary" onClick={runValidation} style={{ marginBottom:20 }}>
              Run Validation Check
            </Btn>

            {validation && (
              <div>
                <div style={{ fontSize:12, fontWeight:700, color:DS.ink, marginBottom:12 }}>
                  Validation Results — {validation.length===0?"All clear":""+validation.length+" issue"+(validation.length!==1?"s":"")}
                </div>
                {validation.length===0 ? (
                  <div style={{ padding:"20px", background:DS.successSoft,
                    border:"1px solid "+DS.successLine, borderRadius:8,
                    color:DS.success, fontWeight:700, fontSize:13 }}>
                    ✓ Diagram passes all structural checks.
                  </div>
                ) : validation.map((v,i)=>(
                  <div key={i} style={{ padding:"12px 16px", marginBottom:8,
                    background:DS.dangerSoft, border:"1px solid "+DS.dangerLine,
                    borderRadius:8, display:"flex", gap:10 }}>
                    <span style={{ color:DS.danger, fontSize:14, flexShrink:0 }}>⚠</span>
                    <div>
                      <div style={{ fontSize:12, fontWeight:700, color:DS.ink,
                        marginBottom:2 }}>{v.node}</div>
                      <div style={{ fontSize:11, color:DS.inkSub }}>{v.msg}</div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* DQ guardrail reminders */}
            <div style={{ marginTop:24, padding:"16px 18px",
              background:DS.chromeSub, border:"1px solid "+DS.border,
              borderRadius:8 }}>
              <div style={{ fontSize:11, fontWeight:700, color:DS.textSec,
                marginBottom:10 }}>Influence Diagram DQ Principles</div>
              {[
                "Value/Outcome nodes must have at least one incoming influence.",
                "Decision nodes must have at least one outgoing influence.",
                "No circular dependencies — influence flows in one direction.",
                "Every uncertainty node should link to at least one value or decision node.",
                "Duplicate nodes indicate redundant thinking — consolidate.",
                "Orphan nodes (no connections) are not contributing to the model.",
              ].map((rule,i)=>(
                <div key={i} style={{ fontSize:11, color:DS.textTer,
                  marginBottom:5, display:"flex", gap:7 }}>
                  <span style={{ color:DS.accent }}>·</span>{rule}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}


/* ─────────────────────────────────────────────────────────────────────────────
   QUICK START — AI DEEP DIVE ENTRY SCREEN
───────────────────────────────────────────────────────────────────────────── */

const ANALYSIS_STEPS = [
  { id:"frame",     label:"Extracting decision frame",      icon:"◎", module:"Problem Definition" },
  { id:"issues",    label:"Identifying issues & risks",     icon:"◈", module:"Issue Raising" },
  { id:"hierarchy", label:"Structuring decision hierarchy", icon:"◧", module:"Decision Hierarchy" },
  { id:"criteria",  label:"Inferring decision criteria",    icon:"◫", module:"Decision Criteria" },
  { id:"strategy",  label:"Drafting initial strategies",    icon:"⊞", module:"Strategy Table" },
];

function QuickStartScreen({ onComplete, onSkip }) {
  const [phase, setPhase] = useState("landing");
  const [inputMode, setInputMode] = useState("paste");
  const [rawText, setRawText] = useState("");
  const [guidedAnswers, setGuidedAnswers] = useState({ what:"", why:"", who:"", when:"", constraints:"" });
  const [analysisProgress, setAnalysisProgress] = useState([]);
  const [draft, setDraft] = useState(null);
  const [accepted, setAccepted] = useState({ frame:true, issues:true, decisions:true, criteria:true, strategies:true });
  const [dragOver, setDragOver] = useState(false);
  const draftRef = useRef(null);
  const { busy, call } = useAI();

  const GUIDED_QUESTIONS = [
    { key:"what", label:"What decision needs to be made?", placeholder:"Describe the core decision in your own words." },
    { key:"why",  label:"Why does this decision matter now?", placeholder:"What is driving the urgency? What triggered this?" },
    { key:"who",  label:"Who owns this decision and who is affected?", placeholder:"Decision maker, key stakeholders, those impacted." },
    { key:"when", label:"What is the time horizon or deadline?", placeholder:"When must this be decided? What happens if delayed?" },
    { key:"constraints", label:"What constraints or givens exist?", placeholder:"Budget limits, regulatory requirements, non-negotiables." },
  ];

  const getInputText = () => {
    if (inputMode === "paste") return rawText;
    return Object.entries(guidedAnswers).map(([k, v]) => {
      const q = GUIDED_QUESTIONS.find(g => g.key === k);
      return v ? `${q.label}\n${v}` : "";
    }).filter(Boolean).join("\n\n");
  };

  const runAnalysis = async () => {
    const rawText = getInputText();
    if (!rawText.trim() || rawText.trim().length < 40) return;
    const text = rawText.length > 4000 ? rawText.slice(0, 4000) : rawText;
    setPhase("analysing");
    setAnalysisProgress([]);

    const progressTimer = setInterval(() => {
      setAnalysisProgress(p => {
        if (p.length < ANALYSIS_STEPS.length) return [...p, ANALYSIS_STEPS[p.length].id];
        clearInterval(progressTimer);
        return p;
      });
    }, 900);

    // Step 1: Get structured analysis as JSON
    // Keep the schema minimal and explicit
    const schemaStr = '{"projectName":"string","executiveSummary":"string","decisionStatement":"How should we...","context":"string","background":"string","trigger":"string","scopeIn":"string","scopeOut":"string","timeHorizon":"string","deadline":"string","owner":"string","constraints":"string","assumptions":"string","successCriteria":"string","issues":[{"text":"string","category":"uncertainty-external","severity":"High","source":"string"}],"decisions":[{"label":"string","choices":["A","B","C"],"tier":"focus","rationale":"string"}],"criteria":[{"label":"string","type":"financial","weight":"high","description":"string"}],"strategies":[{"name":"string","description":"string","rationale":"string"}],"weakestLink":"string","recommendedFirstStep":"string"}';

    const prompt =
      "You are a Decision Quality expert. Read this decision brief and SYNTHESISE a structured analysis." +
      " Do NOT copy text verbatim from the input. Reframe, synthesise and improve all fields." +
      " The decisionStatement must be a genuine open question (How should we...), never a copied sentence." +
      " Return ONLY a JSON object matching this schema exactly. No other text." +
      " Schema: " + schemaStr +
      " Brief: " + text;

    call(prompt, (result) => {
      clearInterval(progressTimer);
      setAnalysisProgress(ANALYSIS_STEPS.map(s => s.id));

      if (result.error) {
        alert("AI Error: " + result.error);
        setPhase("input");
        return;
      }

      // Get the data — either parsed object or raw text to parse
      let data = result;
      if (result._raw) {
        try {
          // Try to extract JSON from raw text
          const raw = result._raw;
          const start = raw.indexOf("{");
          const end = raw.lastIndexOf("}");
          if (start !== -1 && end > start) {
            data = JSON.parse(raw.slice(start, end + 1));
          } else {
            setPhase("input");
            alert("Could not extract structured data. Please try again.");
            return;
          }
        } catch(e) {
          setPhase("input");
          alert("Parse failed. Please try again with a shorter input.");
          return;
        }
      }

      // Map the simple schema to the full draft structure
      const draft = {
        projectName: data.projectName || "Untitled Project",
        executiveSummary: data.executiveSummary || "",
        frame: {
          decisionStatement: data.decisionStatement || "",
          context: data.context || "",
          background: data.background || "",
          trigger: data.trigger || "",
          symptoms: data.symptoms || "",
          rootDecision: data.rootDecision || data.decisionStatement || "",
          scopeIn: data.scopeIn || "",
          scopeOut: data.scopeOut || "",
          timeHorizon: data.timeHorizon || "",
          deadline: data.deadline || "",
          owner: data.owner || "",
          stakeholders: data.stakeholders || [],
          constraints: data.constraints || "",
          assumptions: data.assumptions || "",
          successCriteria: data.successCriteria || "",
          failureConsequences: data.failureConsequences || "",
          urgency: data.urgency || "Medium",
          importance: data.importance || "Significant",
          confidence: "medium",
          confidenceNote: "AI-generated first draft — review and refine",
        },
        issues: (data.issues || []).map(i => ({
          id: uid("iss"),
          text: i.text || "",
          category: i.category || "uncertainty-external",
          severity: i.severity || "Medium",
          hat: i.hat || "Team",
          confidence: i.confidence || "medium",
          source: i.source || "AI Deep Dive",
          status: "Open",
          owner: "",
          votes: 0,
        })),
        decisions: (data.decisions || []).map(d => ({
          id: uid("dec"),
          label: d.label || "",
          choices: d.choices || ["Option A", "Option B"],
          tier: d.tier || "focus",
          owner: d.owner || "",
          rationale: d.rationale || "",
          confidence: d.confidence || "medium",
          sourceId: null,
        })),
        criteria: (data.criteria || []).map(c => ({
          id: uid("crit"),
          label: c.label || "",
          type: c.type || "strategic",
          weight: c.weight || "medium",
          description: c.description || "",
          confidence: c.confidence || "medium",
        })),
        strategies: (data.strategies || []).map((s, i) => ({
          id: uid("strat"),
          colorIdx: i % 6,
          name: s.name || ("Strategy " + (i + 1)),
          description: s.description || "",
          objective: s.objective || "",
          rationale: s.rationale || "",
          keyTheme: s.keyTheme || "",
          confidence: s.confidence || "medium",
          selections: {},
        })),
        dqObservations: data.dqObservations || [],
        weakestLink: data.weakestLink || "",
        recommendedFirstStep: data.recommendedFirstStep || "",
      };

      // Validate minimum content
      if (!draft.frame.decisionStatement && !draft.projectName) {
        setPhase("input");
        alert("AI returned insufficient data. Please try again.");
        return;
      }

      draftRef.current = draft;
      setDraft(draft);
      setAccepted({ frame:true, issues:true, decisions:true, criteria:true, strategies:true });
      setTimeout(() => setPhase("review"), 800);
    });
  };



  const applyDraft = () => { if (draft) onComplete(draft, accepted); };
  const confVar = c => c==="high"?"green":c==="medium"?"warn":"danger";

  const sharedStyles = `
    @import url('https://fonts.googleapis.com/css2?family=IBM+Plex+Sans:wght@400;500;600;700&family=Libre+Baskerville:ital,wght@0,700;1,400&display=swap');
    * { box-sizing:border-box; }
    @keyframes spin{to{transform:rotate(360deg)}}
    @keyframes fadeUp{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:translateY(0)}}
    @keyframes fadeIn{from{opacity:0}to{opacity:1}}
    ::-webkit-scrollbar{width:5px}
    ::-webkit-scrollbar-thumb{background:#252b3b;border-radius:3px}
  `;

  const overlay = { position:"fixed", inset:0, background:DS.chrome, zIndex:200,
    fontFamily:"'IBM Plex Sans','Helvetica Neue',sans-serif", color:DS.textPri };

  // ── LANDING ──
  if (phase === "landing") return (
    <div style={{ ...overlay, display:"flex", alignItems:"center", justifyContent:"center" }}>
      <style>{sharedStyles}</style>
      <div style={{ width:"100%", maxWidth:700, padding:"40px 32px", animation:"fadeUp .4s ease" }}>

        <div style={{ display:"flex", alignItems:"center", gap:12, marginBottom:52 }}>
          <div style={{ width:34, height:34, borderRadius:7, background:DS.accent,
            display:"flex", alignItems:"center", justifyContent:"center" }}>
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round">
              <polygon points="12,2 22,8.5 22,15.5 12,22 2,15.5 2,8.5"/>
              <line x1="12" y1="2" x2="12" y2="22"/>
              <line x1="2" y1="8.5" x2="22" y2="8.5"/>
              <line x1="2" y1="15.5" x2="22" y2="15.5"/>
            </svg>
          </div>
          <div>
            <div style={{ fontSize:15, fontWeight:700, color:DS.textPri, letterSpacing:-.1 }}>Vantage DQ</div>
            <div style={{ fontSize:9, color:DS.textTer, letterSpacing:1.5, textTransform:"uppercase" }}>Decision Quality Platform</div>
          </div>
        </div>

        <div style={{ marginBottom:44 }}>
          <div style={{ fontFamily:"'Libre Baskerville',Georgia,serif", fontSize:38, fontWeight:700,
            color:DS.textPri, lineHeight:1.12, letterSpacing:-.5, marginBottom:16 }}>
            Start with your<br/>problem, not a blank page.
          </div>
          <div style={{ fontSize:14, color:DS.textSec, lineHeight:1.7, maxWidth:520 }}>
            Paste a brief, memo, board paper, or rough description of your decision. Vantage reads it through a Decision Quality lens and builds your first draft — frame, issues, hierarchy, criteria, and strategies — in seconds.
          </div>
        </div>

        {/* ── Three start paths ── */}
        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:12, marginBottom:28 }}>

          {/* Path 1 — AI Deep Dive */}
          {[
            { mode:"paste",   icon:"📄", title:"AI Deep Dive",
              sub:"Best for most sessions",
              desc:"Paste any brief, memo, or problem description. The AI reads it through a DQ lens and populates all modules in seconds.",
              accent: DS.accent },
            { mode:"guided",  icon:"🗂", title:"Guided Questions",
              sub:"No document? Start here",
              desc:"Answer 5 structured questions about the decision. We build your first draft from your answers.",
              accent: "#7c3aed" },
          ].map(opt => (
            <button key={opt.mode}
              onClick={()=>{ setInputMode(opt.mode); setPhase("input"); }}
              style={{ padding:"20px 18px", background:DS.chromeMid,
                border:"1.5px solid "+DS.borderMid,
                borderRadius:10, cursor:"pointer", textAlign:"left",
                transition:"all .15s", fontFamily:"inherit" }}
              onMouseEnter={e=>{ e.currentTarget.style.borderColor=opt.accent; e.currentTarget.style.background=DS.chromeSub; }}
              onMouseLeave={e=>{ e.currentTarget.style.borderColor=DS.borderMid; e.currentTarget.style.background=DS.chromeMid; }}>
              <div style={{ fontSize:22, marginBottom:8 }}>{opt.icon}</div>
              <div style={{ fontSize:12, fontWeight:700, color:DS.textPri, marginBottom:2 }}>{opt.title}</div>
              <div style={{ fontSize:9, fontWeight:700, color:opt.accent, letterSpacing:.5,
                textTransform:"uppercase", marginBottom:8 }}>{opt.sub}</div>
              <div style={{ fontSize:10, color:DS.textTer, lineHeight:1.6 }}>{opt.desc}</div>
            </button>
          ))}

          {/* Path 3 — Start Clean */}
          <button
            onClick={()=>{
              if (window.confirm("Start with completely empty modules? You can always load an example later from the Tools menu.")) {
                onSkip("clean");
              }
            }}
            style={{ padding:"20px 18px", background:"transparent",
              border:"1.5px dashed "+DS.border,
              borderRadius:10, cursor:"pointer", textAlign:"left",
              transition:"all .15s", fontFamily:"inherit" }}
            onMouseEnter={e=>{ e.currentTarget.style.borderColor=DS.textSec; e.currentTarget.style.background=DS.chromeMid; }}
            onMouseLeave={e=>{ e.currentTarget.style.borderColor=DS.border; e.currentTarget.style.background="transparent"; }}>
            <div style={{ fontSize:22, marginBottom:8 }}>◎</div>
            <div style={{ fontSize:12, fontWeight:700, color:DS.textPri, marginBottom:2 }}>Start Clean</div>
            <div style={{ fontSize:9, fontWeight:700, color:DS.textTer, letterSpacing:.5,
              textTransform:"uppercase", marginBottom:8 }}>Blank canvas</div>
            <div style={{ fontSize:10, color:DS.textTer, lineHeight:1.6 }}>
              Begin with empty modules. Fill in the Problem Definition yourself and build everything from scratch.
            </div>
          </button>
        </div>

        {/* Path 4 — Load example */}
        <div style={{ padding:"14px 18px", background:DS.chromeMid,
          border:"1px solid "+DS.border, borderRadius:8,
          display:"flex", alignItems:"center", gap:14 }}>
          <div style={{ fontSize:20, flexShrink:0 }}>🏢</div>
          <div style={{ flex:1 }}>
            <div style={{ fontSize:12, fontWeight:700, color:DS.textPri, marginBottom:2 }}>
              Load Pre-built Example
            </div>
            <div style={{ fontSize:10, color:DS.textTer }}>
              APAC market entry case — fully populated with frame, issues, decisions, strategies, and assessment. Explore the platform with real content.
            </div>
          </div>
          <button onClick={()=>onSkip("example")}
            style={{ padding:"8px 18px", background:DS.accent, border:"none",
              borderRadius:6, color:"#fff", fontSize:11, fontWeight:700,
              cursor:"pointer", fontFamily:"inherit", flexShrink:0,
              transition:"background .12s" }}
            onMouseEnter={e=>{ e.currentTarget.style.background=DS.accentDim; }}
            onMouseLeave={e=>{ e.currentTarget.style.background=DS.accent; }}>
            Load Example →
          </button>
        </div>
      </div>
    </div>
  );

  // ── INPUT ──
  if (phase === "input") return (
    <div style={{ ...overlay, display:"flex", flexDirection:"column" }}>
      <style>{sharedStyles}</style>

      <div style={{ padding:"13px 24px", borderBottom:`1px solid ${DS.border}`,
        display:"flex", alignItems:"center", gap:14, flexShrink:0, background:DS.chromeAlt }}>
        <div style={{ display:"flex", alignItems:"center", gap:8 }}>
          <div style={{ width:26, height:26, borderRadius:5, background:DS.accent,
            display:"flex", alignItems:"center", justifyContent:"center" }}>
            <Svg path={ICONS.spark} size={13} color="#fff"/>
          </div>
          <span style={{ fontSize:13, fontWeight:700, color:DS.textPri }}>AI Deep Dive</span>
        </div>
        <div style={{ display:"flex", gap:5 }}>
          {[{id:"paste",label:"Paste Text"},{id:"guided",label:"5 Questions"}].map(m=>(
            <button key={m.id} onClick={()=>setInputMode(m.id)}
              style={{ padding:"5px 13px", fontSize:11, fontWeight:700, fontFamily:"inherit",
                cursor:"pointer", border:`1px solid ${inputMode===m.id?DS.accent:DS.border}`,
                borderRadius:5, background:inputMode===m.id?DS.accent:"transparent",
                color:inputMode===m.id?"#fff":DS.textTer, transition:"all .12s" }}>
              {m.label}
            </button>
          ))}
        </div>
        <button onClick={()=>setPhase("landing")}
          style={{ marginLeft:"auto", background:"none", border:"none", cursor:"pointer",
            color:DS.textTer, display:"flex", alignItems:"center", gap:5, fontFamily:"inherit", fontSize:12 }}>
          <Svg path={ICONS.x} size={14} color={DS.textTer}/> Back
        </button>
      </div>

      <div style={{ flex:1, display:"flex", overflow:"hidden" }}>
        <div style={{ flex:1, overflowY:"auto", padding:"32px 40px", maxWidth:840, margin:"0 auto", width:"100%" }}>

          {inputMode === "paste" && (
            <div style={{ animation:"fadeUp .25s ease" }}>
              <div style={{ marginBottom:20 }}>
                <div style={{ fontFamily:"'Libre Baskerville',Georgia,serif", fontSize:22,
                  fontWeight:700, color:DS.textPri, marginBottom:8 }}>Paste your problem context</div>
                <div style={{ fontSize:13, color:DS.textSec, lineHeight:1.6 }}>
                  Any format — board paper, strategy brief, email thread, rough notes. Min 40 characters.
                </div>
              </div>

              <div
                onDragOver={e=>{ e.preventDefault(); setDragOver(true); }}
                onDragLeave={()=>setDragOver(false)}
                onDrop={e=>{
                  e.preventDefault(); setDragOver(false);
                  const file = e.dataTransfer.files[0];
                  if (file?.type==="text/plain") {
                    const reader = new FileReader();
                    reader.onload = ev => setRawText(ev.target.result);
                    reader.readAsText(file);
                  }
                }}
                style={{ marginBottom:12, padding:"11px 16px",
                  background:dragOver?"rgba(37,99,235,.08)":"rgba(255,255,255,.02)",
                  border:`1.5px dashed ${dragOver?DS.accent:DS.border}`,
                  borderRadius:8, textAlign:"center", transition:"all .15s" }}>
                <div style={{ fontSize:11, color:DS.textTer }}>Drop a .txt file here, or paste below</div>
              </div>

              <textarea value={rawText} onChange={e=>setRawText(e.target.value)} rows={18}
                placeholder={`Paste your decision context here…\n\nExample:\n"Our business faces increasing competition in APAC. The board has asked us to evaluate market entry options and present a recommendation by Q2. Budget ceiling is $25M for Year 1. We need to balance speed to market with capital efficiency. Options under consideration include a direct subsidiary, strategic partnership, or acquiring a local player…"`}
                style={{ width:"100%", padding:"16px 18px", fontSize:13, fontFamily:"inherit",
                  background:DS.chromeMid, border:`1px solid ${DS.border}`, borderRadius:8,
                  color:DS.textSec, outline:"none", resize:"vertical", lineHeight:1.7,
                  boxSizing:"border-box" }}
                onFocusCapture={e=>e.target.style.borderColor=DS.accent}
                onBlurCapture={e=>e.target.style.borderColor=DS.border}/>

              <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginTop:14 }}>
                <span style={{ fontSize:11, color:rawText.length<40?DS.danger:DS.textTer }}>
                  {rawText.length} chars {rawText.length<40?"— min 40 required":"✓"}
                </span>
                <Btn variant="primary" icon="spark" size="lg" onClick={runAnalysis}
                  disabled={busy||rawText.trim().length<40}>
                  Run Deep Dive Analysis
                </Btn>
              </div>
            </div>
          )}

          {inputMode === "guided" && (
            <div style={{ animation:"fadeUp .25s ease" }}>
              <div style={{ marginBottom:24 }}>
                <div style={{ fontFamily:"'Libre Baskerville',Georgia,serif", fontSize:22,
                  fontWeight:700, color:DS.textPri, marginBottom:8 }}>Five questions about your decision</div>
                <div style={{ fontSize:13, color:DS.textSec, lineHeight:1.6 }}>
                  Rough answers are fine — the AI will structure and infer. Answer at least 2 questions.
                </div>
              </div>

              {GUIDED_QUESTIONS.map((q, i) => (
                <div key={q.key} style={{ marginBottom:20 }}>
                  <div style={{ display:"flex", alignItems:"baseline", gap:10, marginBottom:8 }}>
                    <span style={{ width:22, height:22, borderRadius:5, background:DS.accent,
                      display:"inline-flex", alignItems:"center", justifyContent:"center",
                      fontSize:11, fontWeight:700, color:"#fff", flexShrink:0 }}>{i+1}</span>
                    <label style={{ fontSize:13, fontWeight:700, color:DS.textPri }}>{q.label}</label>
                  </div>
                  <textarea value={guidedAnswers[q.key]} rows={3}
                    onChange={e=>setGuidedAnswers(a=>({...a,[q.key]:e.target.value}))}
                    placeholder={q.placeholder}
                    style={{ width:"100%", padding:"11px 14px", fontSize:12, fontFamily:"inherit",
                      background:DS.chromeMid, border:`1px solid ${DS.border}`, borderRadius:7,
                      color:DS.textSec, outline:"none", resize:"vertical", lineHeight:1.6,
                      boxSizing:"border-box" }}
                    onFocusCapture={e=>e.target.style.borderColor=DS.accent}
                    onBlurCapture={e=>e.target.style.borderColor=DS.border}/>
                </div>
              ))}

              <div style={{ display:"flex", justifyContent:"flex-end" }}>
                <Btn variant="primary" icon="spark" size="lg" onClick={runAnalysis}
                  disabled={busy || Object.values(guidedAnswers).filter(v=>v.trim().length>10).length < 2}>
                  Run Deep Dive Analysis
                </Btn>
              </div>
            </div>
          )}
        </div>

        {/* Tips sidebar */}
        <div style={{ width:260, borderLeft:`1px solid ${DS.border}`, padding:"24px 20px",
          overflowY:"auto", flexShrink:0 }}>
          <div style={{ fontSize:10, fontWeight:700, color:DS.textTer, letterSpacing:.8,
            textTransform:"uppercase", marginBottom:16 }}>What Vantage extracts</div>
          {[
            { icon:"◎", label:"Decision Frame", desc:"Statement, context, scope, owner, constraints, success criteria" },
            { icon:"◈", label:"8–12 Issues", desc:"Tagged by type and severity across stakeholder perspectives" },
            { icon:"◧", label:"Decision Hierarchy", desc:"Decisions across all 5 tiers — Given, Focus, Tactical, Deferred, Dependencies" },
            { icon:"◫", label:"Decision Criteria", desc:"What the organisation values — how strategies will be judged" },
            { icon:"⊞", label:"2–4 Strategies", desc:"Initial coherent directions as a starting scaffold" },
          ].map(item => (
            <div key={item.icon} style={{ marginBottom:14, display:"flex", gap:10 }}>
              <span style={{ fontSize:14, flexShrink:0 }}>{item.icon}</span>
              <div>
                <div style={{ fontSize:11, fontWeight:700, color:DS.textSec, marginBottom:2 }}>{item.label}</div>
                <div style={{ fontSize:10, color:DS.textTer, lineHeight:1.5 }}>{item.desc}</div>
              </div>
            </div>
          ))}
          <div style={{ marginTop:16, padding:"11px 13px", background:DS.chromeMid,
            border:`1px solid ${DS.border}`, borderRadius:7 }}>
            <div style={{ fontSize:11, fontWeight:700, color:DS.accent, marginBottom:5 }}>This is a first draft</div>
            <div style={{ fontSize:11, color:DS.textTer, lineHeight:1.55 }}>
              Everything Vantage produces is a starting point. DQ quality comes from the team's process — not the AI output.
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  // ── ANALYSING ──
  if (phase === "analysing") return (
    <div style={{ ...overlay, display:"flex", alignItems:"center", justifyContent:"center" }}>
      <style>{sharedStyles}</style>
      <div style={{ width:480, textAlign:"center" }}>
        <div style={{ width:52, height:52, margin:"0 auto 24px", borderRadius:"50%",
          border:`3px solid ${DS.border}`, borderTop:`3px solid ${DS.accent}`,
          animation:"spin 1s linear infinite" }}/>
        <div style={{ fontFamily:"'Libre Baskerville',Georgia,serif", fontSize:22,
          fontWeight:700, color:DS.textPri, marginBottom:8 }}>Applying Decision Quality methodology</div>
        <div style={{ fontSize:13, color:DS.textSec, marginBottom:36, lineHeight:1.6 }}>
          Analysing your context across all five DQ modules…
        </div>
        <div style={{ display:"flex", flexDirection:"column", gap:8, textAlign:"left" }}>
          {ANALYSIS_STEPS.map((step, i) => {
            const done = analysisProgress.includes(step.id);
            const active = !done && analysisProgress.length === i;
            return (
              <div key={step.id} style={{ display:"flex", alignItems:"center", gap:12,
                padding:"10px 16px", borderRadius:8,
                background:done?"rgba(5,150,105,.08)":active?DS.chromeSub:DS.chromeMid,
                border:`1px solid ${done?DS.successLine:active?DS.accent:DS.border}40`,
                opacity:done||active?1:0.4, transition:"all .3s" }}>
                <div style={{ width:22, height:22, borderRadius:5, flexShrink:0,
                  background:done?DS.success:active?DS.accent:DS.chromeSub,
                  display:"flex", alignItems:"center", justifyContent:"center" }}>
                  {done
                    ? <Svg path={ICONS.check} size={12} color="#fff" sw={2.5}/>
                    : active
                      ? <div style={{ width:10,height:10,borderRadius:"50%",border:"2px solid #fff",borderTop:"2px solid transparent",animation:"spin .8s linear infinite" }}/>
                      : <span style={{ color:DS.textTer, fontSize:9 }}>{i+1}</span>
                  }
                </div>
                <div style={{ flex:1 }}>
                  <div style={{ fontSize:12, fontWeight:600, color:done||active?DS.textPri:DS.textTer }}>
                    {step.label}
                  </div>
                  <div style={{ fontSize:10, color:DS.textTer }}>→ {step.module}</div>
                </div>
                {done && <span style={{ fontSize:11, color:DS.success }}>✓</span>}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );

  // ── REVIEW ──
  // Use ref as fallback in case state hasn't updated yet
  const activeDraft = draft || draftRef.current;
  if (phase === "review" && activeDraft) {
    // Ensure draft state is synced
    if (!draft && draftRef.current) {
      setDraft(draftRef.current);
    }
    const sections = [
      { key:"frame",      label:"Problem Definition",  count:null },
      { key:"issues",     label:"Issues",              count:activeDraft.issues?.length },
      { key:"decisions",  label:"Decision Hierarchy",  count:activeDraft.decisions?.length },
      { key:"criteria",   label:"Criteria",            count:activeDraft.criteria?.length },
      { key:"strategies", label:"Strategies",          count:activeDraft.strategies?.length },
    ];

    return (
      <div style={{ ...overlay, display:"flex", flexDirection:"column" }}>
        <style>{sharedStyles}</style>

        {/* Top bar */}
        <div style={{ padding:"13px 24px", borderBottom:`1px solid ${DS.border}`,
          display:"flex", alignItems:"center", gap:14, flexShrink:0, background:DS.chromeAlt }}>
          <div style={{ width:26, height:26, borderRadius:5, background:DS.success,
            display:"flex", alignItems:"center", justifyContent:"center" }}>
            <Svg path={ICONS.check} size={13} color="#fff" sw={2.5}/>
          </div>
          <div>
            <div style={{ fontSize:13, fontWeight:700, color:DS.textPri }}>First Draft Ready — {activeDraft.projectName}</div>
            <div style={{ fontSize:11, color:DS.textTer }}>Review what Vantage inferred · toggle sections on/off · load when ready</div>
          </div>
          <div style={{ marginLeft:"auto", display:"flex", gap:8 }}>
            <Btn variant="chrome" onClick={()=>setPhase("input")} size="sm">← Re-analyse</Btn>
            <Btn variant="primary" icon="check" onClick={applyDraft}>Load First Draft →</Btn>
          </div>
        </div>

        <div style={{ flex:1, display:"flex", overflow:"hidden" }}>

          {/* Left sidebar — summary */}
          <div style={{ width:240, borderRight:`1px solid ${DS.border}`, overflowY:"auto",
            flexShrink:0, padding:"20px 18px" }}>

            {activeDraft.executiveSummary && (
              <div style={{ marginBottom:18, paddingBottom:18, borderBottom:`1px solid ${DS.border}` }}>
                <div style={{ fontSize:9, fontWeight:700, color:DS.textTer, letterSpacing:1,
                  textTransform:"uppercase", marginBottom:8 }}>Executive Summary</div>
                <div style={{ fontSize:11, color:DS.textSec, lineHeight:1.65 }}>{activeDraft.executiveSummary}</div>
              </div>
            )}

            {activeDraft.dqObservations?.length > 0 && (
              <div style={{ marginBottom:18, paddingBottom:18, borderBottom:`1px solid ${DS.border}` }}>
                <div style={{ fontSize:9, fontWeight:700, color:DS.textTer, letterSpacing:1,
                  textTransform:"uppercase", marginBottom:8 }}>DQ Observations</div>
                {activeDraft.dqObservations.map((obs,i) => (
                  <div key={i} style={{ fontSize:11, color:"#fbbf24", lineHeight:1.5, marginBottom:6,
                    paddingLeft:8, borderLeft:`2px solid #f59e0b` }}>{obs}</div>
                ))}
              </div>
            )}

            {activeDraft.weakestLink && (
              <div style={{ marginBottom:18, paddingBottom:18, borderBottom:`1px solid ${DS.border}` }}>
                <div style={{ fontSize:9, fontWeight:700, color:DS.danger, letterSpacing:1,
                  textTransform:"uppercase", marginBottom:6 }}>Weakest DQ Link</div>
                <div style={{ fontSize:11, color:DS.textSec, lineHeight:1.5 }}>{activeDraft.weakestLink}</div>
              </div>
            )}

            {activeDraft.recommendedFirstStep && (
              <div>
                <div style={{ fontSize:9, fontWeight:700, color:DS.success, letterSpacing:1,
                  textTransform:"uppercase", marginBottom:6 }}>First Step</div>
                <div style={{ fontSize:11, color:DS.textSec, lineHeight:1.5 }}>{activeDraft.recommendedFirstStep}</div>
              </div>
            )}
          </div>

          {/* Main review area */}
          <div style={{ flex:1, overflowY:"auto", padding:"20px 28px" }}>

            {/* Section toggles */}
            <div style={{ display:"flex", gap:7, flexWrap:"wrap", marginBottom:22 }}>
              {sections.map(s => (
                <button key={s.key} onClick={()=>setAccepted(a=>({...a,[s.key]:!a[s.key]}))}
                  style={{ display:"flex", alignItems:"center", gap:6, padding:"6px 12px",
                    borderRadius:6, border:`1.5px solid ${accepted[s.key]?DS.accent:DS.border}`,
                    background:accepted[s.key]?DS.chromeSub:DS.chromeMid,
                    cursor:"pointer", fontFamily:"inherit", transition:"all .12s" }}>
                  <span style={{ fontSize:12, fontWeight:700, color:accepted[s.key]?DS.accent:DS.textTer }}>
                    {accepted[s.key]?"✓":"○"} {s.label}
                  </span>
                  {s.count && (
                    <span style={{ fontSize:10, fontWeight:700, padding:"1px 6px", borderRadius:10,
                      background:accepted[s.key]?DS.accent:DS.border,
                      color:accepted[s.key]?"#fff":DS.textTer }}>{s.count}</span>
                  )}
                </button>
              ))}
            </div>

            {/* FRAME */}
            {accepted.frame && activeDraft.frame && (
              <div style={{ marginBottom:16, border:`1px solid ${DS.canvasBdr}`, borderRadius:8,
                overflow:"hidden", background:DS.canvas }}>
                <div style={{ padding:"10px 16px", background:DS.canvasAlt,
                  borderBottom:`1px solid ${DS.canvasBdr}`, display:"flex", alignItems:"center", justifyContent:"space-between" }}>
                  <div style={{ fontSize:12, fontWeight:700, color:DS.ink }}>◎ Problem Definition</div>
                  <Badge variant={confVar(activeDraft.frame.confidence)} size="xs">{activeDraft.frame.confidence} confidence</Badge>
                </div>
                <div style={{ padding:"14px 16px", display:"grid", gridTemplateColumns:"1fr 1fr", gap:12 }}>
                  {[
                    ["Decision Statement", activeDraft.frame.decisionStatement],
                    ["Owner", activeDraft.frame.owner],
                    ["Trigger", activeDraft.frame.trigger],
                    ["Deadline", activeDraft.frame.deadline],
                    ["Scope In", activeDraft.frame.scopeIn],
                    ["Scope Out", activeDraft.frame.scopeOut],
                    ["Constraints", activeDraft.frame.constraints],
                    ["Success Criteria", activeDraft.frame.successCriteria],
                  ].filter(([,v])=>v).map(([label, val]) => (
                    <div key={label}>
                      <div style={{ fontSize:10, fontWeight:700, color:DS.inkTer,
                        letterSpacing:.6, textTransform:"uppercase", marginBottom:3 }}>{label}</div>
                      <div style={{ fontSize:12, color:DS.ink, lineHeight:1.5 }}>{val}</div>
                    </div>
                  ))}
                </div>
                {activeDraft.frame.confidenceNote && (
                  <div style={{ padding:"8px 16px", borderTop:`1px solid ${DS.canvasBdr}`,
                    fontSize:11, color:DS.inkTer, fontStyle:"italic" }}>
                    ℹ {activeDraft.frame.confidenceNote}
                  </div>
                )}
              </div>
            )}

            {/* ISSUES */}
            {accepted.issues && activeDraft.issues?.length > 0 && (
              <div style={{ marginBottom:16, border:`1px solid ${DS.canvasBdr}`, borderRadius:8,
                overflow:"hidden", background:DS.canvas }}>
                <div style={{ padding:"10px 16px", background:DS.canvasAlt, borderBottom:`1px solid ${DS.canvasBdr}` }}>
                  <div style={{ fontSize:12, fontWeight:700, color:DS.ink }}>◈ Issues Raised — {activeDraft.issues.length} identified</div>
                </div>
                <div style={{ maxHeight:260, overflowY:"auto" }}>
                  {activeDraft.issues.map((issue, i) => (
                    <div key={i} style={{ padding:"9px 16px", display:"flex", alignItems:"flex-start", gap:10,
                      borderBottom:i<activeDraft.issues.length-1?`1px solid ${DS.canvasBdr}`:"none" }}>
                      <div style={{ flex:1 }}>
                        <div style={{ fontSize:12, color:DS.ink, lineHeight:1.45, marginBottom:5 }}>{issue.text}</div>
                        <div style={{ display:"flex", gap:5, flexWrap:"wrap" }}>
                          <Badge variant={({Risk:"danger",Opportunity:"green",Regulatory:"amber",Financial:"blue",Technical:"chrome",Strategic:"blue"})[issue.type]||"default"} size="xs">{issue.type}</Badge>
                          <Badge variant={({Critical:"danger",High:"warn",Medium:"blue",Low:"default"})[issue.severity]||"default"} size="xs">{issue.severity}</Badge>
                          <Badge variant={confVar(issue.confidence)} size="xs">{issue.confidence}</Badge>
                        </div>
                      </div>
                      {issue.source && (
                        <div style={{ fontSize:10, color:DS.inkDis, fontStyle:"italic",
                          maxWidth:150, lineHeight:1.4, flexShrink:0 }}>
                          "{issue.source.slice(0,55)}…"
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* DECISIONS */}
            {accepted.decisions && activeDraft.decisions?.length > 0 && (
              <div style={{ marginBottom:16, border:`1px solid ${DS.canvasBdr}`, borderRadius:8,
                overflow:"hidden", background:DS.canvas }}>
                <div style={{ padding:"10px 16px", background:DS.canvasAlt, borderBottom:`1px solid ${DS.canvasBdr}` }}>
                  <div style={{ fontSize:12, fontWeight:700, color:DS.ink }}>◧ Decision Hierarchy — {activeDraft.decisions.length} decisions</div>
                </div>
                <div style={{ padding:"12px 16px", display:"flex", flexDirection:"column", gap:10 }}>
                  {["given","focus","tactical","deferred","dependency"].map(tier => {
                    const td = activeDraft.decisions.filter(d=>d.tier===tier);
                    if (!td.length) return null;
                    const tierDef = H_TIERS.find(t=>t.key===tier);
                    return (
                      <div key={tier}>
                        <div style={{ fontSize:10, fontWeight:700, letterSpacing:.6,
                          textTransform:"uppercase", marginBottom:6, color:tierDef?.color||DS.inkTer }}>
                          {tierDef?.icon} {tierDef?.label} ({td.length})
                        </div>
                        <div style={{ display:"flex", flexWrap:"wrap", gap:6 }}>
                          {td.map((d,i) => (
                            <div key={i} style={{ padding:"5px 10px", borderRadius:5, fontSize:11,
                              background:tierDef?.soft||DS.canvasAlt, color:tierDef?.color||DS.ink,
                              border:`1px solid ${tierDef?.line||DS.canvasBdr}`, fontWeight:600 }}>
                              {d.label}
                              <span style={{ fontWeight:400, color:DS.inkTer, marginLeft:4 }}>
                                ({d.choices?.length||0} options)
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* CRITERIA */}
            {accepted.criteria && activeDraft.criteria?.length > 0 && (
              <div style={{ marginBottom:16, border:`1px solid ${DS.canvasBdr}`, borderRadius:8,
                overflow:"hidden", background:DS.canvas }}>
                <div style={{ padding:"10px 16px", background:DS.canvasAlt, borderBottom:`1px solid ${DS.canvasBdr}` }}>
                  <div style={{ fontSize:12, fontWeight:700, color:DS.ink }}>◫ Decision Criteria — {activeDraft.criteria.length} criteria</div>
                </div>
                <div>
                  {activeDraft.criteria.map((c,i) => (
                    <div key={i} style={{ padding:"9px 16px", display:"flex", alignItems:"center", gap:10,
                      borderBottom:i<activeDraft.criteria.length-1?`1px solid ${DS.canvasBdr}`:"none" }}>
                      <div style={{ width:4, alignSelf:"stretch", borderRadius:2, flexShrink:0,
                        background:c.weight==="high"?DS.danger:c.weight==="medium"?DS.warning:DS.inkDis }}/>
                      <div style={{ flex:1 }}>
                        <div style={{ fontSize:12, fontWeight:700, color:DS.ink, marginBottom:2 }}>{c.label}</div>
                        <div style={{ fontSize:11, color:DS.inkSub }}>{c.description}</div>
                      </div>
                      <div style={{ display:"flex", gap:5 }}>
                        <Badge variant={({financial:"green",strategic:"blue",operational:"default",risk:"danger",commercial:"amber",technical:"chrome"})[c.type]||"default"} size="xs">{c.type}</Badge>
                        <Badge variant={({high:"danger",medium:"warn",low:"default"})[c.weight]||"default"} size="xs">{c.weight}</Badge>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* STRATEGIES */}
            {accepted.strategies && activeDraft.strategies?.length > 0 && (
              <div style={{ marginBottom:16, border:`1px solid ${DS.canvasBdr}`, borderRadius:8,
                overflow:"hidden", background:DS.canvas }}>
                <div style={{ padding:"10px 16px", background:DS.canvasAlt, borderBottom:`1px solid ${DS.canvasBdr}` }}>
                  <div style={{ fontSize:12, fontWeight:700, color:DS.ink }}>⊞ Strategy Directions — {activeDraft.strategies.length} directions</div>
                </div>
                <div style={{ padding:"12px 16px", display:"grid",
                  gridTemplateColumns:"repeat(auto-fill,minmax(220px,1fr))", gap:10 }}>
                  {activeDraft.strategies.map((s,i) => {
                    const col = DS.s[i%DS.s.length];
                    return (
                      <div key={i} style={{ padding:"13px 14px", borderRadius:7,
                        border:`1.5px solid ${col.line}`, background:col.soft }}>
                        <div style={{ fontSize:10, fontWeight:700, color:col.fill,
                          letterSpacing:.6, textTransform:"uppercase", marginBottom:5 }}>
                          {DS.sNames[i]||`Strategy ${i+1}`}
                        </div>
                        <div style={{ fontSize:13, fontWeight:700, color:DS.ink, marginBottom:5 }}>{s.name}</div>
                        <div style={{ fontSize:11, color:DS.inkSub, lineHeight:1.5, marginBottom:7 }}>{s.description}</div>
                        <div style={{ padding:"4px 8px", background:"rgba(255,255,255,.65)",
                          borderRadius:4, fontSize:10, color:DS.inkSub, fontStyle:"italic" }}>
                          {s.keyTheme}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Load CTA */}
            <div style={{ padding:"18px 22px", background:DS.accentSoft, border:`1px solid ${DS.accentLine}`,
              borderRadius:10, display:"flex", alignItems:"center", justifyContent:"space-between", gap:16 }}>
              <div>
                <div style={{ fontSize:13, fontWeight:700, color:DS.ink, marginBottom:4 }}>
                  Ready to load your first draft?
                </div>
                <div style={{ fontSize:12, color:DS.inkSub }}>
                  {Object.values(accepted).filter(Boolean).length}/{sections.length} sections selected · Everything is editable once loaded.
                </div>
              </div>
              <Btn variant="primary" icon="check" size="lg" onClick={applyDraft}>Load First Draft →</Btn>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return null;
}

/* ─────────────────────────────────────────────────────────────────────────────
/* ─────────────────────────────────────────────────────────────────────────────
   ROOT APPLICATION — FINISHED BUILD
   Nav overhaul · Polish · PDF Export · Onboarding · Responsive
───────────────────────────────────────────────────────────────────────────── */

/* ── MODULE REGISTRY ──────────────────────────────────────────────────────── */
const PHASE1 = [
  { id:"problem",    num:"01", label:"Problem Definition",     sub:"Frame the decision",        icon:"◎" },
  { id:"issues",     num:"02", label:"Issue Raising",          sub:"Surface what matters",      icon:"◈" },
  { id:"hierarchy",  num:"03", label:"Decision Hierarchy",     sub:"Structure & prioritise",    icon:"◧" },
  { id:"strategy",   num:"04", label:"Strategy Table",         sub:"Build alternatives",        icon:"⊞" },
  { id:"assessment", num:"05", label:"Qualitative Assessment", sub:"Score & compare",           icon:"◫" },
  { id:"scorecard",  num:"06", label:"DQ Scorecard",           sub:"Chain analysis",            icon:"◑" },
  { id:"export",     num:"07", label:"Export & Report",        sub:"Executive package",         icon:"◉" },
];
const PHASE2 = [
  { id:"influence",  num:"08", label:"Influence Map",          sub:"Uncertainty analysis",      icon:"⊕" },
];
const MODULES = [...PHASE1, ...PHASE2];

const MODULE_NUDGES = {
  problem:    "Check if this is truly a decision — or a goal in disguise",
  issues:     "Generate issues from 5 stakeholder perspectives for this decision",
  hierarchy:  "Auto-sort the decision hierarchy across all 5 tiers",
  strategy:   "Suggest 2 genuinely distinct strategies and check coherence",
  assessment: "Score strategies and generate a decision brief",
  scorecard:  "Generate the full DQ report — identify the weakest link",
  export:     "Generate the executive package ready for the board",
  influence:  "Identify key drivers and deal-breaker scenarios",
};

/* ── PDF EXPORT ENGINE ────────────────────────────────────────────────────── */
function buildPDFContent(problem, issues, decisions, strategies, criteria,
  assessmentScores, dqScores, brief, narrative) {

  const focusDecs  = decisions.filter(d=>d.tier==="focus");
  const scoreColor = s => s>=70?"#059669":s>=45?"#d97706":"#dc2626";
  const pct = (s) => {
    if (!criteria.length) return 0;
    const total = criteria.reduce((sum,c)=>{
      const w = 2;
      return sum + (assessmentScores[`${s.id}__${c.id}`]||0)*w;
    },0);
    const max = criteria.length*5*2;
    return max>0 ? Math.round((total/max)*100) : 0;
  };
  const overall = DQ_ELEMENTS.length>0
    ? Math.round(DQ_ELEMENTS.reduce((s,e)=>s+(dqScores[e.key]||0),0)/DQ_ELEMENTS.length)
    : 0;

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8"/>
<title>${problem.projectName||"Decision Package"} — Vantage DQ</title>
<style>
  @import url('https://fonts.googleapis.com/css2?family=IBM+Plex+Sans:wght@400;500;600;700&family=Libre+Baskerville:ital,wght@0,700;1,400&display=swap');
  *{box-sizing:border-box;margin:0;padding:0}
  body{font-family:'IBM Plex Sans','Helvetica Neue',sans-serif;color:#0d0f18;background:#fff;font-size:11px;line-height:1.5}
  .page{width:210mm;min-height:297mm;padding:16mm 18mm;background:#fff;margin:0 auto}
  @media print{.page{padding:12mm 14mm;margin:0}.no-print{display:none!important}@page{size:A4;margin:0}}
  h1{font-family:'Libre Baskerville',Georgia,serif;font-size:22px;font-weight:700;line-height:1.2;letter-spacing:-.3px}
  h2{font-family:'Libre Baskerville',Georgia,serif;font-size:14px;font-weight:700;margin-bottom:8px;color:#0d0f18}
  h3{font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.8px;color:#7b82a0;margin-bottom:6px}
  .header{display:flex;align-items:flex-start;gap:16px;padding-bottom:14px;border-bottom:2px solid #0d0f18;margin-bottom:20px}
  .logo-box{width:36px;height:36px;background:#2563eb;border-radius:6px;display:flex;align-items:center;justify-content:center;flex-shrink:0}
  .badge{display:inline-flex;align-items:center;padding:2px 8px;border-radius:3px;font-size:9px;font-weight:700;letter-spacing:.5px;text-transform:uppercase;border:1px solid}
  .badge-blue{background:#eff4ff;color:#2563eb;border-color:#bfdbfe}
  .badge-green{background:#ecfdf5;color:#059669;border-color:#a7f3d0}
  .badge-warn{background:#fffbeb;color:#d97706;border-color:#fde68a}
  .badge-danger{background:#fef2f2;color:#dc2626;border-color:#fecaca}
  .badge-grey{background:#f3f4f6;color:#374151;border-color:#d1d5db}
  .section{margin-bottom:18px}
  .box{padding:12px 14px;border-radius:6px;border:1px solid;margin-bottom:10px}
  .box-blue{background:#eff4ff;border-color:#bfdbfe}
  .box-green{background:#ecfdf5;border-color:#a7f3d0}
  .box-warn{background:#fffbeb;border-color:#fde68a}
  .box-danger{background:#fef2f2;border-color:#fecaca}
  .box-grey{background:#f9fafb;border-color:#e5e7eb}
  table{width:100%;border-collapse:collapse;font-size:10px}
  th{padding:6px 10px;text-align:left;font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:.6px;color:#7b82a0;border-bottom:1px solid #e2e5ee;background:#f4f5f8}
  td{padding:7px 10px;border-bottom:1px solid #e2e5ee;vertical-align:top}
  tr:last-child td{border-bottom:none}
  .score-big{font-family:'Libre Baskerville',Georgia,serif;font-size:28px;font-weight:700;line-height:1}
  .bar-track{height:5px;background:#e2e5ee;border-radius:3px;overflow:hidden;margin-top:4px}
  .bar-fill{height:100%;border-radius:3px}
  .grid2{display:grid;grid-template-columns:1fr 1fr;gap:12px}
  .grid3{display:grid;grid-template-columns:1fr 1fr 1fr;gap:10px}
  .page-break{page-break-before:always;padding-top:16mm}
  .meta-row{display:flex;gap:20px;flex-wrap:wrap;margin-top:6px}
  .meta-item{display:flex;flex-direction:column;gap:2px}
  .meta-label{font-size:8px;text-transform:uppercase;letter-spacing:.8px;color:#9ca3af;font-weight:700}
  .meta-value{font-size:10px;font-weight:600;color:#3d4260}
  .strat-dot{display:inline-block;width:8px;height:8px;border-radius:50%;margin-right:4px;vertical-align:middle}
  .footer{margin-top:20px;padding-top:10px;border-top:1px solid #e2e5ee;display:flex;justify-content:space-between;color:#9ca3af;font-size:8px}
  .print-btn{position:fixed;bottom:24px;right:24px;padding:10px 20px;background:#2563eb;color:#fff;border:none;border-radius:8px;font-family:inherit;font-size:13px;font-weight:700;cursor:pointer;box-shadow:0 4px 16px rgba(37,99,235,.35)}
</style>
</head>
<body>
<button class="print-btn no-print" onclick="window.print()">🖨 Print / Save PDF</button>

<div class="page">

  <!-- HEADER -->
  <div class="header">
    <div class="logo-box">
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2.5" stroke-linecap="round">
        <polygon points="12,2 22,8.5 22,15.5 12,22 2,15.5 2,8.5"/>
        <line x1="12" y1="2" x2="12" y2="22"/>
        <line x1="2" y1="8.5" x2="22" y2="8.5"/>
        <line x1="2" y1="15.5" x2="22" y2="15.5"/>
      </svg>
    </div>
    <div style="flex:1">
      <div style="font-size:8px;text-transform:uppercase;letter-spacing:1.5px;color:#9ca3af;margin-bottom:4px">Vantage DQ · Decision Quality Platform</div>
      <h1>${problem.projectName||"Decision Package"}</h1>
      <div style="margin-top:6px;display:flex;gap:6px;flex-wrap:wrap">
        ${problem.projectCode?`<span class="badge badge-grey">${problem.projectCode}</span>`:""}
        ${problem.sector?`<span class="badge badge-blue">${problem.sector.split("/")[0].trim()}</span>`:""}
        ${problem.decisionType?`<span class="badge badge-grey">${problem.decisionType}</span>`:""}
        ${problem.confidentiality&&problem.confidentiality!=="Internal"?`<span class="badge badge-warn">${problem.confidentiality}</span>`:""}
      </div>
    </div>
    <div style="text-align:right;flex-shrink:0">
      ${problem.sessionDate?`<div class="meta-item" style="align-items:flex-end"><div class="meta-label">Date</div><div class="meta-value">${new Date(problem.sessionDate).toLocaleDateString("en-GB",{day:"numeric",month:"long",year:"numeric"})}</div></div>`:""}
      ${problem.facilitator?`<div class="meta-item" style="align-items:flex-end;margin-top:6px"><div class="meta-label">Facilitator</div><div class="meta-value">${problem.facilitator}</div></div>`:""}
      ${problem.owner?`<div class="meta-item" style="align-items:flex-end;margin-top:6px"><div class="meta-label">Decision Owner</div><div class="meta-value">${problem.owner}</div></div>`:""}
    </div>
  </div>

  <!-- 1. DECISION FRAME -->
  <div class="section">
    <h2>1. Decision Frame</h2>
    <div class="box box-blue" style="margin-bottom:8px">
      <div style="font-size:8px;text-transform:uppercase;letter-spacing:.8px;color:#2563eb;font-weight:700;margin-bottom:4px">Decision Statement</div>
      <div style="font-family:'Libre Baskerville',Georgia,serif;font-size:12px;font-style:italic;line-height:1.5">"${problem.decisionStatement}"</div>
    </div>
    <div class="grid2">
      ${[
        ["Context",problem.context],
        ["Trigger",problem.trigger],
        ["Scope In",problem.scopeIn],
        ["Scope Out",problem.scopeOut],
        ["Constraints",problem.constraints],
        ["Success Criteria",problem.successCriteria],
      ].filter(([,v])=>v).map(([l,v])=>`
        <div>
          <div class="meta-label">${l}</div>
          <div style="font-size:10px;margin-top:3px;line-height:1.55;color:#3d4260">${v}</div>
        </div>`).join("")}
    </div>
    ${problem.deadline?`<div style="margin-top:10px"><span class="badge badge-warn">⏱ Deadline: ${problem.deadline}</span></div>`:""}
  </div>

  <!-- 2. ISSUE SUMMARY -->
  <div class="section">
    <h2>2. Issue Landscape</h2>
    <div class="grid3" style="margin-bottom:10px">
      <div class="box box-grey" style="text-align:center">
        <div class="score-big" style="color:#0d0f18">${issues.length}</div>
        <div style="font-size:9px;color:#7b82a0;margin-top:3px">Total Issues</div>
      </div>
      <div class="box box-danger" style="text-align:center">
        <div class="score-big" style="color:#dc2626">${issues.filter(i=>i.severity==="Critical").length}</div>
        <div style="font-size:9px;color:#dc2626;margin-top:3px">Critical</div>
      </div>
      <div class="box box-warn" style="text-align:center">
        <div class="score-big" style="color:#d97706">${issues.filter(i=>i.severity==="High").length}</div>
        <div style="font-size:9px;color:#d97706;margin-top:3px">High Priority</div>
      </div>
    </div>
    <table>
      <thead><tr><th>Issue</th><th>Category</th><th>Severity</th><th>Owner</th></tr></thead>
      <tbody>
        ${issues.slice(0,12).map(i=>{
          const cat = (typeof ISSUE_CATEGORIES!=="undefined" ? ISSUE_CATEGORIES : []).find(c=>c.key===i.category);
          return `<tr>
            <td style="max-width:240px">${i.text}</td>
            <td><span class="badge badge-grey">${cat?cat.label:i.category||"—"}</span></td>
            <td><span class="badge ${i.severity==="Critical"?"badge-danger":i.severity==="High"?"badge-warn":"badge-grey"}">${i.severity}</span></td>
            <td style="color:#7b82a0">${i.owner||"—"}</td>
          </tr>`;
        }).join("")}
        ${issues.length>12?`<tr><td colspan="4" style="color:#9ca3af;font-style:italic">+ ${issues.length-12} more issues raised</td></tr>`:""}
      </tbody>
    </table>
  </div>

  <!-- 3. DECISION HIERARCHY -->
  <div class="section">
    <h2>3. Decision Hierarchy</h2>
    <div class="grid2">
      ${["given","focus","tactical","deferred","dependency"].map(tier=>{
        const td = decisions.filter(d=>d.tier===tier);
        if(!td.length) return "";
        const labels={"given":"Given Decisions","focus":"Focus Decisions","tactical":"Tactical Decisions","deferred":"Deferred","dependency":"Dependencies"};
        const colors={"given":"badge-grey","focus":"badge-blue","tactical":"badge-grey","deferred":"badge-green","dependency":"badge-warn"};
        return `<div>
          <div class="meta-label" style="margin-bottom:5px">${labels[tier]||tier} (${td.length})</div>
          ${td.map(d=>`<div style="margin-bottom:5px;padding:5px 8px;background:#f9fafb;border-radius:4px;border:1px solid #e5e7eb">
            <div style="font-weight:600;font-size:10px;margin-bottom:3px">${d.label}</div>
            <div style="display:flex;gap:4px;flex-wrap:wrap">${d.choices.slice(0,3).map(c=>`<span class="badge badge-grey">${c}</span>`).join("")}</div>
          </div>`).join("")}
        </div>`;
      }).join("")}
    </div>
  </div>

  <div class="page-break">

  <!-- 4. STRATEGY TABLE -->
  <h2 style="margin-bottom:12px">4. Strategy Table</h2>
  ${focusDecs.length>0&&strategies.length>0?`
  <table>
    <thead>
      <tr>
        <th>Decision</th>
        ${strategies.map((s,i)=>`<th style="color:${DS.s[s.colorIdx]?.fill||DS.accent}">${DS.sNames[s.colorIdx]||s.name}</th>`).join("")}
      </tr>
    </thead>
    <tbody>
      ${focusDecs.map(d=>`
        <tr>
          <td style="font-weight:600">${d.label}</td>
          ${strategies.map(s=>{
            const idx=s.selections?.[d.id];
            const col=DS.s[s.colorIdx];
            return `<td ${idx!==undefined?`style="background:${col?.soft};color:${col?.fill};font-weight:600"`:""}>${idx!==undefined?d.choices[idx]:"—"}</td>`;
          }).join("")}
        </tr>`).join("")}
    </tbody>
  </table>
  <div style="margin-top:10px;display:flex;gap:10px;flex-wrap:wrap">
    ${strategies.map((s,i)=>{
      const col=DS.s[s.colorIdx];
      const complete=focusDecs.filter(d=>s.selections?.[d.id]!==undefined).length;
      return `<div style="display:flex;align-items:center;gap:5px;padding:4px 10px;border-radius:4px;border:1px solid ${col?.line};background:${col?.soft}">
        <span class="strat-dot" style="background:${col?.fill}"></span>
        <span style="font-size:10px;font-weight:700;color:${col?.fill}">${DS.sNames[s.colorIdx]||s.name}</span>
        <span style="font-size:9px;color:#9ca3af">${complete}/${focusDecs.length} decisions</span>
        ${s.description?`<span style="font-size:9px;color:#7b82a0">· ${s.description.slice(0,50)}</span>`:""}
      </div>`;
    }).join("")}
  </div>` : `<div class="box box-grey">Strategy table not yet populated.</div>`}

  <!-- 5. QUALITATIVE ASSESSMENT -->
  <div class="section" style="margin-top:18px">
    <h2>5. Qualitative Assessment</h2>
    ${criteria.length>0&&strategies.length>0?`
    <table>
      <thead>
        <tr>
          <th>Criterion</th>
          ${strategies.map(s=>`<th style="color:${DS.s[s.colorIdx]?.fill}">${DS.sNames[s.colorIdx]||s.name}</th>`).join("")}
        </tr>
      </thead>
      <tbody>
        ${criteria.map(c=>`
          <tr>
            <td style="font-weight:600">${c.label}<div style="font-size:9px;color:#9ca3af;font-weight:400">${c.type}</div></td>
            ${strategies.map(s=>{
              const sc=assessmentScores[`${s.id}__${c.id}`]||0;
              const col=DS.s[s.colorIdx];
              const best=Math.max(...strategies.map(st=>assessmentScores[`${st.id}__${c.id}`]||0));
              return `<td style="text-align:center${sc===best&&sc>0?`;background:${col?.soft};color:${col?.fill};font-weight:700`:""}">
                ${sc>0?`${sc}/5`:"—"}
              </td>`;
            }).join("")}
          </tr>`).join("")}
        <tr style="background:#f4f5f8;font-weight:700">
          <td>Weighted Total</td>
          ${strategies.map(s=>{
            const p=pct(s);
            const col=DS.s[s.colorIdx];
            return `<td style="text-align:center;color:${col?.fill}">${p>0?`${p}%`:"—"}</td>`;
          }).join("")}
        </tr>
      </tbody>
    </table>` : `<div class="box box-grey">Qualitative assessment not yet completed.</div>`}
  </div>

  <div class="page-break">

  <!-- 6. DQ SCORECARD -->
  <h2 style="margin-bottom:12px">6. Decision Quality Scorecard</h2>
  <div class="grid2" style="margin-bottom:14px">
    <div class="box ${overall>=70?"box-green":overall>=45?"box-warn":"box-danger"}" style="text-align:center">
      <div class="score-big" style="color:${scoreColor(overall)}">${overall>0?overall:"—"}</div>
      <div style="font-size:9px;color:${scoreColor(overall)};margin-top:3px;font-weight:700;text-transform:uppercase;letter-spacing:.6px">Overall DQ Score</div>
      ${overall>0?`<div class="bar-track" style="margin-top:8px"><div class="bar-fill" style="width:${overall}%;background:${scoreColor(overall)}"></div></div>`:""}
    </div>
    <div style="display:flex;flex-direction:column;gap:5px;justify-content:center">
      ${DQ_ELEMENTS.map(el=>{
        const s=dqScores[el.key]||0;
        return `<div style="display:flex;align-items:center;gap:7px">
          <span style="font-size:11px;width:16px">${el.icon}</span>
          <span style="font-size:9px;font-weight:600;color:#3d4260;flex:1">${el.label}</span>
          <div class="bar-track" style="width:80px;flex-shrink:0"><div class="bar-fill" style="width:${s}%;background:${scoreColor(s)}"></div></div>
          <span style="font-size:10px;font-weight:700;color:${scoreColor(s)};width:24px;text-align:right">${s>0?s:"—"}</span>
        </div>`;
      }).join("")}
    </div>
  </div>

  ${narrative?.weakestLinkAnalysis?`
  <div class="box box-danger">
    <h3 style="color:#dc2626;margin-bottom:5px">Weakest Link</h3>
    <div>${narrative.weakestLinkAnalysis}</div>
  </div>`:""}

  <!-- 7. DECISION BRIEF -->
  ${brief?`
  <div class="section">
    <h2>7. Decision Brief</h2>
    ${brief.headline?`<div style="font-family:'Libre Baskerville',Georgia,serif;font-size:14px;font-style:italic;margin-bottom:10px;line-height:1.4">"${brief.headline}"</div>`:""}
    ${brief.situationSummary?`<p style="margin-bottom:10px;line-height:1.65;color:#3d4260">${brief.situationSummary}</p>`:""}
    ${brief.recommendedStrategyName?`
    <div class="box box-blue" style="margin-bottom:10px">
      <h3 style="color:#2563eb">Recommended Strategy</h3>
      <div style="font-size:13px;font-weight:700;margin-bottom:5px">${brief.recommendedStrategyName}</div>
      ${brief.recommendationRationale?`<div style="line-height:1.6">${brief.recommendationRationale}</div>`:""}
    </div>`:""}
    <div class="grid2">
      ${brief.keyTradeoff?`<div class="box box-warn"><h3 style="color:#d97706">Key Trade-off</h3><div>${brief.keyTradeoff}</div></div>`:""}
      ${brief.criticalAssumption?`<div class="box box-danger"><h3 style="color:#dc2626">Critical Assumption</h3><div>${brief.criticalAssumption}</div></div>`:""}
    </div>
  </div>`:""}

  <!-- 8. NEXT STEPS -->
  ${narrative?.priorityActions?.length?`
  <div class="section">
    <h2>8. Priority Actions</h2>
    <table>
      <thead><tr><th>#</th><th>Action</th><th>Element</th><th>Urgency</th></tr></thead>
      <tbody>
        ${narrative.priorityActions.map((a,i)=>`
          <tr>
            <td style="font-weight:700;color:#2563eb">${i+1}</td>
            <td>${a.action}</td>
            <td>${a.element||"—"}</td>
            <td><span class="badge ${a.urgency==="immediate"?"badge-danger":a.urgency==="before-deciding"?"badge-warn":"badge-green"}">${a.urgency}</span></td>
          </tr>`).join("")}
      </tbody>
    </table>
  </div>`:""}

  <!-- FOOTER -->
  <div class="footer">
    <span>Vantage DQ — Decision Quality Platform</span>
    <span>${problem.projectCode||""} ${problem.projectName||""} ${problem.confidentiality?`· ${problem.confidentiality}`:""}</span>
    <span>Generated ${new Date().toLocaleDateString("en-GB",{day:"numeric",month:"long",year:"numeric"})}</span>
  </div>

</div>
</body>
</html>`;
}

function openPDF(content) {
  const win = window.open("", "_blank");
  if (win) { win.document.write(content); win.document.close(); }
}

/* ── ONBOARDING SYSTEM ────────────────────────────────────────────────────── */
const ONBOARDING_STEPS = [
  {
    id:"welcome",
    target:"logo",
    title:"Welcome to Vantage DQ",
    body:"A Decision Quality platform that takes you from a raw problem through to a board-ready recommendation. Let's take a 60-second tour.",
    action:"Start tour →",
  },
  {
    id:"quickstart",
    target:"deepdive",
    title:"Start with AI Deep Dive",
    body:"Paste a brief, memo, or rough description of your decision. Vantage will read it and build your first draft across all modules in seconds.",
    action:"Got it →",
  },
  {
    id:"nav",
    target:"nav",
    title:"The Eight Modules",
    body:"Work through Phase 1 left to right — from framing the problem to building strategies to scoring them and producing a report. Phase 2 adds uncertainty analysis.",
    action:"Got it →",
  },
  {
    id:"copilot",
    target:"copilot",
    title:"AI Co-Pilot",
    body:"The Co-Pilot panel watches your session and surfaces contextual suggestions. Click the nudge at the top to get a module-specific recommendation.",
    action:"Got it →",
  },
  {
    id:"workshop",
    target:"workshop",
    title:"Workshop Mode",
    body:"Running a live session? Workshop Mode gives you a full-screen facilitation view — brainstorm, vote, and present strategies to the room.",
    action:"Got it →",
  },
  {
    id:"done",
    target:null,
    title:"You're ready",
    body:"Start by clicking AI Deep Dive to paste your decision context — or work through the modules manually. The platform auto-saves as you go.",
    action:"Let's go →",
  },
];

function OnboardingTooltip({ step, onNext, onSkip, totalSteps, currentStep }) {
  if (!step) return null;
  return (
    <div style={{ position:"fixed", inset:0, zIndex:500, pointerEvents:"none" }}>
      {/* Backdrop */}
      <div style={{ position:"absolute", inset:0, background:"rgba(0,0,0,.45)", pointerEvents:"auto" }}
        onClick={onSkip}/>
      {/* Tooltip card */}
      <div style={{
        position:"absolute",
        top:"50%", left:"50%",
        transform:"translate(-50%,-50%)",
        width:360, background:DS.canvas,
        borderRadius:12, padding:"22px 24px",
        boxShadow:"0 24px 60px rgba(0,0,0,.25)",
        border:`1px solid ${DS.canvasBdr}`,
        pointerEvents:"auto", zIndex:1,
        fontFamily:"'IBM Plex Sans','Helvetica Neue',sans-serif",
      }}>
        {/* Progress dots */}
        <div style={{ display:"flex", gap:5, marginBottom:14 }}>
          {Array.from({length:totalSteps}).map((_,i) => (
            <div key={i} style={{ height:3, flex:1, borderRadius:2,
              background: i<=currentStep ? DS.accent : DS.canvasBdr,
              transition:"background .2s" }}/>
          ))}
        </div>

        <div style={{ fontSize:10, fontWeight:700, color:DS.accent,
          letterSpacing:.8, textTransform:"uppercase", marginBottom:6 }}>
          {currentStep+1} of {totalSteps}
        </div>
        <div style={{ fontFamily:"'Libre Baskerville',Georgia,serif", fontSize:17,
          fontWeight:700, color:DS.ink, marginBottom:8, lineHeight:1.3 }}>
          {step.title}
        </div>
        <div style={{ fontSize:13, color:DS.inkSub, lineHeight:1.65, marginBottom:18 }}>
          {step.body}
        </div>
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center" }}>
          <button onClick={onSkip}
            style={{ background:"none", border:"none", cursor:"pointer",
              fontSize:12, color:DS.inkTer, fontFamily:"inherit" }}>
            Skip tour
          </button>
          <Btn variant="primary" onClick={onNext}>{step.action}</Btn>
        </div>
      </div>
    </div>
  );
}

function SessionHealthBar({ problem, issues, decisions, strategies, criteria, assessmentScores }) {
  const items = [
    { label:"Frame",       done: problem.decisionStatement?.length > 20 },
    { label:"Issues",      done: issues.length >= 5 },
    { label:"Hierarchy",   done: decisions.filter(d=>d.tier==="focus").length >= 3 },
    { label:"Strategies",  done: strategies.length >= 2 && strategies.some(s=>Object.keys(s.selections||{}).length>0) },
    { label:"Assessment",  done: Object.keys(assessmentScores).length > 0 },
    { label:"Criteria",    done: criteria.length >= 3 },
  ];
  const score = Math.round((items.filter(i=>i.done).length / items.length) * 100);
  const color = score>=80 ? DS.success : score>=50 ? DS.warning : DS.accent;

  return (
    <div style={{ display:"flex", alignItems:"center", gap:8 }}>
      <div style={{ display:"flex", gap:3 }}>
        {items.map((item,i) => (
          <div key={i} title={item.label}
            style={{ width:16, height:4, borderRadius:2,
              background: item.done ? color : DS.border,
              transition:"background .3s" }}/>
        ))}
      </div>
      <span style={{ fontSize:10, fontWeight:700, color, minWidth:28 }}>{score}%</span>
    </div>
  );
}

/* ── TOOLS DROPDOWN ────────────────────────────────────────────────────────── */
function ToolsMenu({ onWorkshop, onVersions, onDqi, onDeepDive, onProject, aiBusy }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    const handleClick = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const items = [
    { icon:"⊕", label:"AI Deep Dive",     sub:"Analyse a problem brief",      action:onDeepDive },
    { icon:"◉", label:"Workshop Mode",    sub:"Live facilitation view",        action:onWorkshop },
    { icon:"◷", label:"Version History",  sub:"Snapshots & restore",           action:onVersions },
    { icon:"◎", label:"DQi Dashboard",    sub:"Organisation performance",      action:onDqi },
    { icon:"◧", label:"Project Setup",    sub:"Identity & metadata",           action:onProject },
  ];

  return (
    <div ref={ref} style={{ position:"relative" }}>
      <button onClick={()=>setOpen(o=>!o)}
        style={{ padding:"5px 12px", border:`1px solid ${open?DS.accent:DS.border}`,
          borderRadius:6, background:open?DS.chromeMid:"transparent",
          color:open?DS.accent:DS.textSec, cursor:"pointer", fontSize:11,
          fontWeight:600, fontFamily:"inherit", display:"flex", alignItems:"center", gap:5,
          transition:"all .12s" }}>
        Tools
        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
          <polyline points="6,9 12,15 18,9"/>
        </svg>
      </button>

      {open && (
        <div style={{ position:"absolute", top:"calc(100% + 6px)", right:0, width:220,
          background:DS.chromeAlt, border:`1px solid ${DS.border}`, borderRadius:9,
          boxShadow:"0 8px 32px rgba(0,0,0,.3)", zIndex:200, overflow:"hidden",
          animation:"fadeUp .15s ease" }}>
          {items.map((item,i) => (
            <button key={i}
              onClick={()=>{ item.action(); setOpen(false); }}
              style={{ width:"100%", padding:"10px 14px", background:"transparent",
                border:"none", borderBottom: i<items.length-1?`1px solid ${DS.border}`:"none",
                cursor:"pointer", display:"flex", alignItems:"center", gap:10,
                fontFamily:"inherit", textAlign:"left", transition:"background .1s" }}
              onMouseEnter={e=>{ e.currentTarget.style.background=DS.chromeMid; }}
              onMouseLeave={e=>{ e.currentTarget.style.background="transparent"; }}>
              <span style={{ fontSize:14, flexShrink:0 }}>{item.icon}</span>
              <div>
                <div style={{ fontSize:12, fontWeight:600, color:DS.textSec }}>{item.label}</div>
                <div style={{ fontSize:10, color:DS.textTer }}>{item.sub}</div>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/* ── DQ PROCESS GATES ───────────────────────────────────────────────────── */
// Returns gate warnings for a given module based on current session data
const getDQGateWarnings = (module, { problem, issues, decisions, criteria, strategies, assessmentScores, dqScores }) => {
  const warnings = [];
  const focusDecs = decisions.filter(d=>d.tier==="focus");

  if (module === "problem") {
    const stmt = problem.decisionStatement || "";
    // Check decision statement is a question not a solution
    const startsAsQuestion = /^(how|what|which|should|where|when|who|why)/i.test(stmt.trim());
    const isSolution = /^(we should|we will|we need to|the answer|the solution|implement|deploy|use|adopt|choose|select)/i.test(stmt.trim());
    if (stmt.length > 10 && !startsAsQuestion)
      warnings.push({ level:"error", text:'Decision statement should start with How/What/Which/Should — it looks like a goal or solution, not a decision question.', element:"frame" });
    if (isSolution)
      warnings.push({ level:"error", text:'This reads as a predetermined solution, not an open decision. Reframe as a question to preserve genuine strategic choice.', element:"frame" });
    if (!problem.owner)
      warnings.push({ level:"warn", text:'No decision owner assigned. Every decision needs a clear owner with authority to decide.', element:"commitment" });
    if (!problem.scopeIn && !problem.scopeOut)
      warnings.push({ level:"warn", text:'Scope is undefined. Explicitly stating what is in and out of scope prevents the decision from expanding or contracting unintentionally.', element:"frame" });
  }

  if (module === "issues") {
    if (issues.length < 5)
      warnings.push({ level:"warn", text:`Only ${issues.length} issues raised. Fewer than 5 issues suggests the problem hasn't been fully explored from all stakeholder perspectives.`, element:"information" });
    const brutals = issues.filter(i=>i.category==="brutal-truth");
    if (brutals.length === 0 && issues.length >= 5)
      warnings.push({ level:"warn", text:'No brutal truths raised. Every real decision has uncomfortable realities the team may be avoiding. Surface them now before they surface later.', element:"frame" });
    const assumptions = issues.filter(i=>i.category==="assumption");
    if (assumptions.length === 0 && issues.length >= 5)
      warnings.push({ level:"warn", text:'No assumptions identified. Every decision rests on assumptions — not identifying them is itself a DQ risk.', element:"information" });
  }

  if (module === "hierarchy") {
    if (focusDecs.length === 0)
      warnings.push({ level:"error", text:'No Focus decisions defined. Without at least 2 Focus decisions you cannot build meaningfully distinct strategies.', element:"alternatives" });
    if (focusDecs.length === 1)
      warnings.push({ level:"warn", text:'Only 1 Focus decision. Strategies built on a single fork are rarely genuinely distinct. Consider whether there are more strategic choices to surface.', element:"alternatives" });
    if (criteria.length === 0)
      warnings.push({ level:"error", text:'No decision criteria defined. Without criteria you cannot evaluate strategies — you would be choosing based on gut feel, not values.', element:"values" });
    if (criteria.length < 3)
      warnings.push({ level:"warn", text:`Only ${criteria.length} criteria. A robust qualitative assessment typically needs 4-7 criteria to meaningfully differentiate strategies.`, element:"values" });
  }

  if (module === "strategy") {
    if (strategies.length < 2)
      warnings.push({ level:"error", text:'Fewer than 2 strategies. You need at least 2 genuine alternatives — a single option is a decision already made, not a decision being evaluated.', element:"alternatives" });
    if (strategies.length >= 2) {
      // Check for strategies that are too similar
      strategies.forEach((s1, i) => {
        strategies.slice(i+1).forEach(s2 => {
          const sharedKeys = focusDecs.filter(d=>
            s1.selections[d.id]!==undefined &&
            s1.selections[d.id]===s2.selections[d.id]
          ).length;
          const totalKeys = focusDecs.filter(d=>
            s1.selections[d.id]!==undefined || s2.selections[d.id]!==undefined
          ).length;
          if (totalKeys > 0 && sharedKeys/totalKeys > 0.6)
            warnings.push({ level:"warn", text:`"${s1.name}" and "${s2.name}" share ${Math.round(sharedKeys/totalKeys*100)}% of their choices — they may not be genuinely distinct strategies. The point of alternatives is real strategic difference.`, element:"alternatives" });
        });
      });
    }
    const incomplete = strategies.filter(s=>{
      const filled = focusDecs.filter(d=>s.selections[d.id]!==undefined).length;
      return focusDecs.length > 0 && filled/focusDecs.length < 0.5;
    });
    if (incomplete.length > 0)
      warnings.push({ level:"warn", text:`${incomplete.map(s=>s.name).join(", ")} ${incomplete.length===1?"is":"are"} less than 50% complete. Incomplete strategies cannot be meaningfully compared.`, element:"alternatives" });
  }

  if (module === "assessment") {
    const totalCells = strategies.length * criteria.length;
    const scoredCells = Object.keys(assessmentScores).length;
    if (totalCells > 0 && scoredCells < totalCells)
      warnings.push({ level:"warn", text:`${totalCells-scoredCells} cells unscored. A partial assessment risks producing a biased recommendation — score all strategies on all criteria.`, element:"values" });
    if (strategies.length >= 2 && criteria.length >= 2) {
      // Check if all strategies score the same — no differentiation
      const totals = strategies.map(s=>criteria.reduce((sum,c)=>sum+(assessmentScores[s.id+"__"+c.id]||0),0));
      const maxDiff = Math.max(...totals) - Math.min(...totals);
      if (scoredCells === totalCells && maxDiff < 3)
        warnings.push({ level:"warn", text:'Strategies score nearly identically. Either the criteria are not discriminating or the scoring is undifferentiated — both are DQ problems. Review whether your criteria genuinely reveal differences between strategies.', element:"values" });
    }
  }

  if (module === "scorecard") {
    const commitmentScore = dqScores["commitment"] || 0;
    if (commitmentScore > 0 && commitmentScore < 50)
      warnings.push({ level:"error", text:`Commitment scores ${commitmentScore}/100 — the weakest DQ element. A decision without stakeholder commitment will not be implemented. Address alignment issues before archiving this decision.`, element:"commitment" });
    const minScore = Math.min(...Object.values(dqScores).filter(s=>s>0));
    const overallDQ = DQ_ELEMENTS.length > 0
      ? Math.round(DQ_ELEMENTS.reduce((s,e)=>s+(dqScores[e.key]||0),0)/DQ_ELEMENTS.length) : 0;
    if (overallDQ > 0 && minScore < 35)
      warnings.push({ level:"error", text:`One DQ element scores below 35/100. The chain is only as strong as its weakest link — a critically weak element degrades the entire decision quality regardless of other scores.`, element:"frame" });
  }

  return warnings;
};

// DQ Gate Warning Banner shown at top of each module
function DQGateWarnings({ warnings }) {
  const [dismissed, setDismissed] = useState([]);
  const visible = warnings.filter((_,i)=>!dismissed.includes(i));
  if (visible.length === 0) return null;

  return (
    <div style={{ flexShrink:0, borderBottom:`1px solid ${DS.canvasBdr}` }}>
      {visible.slice(0,3).map((w, i) => (
        <div key={i} style={{ padding:"9px 16px 9px 14px",
          background: w.level==="error" ? "#fff5f5" : "#fffbeb",
          borderLeft:`3px solid ${w.level==="error"?DS.danger:DS.warning}`,
          display:"flex", alignItems:"flex-start", gap:10 }}>
          <span style={{ fontSize:12, flexShrink:0, marginTop:1 }}>
            {w.level==="error" ? "⚠" : "◐"}
          </span>
          <div style={{ flex:1 }}>
            <span style={{ fontSize:11,
              color: w.level==="error" ? DS.danger : "#92400e",
              lineHeight:1.5 }}>{w.text}</span>
            {w.element && (
              <span style={{ marginLeft:8, fontSize:9, fontWeight:700,
                color: w.level==="error" ? DS.danger : DS.warning,
                textTransform:"uppercase", letterSpacing:.6,
                padding:"1px 5px", borderRadius:3,
                background: w.level==="error" ? DS.dangerSoft : DS.warnSoft,
                border:`1px solid ${w.level==="error"?DS.dangerLine:DS.warnLine}` }}>
                DQ: {w.element}
              </span>
            )}
          </div>
          <button onClick={()=>setDismissed(d=>[...d,i])}
            style={{ background:"none", border:"none", cursor:"pointer",
              color:DS.inkDis, fontSize:14, lineHeight:1, flexShrink:0, padding:2 }}>×</button>
        </div>
      ))}
      {warnings.filter((_,i)=>!dismissed.includes(i)).length > 3 && (
        <div style={{ padding:"5px 16px", background:"#fffbeb",
          fontSize:10, color:DS.warning, fontWeight:600 }}>
          + {warnings.filter((_,i)=>!dismissed.includes(i)).length - 3} more DQ warnings
        </div>
      )}
    </div>
  );
}

/* ── TAB PICKER MODAL ───────────────────────────────────────────────────── */
const TAB_TYPE_OPTIONS = [
  { type:"strategy", icon:"⊞", label:"Strategy Table", desc:"Build a parallel set of strategies for a sub-decision or scenario" },
  { type:"assessment", icon:"◫", label:"Qualitative Assessment", desc:"Score a different set of strategies or criteria" },
  { type:"compare", icon:"⊟", label:"Compare & Contrast", desc:"Side-by-side comparison of any two sets of strategies" },
  { type:"issues", icon:"◈", label:"Issue Register", desc:"Capture issues for a specific workstream or stakeholder group" },
  { type:"hierarchy", icon:"◧", label:"Decision Hierarchy", desc:"Structure decisions for a sub-problem or workstream" }
];

function TabPickerModal({ onAdd, onClose }) {
  const [selected, setSelected] = useState(null);
  const [label, setLabel] = useState("");

  const handleAdd = () => {
    if (!selected) return;
    const opt = TAB_TYPE_OPTIONS.find(t=>t.type===selected);
    const finalLabel = label.trim() || opt.label + " 2";
    onAdd({ id: uid("tab"), type: selected, label: finalLabel, data: {} });
    onClose();
  };

  return (
    <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,.55)",
      display:"flex", alignItems:"center", justifyContent:"center", zIndex:9000 }}
      onClick={e=>{ if(e.target===e.currentTarget) onClose(); }}>
      <div style={{ width:520, background:DS.canvas, borderRadius:14,
        boxShadow:"0 24px 64px rgba(0,0,0,.25)", overflow:"hidden" }}>
        <div style={{ padding:"20px 24px", borderBottom:"1px solid "+DS.canvasBdr }}>
          <div style={{ fontSize:16, fontWeight:700, color:DS.ink, marginBottom:3 }}>
            Add New Workspace Tab
          </div>
          <div style={{ fontSize:12, color:DS.inkTer }}>
            Create a duplicate workspace for parallel analysis or scenario planning
          </div>
        </div>
        <div style={{ padding:"16px 24px" }}>
          <div style={{ fontSize:10, fontWeight:700, color:DS.inkTer,
            letterSpacing:.6, textTransform:"uppercase", marginBottom:10 }}>
            Choose workspace type
          </div>
          <div style={{ display:"flex", flexDirection:"column", gap:8, marginBottom:18 }}>
            {TAB_TYPE_OPTIONS.map(opt => (
              <button key={opt.type}
                onClick={()=>{ setSelected(opt.type); setLabel(opt.label + " 2"); }}
                style={{ display:"flex", alignItems:"center", gap:12,
                  padding:"11px 14px", borderRadius:8, cursor:"pointer",
                  fontFamily:"inherit", textAlign:"left",
                  border:"1.5px solid "+(selected===opt.type?DS.accent:DS.canvasBdr),
                  background:selected===opt.type?DS.accentSoft:"transparent",
                  transition:"all .1s" }}>
                <span style={{ fontSize:18, flexShrink:0 }}>{opt.icon}</span>
                <div>
                  <div style={{ fontSize:13, fontWeight:700,
                    color:selected===opt.type?DS.accent:DS.ink }}>{opt.label}</div>
                  <div style={{ fontSize:11, color:DS.inkTer }}>{opt.desc}</div>
                </div>
              </button>
            ))}
          </div>
          {selected && (
            <div style={{ marginBottom:16 }}>
              <div style={{ fontSize:10, fontWeight:700, color:DS.inkTer,
                letterSpacing:.6, textTransform:"uppercase", marginBottom:6 }}>
                Tab name
              </div>
              <input value={label} onChange={e=>setLabel(e.target.value)}
                style={{ width:"100%", padding:"9px 12px", fontSize:13,
                  fontFamily:"inherit", background:DS.canvas,
                  border:"1px solid "+DS.canvasBdr, borderRadius:7,
                  color:DS.ink, outline:"none", boxSizing:"border-box" }}
                onFocus={e=>e.target.style.borderColor=DS.accent}
                onBlur={e=>e.target.style.borderColor=DS.canvasBdr}
                placeholder="Name this workspace..."/>
            </div>
          )}
        </div>
        <div style={{ padding:"14px 24px", borderTop:"1px solid "+DS.canvasBdr,
          display:"flex", gap:10, justifyContent:"flex-end" }}>
          <Btn variant="secondary" onClick={onClose}>Cancel</Btn>
          <Btn variant="primary" onClick={handleAdd}
            disabled={!selected || !label.trim()}>
            Add Tab →
          </Btn>
        </div>
      </div>
    </div>
  );
}

/* ── CROSS-MODULE NUDGE SYSTEM ──────────────────────────────────────────── */
function NudgeBar({ module, issues, decisions, criteria, strategies, assessmentScores, dqScores, onNavigate }) {
  const nudges = [];
  const focusDecs = decisions.filter(d=>d.tier==="focus");
  const criticalIssues = issues.filter(i=>i.severity==="Critical"&&i.status==="Open");
  const promotableIssues = issues.filter(i=>
    (i.category==="focus-decision"||i.category==="given-decision"||i.category==="tactical-decision")
    && !decisions.find(d=>d.sourceId===i.id)
  );
  const promotableCriteria = issues.filter(i=>
    i.category==="decision-criteria" && !criteria.find(c=>c.sourceId===i.id)
  );
  const unscored = strategies.length > 0 && criteria.length > 0
    ? strategies.filter(s=>criteria.every(c=>!assessmentScores[s.id+"__"+c.id])).length
    : 0;
  const dqScored = Object.values(dqScores).some(s=>s>0);

  // Generate contextual nudges based on current module and data state
  if (module==="problem" && issues.length===0)
    nudges.push({ text:"Ready to surface issues? Move to Issue Raising.", target:"issues", icon:"◈", color:DS.accent });
  if (module==="issues" && promotableIssues.length>0)
    nudges.push({ text:promotableIssues.length+" decision-type issues ready to promote to hierarchy.", target:"hierarchy", icon:"◧", color:DS.warning });
  if (module==="issues" && promotableCriteria.length>0)
    nudges.push({ text:promotableCriteria.length+" criteria-type issues ready to promote.", target:"hierarchy", icon:"◫", color:DS.success });
  if (module==="issues" && criticalIssues.length>0)
    nudges.push({ text:criticalIssues.length+" critical issues unresolved. Address before building strategies.", target:"issues", icon:"⚡", color:DS.danger });
  if (module==="hierarchy" && focusDecs.length===0)
    nudges.push({ text:"No Focus decisions yet. At least 2 are needed to build meaningful strategies.", target:"hierarchy", icon:"⊕", color:DS.danger });
  if (module==="hierarchy" && focusDecs.length>0 && strategies.length===0)
    nudges.push({ text:focusDecs.length+" focus decisions ready. Build your strategies now.", target:"strategy", icon:"⊞", color:DS.accent });
  if (module==="hierarchy" && criteria.length===0)
    nudges.push({ text:"No decision criteria yet. Add criteria to enable qualitative assessment.", target:"hierarchy", icon:"◫", color:DS.warning });
  if (module==="strategy" && strategies.length>0 && criteria.length>0 && unscored===strategies.length)
    nudges.push({ text:"Strategies built. Run AI Initial Assessment to score them.", target:"assessment", icon:"◫", color:DS.accent });
  if (module==="assessment" && Object.keys(assessmentScores).length>0 && !dqScored)
    nudges.push({ text:"Assessment complete. Score the DQ elements to generate your full report.", target:"scorecard", icon:"◑", color:DS.accent });
  if (module==="scorecard" && dqScored)
    nudges.push({ text:"DQ scored. Generate the executive package in Export & Report.", target:"export", icon:"◉", color:DS.success });

  if (nudges.length===0) return null;

  return (
    <div style={{ padding:"0 16px 10px", display:"flex", flexDirection:"column", gap:5 }}>
      {nudges.slice(0,2).map((n,i)=>(
        <button key={i} onClick={()=>onNavigate(n.target)}
          style={{ display:"flex", alignItems:"flex-start", gap:8, padding:"8px 10px",
            background:"transparent", border:`1px solid ${n.color}40`,
            borderRadius:6, cursor:"pointer", fontFamily:"inherit", textAlign:"left",
            transition:"all .12s", width:"100%" }}
          onMouseEnter={e=>{ e.currentTarget.style.background=n.color+"12"; e.currentTarget.style.borderColor=n.color; }}
          onMouseLeave={e=>{ e.currentTarget.style.background="transparent"; e.currentTarget.style.borderColor=n.color+"40"; }}>
          <span style={{ fontSize:12, flexShrink:0, marginTop:1 }}>{n.icon}</span>
          <span style={{ fontSize:10, color:DS.textSec, lineHeight:1.5, flex:1 }}>{n.text}</span>
          <Svg path={ICONS.chevR} size={11} color={DS.textTer}/>
        </button>
      ))}
    </div>
  );
}


function CrossModuleAI({ problem, issues, decisions, criteria, strategies, assessmentScores, dqScores, aiCall, aiBusy, onClose }) {
  const [running, setRunning] = useState(false);
  const [insights, setInsights] = useState(null);

  const run = () => {
    setRunning(true);
    const focusDecs = decisions.filter(d=>d.tier==="focus");
    const scored = Object.keys(assessmentScores).length;
    const dqOverall = Object.values(dqScores).filter(s=>s>0).length > 0
      ? Math.round(Object.values(dqScores).reduce((a,b)=>a+b,0)/Object.values(dqScores).filter(s=>s>0).length)
      : 0;

    aiCall(dqPrompt(
      "You are a senior DQ expert performing a cross-module intelligence audit. " +
      "Decision: " + (problem.decisionStatement||"Not defined") + ". " +
      "Frame quality: owner=" + (problem.owner?"set":"missing") + ", scope=" + (problem.scopeIn?"set":"missing") + ". " +
      "Issues: " + issues.length + " raised, " + issues.filter(i=>i.category==="brutal-truth").length + " brutal truths, " + issues.filter(i=>i.category==="assumption").length + " assumptions. " +
      "Hierarchy: " + focusDecs.length + " focus decisions, " + criteria.length + " criteria. " +
      "Strategies: " + strategies.length + " built, completeness varies. " +
      "Assessment: " + scored + " cells scored. " +
      "DQ Scores: " + Object.entries(dqScores).map(([k,v])=>k+":"+v).join(", ") + ". " +
      "Analyse coherence across all modules. Identify gaps between modules. " +
      'Return ONLY JSON: {"sessionCoherenceScore":72,"coherenceAnalysis":"2 sentences","moduleGaps":[{"module":"issues","gap":"desc","severity":"high"}],"crossModuleInsights":["insight 1"],"recommendedFocus":"what to work on next","facilitatorNotes":"practical note"}'
    ), (r) => {
      let result = r;
      if (r._raw) { try { result = JSON.parse(r._raw.replace(/```json|```/g,"").trim()); } catch(e) { setRunning(false); return; } }
      setInsights(result);
      setRunning(false);
    });
  };

  return (
    <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,.5)",
      display:"flex", alignItems:"center", justifyContent:"center", zIndex:8000 }}
      onClick={e=>{ if(e.target===e.currentTarget) onClose(); }}>
      <div style={{ width:"100%", maxWidth:620, background:DS.canvas,
        borderRadius:14, boxShadow:"0 24px 64px rgba(0,0,0,.25)",
        overflow:"hidden", maxHeight:"85vh", display:"flex", flexDirection:"column" }}>
        <div style={{ padding:"20px 24px", borderBottom:"1px solid "+DS.canvasBdr,
          display:"flex", alignItems:"center", gap:12 }}>
          <div style={{ flex:1 }}>
            <div style={{ fontSize:16, fontWeight:700, color:DS.ink }}>Cross-Module AI Analysis</div>
            <div style={{ fontSize:11, color:DS.inkTer }}>Session coherence audit across all 8 modules</div>
          </div>
          <button onClick={onClose} style={{ background:"none", border:"none",
            cursor:"pointer", color:DS.inkTer, fontSize:18 }}>×</button>
        </div>
        <div style={{ flex:1, overflowY:"auto", padding:"20px 24px" }}>
          {!insights ? (
            <div style={{ textAlign:"center", padding:"32px 0" }}>
              <div style={{ fontSize:13, color:DS.inkSub, marginBottom:20, lineHeight:1.7 }}>
                Analyses coherence across all modules — checks if issues connect to decisions,
                strategies address key uncertainties, and the frame remains valid.
              </div>
              <Btn variant="primary" icon="spark" onClick={run} disabled={running||aiBusy}>
                {running?"Analysing…":"Run Cross-Module Analysis"}
              </Btn>
            </div>
          ) : (
            <div>
              <div style={{ display:"flex", alignItems:"center", gap:12, marginBottom:20,
                padding:"16px 18px", background:DS.accentSoft,
                border:"1px solid "+DS.accentLine, borderRadius:10 }}>
                <div style={{ fontFamily:"'Libre Baskerville',serif",
                  fontSize:36, fontWeight:700, color:DS.accent }}>
                  {insights.sessionCoherenceScore}
                </div>
                <div>
                  <div style={{ fontSize:12, fontWeight:700, color:DS.ink }}>Session Coherence Score</div>
                  <div style={{ fontSize:11, color:DS.inkSub }}>{insights.coherenceAnalysis}</div>
                </div>
              </div>
              {insights.moduleGaps?.length > 0 && (
                <div style={{ marginBottom:16 }}>
                  <div style={{ fontSize:10, fontWeight:700, color:DS.inkTer,
                    letterSpacing:.6, textTransform:"uppercase", marginBottom:8 }}>Module Gaps</div>
                  {insights.moduleGaps.map((g,i)=>(
                    <div key={i} style={{ padding:"10px 14px", marginBottom:6,
                      background:g.severity==="high"?DS.dangerSoft:DS.warnSoft,
                      border:"1px solid "+(g.severity==="high"?DS.dangerLine:DS.warnLine),
                      borderRadius:7, fontSize:12 }}>
                      <strong style={{ textTransform:"capitalize" }}>{g.module}:</strong> {g.gap}
                    </div>
                  ))}
                </div>
              )}
              {insights.crossModuleInsights?.length > 0 && (
                <div style={{ marginBottom:16 }}>
                  <div style={{ fontSize:10, fontWeight:700, color:DS.inkTer,
                    letterSpacing:.6, textTransform:"uppercase", marginBottom:8 }}>Key Insights</div>
                  {insights.crossModuleInsights.map((ins,i)=>(
                    <div key={i} style={{ padding:"8px 12px", marginBottom:5,
                      background:DS.canvasAlt, border:"1px solid "+DS.canvasBdr,
                      borderRadius:6, fontSize:12, color:DS.ink }}>
                      · {ins}
                    </div>
                  ))}
                </div>
              )}
              {insights.recommendedFocus && (
                <div style={{ padding:"14px 16px", background:DS.successSoft,
                  border:"1px solid "+DS.successLine, borderRadius:8, marginBottom:12 }}>
                  <div style={{ fontSize:10, fontWeight:700, color:DS.success,
                    letterSpacing:.6, textTransform:"uppercase", marginBottom:4 }}>
                    Recommended Focus
                  </div>
                  <div style={{ fontSize:12, color:DS.ink }}>{insights.recommendedFocus}</div>
                </div>
              )}
              {insights.facilitatorNotes && (
                <div style={{ fontSize:11, color:DS.inkSub, fontStyle:"italic",
                  padding:"10px 14px", background:DS.canvasAlt,
                  borderRadius:7, border:"1px solid "+DS.canvasBdr }}>
                  Facilitator note: {insights.facilitatorNotes}
                </div>
              )}
              <div style={{ marginTop:16, textAlign:"center" }}>
                <Btn variant="secondary" size="sm" onClick={()=>{ setInsights(null); }}>
                  Run Again
                </Btn>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* ── MAIN APP ─────────────────────────────────────────────────────────────── */
export default function App() {
  const [module, setModule]               = useState("problem");
  const [customTabs, setCustomTabs]       = useState([]);
  const [showTabPicker, setShowTabPicker] = useState(false);
  const [problem, setProblem]             = useState(defaultProblem);
  const [issues, setIssues]               = useState(defaultIssues);
  const [decisions, setDecisions]         = useState(defaultDecisions);
  const [criteria, setCriteria]           = useState(defaultCriteria);
  const [strategies, setStrategies]       = useState(defaultStrategies);
  const [assessmentScores, setAssessmentScores] = useState({});
  const [dqScores, setDqScores]           = useState({});
  const [brief, setBriefState]            = useState(null);
  const [narrative, setNarrativeState]    = useState(null);
  const [aiMessages, setAIMessages]       = useState([]);

  // UI state
  const [showAI, setShowAI]               = useState(true);
  const [showQuickStart, setShowQuickStart] = useState(true);
  const [workshopOpen, setWorkshopOpen]   = useState(false);
  const [versionOpen, setVersionOpen]     = useState(false);
  const [dqiOpen, setDqiOpen]             = useState(false);
  const [projectSetupOpen, setProjectSetupOpen] = useState(false);
  const [navCollapsed, setNavCollapsed]   = useState(false);

  // Onboarding
  const [onboardingStep, setOnboardingStep] = useState(-1);

  const { busy: aiBusy, call: aiCall, validateDQOutput } = useAI();
  const pushAIMsg = (msg) => setAIMessages(m=>[...m, msg]);

  // Auto-save
  useEffect(() => {
    saveSession({ problem, issues, decisions, criteria, strategies, assessmentScores, dqScores });
  }, [problem, issues, decisions, criteria, strategies, assessmentScores, dqScores]);

  // Onboarding complete
  const finishOnboarding = () => {
    try { localStorage.setItem("vantage_onboarded","1"); } catch {}
    setOnboardingStep(-1);
  };

  // QuickStart complete handler
  const handleQuickStartComplete = (draft, accepted) => {
    if (accepted.frame && draft.frame) {
      setProblem(p => ({
        ...p,
        projectName:        draft.projectName || p.projectName,
        decisionStatement:  draft.frame.decisionStatement  || p.decisionStatement,
        context:            draft.frame.context             || p.context,
        background:         draft.frame.background          || p.background,
        trigger:            draft.frame.trigger             || p.trigger,
        symptoms:           draft.frame.symptoms            || p.symptoms,
        rootDecision:       draft.frame.rootDecision        || p.rootDecision,
        scopeIn:            draft.frame.scopeIn             || p.scopeIn,
        scopeOut:           draft.frame.scopeOut            || p.scopeOut,
        timeHorizon:        draft.frame.timeHorizon         || p.timeHorizon,
        deadline:           draft.frame.deadline            || p.deadline,
        owner:              draft.frame.owner               || p.owner,
        stakeholders:       draft.frame.stakeholders?.length
                              ? draft.frame.stakeholders.map(s=>({...s,id:uid("sh")}))
                              : p.stakeholders,
        constraints:        draft.frame.constraints         || p.constraints,
        assumptions:        draft.frame.assumptions         || p.assumptions,
        successCriteria:    draft.frame.successCriteria     || p.successCriteria,
        failureConsequences:draft.frame.failureConsequences || p.failureConsequences,
        urgency:            draft.frame.urgency             || p.urgency,
        importance:         draft.frame.importance          || p.importance,
      }));
    }
    if (accepted.issues && draft.issues?.length) {
      const typeToCategory = {
        "Risk":"uncertainty-external","Opportunity":"opportunity","Constraint":"constraint",
        "Assumption":"assumption","Stakeholder Concern":"stakeholder-concern",
        "Operational":"uncertainty-internal","Financial":"uncertainty-internal",
        "Technical":"uncertainty-internal","Strategic":"focus-decision",
        "Regulatory":"uncertainty-external","Data Gap":"information-gap",
        "Open Question":"information-gap","Dependency":"uncertainty-external",
      };
      setIssues(draft.issues.map(i => ({
        id:uid("iss"), text:i.text,
        category: i.category || typeToCategory[i.type] || "uncertainty-external",
        severity: i.severity || "Medium", status:"Open", owner:"", votes:0,
      })));
    }
    if (accepted.decisions && draft.decisions?.length) {
      setDecisions(draft.decisions.map(d => ({
        id:uid("d"), label:d.label, choices:d.choices||["Option A","Option B"],
        tier:d.tier||"focus", owner:d.owner||"", rationale:d.rationale||"", sourceId:null,
      })));
    }
    if (accepted.criteria && draft.criteria?.length) {
      setCriteria(draft.criteria.map(c => ({
        id:uid("cr"), label:c.label, type:c.type||"strategic",
        weight:c.weight||"medium", description:c.description||"",
      })));
    }
    if (accepted.strategies && draft.strategies?.length) {
      setStrategies(draft.strategies.map((s,i) => ({
        id:uid("s"), colorIdx:i%DS.s.length,
        name:s.name||DS.sNames[i]||`Strategy ${i+1}`,
        description:s.description||"", selections:{}, rationale:{},
      })));
    }
    setShowQuickStart(false);
    setModule("problem");
    // Validate the loaded draft against DQ principles
    const dqWarnings = [];
    if (draft.frame?.decisionStatement) {
      const stmt = draft.frame.decisionStatement;
      const isQ = /^(how|what|which|should|where|when|who|why)/i.test(stmt.trim());
      if (!isQ) dqWarnings.push("The AI-generated decision statement may not be well-formed as a DQ question — review it in Problem Definition.");
    }
    if (draft.strategies && draft.strategies.length < 2)
      dqWarnings.push("Fewer than 2 strategies generated — add more alternatives before proceeding to assessment.");
    const msg = dqWarnings.length > 0
      ? "First draft loaded. DQ note: " + dqWarnings.join(" | ")
      : "First draft loaded. Project: " + (draft.projectName||"Untitled") + ". Review each module and refine with your team.";
    pushAIMsg({ role:"ai", text: msg });
    // Show onboarding after first draft load if not seen before
    try { if (!localStorage.getItem("vantage_onboarded")) setOnboardingStep(0); } catch {}
  };

  const handleAISend = (text) => {
    pushAIMsg({ role:"user", text });
    const ctx = `Project:"${problem.projectName||problem.decisionStatement}" | Module:${module} | Issues:${issues.length} | Focus:${decisions.filter(d=>d.tier==="focus").length} | Strategies:${strategies.length} | Criteria:${criteria.length}`;
    aiCall(`You are a DQ expert facilitator bound by Decision Quality methodology. Context: ${ctx}\n\nQuestion: "${text}"\n\nReply in 80 words or less. Plain text only.`,
      r => pushAIMsg({ role:"ai", text:(r._raw||r.error||(typeof r==="string"?r:JSON.stringify(r))).slice(0,300) })
    );
  };

  const moduleCompletion = (id) => {
    if (id==="problem")    return problem.decisionStatement?.length>20&&problem.owner?.length>2 ? 100 : 40;
    if (id==="issues")     return Math.min(100, issues.length*12);
    if (id==="hierarchy")  return decisions.filter(d=>d.tier==="focus").length>0&&criteria.length>0 ? 100 : decisions.filter(d=>d.tier==="focus").length>0 ? 60 : 0;
    if (id==="strategy")   return strategies.length>0&&strategies.some(s=>Object.keys(s.selections||{}).length>0) ? 100 : 20;
    if (id==="assessment") return Object.keys(assessmentScores).length>0 ? 100 : 0;
    if (id==="scorecard")  return Object.values(dqScores).some(s=>s>0) ? 100 : 0;
    if (id==="export")     return brief||narrative ? 100 : 0;
    if (id==="influence")  return 0;
    return 0;
  };

  const overall = Math.round(MODULES.filter(m=>m.id!=="influence").reduce((s,m)=>s+moduleCompletion(m.id),0)/PHASE1.length);

  // DQ gate warnings for current module
  const gateWarnings = getDQGateWarnings(module, { problem, issues, decisions, criteria, strategies, assessmentScores, dqScores });

  // PDF export
  const handlePDFExport = () => {
    const html = buildPDFContent(problem, issues, decisions, strategies, criteria,
      assessmentScores, dqScores, brief, narrative);
    openPDF(html);
  };

  const moduleProps = {
    problem: { data:problem, onChange:setProblem, aiCall, aiBusy, messages:aiMessages, onAIMsg:pushAIMsg, onAISend:handleAISend },
    issues:  { issues, onChange:setIssues, decisions, onDecisions:setDecisions, criteria, onCriteria:setCriteria, problem, aiCall, aiBusy, onAIMsg:pushAIMsg },
    hierarchy:{ decisions, criteria, onDecisions:setDecisions, onCriteria:setCriteria, issues, aiCall, aiBusy, onAIMsg:pushAIMsg },
    strategy: { decisions, strategies, onChange:setStrategies, onChange2:setDecisions, aiCall, aiBusy, problem, onAIMsg:pushAIMsg },
    assessment:{ strategies, decisions, criteria, problem, scores:assessmentScores, onScores:setAssessmentScores, brief, onBrief:setBriefState, aiCall, aiBusy, onAIMsg:pushAIMsg },
    scorecard: { problem, issues, decisions, strategies, criteria, assessmentScores, brief, scores:dqScores, onScores:setDqScores, aiCall, aiBusy, onAIMsg:pushAIMsg },
    export:    { problem, issues, decisions, criteria, strategies, assessmentScores, dqScores, brief, narrative, aiCall, aiBusy, onAIMsg:pushAIMsg },
    influence: { issues, decisions, strategies, aiCall, aiBusy, onAIMsg:pushAIMsg },
  };

  return (
    <div style={{ display:"flex", height:"100vh", background:DS.chrome, overflow:"hidden",
      fontFamily:"'IBM Plex Sans','Helvetica Neue',sans-serif", color:DS.textPri }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=IBM+Plex+Sans:wght@400;500;600;700&family=Libre+Baskerville:ital,wght@0,700;1,400&display=swap');
        *{box-sizing:border-box;margin:0;padding:0}
        ::-webkit-scrollbar{width:5px;height:5px}
        ::-webkit-scrollbar-track{background:transparent}
        ::-webkit-scrollbar-thumb{background:${DS.border};border-radius:3px}
        ::-webkit-scrollbar-thumb:hover{background:${DS.borderMid}}
        input,textarea,button,select{font-family:inherit}
        @keyframes aipulse{0%,100%{opacity:.2;transform:scale(.7)}50%{opacity:1;transform:scale(1)}}
        @keyframes slideIn{from{opacity:0;transform:translateX(-6px)}to{opacity:1;transform:translateX(0)}}
        @keyframes fadeUp{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:translateY(0)}}
        @keyframes fadeIn{from{opacity:0}to{opacity:1}}
        body{background:#252d3d}
        @media (max-width:900px){
          .nav-rail{width:52px!important}
          .nav-label{display:none!important}
          .nav-sub{display:none!important}
          .top-breadcrumb{display:none!important}
          .ai-panel-wrap{display:none!important}
        }
        @media (max-width:640px){
          .module-padding{padding:14px 16px!important}
          .grid-2col{grid-template-columns:1fr!important}
          .strategy-grid{grid-template-columns:1fr!important}
        }
      `}</style>

      {/* Quick Start */}
      {showQuickStart && (
        <QuickStartScreen onComplete={handleQuickStartComplete} onSkip={()=>setShowQuickStart(false)}/>
      )}

      {/* Onboarding */}
      {onboardingStep >= 0 && onboardingStep < ONBOARDING_STEPS.length && (
        <OnboardingTooltip
          step={ONBOARDING_STEPS[onboardingStep]}
          currentStep={onboardingStep}
          totalSteps={ONBOARDING_STEPS.length}
          onNext={()=>{ if(onboardingStep>=ONBOARDING_STEPS.length-1) finishOnboarding(); else setOnboardingStep(s=>s+1); }}
          onSkip={finishOnboarding}
        />
      )}

      {/* ── NAVIGATION RAIL ── */}
      <div className="nav-rail" style={{ width: navCollapsed?52:228,
        background:DS.chromeAlt, borderRight:`1px solid ${DS.border}`,
        display:"flex", flexDirection:"column", flexShrink:0,
        transition:"width .2s ease", overflow:"hidden" }}>

        {/* Logo + collapse toggle */}
        <div style={{ padding:"16px 14px 14px", borderBottom:`1px solid ${DS.border}`,
          display:"flex", alignItems:"center", gap:10 }}>
          <div style={{ width:28, height:28, borderRadius:6, background:DS.accent,
            display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0,
            cursor:"pointer" }} onClick={()=>setNavCollapsed(c=>!c)}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round">
              <polygon points="12,2 22,8.5 22,15.5 12,22 2,15.5 2,8.5"/>
              <line x1="12" y1="2" x2="12" y2="22"/>
              <line x1="2" y1="8.5" x2="22" y2="8.5"/>
              <line x1="2" y1="15.5" x2="22" y2="15.5"/>
            </svg>
          </div>
          {!navCollapsed && (
            <div className="nav-label">
              <div style={{ fontSize:13, fontWeight:700, color:DS.textPri, letterSpacing:-.2 }}>Vantage DQ</div>
              <div style={{ fontSize:8, color:DS.textTer, letterSpacing:1.5, textTransform:"uppercase" }}>Decision Platform</div>
            </div>
          )}
        </div>

        {/* Project card */}
        {!navCollapsed && (
          <button onClick={()=>setProjectSetupOpen(true)}
            style={{ padding:"11px 16px", borderBottom:`1px solid ${DS.border}`,
              background:"transparent", border:"none", borderBottom:`1px solid ${DS.border}`,
              cursor:"pointer", textAlign:"left", width:"100%", transition:"background .12s" }}
            onMouseEnter={e=>{ e.currentTarget.style.background=DS.chromeMid; }}
            onMouseLeave={e=>{ e.currentTarget.style.background="transparent"; }}>
            <div style={{ fontSize:8, color:DS.textTer, letterSpacing:1.2,
              textTransform:"uppercase", marginBottom:4 }}>Active Project</div>
            <div style={{ fontSize:11, fontWeight:700, color:DS.textPri, lineHeight:1.35,
              fontFamily:"'Libre Baskerville',Georgia,serif", marginBottom:4 }}>
              {(problem.projectName||problem.decisionStatement?.slice(0,40)||"Untitled").slice(0,38)}
              {(problem.projectName||"").length>38?"…":""}
            </div>
            <div style={{ display:"flex", gap:5, flexWrap:"wrap" }}>
              {problem.projectCode && (
                <span style={{ fontSize:8, fontWeight:700, padding:"1px 5px", borderRadius:3,
                  background:DS.chromeSub, color:DS.textTer, border:`1px solid ${DS.border}` }}>
                  {problem.projectCode}
                </span>
              )}
              {problem.sector && (
                <span style={{ fontSize:8, fontWeight:700, padding:"1px 5px", borderRadius:3,
                  background:DS.accentSoft, color:DS.accent, border:`1px solid ${DS.accentLine}` }}>
                  {problem.sector.split("/")[0].trim()}
                </span>
              )}
              {problem.confidentiality && problem.confidentiality!=="Internal" && (
                <span style={{ fontSize:8, fontWeight:700, padding:"1px 5px", borderRadius:3,
                  background:DS.warnSoft, color:DS.warning, border:`1px solid ${DS.warnLine}` }}>
                  {problem.confidentiality}
                </span>
              )}
            </div>
            {problem.facilitator && (
              <div style={{ fontSize:9, color:DS.textTer, marginTop:4 }}>
                {problem.facilitator}{problem.sessionDate ? ` · ${new Date(problem.sessionDate).toLocaleDateString("en-GB",{day:"numeric",month:"short"})}` : ""}
              </div>
            )}
          </button>
        )}

        {/* Navigation */}
        <nav style={{ flex:1, overflowY:"auto", padding:"8px 0" }}>
          {/* Phase 1 */}
          {!navCollapsed && (
            <div style={{ fontSize:8, color:DS.textTer, letterSpacing:1.5,
              textTransform:"uppercase", padding:"6px 16px 3px", fontWeight:700 }}>
              Phase 1 — Framing
            </div>
          )}
          {PHASE1.map((m) => {
            const active = module===m.id;
            const comp   = moduleCompletion(m.id);
            const done   = comp===100;
            return (
              <button key={m.id} onClick={()=>setModule(m.id)} title={navCollapsed?m.label:undefined}
                style={{ width:"100%", padding: navCollapsed?"10px 0":"8px 16px",
                  background:active?DS.chromeMid:"transparent", border:"none",
                  borderLeft:`3px solid ${active?DS.accent:"transparent"}`,
                  cursor:"pointer", display:"flex", alignItems:"center",
                  gap:navCollapsed?0:10, justifyContent:navCollapsed?"center":"flex-start",
                  transition:"all .12s",
                  animation:active?"slideIn .2s ease":undefined }}>
                <div style={{ width:22, height:22, borderRadius:5, flexShrink:0,
                  background:done?DS.success:active?DS.accent:DS.chromeSub,
                  border:`1px solid ${done?DS.successLine:active?DS.accentDim:DS.border}`,
                  display:"flex", alignItems:"center", justifyContent:"center", fontSize:10 }}>
                  {done
                    ? <Svg path={ICONS.check} size={11} color="#fff" sw={2.5}/>
                    : <span style={{ color:active?"#fff":DS.textTer, fontSize:8, fontWeight:700 }}>{m.num}</span>
                  }
                </div>
                {!navCollapsed && (
                  <div style={{ textAlign:"left", flex:1, minWidth:0 }}>
                    <div className="nav-label" style={{ fontSize:11, fontWeight:600,
                      color:active?DS.textPri:done?DS.textSec:DS.textTer }}>{m.label}</div>
                    <div className="nav-sub" style={{ fontSize:9, color:DS.textTer, marginTop:1 }}>{m.sub}</div>
                  </div>
                )}
                {!navCollapsed && (
                  <div style={{ width:5, height:5, borderRadius:"50%", flexShrink:0,
                    background:comp===100?DS.success:comp>0?DS.warning:DS.border }}/>
                )}
              </button>
            );
          })}

          {/* Custom tab items */}
          {customTabs.length > 0 && !navCollapsed && (
            <div style={{ fontSize:8, color:DS.textTer, letterSpacing:1.5,
              textTransform:"uppercase", padding:"10px 16px 3px", fontWeight:700,
              borderTop:"1px solid "+DS.border, marginTop:4 }}>
              Custom Workspaces
            </div>
          )}
          {customTabs.map(tab => {
            const active = module === tab.id;
            const opt = TAB_TYPE_OPTIONS?.find(t=>t.type===tab.type);
            return (
              <button key={tab.id}
                onClick={() => setModule(tab.id)}
                style={{ width:"100%", padding: navCollapsed?"10px 0":"7px 16px",
                  background: active?DS.chromeMid:"transparent", border:"none",
                  borderLeft:"3px solid "+(active?DS.accent:"transparent"),
                  cursor:"pointer", display:"flex", alignItems:"center",
                  gap:10, textAlign:"left", transition:"all .1s" }}>
                <span style={{ fontSize:13, flexShrink:0, width:20,
                  textAlign:"center", color:active?DS.accent:DS.textTer }}>
                  {opt?.icon || "⊞"}
                </span>
                {!navCollapsed && (
                  <div style={{ flex:1, minWidth:0 }}>
                    <div style={{ fontSize:11, fontWeight:600,
                      color:active?DS.textPri:DS.textSec,
                      whiteSpace:"nowrap", overflow:"hidden",
                      textOverflow:"ellipsis" }}>
                      {tab.label}
                    </div>
                    <div style={{ fontSize:9, color:DS.textTer }}>
                      {opt?.label || tab.type}
                    </div>
                  </div>
                )}
                {!navCollapsed && (
                  <span
                    role="button"
                    onClick={e => {
                      e.stopPropagation();
                      setCustomTabs(tabs => tabs.filter(t=>t.id!==tab.id));
                      if (module === tab.id) setModule("problem");
                    }}
                    style={{ background:"none", border:"none", cursor:"pointer",
                      color:DS.textTer, fontSize:14, padding:"2px 5px",
                      borderRadius:3, lineHeight:1, flexShrink:0,
                      display:"flex", alignItems:"center" }}>
                    ×
                  </span>
                )}
              </button>
            );
          })}

          {/* Add new tab button */}
          <button onClick={() => setShowTabPicker(true)}
            style={{ width:"100%", padding: navCollapsed?"10px 0":"7px 16px",
              background:"transparent", border:"none",
              borderLeft:"3px solid transparent",
              cursor:"pointer", display:"flex", alignItems:"center",
              gap:10, textAlign:"left", marginTop:4,
              opacity:.7, transition:"opacity .1s" }}
            onMouseEnter={e=>{ e.currentTarget.style.opacity=1; }}
            onMouseLeave={e=>{ e.currentTarget.style.opacity=0.7; }}>
            <span style={{ fontSize:16, flexShrink:0, width:20,
              textAlign:"center", color:DS.accent }}>+</span>
            {!navCollapsed && (
              <div style={{ fontSize:11, fontWeight:600, color:DS.accent }}>
                New Workspace
              </div>
            )}
          </button>

          {/* Cross-module nudges */}
          {!navCollapsed && (
            <NudgeBar
              module={module}
              issues={issues} decisions={decisions}
              criteria={criteria} strategies={strategies}
              assessmentScores={assessmentScores} dqScores={dqScores}
              onNavigate={setModule}/>
          )}

          {/* Phase 2 */}
          {!navCollapsed && (
            <div style={{ fontSize:8, color:DS.textTer, letterSpacing:1.5,
              textTransform:"uppercase", padding:"10px 16px 3px", fontWeight:700,
              borderTop:`1px solid ${DS.border}`, marginTop:4 }}>
              Phase 2 — Analysis
            </div>
          )}
          {PHASE2.map((m) => {
            const active = module===m.id;
            return (
              <button key={m.id} onClick={()=>setModule(m.id)} title={navCollapsed?m.label:undefined}
                style={{ width:"100%", padding:navCollapsed?"10px 0":"8px 16px",
                  background:active?DS.chromeMid:"transparent", border:"none",
                  borderLeft:`3px solid ${active?DS.accent:"transparent"}`,
                  cursor:"pointer", display:"flex", alignItems:"center",
                  gap:navCollapsed?0:10, justifyContent:navCollapsed?"center":"flex-start",
                  transition:"all .12s" }}>
                <div style={{ width:22, height:22, borderRadius:5, flexShrink:0,
                  background:active?DS.accent:DS.chromeSub,
                  border:`1px solid ${active?DS.accentDim:DS.border}`,
                  display:"flex", alignItems:"center", justifyContent:"center",
                  fontSize:12, color:active?"#fff":DS.textTer }}>
                  {m.icon}
                </div>
                {!navCollapsed && (
                  <div style={{ textAlign:"left", flex:1, minWidth:0 }}>
                    <div className="nav-label" style={{ fontSize:11, fontWeight:600,
                      color:active?DS.textPri:DS.textTer }}>{m.label}</div>
                    <div className="nav-sub" style={{ fontSize:9, color:DS.textTer, marginTop:1 }}>{m.sub}</div>
                  </div>
                )}
              </button>
            );
          })}
        </nav>

        {/* Session summary + progress footer */}
        {!navCollapsed && (
          <div style={{ borderTop:`1px solid ${DS.border}` }}>
            {/* Session snapshot */}
            <div style={{ padding:"10px 16px", borderBottom:`1px solid ${DS.border}` }}>
              <div style={{ fontSize:8, color:DS.textTer, letterSpacing:1.2,
                textTransform:"uppercase", fontWeight:700, marginBottom:8 }}>Session Snapshot</div>
              <div style={{ display:"flex", flexDirection:"column", gap:5 }}>
                {/* Decision statement */}
                {problem.decisionStatement && (
                  <div style={{ fontSize:10, color:DS.textSec, lineHeight:1.4,
                    fontStyle:"italic", borderLeft:`2px solid ${DS.accent}`,
                    paddingLeft:7, marginBottom:2 }}>
                    {problem.decisionStatement.slice(0,70)}{problem.decisionStatement.length>70?"…":""}
                  </div>
                )}
                {/* Key stats grid */}
                <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:5 }}>
                  {[
                    { label:"Issues", value:issues.length, alert:issues.filter(i=>i.severity==="Critical").length > 0,
                      sub:issues.filter(i=>i.severity==="Critical").length > 0
                        ? issues.filter(i=>i.severity==="Critical").length+" critical" : "none critical" },
                    { label:"Focus Dec.", value:decisions.filter(d=>d.tier==="focus").length,
                      alert:decisions.filter(d=>d.tier==="focus").length===0, sub:"in scope" },
                    { label:"Strategies", value:strategies.length,
                      alert:strategies.length===0, sub:"built" },
                    { label:"Criteria", value:criteria.length,
                      alert:criteria.length===0, sub:"defined" },
                  ].map((stat,i)=>(
                    <div key={i} style={{ padding:"6px 8px", borderRadius:5,
                      background:stat.alert?DS.dangerSoft:DS.chromeMid,
                      border:`1px solid ${stat.alert?DS.dangerLine:DS.border}` }}>
                      <div style={{ fontSize:14, fontWeight:700, lineHeight:1,
                        color:stat.alert?DS.danger:DS.textPri,
                        fontFamily:"'Libre Baskerville',Georgia,serif" }}>
                        {stat.value}
                      </div>
                      <div style={{ fontSize:8, color:stat.alert?DS.danger:DS.textTer,
                        fontWeight:700, marginTop:2 }}>{stat.label}</div>
                      <div style={{ fontSize:8, color:DS.textTer }}>{stat.sub}</div>
                    </div>
                  ))}
                </div>
                {/* Top voted issue */}
                {issues.length > 0 && (() => {
                  const top = [...issues].sort((a,b)=>(b.votes||0)-(a.votes||0))[0];
                  return top ? (
                    <div style={{ fontSize:9, color:DS.textTer, lineHeight:1.4,
                      padding:"5px 7px", borderRadius:4, background:DS.chromeMid,
                      border:`1px solid ${DS.border}` }}>
                      <span style={{ color:DS.accent, fontWeight:700 }}>▲ Top issue: </span>
                      {top.text.slice(0,55)}{top.text.length>55?"…":""}
                    </div>
                  ) : null;
                })()}
              </div>
            </div>
            {/* Progress bar */}
            <div style={{ padding:"10px 16px" }}>
              <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:5 }}>
                <span style={{ fontSize:8, color:DS.textTer, letterSpacing:1.2,
                  textTransform:"uppercase", fontWeight:700 }}>Overall Progress</span>
                <span style={{ fontSize:10, color:DS.textSec, fontWeight:700 }}>{overall}%</span>
              </div>
              <div style={{ height:4, background:DS.chromeMid, borderRadius:2, overflow:"hidden" }}>
                <div style={{ height:"100%", borderRadius:2, transition:"width .5s",
                  background:`linear-gradient(90deg, ${DS.accent}, #60a5fa)`,
                  width:`${overall}%` }}/>
              </div>
              <div style={{ fontSize:8, color:DS.textTer, marginTop:5 }}>
                {overall>=80?"Ready for executive review":overall>=50?"Good progress — keep building":"Early stage"}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ── MAIN CONTENT ── */}
      <div style={{ flex:1, display:"flex", flexDirection:"column", minWidth:0, overflow:"hidden" }}>

        {/* API key warning */}
        {false && (
          <div style={{ padding:"8px 16px", background:"#7c3aed22", borderBottom:"1px solid #7c3aed44",
            display:"flex", alignItems:"center", gap:8, flexShrink:0, fontSize:11, color:"#a78bfa" }}>
            <span>⚠</span>
            <span><strong>API key not configured.</strong> Create a <code style={{background:"#1c2030",padding:"1px 5px",borderRadius:3}}>.env</code> file in your project root with <code style={{background:"#1c2030",padding:"1px 5px",borderRadius:3}}>VITE_ANTHROPIC_API_KEY=your_key</code> then restart <code style={{background:"#1c2030",padding:"1px 5px",borderRadius:3}}>npm run dev</code>.</span>
          </div>
        )}
        {/* ── TOP BAR ── */}
        <div style={{ height:46, background:DS.chromeAlt, borderBottom:`1px solid ${DS.border}`,
          display:"flex", alignItems:"center", padding:"0 16px", gap:8, flexShrink:0 }}>

          {/* Breadcrumb */}
          <div className="top-breadcrumb" style={{ flex:1, display:"flex", alignItems:"center", gap:6, minWidth:0 }}>
            <span style={{ fontSize:10, color:DS.textTer, fontWeight:600, letterSpacing:.3 }}>
              {MODULES.find(m=>m.id===module)?.icon}
            </span>
            <span style={{ fontSize:11, fontWeight:700, color:DS.textPri, whiteSpace:"nowrap" }}>
              {MODULES.find(m=>m.id===module)?.label}
            </span>
            {problem.projectName && (
              <>
                <span style={{ color:DS.textTer, fontSize:12 }}>/</span>
                <span style={{ fontSize:10, color:DS.textTer, overflow:"hidden",
                  textOverflow:"ellipsis", whiteSpace:"nowrap", maxWidth:200 }}>
                  {problem.projectName}
                </span>
              </>
            )}
          </div>

          {/* Session health */}
          <SessionHealthBar problem={problem} issues={issues} decisions={decisions}
            strategies={strategies} criteria={criteria} assessmentScores={assessmentScores}/>

          {/* Right controls */}
          <div style={{ display:"flex", gap:6, alignItems:"center" }}>
            {aiBusy && (
              <div style={{ display:"flex", alignItems:"center", gap:4, fontSize:10, color:DS.accent }}>
                <div style={{ width:5,height:5,borderRadius:"50%",background:DS.accent,
                  animation:"aipulse 1s infinite" }}/>
                AI…
              </div>
            )}

            {/* PDF Export */}
            <button onClick={handlePDFExport}
              style={{ padding:"5px 11px", border:`1px solid ${DS.border}`, borderRadius:6,
                background:"transparent", color:DS.textTer, cursor:"pointer", fontSize:11,
                fontWeight:600, fontFamily:"inherit", display:"flex", alignItems:"center", gap:5,
                transition:"all .12s" }}
              onMouseEnter={e=>{e.currentTarget.style.borderColor="#22c55e";e.currentTarget.style.color="#22c55e";}}
              onMouseLeave={e=>{e.currentTarget.style.borderColor=DS.border;e.currentTarget.style.color=DS.textTer;}}>
              <Svg path={ICONS.export} size={12} color="currentColor"/> PDF
            </button>

            {/* Cross-Module AI */}
            <CrossModuleAI problem={problem} issues={issues} decisions={decisions}
              criteria={criteria} strategies={strategies}
              assessmentScores={assessmentScores} dqScores={dqScores}
              aiCall={aiCall} aiBusy={aiBusy} onAIMsg={pushAIMsg}/>

            {/* Tools dropdown */}
            <ToolsMenu
              onDeepDive={()=>setShowQuickStart(true)}
              onWorkshop={()=>setWorkshopOpen(true)}
              onVersions={()=>setVersionOpen(true)}
              onDqi={()=>setDqiOpen(true)}
              onProject={()=>setProjectSetupOpen(true)}
              aiBusy={aiBusy}/>

            {/* Co-Pilot toggle */}
            <button onClick={()=>setShowAI(a=>!a)}
              style={{ padding:"5px 11px", border:`1px solid ${showAI?DS.accent:DS.border}`,
                borderRadius:6, background:showAI?DS.chromeMid:"transparent",
                color:showAI?DS.accent:DS.textSec, cursor:"pointer", fontSize:11,
                fontWeight:600, display:"flex", alignItems:"center", gap:5,
                fontFamily:"inherit" }}>
              <Svg path={ICONS.spark} size={12} color="currentColor"/> Co‑Pilot
            </button>
          </div>
        </div>

        {/* ── MODULE + AI PANEL ── */}
        <div style={{ flex:1, display:"flex", overflow:"hidden" }}>

          {/* Active module */}
          <div style={{ flex:1, background:DS.canvasAlt, overflow:"hidden",
            display:"flex", flexDirection:"column",
            animation:"fadeIn .2s ease" }} key={module}>
            <DQGateWarnings warnings={gateWarnings}/>
            {module==="problem"    && <ModuleProblemDefinition    {...moduleProps.problem}/>}
            {module==="issues"     && <ModuleIssueRaising         {...moduleProps.issues}/>}
            {module==="hierarchy"  && <ModuleDecisionHierarchy    {...moduleProps.hierarchy}/>}
            {module==="strategy"   && <ModuleStrategyTable        {...moduleProps.strategy}/>}
            {module==="assessment" && <ModuleQualitativeAssessment {...moduleProps.assessment}/>}
            {module==="scorecard"  && <ModuleDQScorecard          {...moduleProps.scorecard}/>}
            {module==="export"     && <ModuleExport               {...moduleProps.export}/>}
            {module==="influence"  && <ModuleInfluenceMap         {...moduleProps.influence}/>}

            {/* Custom workspace tabs */}
            {customTabs.map(tab => {
              if (module !== tab.id) return null;
              const updateTabData = (patch) =>
                setCustomTabs(tabs => tabs.map(t =>
                  t.id === tab.id ? { ...t, data: { ...t.data, ...patch } } : t
                ));

              if (tab.type === "strategy") return (
                <ModuleStrategyTable key={tab.id}
                  decisions={decisions}
                  strategies={tab.data.strategies || []}
                  onChange={strats => updateTabData({ strategies: strats })}
                  problem={problem}
                  aiCall={aiCall} aiBusy={aiBusy} onAIMsg={pushAIMsg}/>
              );
              if (tab.type === "assessment") return (
                <ModuleQualitativeAssessment key={tab.id}
                  strategies={tab.data.strategies || strategies}
                  decisions={decisions}
                  criteria={tab.data.criteria || criteria}
                  problem={problem}
                  scores={tab.data.scores || {}}
                  onScores={scores => updateTabData({ scores })}
                  brief={tab.data.brief || null}
                  onBrief={brief => updateTabData({ brief })}
                  aiCall={aiCall} aiBusy={aiBusy} onAIMsg={pushAIMsg}/>
              );
              if (tab.type === "compare") return (
                <div key={tab.id} style={{ flex:1, overflow:"auto", padding:24 }}>
                  <ModuleStrategyTable
                    decisions={decisions}
                    strategies={strategies}
                    onChange={setStrategies}
                    problem={problem}
                    aiCall={aiCall} aiBusy={aiBusy} onAIMsg={pushAIMsg}/>
                </div>
              );
              if (tab.type === "issues") return (
                <ModuleIssueRaising key={tab.id}
                  issues={tab.data.issues || []}
                  onChange={issues => updateTabData({ issues })}
                  decisions={decisions}
                  onDecisions={setDecisions}
                  criteria={criteria}
                  onCriteria={setCriteria}
                  problem={problem}
                  aiCall={aiCall} aiBusy={aiBusy} onAIMsg={pushAIMsg}/>
              );
              if (tab.type === "hierarchy") return (
                <ModuleDecisionHierarchy key={tab.id}
                  decisions={tab.data.decisions || []}
                  criteria={tab.data.criteria || []}
                  onDecisions={decs => updateTabData({ decisions: decs })}
                  onCriteria={crits => updateTabData({ criteria: crits })}
                  issues={issues}
                  aiCall={aiCall} aiBusy={aiBusy} onAIMsg={pushAIMsg}/>
              );
              return (
                <div key={tab.id} style={{ flex:1, display:"flex",
                  alignItems:"center", justifyContent:"center",
                  color:DS.inkTer, fontSize:13 }}>
                  Workspace type "{tab.type}" — coming soon
                </div>
              );
            })}
          </div>

          {/* Co-Pilot */}
          {showAI && (
            <div className="ai-panel-wrap" style={{ width:268, flexShrink:0,
              display:"flex", flexDirection:"column", overflow:"hidden" }}>
              <AIPanel messages={aiMessages} onSend={handleAISend}
                loading={aiBusy} nudge={MODULE_NUDGES[module]}/>
            </div>
          )}
        </div>
      </div>

      {/* ── OVERLAYS ── */}
      {showTabPicker && (
        <TabPickerModal
          onAdd={tab => {
            setCustomTabs(tabs => [...tabs, tab]);
            setModule(tab.id);
          }}
          onClose={() => setShowTabPicker(false)}/>
      )}

      {workshopOpen && (
        <WorkshopMode problem={problem} issues={issues} decisions={decisions}
          strategies={strategies} criteria={criteria}
          onIssues={setIssues} onExit={()=>setWorkshopOpen(false)}/>
      )}
      {versionOpen && (
        <VersionPanel
          currentData={{ problem, issues, decisions, criteria, strategies, assessmentScores, dqScores }}
          onRestore={(data)=>{
            if(data.problem)    setProblem(data.problem);
            if(data.issues)     setIssues(data.issues);
            if(data.decisions)  setDecisions(data.decisions);
            if(data.criteria)   setCriteria(data.criteria);
            if(data.strategies) setStrategies(data.strategies);
            if(data.assessmentScores) setAssessmentScores(data.assessmentScores);
            if(data.dqScores)   setDqScores(data.dqScores);
          }}
          onClose={()=>setVersionOpen(false)}/>
      )}
      {dqiOpen && (
        <DQiDashboard currentProject={problem} dqScores={dqScores}
          strategies={strategies} issues={issues}
          aiCall={aiCall} aiBusy={aiBusy} onClose={()=>setDqiOpen(false)}/>
      )}
      {projectSetupOpen && (
        <ProjectSetupModal data={problem} onChange={setProblem}
          onClose={()=>setProjectSetupOpen(false)}/>
      )}
    </div>
  );
}
