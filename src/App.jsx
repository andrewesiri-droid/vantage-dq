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
        const isQuestion = /^(how|what|which|should|where|when|who|why)/i.test(stmt.trim());
        const isSolution = /^(we should|we will|implement|deploy|use|adopt|choose|select)/i.test(stmt.trim());
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
  const [applying, setApplying] = useState(false);

  const upd = (key, val) => onChange({ ...data, [key]: val });
  const updStakeholder = (id, key, val) =>
    upd("stakeholders", (data.stakeholders||[]).map(s => s.id===id ? {...s,[key]:val} : s));

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
  "hiddenAssumptions": ["plain string assumption 1","plain string assumption 2"],
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

  const applyImprovements = () => {
    const v = data.aiValidation;
    if (!v) { onAIMsg({role:"ai", text:"Run Frame Check first before applying improvements."}); return; }
    setApplying(true);
    onAIMsg({role:"ai", text:"Rewriting flagged fields — this takes 10-15 seconds…"});

    // Build a prompt that asks the AI to rewrite ALL flagged fields
    const flaggedFields = (v.flags||[]).map(f => f.field + ": " + f.message).join("\n");
    const missingElements = (v.missingElements||[]).join(", ");

    // Build a surgical fix prompt - one instruction per flag
    const flagInstructions = (v.flags||[]).map(f => {
      const severity = f.severity === "critical" ? "CRITICAL" : f.severity === "warning" ? "WARNING" : "INFO";
      return severity + " — field [" + f.field + "]: " + f.message;
    }).join("\n");

    const improvePrompt =
      "You are fixing specific DQ validation failures in a decision frame. " +
      "Address ONLY the flagged issues below — do not make other changes. " +
      "Keep responses concise and specific — no padding or generic statements. " +
      "Current values:\n" +
      "decisionStatement: " + (data.decisionStatement||"empty") + "\n" +
      "context: " + (data.context||"empty") + "\n" +
      "scopeIn: " + (data.scopeIn||"empty") + "\n" +
      "scopeOut: " + (data.scopeOut||"empty") + "\n" +
      "successCriteria: " + (data.successCriteria||"empty") + "\n" +
      "constraints: " + (data.constraints||"empty") + "\n" +
      "assumptions: " + (data.assumptions||"empty") + "\n" +
      "owner: " + (data.owner||"empty") + "\n\n" +
      "FLAGS TO FIX (address each one precisely):\n" + flagInstructions + "\n" +
      (missingElements ? "MISSING ELEMENTS TO ADD: " + missingElements + "\n" : "") +
      (v.improvedStatement ? "USE THIS IMPROVED STATEMENT: " + v.improvedStatement + "\n" : "") +
      "\nReturn ONLY a JSON object with ONLY the fields that need changing. " +
      "Each value must directly fix the flag — be specific, not generic. " +
      "Keep each field under 3 sentences. " +
      '{"decisionStatement":"only if flagged","context":"only if flagged","scopeIn":"only if flagged","scopeOut":"only if flagged","successCriteria":"only if flagged","constraints":"only if flagged","assumptions":"only if flagged","owner":"only if flagged"}';
    aiCall(improvePrompt, (r) => {
      // Normalise response — proxy may return parsed object or {_raw:string}
      let result = r;
      if (r && typeof r === "object" && r._raw) {
        const rawStr = typeof r._raw === "string" ? r._raw : JSON.stringify(r._raw);
        try { result = JSON.parse(rawStr.replace(/```json|```/g,"").trim()); }
        catch(e) { setApplying(false); onAIMsg({role:"ai",text:"Could not parse improvements. Try again."}); return; }
      } else if (typeof r === "string") {
        try { result = JSON.parse(r.replace(/```json|```/g,"").trim()); }
        catch(e) { setApplying(false); onAIMsg({role:"ai",text:"Could not parse response. Try again."}); return; }
      }
      if (!result || typeof result !== "object" || result.error) {
        setApplying(false);
        onAIMsg({role:"ai", text:"Error applying improvements: " + (result?.error||"unexpected response")});
        return;
      }

      // Apply each improved field — guard against non-string values
      const updates = {};
      const fields = ["decisionStatement","context","scopeIn","scopeOut","successCriteria","constraints","assumptions","owner"];
      fields.forEach(key => {
        const val = result[key];
        if (val && typeof val === "string" && val.trim()) {
          updates[key] = val.trim();
        }
      });

      // Apply all updates at once
      const newData = { ...data, ...updates };
      onChange(newData);
      setApplying(false);
      onAIMsg({ role:"ai", text: "Fixed " + Object.keys(updates).length + " field(s): " + Object.keys(updates).join(", ") + ". Running Frame Check now to get your new score…" });
      // Auto re-run frame check after a brief delay
      setTimeout(() => {
        setChecking(true);
        const recheckPrompt =
          "Decision Quality frame validation. Decision Statement: \"" + (newData.decisionStatement||"") + "\". " +
          "Context: \"" + (newData.context||"") + "\". " +
          "Root Decision: \"" + (newData.rootDecision||"") + "\". " +
          "Scope In: \"" + (newData.scopeIn||"") + "\". " +
          "Scope Out: \"" + (newData.scopeOut||"") + "\". " +
          "Owner: \"" + (newData.owner||"") + "\". " +
          "Deadline: \"" + (newData.deadline||"") + "\". " +
          "Constraints: \"" + (newData.constraints||"") + "\". " +
          "Assumptions: \"" + (newData.assumptions||"") + "\". " +
          "Success Criteria: \"" + (newData.successCriteria||"") + "\". " +
          "Evaluate strictly. Return ONLY valid JSON: " +
          '{"overallScore":0,"status":"strong","flags":[{"severity":"critical","field":"f","message":"m"}],"improvedStatement":null,"hiddenAssumptions":["string only"],"missingElements":["string only"],"executiveSummary":"summary"}';
        aiCall(dqPrompt(recheckPrompt), (r2) => {
          upd("aiValidation", r2);
          setChecking(false);
          const score = r2.overallScore || r2._raw?.overallScore;
          onAIMsg({ role:"ai", text: "Frame Check complete. New score: " + (score||"?") + "/100. " + (r2.executiveSummary||"") });
        });
      }, 500);
    });
  };

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
                {(data.stakeholders||[]).length} stakeholder{data.stakeholders.length!==1?"s":""} identified
              </div>
              <Btn variant="secondary" icon="plus" size="sm"
                onClick={()=>upd("stakeholders",[...(data.stakeholders||[]), { id:uid("sh"), name:"", role:"", influence:"Medium" }])}>
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
                  {(data.stakeholders||[]).map((s,i)=>(
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

                {/* Apply All Improvements banner */}
                {data.aiValidation.overallScore < 90 && (
                  <div style={{ margin:"16px 0", padding:"14px 16px",
                    background:DS.accentSoft, border:"1px solid "+DS.accentLine,
                    borderRadius:8, display:"flex", alignItems:"center", gap:14 }}>
                    <div style={{ flex:1 }}>
                      <div style={{ fontSize:12, fontWeight:700, color:DS.accent, marginBottom:3 }}>
                        Apply AI improvements to all flagged fields
                      </div>
                      <div style={{ fontSize:11, color:DS.inkTer, lineHeight:1.5 }}>
                        Rewrites decision statement, context, scope, success criteria and assumptions to address every flag. Re-run Frame Check after to see your new score.
                      </div>
                    </div>
                    <Btn variant="primary" onClick={applyImprovements}
                      disabled={applying||aiBusy} style={{ flexShrink:0 }}>
                      {applying ? "Applying…" : "✓ Apply All Improvements"}
                    </Btn>
                  </div>
                )}

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
                      <div style={{ marginTop:12, display:"flex", gap:8, flexWrap:"wrap" }}>
                        <Btn variant="secondary" size="sm"
                          onClick={()=>upd("decisionStatement", data.aiValidation.improvedStatement)}>
                          Apply Statement Only
                        </Btn>
                        <Btn variant="primary" size="sm"
                          onClick={applyImprovements}
                          disabled={applying||aiBusy}>
                          {applying ? "Applying…" : "✓ Apply All Improvements"}
                        </Btn>
                      </div>
                    </SectionCard>
                  )}
                  {data.aiValidation.hiddenAssumptions?.length > 0 && (
                    <SectionCard title="Hidden Assumptions Detected">
                      {data.aiValidation.hiddenAssumptions.map((a,i)=>{
                        const aText = typeof a === "string" ? a : (a.assumption || a.text || JSON.stringify(a));
                        return (
                        <div key={i} style={{ fontSize:12, color:DS.ink, marginBottom:6,
                          padding:"6px 10px", background:DS.warnSoft, borderRadius:5,
                          border:`1px solid ${DS.warnLine}` }}>⚠ {aText}</div>
                         );
                       })}
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
  const [recommending, setRecommending] = useState(false);
  const [recommendation, setRecommendation] = useState(null);
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

    // Build a clear decision menu so the AI knows exactly what to pick
    const decMenu = nowDecisions.map((d, di) =>
      "D" + (di+1) + ": " + d.label + " → options: " +
      d.choices.map((ch, ci) => ci + "=" + ch).join(" | ")
    ).join("\n");

    const existingNames = strategies.map(s => s.name).join(", ") || "none";

    aiCall(
      "You are a Decision Quality strategist. Generate 3 meaningfully distinct strategies for this decision. " +
      "Each strategy must: (1) have a clear strategic objective, (2) pick one option for EVERY decision below, (3) have a rationale explaining why those choices are internally coherent. " +
      "Decision: " + (problem?.decisionStatement || "Not defined") + ". " +
      "Existing strategies (do not duplicate): " + existingNames + ". " +
      "DECISIONS — use the exact option index number (0, 1, 2...) in your selections:\n" + decMenu + "\n\n" +
      "Return ONLY JSON:\n" +
      '{"strategies":[' +
      '{"name":"Bold Growth","objective":"Maximise market capture by committing fully to highest-upside options","rationale":"This combination prioritises speed and scale — each option reinforces the others by...",' +
      '"selections":{"D1":0,"D2":1,"D3":0},' +
      '"riskProfile":"High risk, high reward"}' +
      '],"insight":"observation about the strategy space"}\n' +
      "IMPORTANT: selections must use keys D1, D2, D3... matching the decision numbers above. Use the exact integer index (0, 1, 2) of the chosen option.",
    (r) => {
      let result = r;
      if (r && r._raw) {
        try { result = JSON.parse(r._raw.replace(/```json|```/g,"").trim()); }
        catch(e) { onAIMsg({role:"ai",text:"Could not parse strategies. Try again."}); setSuggesting(false); return; }
      }
      if (!result || result.error) {
        onAIMsg({role:"ai", text:"Error: " + (result?.error||"No response")}); setSuggesting(false); return;
      }

      const strats = result.strategies || [];
      if (!strats.length) {
        onAIMsg({role:"ai", text:"No strategies returned. Try again."}); setSuggesting(false); return;
      }

      const used = strategies.map(s => s.colorIdx);
      const newSs = strats.map((s, i) => {
        const colorIdx = [0,1,2,3,4,5].find(ci => !used.includes(ci)) ?? (strategies.length + i) % 6;
        used.push(colorIdx);

        // Map selections — handle both {D1:0, D2:1} and [0,1,0] formats
        const selections = {};
        const rawSel = s.selections || {};

        if (Array.isArray(rawSel)) {
          // Array format: index maps to decision position
          rawSel.forEach((optIdx, j) => {
            if (nowDecisions[j] && typeof optIdx === "number") {
              selections[nowDecisions[j].id] = optIdx;
            }
          });
        } else {
          // Object format: {D1:0, D2:1, ...}
          Object.entries(rawSel).forEach(([key, optIdx]) => {
            // Key is "D1", "D2" etc — map to decision by position
            const decPos = parseInt(key.replace(/\D/g,"")) - 1;
            const dec = nowDecisions[decPos];
            if (dec && typeof optIdx === "number") {
              selections[dec.id] = optIdx;
            }
          });
        }

        return {
          id: uid("s"), colorIdx,
          name: s.name || DS.sNames[colorIdx] || ("Strategy " + (strategies.length + i + 1)),
          objective: s.objective || "",
          description: s.rationale || s.description || "",
          riskProfile: s.riskProfile || "",
          selections,
          rationale: {},
        };
      });

      onChange([...strategies, ...newSs]);
      onAIMsg({role:"ai", text:
        "Added " + newSs.length + " strategies with objectives, rationale and option selections. " +
        (result.insight || "Review and adjust any selections in the table.")
      });
      setSuggesting(false);
    });
  };

  // ── Fill missing fields on existing strategies ───────────────────────────
  const fillExistingStrategies = () => {
    const incomplete = strategies.filter(s =>
      !s.objective || !s.description ||
      nowDecisions.some(d => s.selections[d.id] === undefined)
    );
    if (incomplete.length === 0) {
      onAIMsg({role:"ai", text:"All existing strategies already have objectives, rationale and selections filled in."});
      return;
    }
    setSuggesting(true);

    const decMenu = nowDecisions.map((d, di) =>
      "D" + (di+1) + " [id:" + d.id + "]: " + d.label + " → " +
      d.choices.map((ch, ci) => ci + "=" + ch).join(" | ")
    ).join("\n");

    const stratList = incomplete.map((s, i) => {
      const existing = nowDecisions.map(d => {
        const v = s.selections[d.id];
        const ci = typeof v === "number" ? v : (Array.isArray(v) ? v[0] : undefined);
        return "D" + (nowDecisions.indexOf(d)+1) + "=" + (ci !== undefined ? d.choices[ci] : "NOT SELECTED");
      }).join(", ");
      return (i+1) + ". Strategy name: " + s.name +
        " | Objective: " + (s.objective || "MISSING") +
        " | Rationale: " + (s.description || "MISSING") +
        " | Current selections: " + existing;
    }).join("\n");

    aiCall(
      "You are a Decision Quality strategist. Complete the missing fields for these existing strategies. " +
      "Decision: " + (problem?.decisionStatement || "Not defined") + ".\n" +
      "DECISIONS:\n" + decMenu + "\n\n" +
      "STRATEGIES TO COMPLETE:\n" + stratList + "\n\n" +
      "For each strategy: write a clear objective (what it aims to achieve), " +
      "a rationale (why the option choices are coherent together), " +
      "and pick the best option index for any unselected decisions. " +
      "Match the strategy name and intent — don't change what's already there, only fill what's missing. " +
      "Return ONLY JSON:\n" +
      '{"strategies":[{"name":"exact strategy name","objective":"clear objective","rationale":"why coherent","selections":{"D1":0,"D2":1}}],"insight":"observation"}',
    (r) => {
      let result = r;
      if (r && r._raw) {
        try { result = JSON.parse(r._raw.replace(/```json|```/g,"").trim()); }
        catch(e) { onAIMsg({role:"ai",text:"Could not parse response. Try again."}); setSuggesting(false); return; }
      }
      if (!result || result.error) {
        onAIMsg({role:"ai", text:"Error: " + (result?.error||"No response")}); setSuggesting(false); return;
      }

      const aiStrats = result.strategies || [];
      if (!aiStrats.length) {
        onAIMsg({role:"ai", text:"No updates returned. Try again."}); setSuggesting(false); return;
      }

      // Merge updates into existing strategies by matching name
      const updated = strategies.map(s => {
        const match = aiStrats.find(ai =>
          ai.name?.toLowerCase().trim() === s.name?.toLowerCase().trim()
        );
        if (!match) return s;

        // Build updated selections — merge AI picks with existing
        const newSelections = { ...s.selections };
        const rawSel = match.selections || {};
        if (Array.isArray(rawSel)) {
          rawSel.forEach((optIdx, j) => {
            if (nowDecisions[j] && typeof optIdx === "number" &&
                newSelections[nowDecisions[j].id] === undefined) {
              newSelections[nowDecisions[j].id] = optIdx;
            }
          });
        } else {
          Object.entries(rawSel).forEach(([key, optIdx]) => {
            const decPos = parseInt(key.replace(/\D/g,"")) - 1;
            const dec = nowDecisions[decPos];
            if (dec && typeof optIdx === "number" &&
                newSelections[dec.id] === undefined) {
              newSelections[dec.id] = optIdx;
            }
          });
        }

        return {
          ...s,
          objective: s.objective || match.objective || s.objective,
          description: s.description || match.rationale || s.description,
          selections: newSelections,
        };
      });

      onChange(updated);
      onAIMsg({role:"ai", text:
        "Filled in " + aiStrats.length + " existing strategies with objectives, rationale and missing option selections. " +
        (result.insight || "Review and adjust as needed.")
      });
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
        {strategies.length > 0 && (
          <Btn variant="secondary" size="sm"
            disabled={suggesting || aiBusy}
            onClick={fillExistingStrategies}>
            {suggesting ? "Filling…" : "AI Fill Existing"}
          </Btn>
        )}
        <Btn variant="primary" size="sm"
          disabled={recommending || aiBusy || strategies.length < 2}
          onClick={recommendStrategy}>
          {recommending ? "Analysing…" : "✦ AI Pick Best Strategy"}
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
        {/* ── AI RECOMMENDATION PANEL ── */}
        {recommendation && (
          <div style={{ margin:"16px 24px", padding:"18px 20px",
            background:"linear-gradient(135deg, #eff6ff 0%, #f0fdf4 100%)",
            border:"2px solid "+DS.accent, borderRadius:10,
            position:"relative" }}>
            <button onClick={()=>setRecommendation(null)}
              style={{ position:"absolute", top:10, right:12,
                background:"none", border:"none", cursor:"pointer",
                color:DS.inkTer, fontSize:16 }}>×</button>
            <div style={{ fontSize:10, fontWeight:700, color:DS.accent,
              letterSpacing:.6, textTransform:"uppercase", marginBottom:8 }}>
              ✦ AI Strategy Recommendation
            </div>
            <div style={{ display:"flex", alignItems:"baseline", gap:10, marginBottom:12 }}>
              <div style={{ fontFamily:"'Libre Baskerville',serif",
                fontSize:20, fontWeight:700, color:DS.ink }}>
                {recommendation.recommendedStrategy}
              </div>
              <span style={{ fontSize:10, fontWeight:700, padding:"2px 8px",
                borderRadius:4,
                background:recommendation.confidence==="High"?DS.successSoft:recommendation.confidence==="Medium"?DS.warnSoft:DS.dangerSoft,
                color:recommendation.confidence==="High"?DS.success:recommendation.confidence==="Medium"?DS.warning:DS.danger }}>
                {recommendation.confidence} confidence
              </span>
            </div>
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12 }}>
              <div>
                <div style={{ fontSize:9, fontWeight:700, color:DS.inkTer,
                  textTransform:"uppercase", letterSpacing:.5, marginBottom:4 }}>Reasoning</div>
                <div style={{ fontSize:12, color:DS.ink, lineHeight:1.6 }}>
                  {recommendation.reasoning}
                </div>
              </div>
              <div>
                {recommendation.concerns && (
                  <div style={{ marginBottom:8 }}>
                    <div style={{ fontSize:9, fontWeight:700, color:DS.danger,
                      textTransform:"uppercase", letterSpacing:.5, marginBottom:4 }}>Key Concerns</div>
                    <div style={{ fontSize:12, color:DS.inkSub, lineHeight:1.6 }}>
                      {recommendation.concerns}
                    </div>
                  </div>
                )}
                {recommendation.alternativeIf && (
                  <div>
                    <div style={{ fontSize:9, fontWeight:700, color:DS.inkTer,
                      textTransform:"uppercase", letterSpacing:.5, marginBottom:4 }}>Consider Alternative If</div>
                    <div style={{ fontSize:12, color:DS.inkSub, lineHeight:1.6 }}>
                      {recommendation.alternativeIf}
                    </div>
                  </div>
                )}
              </div>
            </div>
            {recommendation.rankingNote && (
              <div style={{ marginTop:10, padding:"8px 12px",
                background:"rgba(255,255,255,.6)", borderRadius:6,
                fontSize:11, color:DS.inkTer, lineHeight:1.5 }}>
                {recommendation.rankingNote}
              </div>
            )}
          </div>
        )}

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
const UNCERTAINTY_TYPES  = ["Market","Regulatory","Technical","Financial","Competitive","Operational","Political","Stakeholder"]
  // ── AI Recommend Best Strategy ────────────────────────────────────────────
  const recommendStrategy = () => {
    const strategiesWithObjectives = strategies.filter(s => s.objective || s.description);
    if (strategies.length < 2) {
      onAIMsg({role:"ai", text:"Add at least 2 strategies before asking the AI to recommend."});
      return;
    }
    setRecommending(true);
    setRecommendation(null);

    const stratSummaries = strategies.map((s,i) => {
      const choices = nowDecisions.map(d => {
        const v = s.selections[d.id];
        const ci = Array.isArray(v) ? v[0] : v;
        return d.label + "=" + (ci !== undefined ? d.choices[ci] : "not selected");
      }).join(", ");
      return (i+1) + ". " + s.name +
        (s.objective ? " | Objective: " + s.objective : "") +
        (s.description ? " | Rationale: " + s.description : "") +
        " | Decisions: " + choices;
    }).join("\n");

    const critera_str = criteria.map(cr => cr.label || cr.name || cr).join(", ");

    aiCall(
      "You are a senior Decision Quality expert evaluating strategies. " +
      "Decision: " + (problem?.decisionStatement || "") + ". " +
      "Criteria: " + (critera_str || "not defined") + ".\n\n" +
      "Strategies:\n" + stratSummaries + "\n\n" +
      "Evaluate each strategy against the decision objectives and DQ principles. " +
      "Recommend the best strategy or combination. Be direct and specific. " +
      "Return ONLY JSON: " +
      '{"recommendedStrategy":"strategy name","confidence":"High|Medium|Low",' +
      '"reasoning":"2-3 sentences on why this strategy best achieves the stated objectives",' +
      '"concerns":"key risks or gaps in the recommended strategy",' +
      '"alternativeIf":"condition under which a different strategy would be better",' +
      '"rankingNote":"brief comment on how all strategies compare"}',
    (r) => {
      let result = r;
      if (r && r._raw) {
        try { result = JSON.parse(r._raw.replace(/```json|```/g,"").trim()); } catch(e) {}
      }
      if (result && !result.error) {
        setRecommendation(result);
        onAIMsg({role:"ai", text:
          "Recommended: " + result.recommendedStrategy + " (" + result.confidence + " confidence). " +
          result.reasoning
        });
      } else {
        onAIMsg({role:"ai", text:"Could not generate recommendation. Try again."});
      }
      setRecommending(false);
    });
  };

;


function ModuleInfluenceMap({ issues, decisions, strategies, aiCall, aiBusy, onAIMsg, problem, onNodesChange, onEdgesChange }) {

  // ── Node taxonomy per spec ────────────────────────────────────────────────
  const NODE_TYPES = {
    decision: {
      label:"Decision", color:"#2563eb", bg:"#eff4ff", border:"#93c5fd",
      icon:"▣", shape:"rect",
      desc:"A controllable choice — what can be decided",
      rule:"Must have outgoing influence. Cannot be probabilistic.",
    },
    uncertainty: {
      label:"Uncertainty", color:"#d97706", bg:"#fffbeb", border:"#fcd34d",
      icon:"◎", shape:"oval",
      desc:"An unknown variable — what cannot be controlled",
      rule:"May influence other uncertainties and value nodes.",
    },
    value: {
      label:"Value / Outcome", color:"#059669", bg:"#ecfdf5", border:"#6ee7b7",
      icon:"◆", shape:"diamond",
      desc:"An objective or result — NPV, market share, strategic value",
      rule:"Terminal node. Should not influence upstream nodes.",
    },
    deterministic: {
      label:"Deterministic", color:"#7c3aed", bg:"#f5f3ff", border:"#c4b5fd",
      icon:"⬡", shape:"hex",
      desc:"A calculated relationship — revenue, cash flow, emissions",
      rule:"Calculated from inputs. Can influence value nodes.",
    },
  };

  // ── State ─────────────────────────────────────────────────────────────────
  const [view, setView]             = useState("diagram");
  const [nodes, setNodes]           = useState([]);
  const [edges, setEdges]           = useState([]);
  const [selected, setSelected]     = useState(null);
  const [linkMode, setLinkMode]     = useState(false);
  const [linkSource, setLinkSource] = useState(null);
  const linkSourceRef = useRef(null); // ref stays current across renders
  const [addType, setAddType]       = useState("uncertainty");
  const [newLabel, setNewLabel]     = useState("");
  const [showAdd, setShowAdd]       = useState(false);
  const [generating, setGenerating] = useState(false);
  const [validation, setValidation] = useState(null);
  const [zoom, setZoom]             = useState(1);
  const [metaNode, setMetaNode]     = useState(null); // node being edited in metadata panel
  const [modelResult, setModelResult] = useState(null); // built financial model
  const [showModelResult, setShowModelResult] = useState(false);
  const [showModelModal, setShowModelModal] = useState(false);
  const [modelParams, setModelParams] = useState({
    horizon: "5", discount: "10", currency: "USD",
    revenueUnit: "millions", investment: "",
    baseRevenue: "", growthRate: "", costMargin: "",
  });
  const [buildingModel, setBuildingModel] = useState(false);

  const dragRef = useRef({ dragging:false, id:null, startX:0, startY:0, origX:0, origY:0 });

  // ── Seeding from issues ───────────────────────────────────────────────────
  // Sync nodes/edges to parent for Scenario Planning and VoI
  useEffect(() => {
    if (onNodesChange) onNodesChange(nodes);
  }, [nodes]);
  useEffect(() => {
    if (onEdgesChange) onEdgesChange(edges);
  }, [edges]);

  useEffect(() => {
    if (nodes.length > 0) return;
    const uIssues = issues.filter(i =>
      i.category === "uncertainty-external" || i.category === "uncertainty-internal"
    );
    if (uIssues.length > 0) {
      const seeded = uIssues.slice(0, 8).map((iss, idx) => ({
        id: uid("n"), type: "uncertainty",
        label: iss.text.length > 55 ? iss.text.slice(0, 55) + "…" : iss.text,
        description: iss.text, owner: "", assumptions: "",
        impact: iss.severity === "Critical" || iss.severity === "High" ? "High" : "Medium",
        control: iss.category === "uncertainty-external" ? "Low" : "Medium",
        tags: [],
        x: 180 + (idx % 4) * 230,
        y: 120 + Math.floor(idx / 4) * 200,
      }));
      setNodes(seeded);
    }
  }, [issues.length]);

  // ── Drag handlers ─────────────────────────────────────────────────────────
  const onMouseDown = (e, id) => {
    if (linkMode || e.button !== 0) return;
    e.preventDefault(); e.stopPropagation();
    const n = nodes.find(n => n.id === id);
    if (!n) return;
    dragRef.current = { dragging: true, id, startX: e.clientX, startY: e.clientY, origX: n.x, origY: n.y };
  };

  const onMouseMove = (e) => {
    const d = dragRef.current;
    if (!d.dragging) return;
    setNodes(prev => prev.map(n => n.id === d.id
      ? { ...n, x: Math.max(16, d.origX + (e.clientX - d.startX)), y: Math.max(16, d.origY + (e.clientY - d.startY)) }
      : n
    ));
  };

  const onMouseUp = (e) => {
    const d = dragRef.current;
    if (!d.dragging) return;
    const dx = Math.abs(e.clientX - d.startX), dy = Math.abs(e.clientY - d.startY);
    if (dx < 5 && dy < 5) {
      if (linkMode) handleLink(d.id);
      else { setSelected(s => s === d.id ? null : d.id); setMetaNode(d.id); }
    }
    dragRef.current = { ...dragRef.current, dragging: false };
  };

  // ── Link / edge logic ─────────────────────────────────────────────────────
  const handleLink = (targetId) => {
    const currentSource = linkSourceRef.current;
    if (!currentSource) {
      setLinkSource(targetId);
      linkSourceRef.current = targetId;
      return;
    }
    if (currentSource === targetId) {
      setLinkSource(null);
      linkSourceRef.current = null;
      return;
    }
    // Use currentSource (from ref) instead of linkSource (stale closure)
    const linkSourceId = currentSource;
    if (linkSource === targetId) { setLinkSource(null); return; }

    const src = nodes.find(n => n.id === linkSourceId);
    const tgt = nodes.find(n => n.id === targetId);

    // Rule: value nodes cannot influence upstream
    if (src?.type === "value") {
      onAIMsg({ role: "ai", text: "⚠ Invalid link: Value/Outcome nodes are terminal — they cannot influence other nodes. Reverse the arrow direction." });
      setLinkSource(null); return;
    }

    // Rule: no duplicate edges
    if (edges.find(e => e.from === linkSourceId && e.to === targetId)) {
      setLinkSource(null); linkSourceRef.current = null; return;
    }

    // Rule: circular dependency check (DFS)
    const wouldCycle = (from, to) => {
      const visited = new Set();
      const dfs = (id) => {
        if (id === from) return true;
        if (visited.has(id)) return false;
        visited.add(id);
        return edges.filter(e => e.from === id).some(e => dfs(e.to));
      };
      return dfs(to);
    };
    if (wouldCycle(linkSourceId, targetId)) {
      onAIMsg({ role: "ai", text: "⚠ Circular dependency detected. Influence diagrams must be acyclic — this link would create a loop." });
      setLinkSource(null); return;
    }

    setEdges(prev => [...prev, { id: uid("e"), from: linkSourceId, to: targetId, label: "influences" }]);
    setLinkSource(null);
    linkSourceRef.current = null;
  };

  // ── Node CRUD ─────────────────────────────────────────────────────────────
  const addNode = () => {
    const label = newLabel.trim();
    if (!label) return;
    const n = {
      id: uid("n"), type: addType, label,
      description: "", owner: "", assumptions: "", tags: [],
      impact: "High", control: "Low",
      x: 200 + Math.random() * 500, y: 150 + Math.random() * 300,
    };
    setNodes(prev => [...prev, n]);
    setNewLabel(""); setShowAdd(false);
    setSelected(n.id); setMetaNode(n.id);
  };

  const updateNode = (id, patch) => setNodes(prev => prev.map(n => n.id === id ? { ...n, ...patch } : n));

  const removeNode = (id) => {
    setNodes(prev => prev.filter(n => n.id !== id));
    setEdges(prev => prev.filter(e => e.from !== id && e.to !== id));
    if (selected === id) setSelected(null);
    if (metaNode === id) setMetaNode(null);
  };

  // ── Auto-layout ───────────────────────────────────────────────────────────
  const autoLayout = () => {
    // Topological sort then arrange in columns by type
    const cols = { decision: [], uncertainty: [], deterministic: [], value: [] };
    nodes.forEach(n => cols[n.type]?.push(n));
    const colOrder = ["decision", "uncertainty", "deterministic", "value"];
    const newNodes = [...nodes];
    colOrder.forEach((type, ci) => {
      cols[type].forEach((n, ri) => {
        const target = newNodes.find(x => x.id === n.id);
        if (target) { target.x = 80 + ci * 240; target.y = 80 + ri * 160; }
      });
    });
    setNodes([...newNodes]);
  };

  // ── Validation engine ─────────────────────────────────────────────────────
  const runValidation = () => {
    const issues_found = [];

    // Orphan nodes
    nodes.forEach(n => {
      const connected = edges.some(e => e.from === n.id || e.to === n.id);
      if (!connected) issues_found.push({ type: "orphan", node: n.label, msg: "Not connected to anything — either link it or remove it." });
    });

    // Value nodes with no incoming
    nodes.filter(n => n.type === "value").forEach(n => {
      if (!edges.some(e => e.to === n.id))
        issues_found.push({ type: "disconnected-value", node: n.label, msg: "Value node has no incoming influence — what drives this outcome?" });
    });

    // Decision nodes with no outgoing
    nodes.filter(n => n.type === "decision").forEach(n => {
      if (!edges.some(e => e.from === n.id))
        issues_found.push({ type: "disconnected-decision", node: n.label, msg: "Decision node has no outgoing influence — what does this decision affect?" });
    });

    // Duplicate labels
    const labels = nodes.map(n => n.label.toLowerCase().trim());
    nodes.forEach((n, i) => {
      if (labels.indexOf(n.label.toLowerCase().trim()) !== i)
        issues_found.push({ type: "duplicate", node: n.label, msg: "Duplicate node label — consolidate these into one node." });
    });

    // No value nodes at all
    if (nodes.length > 3 && !nodes.some(n => n.type === "value"))
      issues_found.push({ type: "no-value", node: "Diagram", msg: "No Value/Outcome nodes — what is this diagram optimising for?" });

    setValidation(issues_found);
    return issues_found;
  };

  // ── AI Generate ───────────────────────────────────────────────────────────
  const generateNodes = () => {
    setGenerating(true);
    const focusDecs = decisions.filter(d => d.tier === "focus").map(d => d.label).join(", ");
    const strats = strategies.map(s => s.name).join(", ");
    const existing = nodes.map(n => n.type + ": " + n.label).join("; ");
    const today = new Date().toISOString().slice(0, 10);

    aiCall(
      "You are a decision analysis expert building an influence diagram per the Decision Quality methodology. " +
      "Decision: " + (problem?.decisionStatement || "Not defined") + ". " +
      "Focus decisions: " + (focusDecs || "none") + ". " +
      "Strategies being evaluated: " + (strats || "none") + ". " +
      "Existing nodes (do not duplicate): " + (existing || "none") + ". " +
      "Generate a realistic influence diagram. Include all four node types: " +
      "decision nodes (controllable choices), uncertainty nodes (unknown variables), " +
      "deterministic nodes (calculated relationships like revenue/cost), and value nodes (outcomes like NPV/market share). " +
      "Suggest influence edges. Value nodes must be terminal — they cannot influence other nodes. " +
      "Decision nodes must have outgoing edges. No circular dependencies. " +
      'Return ONLY JSON: {"nodes":[{"type":"uncertainty","label":"Oil Price","description":"Global crude benchmark","impact":"High","control":"Low","owner":""}],' +
      '"edges":[{"from":"Oil Price","to":"Revenue","label":"drives"}],' +
      '"insight":"Key observation about the decision structure","missingNodes":["what else should be added"]}',
    (r) => {
      let result = r;
      if (r._raw) { try { result = JSON.parse(r._raw.replace(/```json|```/g, "").trim()); } catch(e) { setGenerating(false); return; } }
      if (result.error) { onAIMsg({ role: "ai", text: "AI error: " + result.error }); setGenerating(false); return; }

      if (result.nodes?.length) {
        const newNodes = result.nodes.map((n, i) => ({
          id: uid("n"), type: n.type || "uncertainty",
          label: n.label, description: n.description || "",
          owner: n.owner || "", assumptions: "", tags: [],
          impact: n.impact || "Medium", control: n.control || "Low",
          x: 150 + (i % 4) * 240, y: 120 + Math.floor(i / 4) * 180,
        }));
        // Add nodes first, then wire edges using combined node list
        const allNodes = [...nodes, ...newNodes];
        setNodes(allNodes);

        if (result.edges?.length) {
          const newEdges = result.edges.map(e => {
            const s = allNodes.find(n => n.label.toLowerCase() === (e.from || "").toLowerCase());
            const t = allNodes.find(n => n.label.toLowerCase() === (e.to || "").toLowerCase());
            return s && t ? { id: uid("e"), from: s.id, to: t.id, label: e.label || "influences" } : null;
          }).filter(Boolean);
          if (newEdges.length > 0) {
            setEdges(prev => [...prev, ...newEdges]);
          }
        }

        const msg = result.insight || ("Added " + result.nodes.length + " nodes.");
        const missing = result.missingNodes?.length ? " Consider adding: " + result.missingNodes.join(", ") + "." : "";
        onAIMsg({ role: "ai", text: msg + missing });
      }
      setGenerating(false);
    });
  };

  // ── Canvas dimensions ─────────────────────────────────────────────────────
  const CANVAS_W = Math.max(1100, nodes.reduce((m, n) => Math.max(m, (n.x || 0) + 260), 1100)) * zoom;
  const CANVAS_H = Math.max(700,  nodes.reduce((m, n) => Math.max(m, (n.y || 0) + 180), 700)) * zoom;

  const selNode = nodes.find(n => n.id === selected);
  const metaNodeData = nodes.find(n => n.id === metaNode);

  // ── Node shape SVG renderer ───────────────────────────────────────────────
  const NodeShape = ({ node }) => {
    const nt = NODE_TYPES[node.type] || NODE_TYPES.uncertainty;
    const isSel = selected === node.id;
    const isSrc = linkSource === node.id;
    const W = 190, H = 60;
    const cx = W / 2, cy = H / 2;

    const shapeStyle = {
      position: "absolute", left: node.x * zoom, top: node.y * zoom,
      width: W, minHeight: H,
      cursor: linkMode ? "crosshair" : "grab",
      userSelect: "none", zIndex: isSel || isSrc ? 10 : 1,
    };

    const boxStyle = {
      padding: "10px 14px",
      background: isSrc ? nt.color : nt.bg,
      border: "2px solid " + (isSel ? nt.color : isSrc ? nt.color : nt.border),
      borderRadius:
        node.type === "uncertainty" ? 50 :
        node.type === "value" ? 4 :
        node.type === "hex" ? 8 : 8,
      transform: node.type === "value" ? "rotate(-1deg)" : "none",
      boxShadow: isSel
        ? "0 0 0 3px " + nt.border + "80, 0 4px 16px rgba(0,0,0,.12)"
        : "0 2px 8px rgba(0,0,0,.07)",
      transition: "box-shadow .12s",
    };

    return (
      <div style={shapeStyle}
        onMouseDown={e => onMouseDown(e, node.id)}
        onClick={e => { if (linkMode) { e.stopPropagation(); handleLink(node.id); } }}>
        <div style={boxStyle}>
          <div style={{ display: "flex", alignItems: "flex-start", gap: 7 }}>
            <span style={{ fontSize: 12, color: isSrc ? "#fff" : nt.color, flexShrink: 0, marginTop: 1 }}>
              {nt.icon}
            </span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 11, fontWeight: 700,
                color: isSrc ? "#fff" : nt.color,
                lineHeight: 1.3, wordBreak: "break-word" }}>
                {node.label}
              </div>
              <div style={{ fontSize: 9, color: isSrc ? "rgba(255,255,255,.65)" : "#9ca3af",
                textTransform: "uppercase", letterSpacing: .5, marginTop: 3 }}>
                {nt.label}
                {node.type === "uncertainty" ? " · " + (node.impact || "?") + " impact" : ""}
              </div>
            </div>
          </div>
        </div>

        {/* Action row when selected */}
        {isSel && !linkMode && (
          <div style={{ position: "absolute", top: -30, right: 0,
            display: "flex", gap: 4 }}>
            <button onMouseDown={e => e.stopPropagation()}
              onClick={e => { e.stopPropagation(); setMetaNode(node.id); }}
              style={{ padding: "2px 8px", fontSize: 9, fontWeight: 700,
                background: nt.color, border: "none", borderRadius: 4,
                color: "#fff", cursor: "pointer", fontFamily: "inherit" }}>
              ✎ Edit
            </button>
            <button onMouseDown={e => e.stopPropagation()}
              onClick={e => { e.stopPropagation(); removeNode(node.id); }}
              style={{ padding: "2px 8px", fontSize: 9, fontWeight: 700,
                background: "#dc2626", border: "none", borderRadius: 4,
                color: "#fff", cursor: "pointer", fontFamily: "inherit" }}>
              ×
            </button>
          </div>
        )}
      </div>
    );
  };


  // ── Build Financial Model (deterministic engine) ────────────────────────
  const buildFinancialModel = () => {
    setBuildingModel(true);
    const valNodes = nodes.filter(n=>n.type==="value");
    const decNodes = nodes.filter(n=>n.type==="decision");
    const uncNodes = nodes.filter(n=>n.type==="uncertainty");
    const detNodes = nodes.filter(n=>n.type==="deterministic");
    const diagramDesc =
      "Value nodes: " + valNodes.map(n=>n.label).join(", ") + ". " +
      "Decision nodes: " + decNodes.map(n=>n.label).join(", ") + ". " +
      "Uncertainty nodes (scenario drivers): " + uncNodes.map(n=>n.label+" (impact:"+n.impact+", control:"+n.control+")").join(", ") + ". " +
      "Deterministic nodes: " + detNodes.map(n=>n.label).join(", ") + ". " +
      "Edges: " + edges.map(e=>{const s=nodes.find(n=>n.id===e.from),t=nodes.find(n=>n.id===e.to);return s&&t?s.label+"->"+t.label:null;}).filter(Boolean).join(", ");

    const p = modelParams;
    const inv = parseFloat(p.investment)||0;
    const baseRev = parseFloat(p.baseRevenue)||0;
    const growth = parseFloat(p.growthRate)||0;
    const costPct = parseFloat(p.costMargin)||0;
    const wacc = parseFloat(p.discount)||10;
    const yrs = parseInt(p.horizon)||5;

    // Step 1: AI decides ONLY structure/assumptions — no numbers
    aiCall(
      "You are a decision analyst. Given this influence diagram, define the key uncertainty assumptions " +
      "that will drive Low/Base/High scenario spreads in a financial model. " +
      "Do NOT generate any financial numbers — just the assumption structure. " +
      "Diagram: " + diagramDesc + ". " +
      "Decision: " + (problem?.decisionStatement||"") + ". " +
      "For each key uncertainty node, define what the Low/Base/High multiplier means for revenue and cost. " +
      "Also provide: scenario narratives (one sentence each), key risks from uncertainty nodes, modelling notes. " +
      "Return ONLY JSON: " +
      '{"modelTitle":"short title",' +
      '"revenueMultipliers":{"low":0.6,"base":1.0,"high":1.4},' +
      '"costMultipliers":{"low":1.1,"base":1.0,"high":0.85},' +
      '"growthMultipliers":{"low":0.6,"base":1.0,"high":1.3},' +
      '"assumptions":[{"name":"assumption","driver":"uncertainty node","low":"description","base":"description","high":"description"}],' +
      '"scenarioLow":"downside narrative",' +
      '"scenarioBase":"base case narrative",' +
      '"scenarioHigh":"upside narrative",' +
      '"keyRisks":["risk1","risk2","risk3"],' +
      '"notes":"modelling assumptions and caveats"}',
    (r) => {
      let structure = r;
      if (r._raw) { try { structure = JSON.parse(r._raw.replace(/```json|```/g,"").trim()); } catch(e) { setBuildingModel(false); onAIMsg({role:"ai",text:"Could not parse model structure."}); return; } }
      if (structure.error) { setBuildingModel(false); onAIMsg({role:"ai",text:"Error: "+structure.error}); return; }

      // Step 2: Calculate ALL numbers deterministically from params + multipliers
      const rMult = { low: parseFloat(structure.revenueMultipliers?.low)||0.6, base: 1.0, high: parseFloat(structure.revenueMultipliers?.high)||1.4 };
      const cMult = { low: parseFloat(structure.costMultipliers?.low)||1.1,    base: 1.0, high: parseFloat(structure.costMultipliers?.high)||0.85 };
      const gMult = { low: parseFloat(structure.growthMultipliers?.low)||0.6,  base: 1.0, high: parseFloat(structure.growthMultipliers?.high)||1.3 };

      const calcRevenue = (sc) => {
        const g = (growth * gMult[sc]) / 100;
        return Array.from({length:yrs}, (_,i) => parseFloat((baseRev * rMult[sc] * Math.pow(1+g, i)).toFixed(2)));
      };
      const calcCosts = (sc, revArr) => revArr.map(r => parseFloat((r * costPct * cMult[sc] / 100).toFixed(2)));
      const calcEbitda = (revArr, costArr) => revArr.map((r,i) => parseFloat((r - costArr[i]).toFixed(2)));

      const calcNPV = (ebitdaArr, waccPct, initialInv) => {
        const w = waccPct / 100;
        const pv = ebitdaArr.reduce((sum,cf,i) => sum + cf / Math.pow(1+w, i+1), 0);
        return parseFloat((pv - initialInv).toFixed(2));
      };

      const calcIRR = (ebitdaArr, initialInv) => {
        if (initialInv === 0) return 0;
        const cashflows = [-initialInv, ...ebitdaArr];
        let r = 0.1;
        for (let iter = 0; iter < 100; iter++) {
          const npv = cashflows.reduce((s,cf,i) => s + cf/Math.pow(1+r,i), 0);
          const dnpv = cashflows.reduce((s,cf,i) => s - i*cf/Math.pow(1+r,i+1), 0);
          if (Math.abs(dnpv) < 1e-10) break;
          const rNew = r - npv/dnpv;
          if (Math.abs(rNew - r) < 1e-8) { r = rNew; break; }
          r = rNew;
        }
        return parseFloat((r * 100).toFixed(1));
      };

      const calcPayback = (ebitdaArr, initialInv) => {
        let cum = -initialInv;
        for (let i = 0; i < ebitdaArr.length; i++) {
          cum += ebitdaArr[i];
          if (cum >= 0) return parseFloat((i + 1 - (cum - ebitdaArr[i]) / ebitdaArr[i]).toFixed(1));
        }
        return null;
      };

      const scenarios = ["low","base","high"];
      const revenue = {}, costs = {}, ebitda = {};
      const npv = {}, irr = {}, payback = {};

      scenarios.forEach(sc => {
        revenue[sc] = calcRevenue(sc);
        costs[sc]   = calcCosts(sc, revenue[sc]);
        ebitda[sc]  = calcEbitda(revenue[sc], costs[sc]);
        npv[sc]     = calcNPV(ebitda[sc], wacc, inv);
        irr[sc]     = calcIRR(ebitda[sc], inv);
        payback[sc] = calcPayback(ebitda[sc], inv);
      });

      const modelData = {
        modelTitle: structure.modelTitle || "Financial Model",
        assumptions: structure.assumptions || [],
        revenue, costs, ebitda, npv, irr, payback,
        scenarioLow:  structure.scenarioLow  || "",
        scenarioBase: structure.scenarioBase || "",
        scenarioHigh: structure.scenarioHigh || "",
        keyRisks: structure.keyRisks || [],
        notes: structure.notes || "",
        params: p,
        // Store multipliers so Excel can show the logic
        rMult, cMult, gMult,
        yrs,
      };

      showModelInApp(modelData);
      setBuildingModel(false);
      setShowModelModal(false);
      onAIMsg({role:"ai", text:"Model built. Base NPV: "+p.currency+" "+npv.base+"M | IRR: "+irr.base+"% | Payback: "+(payback.base||">"+(p.horizon||5))+" yrs. Numbers are deterministic — same inputs always give same outputs."});
    });
  };


  const showModelInApp = (modelData) => {
    setModelResult(modelData);
    setShowModelResult(true);
  };

  const downloadExcel = async (modelData) => {
    try {
      onAIMsg({role:"ai", text:"Generating Excel file..."});
      const response = await fetch("/api/excel", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ modelData, params: modelParams }),
      });
      if (!response.ok) throw new Error("Server error: " + response.status);
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = (modelData.modelTitle||"FinancialModel").replace(/\s+/g,"_") + "_VantageDQ.xlsx";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      onAIMsg({role:"ai", text:"Excel downloaded. Open in Excel — blue cells are editable inputs, black cells contain formulas. Change any blue cell and the model recalculates automatically."});
    } catch(err) {
      // Fallback to CSV if server fails
      console.error("Excel API failed, falling back to CSV:", err);
      const p = modelParams;
      const yrs = modelData.yrs || parseInt(p.horizon) || 5;
      const yrLabels = Array.from({length:yrs},(_,i)=>"Y"+(i+1));
      const fmtN = (n) => n===undefined||n===null?"":parseFloat(n).toFixed(2);
      let csv = "FINANCIAL MODEL: "+(modelData.modelTitle||"").toUpperCase()+"\n";
      csv += "Generated by Vantage DQ\n\n";
      csv += "PARAMETERS\n";
      csv += "Investment,"+p.investment+"\n";
      csv += "Year 1 Revenue (Base),"+p.baseRevenue+"\n";
      csv += "Growth Rate,"+p.growthRate+"%\n";
      csv += "Cost Margin,"+p.costMargin+"%\n";
      csv += "WACC,"+p.discount+"%\n\n";
      csv += "INCOME STATEMENT\n";
      csv += "Scenario,Line Item,"+yrLabels.join(",")+",NPV,IRR,Payback\n";
      ["low","base","high"].forEach(sc => {
        csv += sc.toUpperCase()+",Revenue,"+(modelData.revenue[sc]||[]).map(fmtN).join(",")+"\n";
        csv += ",Costs,"+(modelData.costs[sc]||[]).map(fmtN).join(",")+"\n";
        csv += ",EBITDA,"+(modelData.ebitda[sc]||[]).map(fmtN).join(",")+",,"+fmtN(modelData.npv[sc])+","+fmtN(modelData.irr[sc])+"%,"+fmtN(modelData.payback[sc])+" yrs\n";
      });
      const blob = new Blob([csv], {type:"text/csv;charset=utf-8;"});
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = (modelData.modelTitle||"FinancialModel").replace(/\s+/g,"_")+"_VantageDQ.csv";
      document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(url);
      onAIMsg({role:"ai", text:"Downloaded as CSV (Excel API unavailable). Open in Excel to edit."});
    }
  };


  // ── RENDER ────────────────────────────────────────────────────────────────
  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", overflow: "hidden" }}>

      {/* ── HEADER ── */}
      <div style={{ background: DS.canvas, borderBottom: "1px solid " + DS.canvasBdr, flexShrink: 0 }}>
        <div style={{ padding: "10px 20px", display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 9, color: DS.inkTer, textTransform: "uppercase",
              fontWeight: 700, letterSpacing: 1 }}>Module 08</div>
            <div style={{ fontFamily: "'Libre Baskerville',serif",
              fontSize: 18, fontWeight: 700, color: DS.ink }}>Influence Diagram</div>
          </div>
          <Btn variant="secondary" size="sm" onClick={() => setShowAdd(p => !p)}>+ Add Node</Btn>
          <Btn variant="secondary" size="sm" onClick={autoLayout}>Auto Layout</Btn>
          <Btn variant="secondary" size="sm"
            onClick={() => { setLinkMode(l => !l); setLinkSource(null); linkSourceRef.current = null; }}
            style={{
              background: linkMode ? DS.accentSoft : "transparent",
              border: "1px solid " + (linkMode ? DS.accent : DS.canvasBdr),
              color: linkMode ? DS.accent : DS.inkSub,
            }}>
            {linkMode ? (linkSource ? "→ Click target node" : "→ Click source node") : "Draw Links"}
          </Btn>
          <Btn variant="secondary" size="sm" onClick={runValidation}>Validate</Btn>
          <Btn variant="secondary" size="sm"
            onClick={()=>setShowModelModal(true)}
            disabled={nodes.length===0}>
            📊 Financial Model
          </Btn>
          <Btn variant="primary" icon="spark" size="sm"
            onClick={generateNodes} disabled={aiBusy || generating}>
            {generating ? "Generating…" : "AI Generate"}
          </Btn>
        </div>

        {/* View tabs + zoom */}
        <div style={{ padding: "0 20px 8px", display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ display: "flex", border: "1px solid " + DS.canvasBdr,
            borderRadius: 6, overflow: "hidden" }}>
            {[
              { id: "diagram",  label: "Diagram" },
              { id: "matrix",   label: "Impact Matrix" },
              { id: "metadata", label: "Node Registry" },
              { id: "validate", label: "Validate" },
            ].map(v => (
              <button key={v.id} onClick={() => setView(v.id)}
                style={{ padding: "5px 12px", fontSize: 11, fontWeight: 700,
                  fontFamily: "inherit", cursor: "pointer", border: "none",
                  background: view === v.id ? DS.accent : "transparent",
                  color: view === v.id ? "#fff" : DS.inkSub }}>
                {v.label}
              </button>
            ))}
          </div>

          {view === "diagram" && (
            <div style={{ display: "flex", alignItems: "center", gap: 5, marginLeft: "auto" }}>
              <button onClick={() => setZoom(z => Math.max(0.4, z - 0.15))}
                style={{ width: 22, height: 22, borderRadius: 4,
                  border: "1px solid " + DS.canvasBdr, background: "transparent",
                  cursor: "pointer", fontFamily: "inherit", fontSize: 14,
                  display: "flex", alignItems: "center", justifyContent: "center" }}>−</button>
              <span style={{ fontSize: 10, color: DS.inkTer, width: 38, textAlign: "center" }}>
                {Math.round(zoom * 100)}%
              </span>
              <button onClick={() => setZoom(z => Math.min(2, z + 0.15))}
                style={{ width: 22, height: 22, borderRadius: 4,
                  border: "1px solid " + DS.canvasBdr, background: "transparent",
                  cursor: "pointer", fontFamily: "inherit", fontSize: 14,
                  display: "flex", alignItems: "center", justifyContent: "center" }}>+</button>
              <button onClick={() => setZoom(1)}
                style={{ fontSize: 10, padding: "2px 7px", borderRadius: 4,
                  border: "1px solid " + DS.canvasBdr, background: "transparent",
                  cursor: "pointer", fontFamily: "inherit", color: DS.inkTer }}>Reset</button>
            </div>
          )}

          {/* Node type legend */}
          <div style={{ display: "flex", gap: 10, marginLeft: view === "diagram" ? 0 : "auto" }}>
            {Object.entries(NODE_TYPES).map(([type, nt]) => (
              <div key={type} style={{ display: "flex", alignItems: "center", gap: 4 }}>
                <span style={{ fontSize: 10, color: nt.color }}>{nt.icon}</span>
                <span style={{ fontSize: 9, color: DS.inkTer }}>{nt.label}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Add node panel */}
      {showAdd && (
        <div style={{ padding: "10px 20px", background: DS.accentSoft,
          borderBottom: "1px solid " + DS.accentLine,
          display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", flexShrink: 0 }}>
          {Object.entries(NODE_TYPES).map(([key, nt]) => (
            <button key={key} onClick={() => setAddType(key)}
              style={{ padding: "4px 11px", fontSize: 10, fontWeight: 700,
                fontFamily: "inherit", cursor: "pointer",
                border: "1.5px solid " + (addType === key ? nt.color : DS.canvasBdr),
                borderRadius: 5,
                background: addType === key ? nt.bg : "transparent",
                color: addType === key ? nt.color : DS.inkSub }}>
              {nt.icon} {nt.label}
            </button>
          ))}
          <input autoFocus value={newLabel}
            onChange={e => setNewLabel(e.target.value)}
            onKeyDown={e => { if (e.key === "Enter") addNode(); if (e.key === "Escape") setShowAdd(false); }}
            placeholder={"Label for this " + (NODE_TYPES[addType]?.label || "node").toLowerCase() + "..."}
            style={{ flex: 1, minWidth: 200, padding: "6px 10px", fontSize: 12,
              fontFamily: "inherit", background: DS.canvas,
              border: "1px solid " + DS.accentLine, borderRadius: 5,
              color: DS.ink, outline: "none" }}/>
          <Btn variant="primary" size="sm" onClick={addNode}>Add</Btn>
          <Btn variant="secondary" size="sm" onClick={() => setShowAdd(false)}>Cancel</Btn>
        </div>
      )}

      {/* Validation banner */}
      {validation && (
        <div style={{ padding: "8px 20px", flexShrink: 0,
          background: validation.length === 0 ? DS.successSoft : "#fff5f5",
          borderBottom: "1px solid " + (validation.length === 0 ? DS.successLine : "#fecaca"),
          display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
          {validation.length === 0 ? (
            <span style={{ fontSize: 11, color: DS.success, fontWeight: 700 }}>
              ✓ Diagram is structurally valid — no orphans, circular dependencies, or missing value nodes.
            </span>
          ) : (
            <>
              <span style={{ fontSize: 11, fontWeight: 700, color: DS.danger, flexShrink: 0 }}>
                ⚠ {validation.length} issue{validation.length !== 1 ? "s" : ""}:
              </span>
              {validation.map((v, i) => (
                <span key={i} style={{ fontSize: 10, color: "#7f1d1d",
                  background: "#fee2e2", padding: "2px 8px", borderRadius: 4 }}>
                  <strong>{v.node}:</strong> {v.msg}
                </span>
              ))}
            </>
          )}
          <button onClick={() => setValidation(null)}
            style={{ marginLeft: "auto", background: "none", border: "none",
              cursor: "pointer", color: DS.inkTer, fontSize: 14, flexShrink: 0 }}>×</button>
        </div>
      )}

      {/* ── MAIN CONTENT AREA ── */}
      <div style={{ flex: 1, overflow: "hidden", display: "flex" }}>

        {/* ── DIAGRAM VIEW ── */}
        {view === "diagram" && (
          <div style={{ flex: 1, overflow: "auto", position: "relative",
            background: "#f7f8fa",
            backgroundImage: "radial-gradient(circle, #d1d5db 1px, transparent 1px)",
            backgroundSize: "28px 28px" }}
            onMouseMove={onMouseMove} onMouseUp={onMouseUp} onMouseLeave={onMouseUp}>

            {nodes.length === 0 && (
              <div style={{ position: "absolute", top: "50%", left: "50%",
                transform: "translate(-50%,-50%)",
                textAlign: "center", color: DS.inkTer, pointerEvents: "none" }}>
                <div style={{ fontSize: 40, marginBottom: 12, opacity: .3 }}>◎</div>
                <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 6 }}>No nodes yet</div>
                <div style={{ fontSize: 12 }}>
                  Click <strong>+ Add Node</strong> to start, or use <strong>AI Generate</strong> to build a first draft from your decision context.
                </div>
              </div>
            )}

            <div style={{ position: "relative", width: CANVAS_W, height: CANVAS_H, minWidth: "100%", minHeight: "100%" }}>

              {/* SVG layer for edges */}
              <svg style={{ position: "absolute", top: 0, left: 0,
                width: CANVAS_W, height: CANVAS_H, pointerEvents: "none" }}>
                <defs>
                  {Object.entries(NODE_TYPES).map(([type, nt]) => (
                    <marker key={type}
                      id={"arr-" + type} markerWidth="10" markerHeight="7"
                      refX="9" refY="3.5" orient="auto">
                      <polygon points="0 0, 10 3.5, 0 7" fill={nt.color} opacity=".8"/>
                    </marker>
                  ))}
                </defs>
                {edges.map(e => {
                  const f = nodes.find(n => n.id === e.from);
                  const t = nodes.find(n => n.id === e.to);
                  if (!f || !t) return null;
                  const nt = NODE_TYPES[f.type] || NODE_TYPES.uncertainty;
                  const fx = (f.x + 95) * zoom, fy = (f.y + 35) * zoom;
                  const tx = (t.x + 95) * zoom, ty = (t.y + 35) * zoom;
                  const mx = (fx + tx) / 2, my = (fy + ty) / 2 - 40;
                  return (
                    <g key={e.id}>
                      <path
                        d={"M" + fx + "," + fy + " Q" + mx + "," + my + " " + tx + "," + ty}
                        fill="none" stroke={nt.color} strokeWidth={1.8}
                        strokeDasharray="6,3" opacity={.7}
                        markerEnd={"url(#arr-" + f.type + ")"}/>
                      {e.label && (
                        <text x={mx} y={my + 14} textAnchor="middle"
                          fontSize={9} fill={nt.color} opacity={.8}
                          fontFamily="'IBM Plex Sans',sans-serif">
                          {e.label}
                        </text>
                      )}
                      {/* Invisible hit area to click-remove */}
                      <circle cx={mx} cy={my + 7} r={10}
                        fill="transparent"
                        style={{ pointerEvents: "all", cursor: "pointer" }}
                        onClick={() => setEdges(prev => prev.filter(x => x.id !== e.id))}/>
                    </g>
                  );
                })}
              </svg>

              {/* Node elements */}
              {nodes.map(node => <NodeShape key={node.id} node={node}/>)}
            </div>
          </div>
        )}

        {/* ── IMPACT MATRIX VIEW ── */}
        {view === "matrix" && (
          <div style={{ flex: 1, overflow: "auto", padding: 20 }}>
            <div style={{ marginBottom: 12 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: DS.ink, marginBottom: 3 }}>
                Uncertainty Impact × Control Matrix
              </div>
              <div style={{ fontSize: 11, color: DS.inkTer }}>
                Uncertainty nodes plotted by how much they matter vs how much control the team has.
                Click any node to jump to the diagram.
              </div>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr",
              gridTemplateRows: "1fr 1fr", gap: 4,
              height: "calc(100% - 80px)", minHeight: 400 }}>
              {[
                { impact: "High", control: "High", label: "Manage Actively",
                  sub: "High leverage — key levers you control", color: "#059669", bg: "#ecfdf5" },
                { impact: "High", control: "Low", label: "Monitor Closely",
                  sub: "Major impact, low control — external forces", color: "#d97706", bg: "#fffbeb" },
                { impact: "Low", control: "High", label: "Exploit",
                  sub: "Easy wins — you control these", color: "#2563eb", bg: "#eff4ff" },
                { impact: "Low", control: "Low", label: "Accept / Track",
                  sub: "Background noise — monitor but don't over-invest", color: "#6b7280", bg: "#f9fafb" },
              ].map(q => {
                const qNodes = nodes.filter(n =>
                  n.type === "uncertainty" && n.impact === q.impact && n.control === q.control
                );
                return (
                  <div key={q.label} style={{ background: q.bg,
                    border: "1px solid " + q.color + "40", borderRadius: 10,
                    padding: "14px 16px", overflow: "auto" }}>
                    <div style={{ fontSize: 12, fontWeight: 700, color: q.color, marginBottom: 2 }}>
                      {q.label}
                    </div>
                    <div style={{ fontSize: 10, color: "#6b7280", marginBottom: 10 }}>{q.sub}</div>
                    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                      {qNodes.map(n => (
                        <div key={n.id}
                          onClick={() => { setView("diagram"); setSelected(n.id); }}
                          style={{ padding: "7px 10px", background: "white",
                            border: "1px solid " + q.color + "40", borderRadius: 6,
                            cursor: "pointer", fontSize: 11, fontWeight: 600, color: q.color }}>
                          {n.label}
                          {n.description && (
                            <div style={{ fontSize: 10, color: "#6b7280", fontWeight: 400, marginTop: 2 }}>
                              {n.description.slice(0, 60)}{n.description.length > 60 ? "…" : ""}
                            </div>
                          )}
                        </div>
                      ))}
                      {qNodes.length === 0 && (
                        <div style={{ fontSize: 11, color: "#9ca3af", fontStyle: "italic" }}>
                          No uncertainties here yet
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", marginTop: 8, padding: "0 4px" }}>
              <span style={{ fontSize: 10, color: DS.inkTer }}>← Low Control</span>
              <span style={{ fontSize: 10, fontWeight: 700, color: DS.inkTer }}>CONTROLLABILITY →</span>
              <span style={{ fontSize: 10, color: DS.inkTer }}>High Control →</span>
            </div>
          </div>
        )}

        {/* ── NODE REGISTRY VIEW ── */}
        {view === "metadata" && (
          <div style={{ flex: 1, display: "flex", overflow: "hidden" }}>
            {/* Node list */}
            <div style={{ width: 280, borderRight: "1px solid " + DS.canvasBdr,
              overflowY: "auto", flexShrink: 0 }}>
              {Object.entries(NODE_TYPES).map(([type, nt]) => {
                const typeNodes = nodes.filter(n => n.type === type);
                if (!typeNodes.length) return null;
                return (
                  <div key={type}>
                    <div style={{ padding: "8px 14px 4px",
                      fontSize: 9, fontWeight: 700, color: nt.color,
                      letterSpacing: .6, textTransform: "uppercase",
                      background: nt.bg, borderBottom: "1px solid " + nt.border }}>
                      {nt.icon} {nt.label} ({typeNodes.length})
                    </div>
                    {typeNodes.map(n => (
                      <button key={n.id}
                        onClick={() => setMetaNode(n.id)}
                        style={{ width: "100%", padding: "10px 14px", textAlign: "left",
                          border: "none", borderBottom: "1px solid " + DS.canvasBdr,
                          background: metaNode === n.id ? nt.bg : "transparent",
                          cursor: "pointer", fontFamily: "inherit",
                          borderLeft: "3px solid " + (metaNode === n.id ? nt.color : "transparent") }}>
                        <div style={{ fontSize: 12, fontWeight: 600,
                          color: nt.color, marginBottom: 2 }}>{n.label}</div>
                        {n.description && (
                          <div style={{ fontSize: 10, color: DS.inkTer }}>
                            {n.description.slice(0, 45)}{n.description.length > 45 ? "…" : ""}
                          </div>
                        )}
                      </button>
                    ))}
                  </div>
                );
              })}
              {nodes.length === 0 && (
                <div style={{ padding: "32px 16px", textAlign: "center",
                  color: DS.inkTer, fontSize: 12 }}>
                  No nodes yet. Add them in the Diagram view.
                </div>
              )}
            </div>

            {/* Metadata editor */}
            <div style={{ flex: 1, overflowY: "auto", padding: 20 }}>
              {metaNodeData ? (() => {
                const nt = NODE_TYPES[metaNodeData.type] || NODE_TYPES.uncertainty;
                return (
                  <div>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16 }}>
                      <div style={{ width: 28, height: 28, borderRadius: 6,
                        background: nt.bg, border: "2px solid " + nt.color,
                        display: "flex", alignItems: "center", justifyContent: "center",
                        fontSize: 14, color: nt.color }}>{nt.icon}</div>
                      <div>
                        <div style={{ fontSize: 14, fontWeight: 700, color: nt.color }}>{metaNodeData.label}</div>
                        <div style={{ fontSize: 10, color: DS.inkTer }}>{nt.label} · {nt.rule}</div>
                      </div>
                      <button onClick={() => removeNode(metaNodeData.id)}
                        style={{ marginLeft: "auto", background: "none",
                          border: "1px solid " + DS.dangerLine, borderRadius: 5,
                          cursor: "pointer", color: DS.danger, fontSize: 11,
                          padding: "3px 10px", fontFamily: "inherit", fontWeight: 700 }}>
                        Remove
                      </button>
                    </div>

                    {[
                      { key: "label", label: "Label", type: "text", placeholder: "Node name" },
                      { key: "description", label: "Description", type: "textarea", placeholder: "What does this node represent? What drives it?" },
                      { key: "owner", label: "Owner", type: "text", placeholder: "Who owns this variable?" },
                      { key: "assumptions", label: "Key Assumptions", type: "textarea", placeholder: "What are we assuming about this node?" },
                    ].map(field => (
                      <div key={field.key} style={{ marginBottom: 14 }}>
                        <div style={{ fontSize: 10, fontWeight: 700, color: DS.inkTer,
                          letterSpacing: .5, textTransform: "uppercase", marginBottom: 5 }}>
                          {field.label}
                        </div>
                        {field.type === "textarea" ? (
                          <textarea value={metaNodeData[field.key] || ""}
                            onChange={e => updateNode(metaNodeData.id, { [field.key]: e.target.value })}
                            placeholder={field.placeholder} rows={3}
                            style={{ width: "100%", padding: "7px 9px", fontSize: 12,
                              fontFamily: "inherit", background: DS.canvasAlt,
                              border: "1px solid " + DS.canvasBdr, borderRadius: 6,
                              color: DS.ink, outline: "none", resize: "vertical",
                              lineHeight: 1.5, boxSizing: "border-box" }}
                            onFocus={e => e.target.style.borderColor = nt.color}
                            onBlur={e => e.target.style.borderColor = DS.canvasBdr}/>
                        ) : (
                          <input value={metaNodeData[field.key] || ""}
                            onChange={e => updateNode(metaNodeData.id, { [field.key]: e.target.value })}
                            placeholder={field.placeholder}
                            style={{ width: "100%", padding: "7px 9px", fontSize: 12,
                              fontFamily: "inherit", background: DS.canvasAlt,
                              border: "1px solid " + DS.canvasBdr, borderRadius: 6,
                              color: DS.ink, outline: "none", boxSizing: "border-box" }}
                            onFocus={e => e.target.style.borderColor = nt.color}
                            onBlur={e => e.target.style.borderColor = DS.canvasBdr}/>
                        )}
                      </div>
                    ))}

                    {metaNodeData.type === "uncertainty" && (
                      <div style={{ display: "flex", gap: 12, marginBottom: 14 }}>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontSize: 10, fontWeight: 700, color: DS.inkTer,
                            letterSpacing: .5, textTransform: "uppercase", marginBottom: 5 }}>
                            Impact Level
                          </div>
                          <select value={metaNodeData.impact || "High"}
                            onChange={e => updateNode(metaNodeData.id, { impact: e.target.value })}
                            style={{ width: "100%", padding: "7px 9px", fontSize: 12,
                              fontFamily: "inherit", background: DS.canvasAlt,
                              border: "1px solid " + DS.canvasBdr, borderRadius: 6,
                              color: DS.ink, outline: "none" }}>
                            {["Critical", "High", "Medium", "Low"].map(v => <option key={v}>{v}</option>)}
                          </select>
                        </div>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontSize: 10, fontWeight: 700, color: DS.inkTer,
                            letterSpacing: .5, textTransform: "uppercase", marginBottom: 5 }}>
                            Controllability
                          </div>
                          <select value={metaNodeData.control || "Low"}
                            onChange={e => updateNode(metaNodeData.id, { control: e.target.value })}
                            style={{ width: "100%", padding: "7px 9px", fontSize: 12,
                              fontFamily: "inherit", background: DS.canvasAlt,
                              border: "1px solid " + DS.canvasBdr, borderRadius: 6,
                              color: DS.ink, outline: "none" }}>
                            {["High", "Medium", "Low", "No Control"].map(v => <option key={v}>{v}</option>)}
                          </select>
                        </div>
                      </div>
                    )}

                    {/* Connections summary */}
                    {edges.filter(e => e.from === metaNodeData.id || e.to === metaNodeData.id).length > 0 && (
                      <div style={{ padding: "12px 14px", background: DS.canvasAlt,
                        border: "1px solid " + DS.canvasBdr, borderRadius: 8, marginTop: 8 }}>
                        <div style={{ fontSize: 10, fontWeight: 700, color: DS.inkTer,
                          textTransform: "uppercase", letterSpacing: .5, marginBottom: 8 }}>
                          Connections
                        </div>
                        {edges.filter(e => e.from === metaNodeData.id).length > 0 && (
                          <div style={{ marginBottom: 6 }}>
                            <span style={{ fontSize: 10, color: DS.inkTer }}>Influences → </span>
                            {edges.filter(e => e.from === metaNodeData.id).map(e => {
                              const t = nodes.find(n => n.id === e.to);
                              const tn = NODE_TYPES[t?.type] || NODE_TYPES.uncertainty;
                              return t ? (
                                <span key={e.id} style={{ fontSize: 10, fontWeight: 600,
                                  color: tn.color, marginRight: 6 }}>
                                  {tn.icon} {t.label}
                                </span>
                              ) : null;
                            })}
                          </div>
                        )}
                        {edges.filter(e => e.to === metaNodeData.id).length > 0 && (
                          <div>
                            <span style={{ fontSize: 10, color: DS.inkTer }}>← Influenced by </span>
                            {edges.filter(e => e.to === metaNodeData.id).map(e => {
                              const s = nodes.find(n => n.id === e.from);
                              const sn = NODE_TYPES[s?.type] || NODE_TYPES.uncertainty;
                              return s ? (
                                <span key={e.id} style={{ fontSize: 10, fontWeight: 600,
                                  color: sn.color, marginRight: 6 }}>
                                  {sn.icon} {s.label}
                                </span>
                              ) : null;
                            })}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })() : (
                <div style={{ display: "flex", alignItems: "center", justifyContent: "center",
                  height: "100%", color: DS.inkTer, fontSize: 13 }}>
                  Select a node from the list to edit its metadata
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── VALIDATE VIEW ── */}
        {view === "validate" && (
          <div style={{ flex: 1, overflowY: "auto", padding: 20 }}>
            {/* Stats grid */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(5,1fr)", gap: 10, marginBottom: 20 }}>
              {[...Object.entries(NODE_TYPES).map(([type, nt]) => ({
                icon: nt.icon, color: nt.color, label: nt.label,
                val: nodes.filter(n => n.type === type).length,
              })), {
                icon: "→", color: DS.accent, label: "Edges",
                val: edges.length,
              }].map((item, i) => (
                <div key={i} style={{ padding: "14px 16px", borderRadius: 8,
                  background: item.color + "12", border: "1px solid " + item.color + "30",
                  display: "flex", alignItems: "center", gap: 10 }}>
                  <span style={{ fontSize: 20 }}>{item.icon}</span>
                  <div>
                    <div style={{ fontSize: 20, fontWeight: 700, color: item.color,
                      fontFamily: "'Libre Baskerville',serif" }}>{item.val}</div>
                    <div style={{ fontSize: 10, color: "#6b7280" }}>{item.label}</div>
                  </div>
                </div>
              ))}
            </div>

            <Btn variant="primary" onClick={runValidation} style={{ marginBottom: 16 }}>
              Run Structural Validation
            </Btn>

            {validation && (
              <div style={{ marginBottom: 20 }}>
                {validation.length === 0 ? (
                  <div style={{ padding: "16px 18px", background: DS.successSoft,
                    border: "1px solid " + DS.successLine, borderRadius: 8,
                    color: DS.success, fontWeight: 700, fontSize: 13 }}>
                    ✓ Diagram passes all structural checks. No orphans, disconnected nodes, or duplicate labels.
                  </div>
                ) : validation.map((v, i) => (
                  <div key={i} style={{ padding: "11px 14px", marginBottom: 8,
                    background: DS.dangerSoft, border: "1px solid " + DS.dangerLine,
                    borderRadius: 8, display: "flex", gap: 10 }}>
                    <span style={{ color: DS.danger, fontSize: 16, flexShrink: 0 }}>⚠</span>
                    <div>
                      <div style={{ fontSize: 12, fontWeight: 700, color: DS.ink, marginBottom: 2 }}>
                        {v.node}
                      </div>
                      <div style={{ fontSize: 11, color: DS.inkSub }}>{v.msg}</div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* DQ principles */}
            <div style={{ padding: "16px 18px", background: DS.canvasAlt,
              border: "1px solid " + DS.canvasBdr, borderRadius: 10 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: DS.ink, marginBottom: 10 }}>
                Influence Diagram DQ Principles
              </div>
              {[
                "Decision nodes must have at least one outgoing influence — they must affect something.",
                "Value/Outcome nodes must have at least one incoming influence — something must drive the outcome.",
                "Value/Outcome nodes should not influence upstream nodes — they are terminal.",
                "No circular dependencies — influence must flow in one direction only.",
                "Every uncertainty should ultimately connect to a value node (directly or indirectly).",
                "Orphan nodes (no connections) are not contributing to the model — link or remove them.",
                "Duplicate node labels suggest redundant thinking — consolidate into one node.",
                "Every diagram needs at least one value node — what is this decision optimising for?",
              ].map((rule, i) => (
                <div key={i} style={{ display: "flex", gap: 8, marginBottom: 6,
                  fontSize: 11, color: DS.inkSub, lineHeight: 1.5 }}>
                  <span style={{ color: DS.accent, flexShrink: 0 }}>·</span>
                  <span>{rule}</span>
                </div>
              ))}
            </div>
          </div>
        )}


      {/* Financial Model Modal */}
      {showModelModal && (
        <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,.55)",
          display:"flex", alignItems:"center", justifyContent:"center", zIndex:9000 }}
          onClick={e=>{ if(e.target===e.currentTarget) setShowModelModal(false); }}>
          <div style={{ width:"100%", maxWidth:560, background:DS.canvas,
            borderRadius:14, boxShadow:"0 24px 64px rgba(0,0,0,.25)", overflow:"hidden" }}>
            <div style={{ padding:"20px 24px", borderBottom:"1px solid "+DS.canvasBdr,
              background:"linear-gradient(135deg, #1e2433 0%, #2d3748 100%)" }}>
              <div style={{ fontSize:17, fontWeight:700, color:"#fff", marginBottom:3 }}>
                📊 Build Financial Model
              </div>
              <div style={{ fontSize:11, color:"#93c5fd" }}>
                AI uses your influence diagram to build a 3-scenario financial model
              </div>
            </div>
            <div style={{ padding:"10px 24px", background:DS.accentSoft,
              borderBottom:"1px solid "+DS.accentLine,
              display:"flex", gap:16, flexWrap:"wrap", alignItems:"center" }}>
              {[
                { label:"Decisions", val:nodes.filter(n=>n.type==="decision").length, color:"#2563eb" },
                { label:"Uncertainties", val:nodes.filter(n=>n.type==="uncertainty").length, color:"#d97706" },
                { label:"Deterministic", val:nodes.filter(n=>n.type==="deterministic").length, color:"#7c3aed" },
                { label:"Value nodes", val:nodes.filter(n=>n.type==="value").length, color:"#059669" },
              ].map(item=>(
                <div key={item.label} style={{ display:"flex", alignItems:"center", gap:4 }}>
                  <span style={{ fontSize:14, fontWeight:700, color:item.color }}>{item.val}</span>
                  <span style={{ fontSize:10, color:DS.inkTer }}>{item.label}</span>
                </div>
              ))}
              <span style={{ fontSize:10, color:DS.inkTer, marginLeft:"auto" }}>{edges.length} edges</span>
            </div>
            <div style={{ padding:"18px 24px" }}>
              <div style={{ fontSize:11, fontWeight:700, color:DS.ink, marginBottom:12 }}>
                Enter 5 parameters — AI handles the rest
              </div>
              <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10 }}>
                {[
                  { key:"investment",  label:"Total Investment",      placeholder:"e.g. 50",   suffix:"(base currency)" },
                  { key:"baseRevenue", label:"Year 1 Revenue (Base)", placeholder:"e.g. 12",   suffix:"" },
                  { key:"growthRate",  label:"Annual Revenue Growth", placeholder:"e.g. 35",   suffix:"%" },
                  { key:"costMargin",  label:"Cost % of Revenue",     placeholder:"e.g. 65",   suffix:"%" },
                  { key:"discount",    label:"Discount Rate (WACC)",  placeholder:"e.g. 10",   suffix:"%" },
                  { key:"horizon",     label:"Model Horizon",         placeholder:"e.g. 5",    suffix:"years" },
                  { key:"currency",    label:"Currency",              placeholder:"e.g. USD",  suffix:"" },
                  { key:"revenueUnit", label:"Revenue Unit",          placeholder:"e.g. millions", suffix:"" },
                ].map(field=>(
                  <div key={field.key}>
                    <div style={{ fontSize:9, fontWeight:700, color:DS.inkTer,
                      letterSpacing:.5, textTransform:"uppercase", marginBottom:3 }}>
                      {field.label}
                    </div>
                    <div style={{ display:"flex", alignItems:"center", gap:5 }}>
                      <input value={modelParams[field.key]}
                        onChange={e=>setModelParams(p=>({...p,[field.key]:e.target.value}))}
                        placeholder={field.placeholder}
                        style={{ flex:1, padding:"6px 9px", fontSize:12,
                          fontFamily:"inherit", background:DS.canvasAlt,
                          border:"1px solid "+DS.canvasBdr, borderRadius:5,
                          color:DS.ink, outline:"none" }}
                        onFocus={e=>{e.target.style.borderColor=DS.accent;}}
                        onBlur={e=>{e.target.style.borderColor=DS.canvasBdr;}}/>
                      {field.suffix && <span style={{ fontSize:10, color:DS.inkTer, whiteSpace:"nowrap" }}>{field.suffix}</span>}
                    </div>
                  </div>
                ))}
              </div>
              <div style={{ marginTop:12, padding:"9px 12px",
                background:"#fffbeb", border:"1px solid #fde68a",
                borderRadius:6, fontSize:10, color:"#92400e", lineHeight:1.5 }}>
                ⚡ The AI traces causal paths from your uncertainty nodes to value nodes, builds Low/Base/High scenario projections, and calculates NPV, IRR and payback. Renders inside Vantage DQ.
              </div>
            </div>
            <div style={{ padding:"13px 24px", borderTop:"1px solid "+DS.canvasBdr,
              display:"flex", gap:10, justifyContent:"flex-end" }}>
              <Btn variant="secondary" onClick={()=>setShowModelModal(false)}>Cancel</Btn>
              <Btn variant="primary" onClick={buildFinancialModel}
                disabled={buildingModel||!modelParams.investment||!modelParams.baseRevenue}>
                {buildingModel?"Building model…":"Build Financial Model →"}
              </Btn>
            </div>
          </div>
        </div>
      )}

      {/* ── FINANCIAL MODEL RESULT MODAL ── */}
      {showModelResult && modelResult && (
        <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,.6)",
          display:"flex", alignItems:"flex-start", justifyContent:"center",
          zIndex:9500, overflowY:"auto", padding:"24px 16px" }}>
          <div style={{ width:"100%", maxWidth:900, background:DS.canvas,
            borderRadius:14, boxShadow:"0 32px 80px rgba(0,0,0,.3)",
            overflow:"hidden" }}>

            {/* Header */}
            <div style={{ padding:"18px 28px", display:"flex", alignItems:"center", gap:10,
              background:"linear-gradient(135deg,#1e2433 0%,#2d3748 100%)" }}>
              <div style={{ flex:1 }}>
                <div style={{ fontSize:18, fontWeight:700, color:"#fff", marginBottom:3 }}>
                  📊 {modelResult.modelTitle || "Financial Model"}
                </div>
                <div style={{ fontSize:11, color:"#93c5fd" }}>
                  {modelResult.scenarioBase}
                </div>
              </div>
              {/* Download Excel/CSV */}
              <button
                onClick={()=>downloadExcel(modelResult)}
                style={{ padding:"6px 14px", border:"1px solid rgba(255,255,255,.3)",
                  borderRadius:6, cursor:"pointer", color:"#fff", background:"rgba(255,255,255,.15)",
                  fontSize:11, fontWeight:700, fontFamily:"inherit",
                  display:"flex", alignItems:"center", gap:5 }}>
                ⬇ Download Excel
              </button>
              {/* Print to PDF */}
              <button
                onClick={()=>{
                  const el = document.getElementById("vantage-fin-model");
                  if (!el) return;
                  const orig = document.title;
                  document.title = (modelResult.modelTitle||"Financial Model") + " — Vantage DQ";
                  const style = document.createElement("style");
                  style.id = "print-override";
                  style.textContent = "@media print { body * { visibility:hidden } #vantage-fin-model, #vantage-fin-model * { visibility:visible } #vantage-fin-model { position:fixed;inset:0;overflow:visible;padding:24px;background:white } .no-print { display:none!important } }";
                  document.head.appendChild(style);
                  window.print();
                  document.head.removeChild(style);
                  document.title = orig;
                }}
                style={{ padding:"6px 14px", border:"1px solid rgba(255,255,255,.3)",
                  borderRadius:6, cursor:"pointer", color:"#fff", background:"rgba(255,255,255,.1)",
                  fontSize:11, fontWeight:700, fontFamily:"inherit",
                  display:"flex", alignItems:"center", gap:5 }}>
                🖨 Print / PDF
              </button>
              {/* Email share */}
              <button
                onClick={()=>{
                  const subject = encodeURIComponent((modelResult.modelTitle||"Financial Model") + " — Vantage DQ");
                  const yrs = Array.from({length:parseInt(modelParams.horizon)||5},(_,i)=>"Y"+(i+1)).join("  ");
                  const fmtRow = (label, data) => {
                    if (!data) return "";
                    const vals = [data.low, data.base, data.high].map(scenario =>
                      (scenario||[]).map(v=>v!=null?parseFloat(v).toFixed(1):"—").join(" / ")
                    );
                    return label + ": Low=" + vals[0] + "  Base=" + vals[1] + "  High=" + vals[2];
                  };
                  const body = encodeURIComponent(
                    "FINANCIAL MODEL: " + (modelResult.modelTitle||"").toUpperCase() + "\n" +
                    "Generated by Vantage DQ\n\n" +
                    "PARAMETERS\n" +
                    "Investment: " + modelParams.currency + " " + modelParams.investment + modelParams.revenueUnit + "\n" +
                    "Year 1 Revenue (Base): " + modelParams.currency + " " + modelParams.baseRevenue + modelParams.revenueUnit + "\n" +
                    "Growth: " + modelParams.growthRate + "% | Cost margin: " + modelParams.costMargin + "% | WACC: " + modelParams.discount + "% | Horizon: " + modelParams.horizon + " yrs\n\n"
                  );
                  window.location.href = "mailto:?subject=" + subject + "&body=" + body;
                }}
                style={{ padding:"6px 14px", border:"1px solid rgba(255,255,255,.3)",
                  borderRadius:6, cursor:"pointer", color:"#fff", background:"rgba(255,255,255,.1)",
                  fontSize:11, fontWeight:700, fontFamily:"inherit",
                  display:"flex", alignItems:"center", gap:5 }}>
                ✉ Send Email
              </button>
              <button onClick={()=>setShowModelResult(false)} className="no-print"
                style={{ background:"none", border:"1px solid rgba(255,255,255,.2)",
                  borderRadius:6, cursor:"pointer", color:"rgba(255,255,255,.6)",
                  fontSize:11, padding:"5px 12px", fontFamily:"inherit", fontWeight:600 }}>
                ✕
              </button>
            </div>

            <div id="vantage-fin-model" style={{ padding:"24px 28px", overflowY:"auto", maxHeight:"80vh" }}>

              {/* Parameters recap */}
              <div style={{ marginBottom:16 }}>
                <div style={{ display:"flex", gap:10, flexWrap:"wrap", marginBottom:6,
                  padding:"10px 14px", background:DS.canvasAlt,
                  border:"1px solid "+DS.canvasBdr, borderRadius:"8px 8px 0 0" }}>
                  {[
                    ["Investment", modelParams.currency+" "+modelParams.investment+"M"],
                    ["Yr 1 Rev (Base)", modelParams.currency+" "+modelParams.baseRevenue+"M"],
                    ["Growth", modelParams.growthRate+"%"],
                    ["Cost Margin", modelParams.costMargin+"%"],
                    ["WACC", modelParams.discount+"%"],
                    ["Horizon", modelParams.horizon+" years"],
                  ].map(([k,v])=>(
                    <div key={k} style={{ fontSize:10 }}>
                      <span style={{ color:DS.inkTer }}>{k}: </span>
                      <span style={{ fontWeight:700, color:DS.ink }}>{v}</span>
                    </div>
                  ))}
                </div>
                <div style={{ padding:"7px 14px", background:"#f0fdf4",
                  border:"1px solid #bbf7d0", borderRadius:"0 0 8px 8px",
                  fontSize:10, color:"#065f46" }}>
                  ✓ Numbers calculated deterministically — same inputs always produce the same outputs.
                  Scenario spread is driven by uncertainty node multipliers from your influence diagram.
                </div>
              </div>

              {/* Assumptions table */}
              {modelResult.assumptions?.length > 0 && (
                <div style={{ marginBottom:24 }}>
                  <div style={{ fontSize:12, fontWeight:700, color:DS.ink, marginBottom:10,
                    paddingBottom:6, borderBottom:"2px solid #d97706" }}>
                    Key Assumptions
                  </div>
                  <table style={{ width:"100%", borderCollapse:"collapse", fontSize:11 }}>
                    <thead>
                      <tr>
                        {["Parameter","Low Case","Base Case","High Case","Unit","Uncertainty Driver"].map(h=>(
                          <th key={h} style={{ padding:"7px 10px", background:"#1e2433",
                            color:"#fff", fontWeight:700, textAlign:h==="Parameter"||h==="Uncertainty Driver"?"left":"center",
                            fontSize:10 }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {modelResult.assumptions.map((a,i)=>(
                        <tr key={i} style={{ background:i%2===0?"#fffbeb":"#fef9ee" }}>
                          <td style={{ padding:"7px 10px", fontWeight:600, color:"#92400e" }}>{a.name}</td>
                          <td style={{ padding:"7px 10px", textAlign:"center", color:"#dc2626", fontWeight:600 }}>{a.low}</td>
                          <td style={{ padding:"7px 10px", textAlign:"center", color:"#2563eb", fontWeight:700 }}>{a.base}</td>
                          <td style={{ padding:"7px 10px", textAlign:"center", color:"#059669", fontWeight:600 }}>{a.high}</td>
                          <td style={{ padding:"7px 10px", color:DS.inkTer, fontSize:10 }}>{a.unit}</td>
                          <td style={{ padding:"7px 10px", fontSize:10 }}>
                            <span style={{ background:"#fef3c7", color:"#92400e",
                              padding:"1px 6px", borderRadius:3, fontWeight:600 }}>
                              {a.driver}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {/* Income Statement — 3 scenarios side by side */}
              <div style={{ marginBottom:24 }}>
                <div style={{ fontSize:12, fontWeight:700, color:DS.ink, marginBottom:10,
                  paddingBottom:6, borderBottom:"2px solid #2563eb" }}>
                  Income Statement — Three Scenarios
                </div>
                {(() => {
                  const yrs = Array.from({length:parseInt(modelParams.horizon)||5},(_,i)=>"Y"+(i+1));
                  const rows = [
                    { label:"Revenue",   key:"revenue", bold:true,  color:"#059669" },
                    { label:"Costs",     key:"costs",   bold:false, color:"#dc2626" },
                    { label:"EBITDA",    key:"ebitda",  bold:true,  color:"#2563eb", sep:true },
                  ];
                  const fmtN = (n) => {
                    if (n===undefined||n===null) return "—";
                    const num = parseFloat(n);
                    if (isNaN(num)) return n;
                    return num >= 1000 ? num.toLocaleString("en",{maximumFractionDigits:0})
                      : num >= 0 ? num.toFixed(1) : "("+Math.abs(num).toFixed(1)+")";
                  };
                  const scenarios = [
                    { key:"low",  label:"⬇ Low",  bg:"#fff5f5", hdr:"#fecaca", col:"#dc2626" },
                    { key:"base", label:"◆ Base", bg:"#eff6ff", hdr:"#bfdbfe", col:"#2563eb" },
                    { key:"high", label:"⬆ High", bg:"#f0fdf4", hdr:"#bbf7d0", col:"#059669" },
                  ];
                  return (
                    <div style={{ overflowX:"auto" }}>
                      <table style={{ width:"100%", borderCollapse:"collapse", fontSize:11 }}>
                        <thead>
                          <tr>
                            <th style={{ padding:"7px 12px", background:"#1e2433",
                              color:"#fff", textAlign:"left", width:120 }}>Line</th>
                            {scenarios.map(sc=>(
                              yrs.map(y=>(
                                <th key={sc.key+y} style={{ padding:"5px 8px",
                                  background:sc.col, color:"#fff",
                                  textAlign:"right", fontSize:9, fontWeight:700,
                                  minWidth:60 }}>
                                  {sc.label} {y}
                                </th>
                              ))
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {rows.map((row,ri)=>(
                            <tr key={row.key} style={{
                              background:ri%2===0?"#f9fafb":"#fff",
                              borderTop:row.sep?"2px solid #374151":"none" }}>
                              <td style={{ padding:"7px 12px", fontWeight:row.bold?700:400,
                                color:row.color, fontSize:row.bold?12:11 }}>{row.label}</td>
                              {scenarios.map(sc=>(
                                yrs.map((_,yi)=>(
                                  <td key={sc.key+yi} style={{ padding:"6px 8px",
                                    textAlign:"right", fontFamily:"monospace",
                                    fontWeight:row.bold?700:400,
                                    background:row.sep?sc.bg+"80":"transparent",
                                    color:row.key==="costs"?"#dc2626":row.bold?sc.col:"#374151" }}>
                                    {fmtN(modelResult[row.key]?.[sc.key]?.[yi])}
                                  </td>
                                ))
                              ))}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  );
                })()}
              </div>

              {/* Valuation Summary */}
              <div style={{ marginBottom:24 }}>
                <div style={{ fontSize:12, fontWeight:700, color:DS.ink, marginBottom:10,
                  paddingBottom:6, borderBottom:"2px solid #059669" }}>
                  Valuation Summary
                </div>
                <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:12 }}>
                  {[
                    { metric:"Net Present Value", key:"npv", unit:modelParams.currency+"M", icon:"💰" },
                    { metric:"Internal Rate of Return", key:"irr", unit:"%", icon:"📈" },
                    { metric:"Payback Period", key:"payback", unit:"years", icon:"⏱" },
                  ].map(item=>(
                    <div key={item.key} style={{ borderRadius:10, overflow:"hidden",
                      border:"1px solid "+DS.canvasBdr }}>
                      <div style={{ padding:"8px 14px", background:"#1e2433",
                        fontSize:10, fontWeight:700, color:"#94a3b8" }}>
                        {item.icon} {item.metric}
                      </div>
                      {[
                        { sc:"low",  label:"Low",  col:"#dc2626", bg:"#fff5f5" },
                        { sc:"base", label:"Base", col:"#2563eb", bg:"#eff6ff" },
                        { sc:"high", label:"High", col:"#059669", bg:"#f0fdf4" },
                      ].map(row=>(
                        <div key={row.sc} style={{ padding:"8px 14px",
                          background:row.bg, display:"flex",
                          justifyContent:"space-between", alignItems:"center",
                          borderBottom:"1px solid "+DS.canvasBdr }}>
                          <span style={{ fontSize:10, color:row.col, fontWeight:700 }}>
                            {row.label}
                          </span>
                          <span style={{ fontSize:16, fontWeight:700, color:row.col,
                            fontFamily:"'Libre Baskerville',serif" }}>
                            {modelResult[item.key]?.[row.sc] ?? "—"}{item.unit}
                          </span>
                        </div>
                      ))}
                    </div>
                  ))}
                </div>
              </div>

              {/* Scenarios + Risks */}
              <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:16, marginBottom:20 }}>
                <div>
                  <div style={{ fontSize:12, fontWeight:700, color:DS.ink, marginBottom:8,
                    paddingBottom:6, borderBottom:"1px solid "+DS.canvasBdr }}>
                    Scenario Narratives
                  </div>
                  {[
                    { key:"scenarioLow",  label:"⬇ Low Case",  col:"#dc2626", bg:"#fff5f5" },
                    { key:"scenarioBase", label:"◆ Base Case", col:"#2563eb", bg:"#eff6ff" },
                    { key:"scenarioHigh", label:"⬆ High Case", col:"#059669", bg:"#f0fdf4" },
                  ].map(s=>(
                    <div key={s.key} style={{ padding:"10px 12px", marginBottom:6,
                      background:s.bg, borderLeft:"3px solid "+s.col, borderRadius:5 }}>
                      <div style={{ fontSize:10, fontWeight:700, color:s.col, marginBottom:3 }}>
                        {s.label}
                      </div>
                      <div style={{ fontSize:11, color:DS.inkSub, lineHeight:1.5 }}>
                        {modelResult[s.key] || "—"}
                      </div>
                    </div>
                  ))}
                </div>
                <div>
                  <div style={{ fontSize:12, fontWeight:700, color:DS.ink, marginBottom:8,
                    paddingBottom:6, borderBottom:"1px solid "+DS.canvasBdr }}>
                    Key Risks from Diagram
                  </div>
                  {(modelResult.keyRisks||[]).map((r,i)=>(
                    <div key={i} style={{ padding:"8px 10px", marginBottom:5,
                      background:"#fff5f5", borderLeft:"3px solid #dc2626",
                      borderRadius:5, fontSize:11, color:DS.inkSub, lineHeight:1.5 }}>
                      ⚠ {r}
                    </div>
                  ))}
                  {modelResult.notes && (
                    <div style={{ marginTop:10, padding:"10px 12px",
                      background:DS.canvasAlt, borderRadius:6,
                      fontSize:10, color:DS.inkTer, lineHeight:1.6,
                      border:"1px solid "+DS.canvasBdr }}>
                      <strong>Modelling notes:</strong> {modelResult.notes}
                    </div>
                  )}
                </div>
              </div>

            </div>
          </div>
        </div>
      )}
      </div>
    </div>
  );
}


function NudgeBar({ module, issues, decisions, criteria, strategies, assessmentScores, dqScores, onNavigate }) {
  const nudges = [];
  const focusDecs = decisions.filter(d=>d.tier==="focus");
  const criticalIssues = issues.filter(i=>i.severity==="Critical"&&i.status==="Open");

  if (module==="problem" && issues.length===0)
    nudges.push({ text:"Start by raising issues from the problem brief", nav:"issues", color:DS.accent });
  if (module==="issues" && focusDecs.length===0 && issues.length>=3)
    nudges.push({ text:"Promote key decisions to the Decision Hierarchy", nav:"hierarchy", color:DS.warning });
  if (module==="hierarchy" && focusDecs.length>=2 && strategies.length===0)
    nudges.push({ text:"You have focus decisions — build your strategies now", nav:"strategy", color:DS.success });
  if (module==="strategy" && strategies.length>=2 && Object.keys(assessmentScores).length===0)
    nudges.push({ text:"Strategies ready — score them against your criteria", nav:"assessment", color:DS.accent });
  if (module==="assessment" && Object.keys(assessmentScores).length>0 && !dqScores?.frame)
    nudges.push({ text:"Assessment complete — run the DQ Scorecard", nav:"scorecard", color:DS.warning });
  if (criticalIssues.length>0 && module!=="issues")
    nudges.push({ text:criticalIssues.length+" critical issue"+(criticalIssues.length>1?"s":"")+" unresolved", nav:"issues", color:DS.danger });

  if (nudges.length===0) return null;
  const n = nudges[0];
  return (
    <div style={{ margin:"8px 10px 0", padding:"8px 10px",
      background:n.color+"18", border:"1px solid "+n.color+"40",
      borderRadius:7, cursor:"pointer" }}
      onClick={()=>onNavigate(n.nav)}>
      <div style={{ fontSize:9, fontWeight:700, color:n.color,
        textTransform:"uppercase", letterSpacing:.5, marginBottom:2 }}>DQ Nudge</div>
      <div style={{ fontSize:10, color:DS.textSec, lineHeight:1.4 }}>{n.text}</div>
    </div>
  );
}


function WorkshopMode({ problem, issues, decisions, strategies, criteria, onIssues, onExit }) {
  const [wsView, setWsView]         = useState("facilitor"); // facilitor | participant | brainstorm | vote
  const [timer, setTimer]           = useState(null);
  const [timerSeconds, setTimerSeconds] = useState(0);
  const [timerRunning, setTimerRunning] = useState(false);
  const [input, setInput]           = useState("");
  const [newCat, setNewCat]         = useState("uncertainty-external");
  const [locked, setLocked]         = useState(false);
  const [selectedStrat, setSelectedStrat] = useState(null);
  const [revealAll, setRevealAll]   = useState(true);
  const [wsNotes, setWsNotes]       = useState("");

  useEffect(() => {
    let interval;
    if (timerRunning && timerSeconds > 0) {
      interval = setInterval(() => setTimerSeconds(s => {
        if (s <= 1) { setTimerRunning(false); return 0; }
        return s - 1;
      }), 1000);
    }
    return () => clearInterval(interval);
  }, [timerRunning, timerSeconds]);

  const addIssue = () => {
    if (!input.trim()) return;
    onIssues(prev => [...prev, { id:uid("iss"), text:input.trim(), category:newCat, severity:"Medium", status:"Open", owner:"Workshop", votes:0 }]);
    setInput("");
  };

  const vote = (id) => onIssues(prev => prev.map(i => i.id===id ? {...i, votes:(i.votes||0)+1} : i));
  const sorted = [...issues].sort((a,b)=>(b.votes||0)-(a.votes||0));

  const fmtTime = (s) => `${Math.floor(s/60).toString().padStart(2,"0")}:${(s%60).toString().padStart(2,"0")}`;

  return (
    <div style={{ position:"fixed", inset:0, background:DS.ink, zIndex:300,
      fontFamily:"'IBM Plex Sans','Helvetica Neue',sans-serif", color:DS.textPri,
      display:"flex", flexDirection:"column" }}>
      <style>{`@keyframes pulse{0%,100%{opacity:.5}50%{opacity:1}}`}</style>

      {/* Workshop top bar */}
      <div style={{ padding:"12px 24px", borderBottom:`1px solid ${DS.border}`,
        display:"flex", alignItems:"center", gap:12, flexShrink:0, background:DS.chromeAlt }}>
        <div style={{ display:"flex", alignItems:"center", gap:8 }}>
          <div style={{ width:8,height:8,borderRadius:"50%",background:"#22c55e",animation:"pulse 2s infinite" }}/>
          <span style={{ fontSize:13, fontWeight:700, color:DS.textPri }}>Workshop Mode</span>
          <Badge variant="chrome" size="xs">{problem.decisionStatement?.slice(0,40)}…</Badge>
        </div>

        {/* Timer */}
        <div style={{ display:"flex", alignItems:"center", gap:6, marginLeft:16 }}>
          <span style={{ fontSize:22, fontWeight:700,
            fontFamily:"'Libre Baskerville',Georgia,serif",
            color: timerSeconds<60&&timerSeconds>0 ? DS.danger : DS.textPri }}>
            {fmtTime(timerSeconds)}
          </span>
          <div style={{ display:"flex", gap:4 }}>
            {[5,10,15,20].map(m => (
              <button key={m} onClick={()=>{setTimerSeconds(m*60);setTimerRunning(false);}}
                style={{ padding:"3px 8px", fontSize:10, fontWeight:700, fontFamily:"inherit",
                  border:`1px solid ${DS.border}`, borderRadius:4, background:"transparent",
                  color:DS.textSec, cursor:"pointer" }}>{m}m</button>
            ))}
            <button onClick={()=>setTimerRunning(r=>!r)} style={{ padding:"4px 10px", fontSize:11,
              fontWeight:700, fontFamily:"inherit", border:`1px solid ${timerRunning?DS.danger:DS.success}`,
              borderRadius:4, background:timerRunning?DS.dangerSoft:DS.successSoft,
              color:timerRunning?DS.danger:DS.success, cursor:"pointer" }}>
              {timerRunning?"Pause":"Start"}
            </button>
          </div>
        </div>

        {/* View switcher */}
        <div style={{ display:"flex", gap:5, marginLeft:"auto" }}>
          {[
            {id:"facilitor", label:"Facilitator"},
            {id:"brainstorm",label:"Brainstorm"},
            {id:"vote",      label:"Vote"},
            {id:"strategies",label:"Strategies"},
          ].map(v => (
            <button key={v.id} onClick={()=>setWsView(v.id)}
              style={{ padding:"5px 12px", fontSize:11, fontWeight:700, fontFamily:"inherit",
                cursor:"pointer", border:`1px solid ${wsView===v.id?DS.accent:DS.border}`,
                borderRadius:5, background:wsView===v.id?DS.accent:"transparent",
                color:wsView===v.id?"#fff":DS.textSec }}>
              {v.label}
            </button>
          ))}
        </div>
        <Btn variant="secondary" size="sm" onClick={onExit}>Exit Workshop</Btn>
      </div>

      {/* ── FACILITATOR VIEW ── */}
      {wsView==="facilitor" && (
        <div style={{ flex:1, overflowY:"auto", padding:"24px 28px" }}>
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:16, marginBottom:20 }}>
            {[
              { label:"Issues Raised", value:issues.length, color:DS.accent },
              { label:"Critical Issues", value:issues.filter(i=>i.severity==="Critical").length, color:DS.danger },
              { label:"Top Voted", value:sorted[0]?.votes||0, sub:sorted[0]?.text?.slice(0,30)||"—", color:DS.success },
            ].map((stat,i)=>(
              <div key={i} style={{ padding:"16px 18px", background:DS.chromeMid, borderRadius:9,
                border:`1px solid ${DS.border}` }}>
                <div style={{ fontSize:11, color:DS.textTer, marginBottom:6 }}>{stat.label}</div>
                <div style={{ fontSize:28, fontWeight:700, color:stat.color,
                  fontFamily:"'Libre Baskerville',Georgia,serif" }}>{stat.value}</div>
                {stat.sub && <div style={{ fontSize:11, color:DS.textTer, marginTop:4 }}>{stat.sub}</div>}
              </div>
            ))}
          </div>

          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:16 }}>
            {/* Issue feed */}
            <div style={{ background:DS.chromeMid, borderRadius:9, border:`1px solid ${DS.border}`, overflow:"hidden" }}>
              <div style={{ padding:"11px 16px", background:DS.chromeSub, borderBottom:`1px solid ${DS.border}`,
                fontSize:11, fontWeight:700, color:DS.textSec }}>Live Issue Feed</div>
              <div style={{ maxHeight:320, overflowY:"auto", padding:"10px" }}>
                {sorted.slice(0,8).map(issue => {
                  const cat = ISSUE_CATEGORIES?.find(c=>c.key===issue.category);
                  return (
                    <div key={issue.id} style={{ padding:"8px 10px", borderRadius:6, marginBottom:6,
                      background:DS.chromeSub, border:`1px solid ${DS.border}` }}>
                      <div style={{ fontSize:11, color:DS.textSec, lineHeight:1.4, marginBottom:4 }}>{issue.text}</div>
                      <div style={{ display:"flex", gap:5, alignItems:"center" }}>
                        {cat && <span style={{ fontSize:9, fontWeight:700, color:cat.color,
                          padding:"1px 5px", borderRadius:3, background:cat.color+"22" }}>{cat.icon} {cat.short}</span>}
                        <span style={{ fontSize:10, color:DS.accent }}>▲ {issue.votes||0}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Facilitator notes */}
            <div style={{ background:DS.chromeMid, borderRadius:9, border:`1px solid ${DS.border}`, overflow:"hidden" }}>
              <div style={{ padding:"11px 16px", background:DS.chromeSub, borderBottom:`1px solid ${DS.border}`,
                fontSize:11, fontWeight:700, color:DS.textSec }}>Session Notes</div>
              <textarea value={wsNotes} onChange={e=>setWsNotes(e.target.value)}
                placeholder="Record key observations, tensions, decisions made in the room…"
                style={{ width:"100%", height:280, padding:"12px 14px", fontSize:12, fontFamily:"inherit",
                  background:"transparent", border:"none", color:DS.textSec, outline:"none",
                  resize:"none", lineHeight:1.6, boxSizing:"border-box" }}/>
            </div>
          </div>
        </div>
      )}

      {/* ── BRAINSTORM VIEW ── */}
      {wsView==="brainstorm" && (
        <div style={{ flex:1, display:"flex", flexDirection:"column" }}>
          <div style={{ padding:"20px 28px", borderBottom:`1px solid ${DS.border}`,
            display:"flex", gap:10, flexShrink:0 }}>
            <input value={input} onChange={e=>setInput(e.target.value)}
              onKeyDown={e=>e.key==="Enter"&&addIssue()}
              placeholder={locked?"Session locked — no new submissions":"Submit an issue, risk, or question…"}
              disabled={locked}
              style={{ flex:1, padding:"14px 18px", fontSize:16, fontFamily:"inherit",
                background:DS.chromeMid, border:`1px solid ${locked?DS.border:DS.accent}`,
                borderRadius:8, color:DS.textPri, outline:"none" }}/>
            <Select value={newCat} onChange={setNewCat}
              options={ISSUE_CATEGORIES.map(c=>({value:c.key,label:`${c.icon} ${c.label}`}))}
              style={{ width:200 }}/>
            <Btn variant="primary" onClick={addIssue} disabled={locked}>Submit</Btn>
            <button onClick={()=>setLocked(l=>!l)}
              style={{ padding:"8px 14px", border:`1px solid ${locked?DS.danger:DS.border}`,
                borderRadius:7, background:locked?DS.dangerSoft:"transparent",
                color:locked?DS.danger:DS.textSec, cursor:"pointer", fontFamily:"inherit",
                fontSize:11, fontWeight:700 }}>
              {locked?"🔒 Locked":"🔓 Lock"}
            </button>
          </div>
          <div style={{ flex:1, overflowY:"auto", padding:"20px 28px",
            display:"grid", gridTemplateColumns:"repeat(auto-fill,minmax(240px,1fr))", gap:12, alignContent:"start" }}>
            {issues.slice().reverse().map(issue => {
              const cat = ISSUE_CATEGORIES?.find(c=>c.key===issue.category);
              return (
                <div key={issue.id} style={{ padding:"16px 18px", borderRadius:9,
                  background:cat?.soft||DS.chromeMid,
                  border:`1px solid ${cat?.line||DS.border}`,
                  borderLeft:`4px solid ${cat?.color||DS.accent}` }}>
                  <div style={{ fontSize:13, color:DS.ink, lineHeight:1.5, marginBottom:8 }}>{issue.text}</div>
                  {cat && <span style={{ fontSize:10, fontWeight:700, color:cat.color,
                    padding:"2px 7px", borderRadius:3, background:cat.color+"22" }}>
                    {cat.icon} {cat.label}
                  </span>}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── VOTE VIEW ── */}
      {wsView==="vote" && (
        <div style={{ flex:1, overflowY:"auto", padding:"24px 36px" }}>
          <div style={{ fontSize:14, color:DS.textSec, marginBottom:20 }}>
            Vote on the most important issues. Highest-voted issues will be prioritised for strategy table focus.
          </div>
          <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
            {sorted.map((issue, rank) => {
              const cat = ISSUE_CATEGORIES?.find(c=>c.key===issue.category);
              const maxVotes = sorted[0]?.votes||1;
              return (
                <div key={issue.id} style={{ display:"flex", alignItems:"center", gap:16,
                  padding:"14px 18px", borderRadius:9,
                  background: rank<3 ? (cat?.soft||DS.chromeMid) : DS.chromeMid,
                  border:`1px solid ${rank<3?(cat?.line||DS.border):DS.border}` }}>
                  <span style={{ fontSize:18, fontWeight:700,
                    fontFamily:"'Libre Baskerville',Georgia,serif",
                    color:rank===0?DS.accent:DS.textTer, width:28, textAlign:"center" }}>
                    {rank+1}
                  </span>
                  <div style={{ flex:1 }}>
                    <div style={{ fontSize:13, color:DS.textPri, lineHeight:1.45, marginBottom:6 }}>{issue.text}</div>
                    <div style={{ height:4, background:DS.border, borderRadius:2, overflow:"hidden" }}>
                      <div style={{ width:`${(issue.votes||0)/maxVotes*100}%`, height:"100%",
                        background:cat?.color||DS.accent, borderRadius:2, transition:"width .3s" }}/>
                    </div>
                  </div>
                  <div style={{ display:"flex", flexDirection:"column", alignItems:"center", gap:4 }}>
                    <button onClick={()=>vote(issue.id)}
                      style={{ width:44, height:44, borderRadius:9, background:DS.accent,
                        border:"none", cursor:"pointer", fontSize:20, color:"#fff",
                        display:"flex", alignItems:"center", justifyContent:"center" }}>▲</button>
                    <span style={{ fontSize:15, fontWeight:700, color:DS.accent }}>{issue.votes||0}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── STRATEGIES VIEW ── */}
      {wsView==="strategies" && (
        <div style={{ flex:1, overflowY:"auto", padding:"28px 36px" }}>
          <div style={{ fontSize:14, color:DS.textSec, marginBottom:24 }}>
            Present one strategy at a time. Click to highlight.
          </div>
          <div style={{ display:"flex", gap:10, flexWrap:"wrap", marginBottom:24 }}>
            {strategies.map(s => {
              const col = DS.s[s.colorIdx];
              return (
                <button key={s.id} onClick={()=>setSelectedStrat(selectedStrat===s.id?null:s.id)}
                  style={{ padding:"10px 22px", borderRadius:8, fontSize:14, fontWeight:700,
                    fontFamily:"inherit", cursor:"pointer",
                    border:`2px solid ${selectedStrat===s.id?col.fill:DS.border}`,
                    background:selectedStrat===s.id?col.fill:"transparent",
                    color:selectedStrat===s.id?"#fff":col.fill, transition:"all .15s" }}>
                  {DS.sNames[s.colorIdx]||s.name}
                </button>
              );
            })}
          </div>
          {selectedStrat && (() => {
            const s = strategies.find(st=>st.id===selectedStrat);
            const col = DS.s[s.colorIdx];
            const focusDecs = decisions.filter(d=>d.tier==="focus");
            return (
              <div style={{ padding:"24px 28px", background:col.soft, border:`2px solid ${col.fill}`,
                borderRadius:12, maxWidth:700 }}>
                <div style={{ fontSize:22, fontWeight:700, color:col.fill,
                  fontFamily:"'Libre Baskerville',Georgia,serif", marginBottom:8 }}>
                  {DS.sNames[s.colorIdx]||s.name}
                </div>
                {s.description && <div style={{ fontSize:14, color:DS.ink, marginBottom:20, lineHeight:1.6 }}>{s.description}</div>}
                {focusDecs.map(d => {
                  const idx = s.selections?.[d.id];
                  return (
                    <div key={d.id} style={{ padding:"12px 16px", background:"rgba(255,255,255,.7)",
                      borderRadius:8, marginBottom:10, display:"flex", gap:16, alignItems:"center" }}>
                      <div style={{ fontSize:11, fontWeight:700, color:DS.inkTer,
                        letterSpacing:.5, textTransform:"uppercase", width:130, flexShrink:0 }}>{d.label}</div>
                      <div style={{ fontSize:15, fontWeight:700,
                        color:idx!==undefined?col.fill:DS.inkDis }}>
                        {idx!==undefined?d.choices[idx]:"— Not selected —"}
                      </div>
                    </div>
                  );
                })}
              </div>
            );
          })()}
        </div>
      )}
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────────────────
   PHASE 2 — SESSION PERSISTENCE & VERSION CONTROL
───────────────────────────────────────────────────────────────────────────── */

const SESSION_KEY = "vantage_dq_session_v1";

const saveSession = (data) => {
  try {
    const snapshot = { ...data, savedAt: new Date().toISOString() };
    localStorage.setItem(SESSION_KEY, JSON.stringify(snapshot));
    return true;
  } catch { return false; }
};

const loadSession = () => {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
};

const VERSION_KEY = "vantage_dq_versions_v1";

const saveVersion = (label, data) => {
  try {
    const versions = loadVersions();
    const newVersion = { id: uid("ver"), label, savedAt: new Date().toISOString(), data: {...data} };
    versions.unshift(newVersion);
    localStorage.setItem(VERSION_KEY, JSON.stringify(versions.slice(0, 20)));
    return newVersion;
  } catch { return null; }
};

const loadVersions = () => {
  try {
    const raw = localStorage.getItem(VERSION_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
};

function VersionPanel({ currentData, onRestore, onClose }) {
  const [versions, setVersions]     = useState(loadVersions);
  const [label, setLabel]           = useState("");
  const [confirmRestore, setConfirm] = useState(null);

  const handleSave = () => {
    const lbl = label.trim() || `Snapshot ${new Date().toLocaleTimeString()}`;
    const v = saveVersion(lbl, currentData);
    if (v) { setVersions(loadVersions()); setLabel(""); }
  };

  const handleRestore = (version) => {
    onRestore(version.data);
    setConfirm(null);
    onClose();
  };

  const handleDelete = (id) => {
    const updated = versions.filter(v=>v.id!==id);
    localStorage.setItem(VERSION_KEY, JSON.stringify(updated));
    setVersions(updated);
  };

  return (
    <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,.5)", zIndex:400,
      display:"flex", alignItems:"center", justifyContent:"center",
      fontFamily:"'IBM Plex Sans','Helvetica Neue',sans-serif" }}>
      <div style={{ background:DS.canvas, borderRadius:14, width:"100%", maxWidth:560,
        maxHeight:"82vh", display:"flex", flexDirection:"column",
        boxShadow:"0 24px 64px rgba(0,0,0,.18)", border:`1px solid ${DS.canvasBdr}` }}>

        <div style={{ padding:"16px 20px", borderBottom:`1px solid ${DS.canvasBdr}`,
          display:"flex", alignItems:"center", justifyContent:"space-between" }}>
          <div style={{ fontSize:15, fontWeight:700, color:DS.ink,
            fontFamily:"'Libre Baskerville',Georgia,serif" }}>Version History</div>
          <button onClick={onClose} style={{ background:"none", border:"none", cursor:"pointer", color:DS.inkTer }}>
            <Svg path={ICONS.x} size={18} color={DS.inkTer}/>
          </button>
        </div>

        {/* Save new version */}
        <div style={{ padding:"14px 20px", borderBottom:`1px solid ${DS.canvasBdr}`,
          display:"flex", gap:8 }}>
          <input value={label} onChange={e=>setLabel(e.target.value)}
            onKeyDown={e=>e.key==="Enter"&&handleSave()}
            placeholder="Snapshot name (e.g. After workshop Day 1)…"
            style={{ flex:1, padding:"8px 12px", fontSize:12, fontFamily:"inherit",
              background:DS.canvasAlt, border:`1px solid ${DS.canvasBdr}`, borderRadius:6,
              color:DS.ink, outline:"none" }}
            onFocusCapture={e=>e.target.style.borderColor=DS.accent}
            onBlurCapture={e=>e.target.style.borderColor=DS.canvasBdr}/>
          <Btn variant="primary" size="sm" onClick={handleSave}>Save Snapshot</Btn>
        </div>

        {/* Version list */}
        <div style={{ flex:1, overflowY:"auto", padding:"12px" }}>
          {versions.length === 0 ? (
            <div style={{ padding:"32px", textAlign:"center", color:DS.inkTer, fontSize:13 }}>
              No snapshots yet. Save one above to capture the current state.
            </div>
          ) : versions.map(v => (
            <div key={v.id} style={{ padding:"12px 14px", borderRadius:8, marginBottom:8,
              border:`1px solid ${DS.canvasBdr}`, background:DS.canvas,
              display:"flex", alignItems:"center", gap:12 }}>
              <div style={{ flex:1 }}>
                <div style={{ fontSize:13, fontWeight:700, color:DS.ink, marginBottom:3 }}>{v.label}</div>
                <div style={{ fontSize:11, color:DS.inkTer }}>
                  {new Date(v.savedAt).toLocaleString("en-GB",{day:"numeric",month:"short",hour:"2-digit",minute:"2-digit"})}
                  {" · "}{v.data?.issues?.length||0} issues · {v.data?.strategies?.length||0} strategies
                </div>
              </div>
              {confirmRestore===v.id ? (
                <div style={{ display:"flex", gap:5 }}>
                  <Btn variant="danger" size="sm" onClick={()=>handleRestore(v)}>Restore</Btn>
                  <Btn variant="ghost" size="sm" onClick={()=>setConfirm(null)}>Cancel</Btn>
                </div>
              ) : (
                <div style={{ display:"flex", gap:5 }}>
                  <Btn variant="secondary" size="sm" onClick={()=>setConfirm(v.id)}>Restore</Btn>
                  <button onClick={()=>handleDelete(v.id)}
                    style={{ background:"none", border:"none", cursor:"pointer", color:DS.inkDis, padding:4 }}>
                    <Svg path={ICONS.trash} size={14} color={DS.inkTer}/>
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────────────────
   PHASE 2 — CROSS-MODULE AI INTELLIGENCE PANEL
───────────────────────────────────────────────────────────────────────────── */

function ModuleScenarios({ strategies, decisions, issues, problem, nodes, edges, aiCall, aiBusy, onAIMsg }) {

  // ── Constants ─────────────────────────────────────────────────────────────
  const THEMES = ["Market","Technical","Regulatory","Competitive","Geopolitical","Stakeholder","Operational","Environmental","Commercial","Technology"];
  const RATINGS = [
    { id:"thrives",  label:"Thrives",  icon:"✓", color:"#059669", bg:"#ecfdf5", border:"#a7f3d0" },
    { id:"survives", label:"Survives", icon:"~", color:"#d97706", bg:"#fffbeb", border:"#fde68a" },
    { id:"struggles",label:"Struggles",icon:"✗", color:"#dc2626", bg:"#fef2f2", border:"#fecaca" },
  ];

  // ── State ─────────────────────────────────────────────────────────────────
  const [view, setView]               = useState("uncertainties"); // uncertainties | matrix2x2 | scenarios | test | insights
  const [uncertainties, setUncs]      = useState([]);
  const [axis1, setAxis1]             = useState(null); // selected uncertainty id for axis 1
  const [axis2, setAxis2]             = useState(null); // selected uncertainty id for axis 2
  const [scenarios, setScenarios]     = useState([]); // 4 quadrant scenarios
  const [perfMatrix, setPerfMatrix]   = useState({}); // {stratId_scenId: {rating, note}}
  const [generating, setGenerating]   = useState(false);
  const [filling, setFilling]         = useState(false);
  const [fillingScenarios, setFillingScenarios] = useState(false);
  const [scenarioMode, setScenarioMode]         = useState(null); // null | '2x2' | 'multi'
  const [multiScenarios, setMultiScenarios]     = useState([]); // for multi mode

  // ── Helpers ───────────────────────────────────────────────────────────────
  const addUnc = () => setUncs(prev => [...prev, {
    id: uid("u"), label:"", theme:"Market",
    impact:"Medium", uncertainty:"High", control:"Low", urgency:"Medium",
    score: 0,
  }]);

  const updateUnc = (id, patch) => setUncs(prev => prev.map(u => u.id===id?{...u,...patch}:u));
  const removeUnc = (id) => { setUncs(prev=>prev.filter(u=>u.id!==id)); if(axis1===id)setAxis1(null); if(axis2===id)setAxis2(null); };

  const scoreUnc = (u) => {
    const s = { High:3, Medium:2, Low:1 };
    return (s[u.impact]||2) * (s[u.uncertainty]||2) * (3 - (s[u.control]||2) + 1);
  };

  const sortedUncs = [...uncertainties].map(u=>({...u,score:scoreUnc(u)})).sort((a,b)=>b.score-a.score);
  const top2 = sortedUncs.slice(0,2).map(u=>u.id);

  // Build 2x2 from axis1 and axis2
  const QUADRANTS = [
    { pos:"TL", ax1:"Low",  ax2:"High", label:"Q1" },
    { pos:"TR", ax1:"High", ax2:"High", label:"Q2" },
    { pos:"BL", ax1:"Low",  ax2:"Low",  label:"Q3" },
    { pos:"BR", ax1:"High", ax2:"Low",  label:"Q4" },
  ];

  const ensureScenarios = () => {
    if (scenarios.length===4) return;
    setScenarios(QUADRANTS.map((q,i)=>({
      id: uid("sc"), pos:q.pos,
      name: "Scenario "+(i+1),
      narrative:"", assumptions:"", marketConditions:"",
      stakeholderBehavior:"", regulatoryEnvironment:"",
      earlyWarningIndicators:"", risks:"", opportunities:"",
      ax1Label:q.ax1, ax2Label:q.ax2,
    })));
  };

  const updateScen = (id, patch) => setScenarios(prev=>prev.map(s=>s.id===id?{...s,...patch}:s));
  const updateCell = (stratId, scenId, patch) =>
    setPerfMatrix(prev=>({...prev,[stratId+"_"+scenId]:{...(prev[stratId+"_"+scenId]||{}),...patch}}));

  // ── AI: generate uncertainties ────────────────────────────────────────────
  const generateUncs = () => {
    setGenerating(true);
    const uncNodes = (nodes||[]).filter(n=>n.type==="uncertainty").map(n=>n.label).join(", ");
    const critIssues = issues.filter(i=>i.category?.includes("uncertainty")||i.severity==="Critical")
      .slice(0,5).map(i=>i.text.slice(0,60)).join("; ");
    aiCall(
      "You are a DQ scenario planning expert. Identify the 4-6 most decision-relevant external uncertainties for this decision. " +
      "Uncertainties must be external (not controllable), distinct, and directly relevant to the decision outcome. " +
      "Do NOT include issues, risks, constraints or decisions — only genuine uncertainties about the external environment. " +
      "Decision: " + (problem?.decisionStatement||"Not defined") + ". " +
      "Known uncertainties from influence diagram: " + (uncNodes||"none") + ". " +
      "Critical issues: " + (critIssues||"none") + ". " +
      "Return ONLY JSON: " +
      '{"uncertainties":[{"label":"uncertainty name","theme":"Market|Technical|Regulatory|Competitive|Geopolitical|Stakeholder|Operational","impact":"High|Medium|Low","uncertainty":"High|Medium|Low","control":"Low|Medium|High","rationale":"why this is decision-critical"}],"insight":"observation"}',
    (r) => {
      let result = r;
      if (r&&r._raw){try{result=JSON.parse(r._raw.replace(/```json|```/g,"").trim());}catch(e){setGenerating(false);return;}}
      if (!result||result.error){setGenerating(false);return;}
      const newU = (result.uncertainties||[]).map(u=>({
        id:uid("u"), label:u.label||"", theme:u.theme||"Market",
        impact:u.impact||"Medium", uncertainty:u.uncertainty||"High", control:u.control||"Low",
        urgency:"Medium", rationale:u.rationale||"", score:0,
      }));
      setUncs(prev=>[...prev,...newU]);
      onAIMsg({role:"ai",text:result.insight||("Added "+newU.length+" uncertainties.")});
      setGenerating(false);
    });
  };

  // ── AI: fill scenario narratives ──────────────────────────────────────────
  const fillScenarioNarratives = () => {
    if (!axis1||!axis2) return;
    setFillingScenarios(true);
    const u1 = uncertainties.find(u=>u.id===axis1);
    const u2 = uncertainties.find(u=>u.id===axis2);
    aiCall(
      "You are a scenario planning expert. Write compelling, internally coherent scenario narratives for a 2x2 scenario matrix. " +
      "Decision: " + (problem?.decisionStatement||"Not defined") + ". " +
      "Axis 1: " + (u1?.label||"Uncertainty 1") + " (Low vs High). " +
      "Axis 2: " + (u2?.label||"Uncertainty 2") + " (Low vs High). " +
      "The 4 quadrants are: Q1=Low/High, Q2=High/High, Q3=Low/Low, Q4=High/Low. " +
      "For each quadrant, write: a vivid scenario name (3-5 words), a narrative (2-3 sentences describing the world), key assumptions, early warning indicators that signal this scenario is emerging. " +
      "Scenarios must be plausible, distinct, and decision-relevant — NOT best/base/worst case. " +
      "Return ONLY JSON: " +
      '{"scenarios":[{"pos":"TL","name":"Scenario name","narrative":"2-3 sentence story","assumptions":"key assumptions","earlyWarningIndicators":"2-3 signposts","risks":"strategic risks","opportunities":"strategic opportunities"}],"insight":"observation"}',
    (r) => {
      let result = r;
      if (r&&r._raw){try{result=JSON.parse(r._raw.replace(/```json|```/g,"").trim());}catch(e){setFillingScenarios(false);return;}}
      if (!result||result.error){setFillingScenarios(false);return;}
      const aiScens = result.scenarios||[];
      setScenarios(prev=>prev.map(s=>{
        const match = aiScens.find(a=>a.pos===s.pos);
        if (!match) return s;
        return {...s,
          name:match.name||s.name,
          narrative:match.narrative||s.narrative,
          assumptions:match.assumptions||s.assumptions,
          earlyWarningIndicators:match.earlyWarningIndicators||s.earlyWarningIndicators,
          risks:match.risks||s.risks,
          opportunities:match.opportunities||s.opportunities,
        };
      }));
      onAIMsg({role:"ai",text:result.insight||"Scenario narratives filled."});
      setFillingScenarios(false);
    });
  };

  // ── AI: generate multi-uncertainty scenarios ─────────────────────────────
  const generateMultiScenarios = () => {
    setFillingScenarios(true);
    const uncList = sortedUncs.map((u,i) =>
      (i+1)+". "+u.label+" (Impact: "+u.impact+", Uncertainty: "+u.uncertainty+")"
    ).join("\n");
    aiCall(
      "You are a scenario planning expert. Generate 4 distinct, plausible future scenarios from this full set of uncertainties. " +
      "Each scenario should be a coherent 'future world' that specifies how each uncertainty resolves — some favourably, some unfavourably. " +
      "Scenarios must be meaningfully different — not simply optimistic/pessimistic. " +
      "Decision: "+(problem?.decisionStatement||"Not defined")+".\n" +
      "Uncertainties:\n"+uncList+"\n\n" +
      "For each scenario name it evocatively (3-5 words), write a narrative, state how each key uncertainty resolves, list early warning indicators. " +
      "Return ONLY JSON: " +
      '{"scenarios":[{"id":"s1","name":"Scenario name","narrative":"2-3 sentence story of this future","uncertaintyResolutions":{"uncertainty label":"how it resolves in this scenario"},"assumptions":"key assumptions","earlyWarningIndicators":"2-3 signposts","risks":"strategic risks","opportunities":"strategic opportunities"}],"insight":"observation"}',
    (r) => {
      let result = r;
      if (r&&r._raw){try{result=JSON.parse(r._raw.replace(/```json|```/g,"").trim());}catch(e){setFillingScenarios(false);return;}}
      if (!result||result.error){setFillingScenarios(false);return;}
      const newScens = (result.scenarios||[]).map((s,i)=>({
        id: uid("sc"), name:s.name||"Scenario "+(i+1),
        narrative:s.narrative||"", assumptions:s.assumptions||"",
        earlyWarningIndicators:s.earlyWarningIndicators||"",
        risks:s.risks||"", opportunities:s.opportunities||"",
        uncertaintyResolutions:s.uncertaintyResolutions||{},
        pos:null, // no quadrant in multi mode
      }));
      setMultiScenarios(newScens);
      // Also populate scenarios state so the test/robustness steps work
      setScenarios(newScens);
      onAIMsg({role:"ai",text:result.insight||("Generated "+newScens.length+" scenarios from all "+sortedUncs.length+" uncertainties.")});
      setFillingScenarios(false);
    });
  };

  // ── AI: fill performance matrix ───────────────────────────────────────────
  const fillMatrix = () => {
    if (!scenarios.length||!strategies.length) return;
    setFilling(true);
    const stratList = strategies.map((s,i)=>
      (i+1)+". "+s.name+(s.objective?" — objective: "+s.objective:"")
    ).join("\n");
    const scenList = scenarios.map(s=>
      s.pos+": "+s.name+" — "+s.narrative
    ).join("\n");
    aiCall(
      "You are a DQ strategist evaluating how alternatives perform across future scenarios. " +
      "Decision: " + (problem?.decisionStatement||"") + ".\n" +
      "STRATEGIES:\n"+stratList+"\n\nSCENARIOS:\n"+scenList+"\n\n" +
      "Classify each strategy-scenario combination as thrives/survives/struggles and give a one-line reason. " +
      "Also classify the overall strategy as: robust (thrives in most), fragile (struggles in some), hedge (survives everywhere), or option (high upside in one scenario). " +
      "Return ONLY JSON: " +
      '{"matrix":[{"strategyName":"name","scenarioPos":"TL","rating":"thrives|survives|struggles","note":"reason"}],"insight":"which strategy is most robust"}',
    (r) => {
      let result = r;
      if (r&&r._raw){try{result=JSON.parse(r._raw.replace(/```json|```/g,"").trim());}catch(e){setFilling(false);return;}}
      if (!result||result.error){setFilling(false);return;}
      const newMatrix = {...perfMatrix};
      (result.matrix||[]).forEach(cell=>{
        const strat = strategies.find(s=>s.name.toLowerCase()===cell.strategyName?.toLowerCase());
        const scen  = scenarios.find(s=>s.pos===cell.scenarioPos);
        if (strat&&scen) newMatrix[strat.id+"_"+scen.id]={rating:cell.rating||"survives",note:cell.note||""};
      });
      setPerfMatrix(newMatrix);
      onAIMsg({role:"ai",text:result.insight||"Matrix filled."});
      setFilling(false);
    });
  };

  // ── Robustness scoring ────────────────────────────────────────────────────
  const robustness = strategies.map(s=>{
    const counts={thrives:0,survives:0,struggles:0};
    scenarios.forEach(sc=>{
      const cell=perfMatrix[s.id+"_"+sc.id];
      if(cell?.rating) counts[cell.rating]++;
    });
    const filled = counts.thrives+counts.survives+counts.struggles;
    const score = filled>0 ? (counts.thrives*2+counts.survives*1)/((filled)*2)*100 : 0;
    return {...s,counts,score:Math.round(score),filled};
  }).sort((a,b)=>b.score-a.score);

  const u1 = uncertainties.find(u=>u.id===axis1);
  const u2 = uncertainties.find(u=>u.id===axis2);

  return (
    <div style={{display:"flex",flexDirection:"column",height:"100%",overflow:"hidden"}}>

      {/* Header */}
      <div style={{background:DS.canvas,borderBottom:"1px solid "+DS.canvasBdr,flexShrink:0}}>
        <div style={{padding:"10px 20px",display:"flex",alignItems:"center",gap:10,flexWrap:"wrap"}}>
          <div style={{flex:1}}>
            <div style={{fontSize:9,color:DS.inkTer,textTransform:"uppercase",fontWeight:700,letterSpacing:1}}>Module 05</div>
            <div style={{fontFamily:"'Libre Baskerville',serif",fontSize:18,fontWeight:700,color:DS.ink}}>Scenario Planning</div>
          </div>
          {view==="uncertainties" && (
            <>
              <Btn variant="secondary" size="sm" onClick={addUnc}>+ Add Uncertainty</Btn>
              <Btn variant="secondary" size="sm" onClick={generateUncs} disabled={aiBusy||generating}>
                {generating?"Generating…":"AI Generate"}
              </Btn>
            </>
          )}
          {view==="matrix2x2" && axis1&&axis2 && (
            <Btn variant="secondary" size="sm" onClick={()=>{ensureScenarios();setView("scenarios");}}>
              Build Scenarios →
            </Btn>
          )}
          {view==="scenarios" && (
            <Btn variant="secondary" size="sm" onClick={fillScenarioNarratives} disabled={aiBusy||fillingScenarios}>
              {fillingScenarios?"Filling…":"AI Fill Narratives"}
            </Btn>
          )}
          {view==="test" && strategies.length>0 && scenarios.length>0 && (
            <Btn variant="primary" size="sm" onClick={fillMatrix} disabled={aiBusy||filling}>
              {filling?"Filling…":"AI Fill Matrix"}
            </Btn>
          )}
        </div>

        {/* Step tabs */}
        <div style={{padding:"0 20px 8px",display:"flex",gap:2}}>
          {[
            {id:"uncertainties",label:"1. Uncertainties"},
            {id:"matrix2x2",label:scenarioMode===null?"2a. Select Axes":"2. Select Axes",hidden:scenarioMode==="multi"},
            {id:"multi",label:scenarioMode===null?"2b. Multi-Scenario":"2. Multi-Scenario",hidden:scenarioMode==="2x2"},
            {id:"scenarios",label:scenarioMode==="multi"?"3. Scenarios":"3. Scenarios",hidden:scenarioMode==="multi"},
            {id:"test",label:scenarioMode==="multi"?"3. Test Strategies":"4. Test Strategies"},
            {id:"insights",label:scenarioMode==="multi"?"4. Robustness":"5. Robustness"},
          ].filter(v=>!v.hidden).map((v,i)=>{
            const done = (v.id==="uncertainties"&&uncertainties.length>0) ||
              (v.id==="matrix2x2"&&axis1&&axis2) ||
              (v.id==="scenarios"&&scenarios.length>0&&scenarios.some(s=>s.narrative)) ||
              (v.id==="test"&&Object.keys(perfMatrix).length>0) ||
              (v.id==="insights"&&robustness.some(r=>r.filled>0));
            return (
              <button key={v.id} onClick={()=>setView(v.id)}
                style={{padding:"5px 12px",fontSize:11,fontWeight:700,fontFamily:"inherit",
                  cursor:"pointer",border:"none",borderRadius:5,
                  background:view===v.id?DS.accent:done?"#f0fdf4":"transparent",
                  color:view===v.id?"#fff":done?DS.success:DS.inkSub}}>
                {done&&view!==v.id?"✓ ":""}{v.label}
              </button>
            );
          })}
        </div>
      </div>

      <div style={{flex:1,overflow:"auto",padding:20}}>

        {/* ── STEP 1: UNCERTAINTIES ── */}
        {view==="uncertainties" && (
          <div>
            <div style={{fontSize:12,color:DS.inkSub,lineHeight:1.6,marginBottom:16,maxWidth:700}}>
              Identify the key <strong>external uncertainties</strong> that could affect this decision.
              These must be things outside management control — not decisions, risks, or constraints.
              AI will suggest which two are most decision-relevant for building your 2×2 scenario matrix.
            </div>

            {uncertainties.length===0 ? (
              <div style={{textAlign:"center",padding:"40px 20px",color:DS.inkTer,border:"1.5px dashed "+DS.canvasBdr,borderRadius:10}}>
                <div style={{fontSize:28,marginBottom:8,opacity:.4}}>◈</div>
                <div style={{fontSize:13,fontWeight:700,marginBottom:6}}>No uncertainties yet</div>
                <div style={{fontSize:12,marginBottom:16}}>Click <strong>AI Generate</strong> to identify key uncertainties from your decision context, or add them manually.</div>
                <Btn variant="secondary" onClick={addUnc}>+ Add Manually</Btn>
              </div>
            ) : (
              <>
                {/* Impact × Uncertainty matrix */}
                <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gridTemplateRows:"1fr 1fr",gap:3,height:280,marginBottom:20,border:"1px solid "+DS.canvasBdr,borderRadius:8,overflow:"hidden"}}>
                  {[
                    {impact:"High",unc:"High",label:"Prioritise for scenarios",color:"#dc2626",bg:"#fef2f2",desc:"High impact + high uncertainty = scenario-worthy"},
                    {impact:"High",unc:"Low",label:"Monitor closely",color:"#d97706",bg:"#fffbeb",desc:"High impact but relatively known"},
                    {impact:"Low",unc:"High",label:"Track but less critical",color:"#2563eb",bg:"#eff6ff",desc:"Uncertain but low decision impact"},
                    {impact:"Low",unc:"Low",label:"Background",color:"#6b7280",bg:"#f9fafb",desc:"Low priority"},
                  ].map(q=>{
                    const qUncs = sortedUncs.filter(u=>u.impact===q.impact&&u.uncertainty===q.unc);
                    return (
                      <div key={q.label} style={{background:q.bg,padding:"10px 12px",overflow:"auto"}}>
                        <div style={{fontSize:9,fontWeight:700,color:q.color,textTransform:"uppercase",letterSpacing:.5,marginBottom:6}}>{q.label}</div>
                        {qUncs.map(u=>(
                          <div key={u.id} style={{fontSize:10,fontWeight:600,color:q.color,
                            padding:"2px 7px",marginBottom:3,background:"white",borderRadius:4,
                            border:"1px solid "+q.color+"40",cursor:"pointer"}}
                            onClick={()=>{if(!axis1)setAxis1(u.id);else if(!axis2&&u.id!==axis1)setAxis2(u.id);}}>
                            {axis1===u.id?"[Axis 1] ":axis2===u.id?"[Axis 2] ":""}{u.label}
                          </div>
                        ))}
                        {qUncs.length===0&&<div style={{fontSize:10,color:"#9ca3af",fontStyle:"italic"}}>None here</div>}
                      </div>
                    );
                  })}
                </div>
                <div style={{display:"flex",gap:8,alignItems:"center",marginBottom:6,fontSize:10,color:DS.inkTer}}>
                  <span>↑ High Impact</span><span style={{flex:1,height:1,background:DS.canvasBdr}}/><span>Low Impact ↓</span>
                </div>
                <div style={{fontSize:10,color:DS.inkTer,marginBottom:20}}>
                  Click any uncertainty to select it as Axis 1 or Axis 2 for your 2×2 matrix.
                  Currently selected: <strong style={{color:DS.accent}}>{u1?.label||"none"}</strong> vs <strong style={{color:"#7c3aed"}}>{u2?.label||"none"}</strong>
                </div>

                {/* Uncertainty cards */}
                <div style={{display:"flex",flexDirection:"column",gap:8}}>
                  {sortedUncs.map((u,i)=>(
                    <div key={u.id} style={{padding:"12px 14px",background:DS.canvas,
                      border:"1px solid "+(axis1===u.id?DS.accent:axis2===u.id?"#7c3aed":DS.canvasBdr),
                      borderRadius:8,borderLeft:"3px solid "+(i<2?"#dc2626":i<4?"#d97706":"#6b7280")}}>
                      <div style={{display:"flex",alignItems:"flex-start",gap:10}}>
                        <div style={{flex:1}}>
                          <input value={u.label} onChange={e=>updateUnc(u.id,{label:e.target.value})}
                            placeholder="Uncertainty label…"
                            style={{width:"100%",fontSize:13,fontWeight:700,color:DS.ink,
                              background:"transparent",border:"none",outline:"none",fontFamily:"inherit"}}/>
                        </div>
                        <select value={u.theme} onChange={e=>updateUnc(u.id,{theme:e.target.value})}
                          style={{fontSize:10,padding:"2px 5px",border:"1px solid "+DS.canvasBdr,borderRadius:4,fontFamily:"inherit",background:DS.canvasAlt,color:DS.inkSub}}>
                          {THEMES.map(t=><option key={t}>{t}</option>)}
                        </select>
                        <button onClick={()=>removeUnc(u.id)}
                          style={{background:"none",border:"none",cursor:"pointer",color:DS.inkTer,fontSize:14}}>×</button>
                      </div>
                      <div style={{display:"flex",gap:10,marginTop:8}}>
                        {[{key:"impact",label:"Impact"},{key:"uncertainty",label:"Uncertainty"},{key:"control",label:"Control"}].map(f=>(
                          <div key={f.key}>
                            <div style={{fontSize:9,color:DS.inkTer,marginBottom:2}}>{f.label}</div>
                            <select value={u[f.key]} onChange={e=>updateUnc(u.id,{[f.key]:e.target.value})}
                              style={{fontSize:10,padding:"2px 5px",border:"1px solid "+DS.canvasBdr,borderRadius:4,fontFamily:"inherit",background:DS.canvasAlt}}>
                              {["High","Medium","Low"].map(v=><option key={v}>{v}</option>)}
                            </select>
                          </div>
                        ))}
                        <div style={{marginLeft:"auto",fontSize:10,fontWeight:700,
                          color:i<2?"#dc2626":i<4?"#d97706":"#6b7280",
                          alignSelf:"flex-end"}}>
                          Score: {u.score} {i<2?"★ Top priority":""}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
                <div style={{marginTop:12}}>
                  <Btn variant="secondary" size="sm" onClick={addUnc}>+ Add Uncertainty</Btn>
                  <div style={{display:"flex",gap:8,flexWrap:"wrap",marginTop:4}}>
                    {axis1&&axis2&&(
                      <Btn variant="secondary" size="sm"
                        onClick={()=>{setScenarioMode("2x2");setView("matrix2x2");}}>
                        Build 2×2 Matrix →
                      </Btn>
                    )}
                    {uncertainties.length>=2&&(
                      <Btn variant="primary" size="sm"
                        onClick={()=>{setScenarioMode("multi");setView("multi");}}>
                        {uncertainties.length>2?"Multi-Uncertainty Mode →":"Multi-Scenario Mode →"}
                      </Btn>
                    )}
                  </div>
                </div>
              </>
            )}
          </div>
        )}

        {/* ── STEP 2: 2×2 MATRIX ── */}
        {view==="matrix2x2" && (
          <div>
            <div style={{fontSize:12,color:DS.inkSub,marginBottom:16}}>
              Your 2×2 matrix axes. Select two uncertainties from Step 1 to define the dimensions.
            </div>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12,marginBottom:20}}>
              {[{label:"Axis 1 (Horizontal)",state:axis1,set:setAxis1,color:DS.accent},
                {label:"Axis 2 (Vertical)",state:axis2,set:setAxis2,color:"#7c3aed"}].map(ax=>(
                <div key={ax.label} style={{padding:"14px 16px",background:DS.canvas,
                  border:"2px solid "+ax.color,borderRadius:8}}>
                  <div style={{fontSize:10,fontWeight:700,color:ax.color,marginBottom:8}}>{ax.label}</div>
                  <select value={ax.state||""} onChange={e=>ax.set(e.target.value||null)}
                    style={{width:"100%",padding:"7px 9px",fontSize:12,fontFamily:"inherit",
                      background:DS.canvasAlt,border:"1px solid "+DS.canvasBdr,
                      borderRadius:5,color:DS.ink,outline:"none"}}>
                    <option value="">Select uncertainty…</option>
                    {uncertainties.map(u=><option key={u.id} value={u.id}>{u.label}</option>)}
                  </select>
                </div>
              ))}
            </div>
            {axis1&&axis2&&(
              <div style={{border:"1px solid "+DS.canvasBdr,borderRadius:10,overflow:"hidden"}}>
                {/* Axis labels */}
                <div style={{background:DS.canvasAlt,padding:"8px 16px",display:"flex",justifyContent:"space-between",borderBottom:"1px solid "+DS.canvasBdr}}>
                  <span style={{fontSize:10,color:DS.inkTer}}>← Low {u1?.label}</span>
                  <span style={{fontSize:10,fontWeight:700,color:DS.accent}}>{u1?.label} →</span>
                  <span style={{fontSize:10,color:DS.inkTer}}>High →</span>
                </div>
                <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:2,padding:2,background:DS.canvasBdr}}>
                  {QUADRANTS.map(q=>(
                    <div key={q.pos} style={{background:DS.canvas,padding:"16px 18px",minHeight:120}}>
                      <div style={{fontSize:9,color:DS.inkTer,fontWeight:700,marginBottom:4}}>
                        {u1?.label}: {q.ax1} | {u2?.label}: {q.ax2}
                      </div>
                      <div style={{fontSize:13,fontWeight:700,color:DS.ink}}>
                        {scenarios.find(s=>s.pos===q.pos)?.name||q.label}
                      </div>
                    </div>
                  ))}
                </div>
                <div style={{padding:"8px 16px",background:DS.canvasAlt,borderTop:"1px solid "+DS.canvasBdr,display:"flex",justifyContent:"flex-end"}}>
                  <Btn variant="primary" size="sm" onClick={()=>{ensureScenarios();setView("scenarios");}}>
                    Develop Scenarios →
                  </Btn>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── STEP 3: SCENARIO DEVELOPMENT ── */}
        {view==="scenarios" && (
          <div>
            <div style={{fontSize:12,color:DS.inkSub,marginBottom:16,lineHeight:1.6}}>
              Develop each of the four scenarios. Use <strong>AI Fill Narratives</strong> to generate story, assumptions and early warning indicators.
            </div>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:14}}>
              {scenarios.map(s=>{
                const q = QUADRANTS.find(q=>q.pos===s.pos);
                return (
                  <div key={s.id} style={{padding:"16px 18px",background:DS.canvas,
                    border:"1px solid "+DS.canvasBdr,borderRadius:10,
                    borderTop:"3px solid "+DS.accent}}>
                    <div style={{display:"flex",gap:8,alignItems:"center",marginBottom:8}}>
                      <div style={{fontSize:9,fontWeight:700,color:DS.inkTer,textTransform:"uppercase",letterSpacing:.5}}>
                        {u1?.label}: {q?.ax1} | {u2?.label}: {q?.ax2}
                      </div>
                    </div>
                    <input value={s.name} onChange={e=>updateScen(s.id,{name:e.target.value})}
                      placeholder="Scenario name…"
                      style={{width:"100%",fontSize:14,fontWeight:700,color:DS.ink,
                        background:"transparent",border:"none",outline:"none",fontFamily:"inherit",
                        marginBottom:10,boxSizing:"border-box"}}/>
                    {[
                      {key:"narrative",label:"Narrative",placeholder:"Describe this future world in 2-3 sentences…",rows:3},
                      {key:"assumptions",label:"Key Assumptions",placeholder:"What must be true for this scenario to occur?",rows:2},
                      {key:"earlyWarningIndicators",label:"Early Warning Indicators",placeholder:"What signals would tell us this scenario is emerging?",rows:2},
                      {key:"risks",label:"Strategic Risks",placeholder:"What risks does this scenario create?",rows:2},
                      {key:"opportunities",label:"Strategic Opportunities",placeholder:"What opportunities does this scenario open?",rows:2},
                    ].map(f=>(
                      <div key={f.key} style={{marginBottom:10}}>
                        <div style={{fontSize:9,fontWeight:700,color:DS.inkTer,textTransform:"uppercase",letterSpacing:.5,marginBottom:3}}>{f.label}</div>
                        <textarea value={s[f.key]||""} onChange={e=>updateScen(s.id,{[f.key]:e.target.value})}
                          placeholder={f.placeholder} rows={f.rows}
                          style={{width:"100%",fontSize:11,padding:"6px 8px",fontFamily:"inherit",
                            background:DS.canvasAlt,border:"1px solid "+DS.canvasBdr,
                            borderRadius:5,color:DS.ink,outline:"none",resize:"vertical",
                            lineHeight:1.5,boxSizing:"border-box"}}/>
                      </div>
                    ))}
                  </div>
                );
              })}
            </div>
            {scenarios.length>0&&(
              <div style={{marginTop:16,textAlign:"center"}}>
                <Btn variant="primary" size="sm" onClick={()=>setView("test")}>Test Strategies →</Btn>
              </div>
            )}
          </div>
        )}

        {/* ── MULTI-SCENARIO MODE ── */}
        {view==="multi" && (
          <div>
            <div style={{fontSize:12,color:DS.inkSub,marginBottom:16,lineHeight:1.6,maxWidth:700}}>
              With <strong>{uncertainties.length} uncertainties</strong>, the AI will build 4 coherent scenarios
              that specify how all uncertainties resolve together — richer than a 2×2 because every
              uncertainty informs every scenario.
            </div>
            <div style={{display:"flex",gap:10,marginBottom:20,alignItems:"center"}}>
              <Btn variant="primary" onClick={generateMultiScenarios} disabled={aiBusy||fillingScenarios}>
                {fillingScenarios?"Generating…":"AI Generate 4 Scenarios from All Uncertainties"}
              </Btn>
              {uncertainties.length>=2&&(
                <Btn variant="secondary" size="sm"
                  onClick={()=>{setScenarioMode("2x2");setView("matrix2x2");}}>
                  Switch to 2×2 instead
                </Btn>
              )}
            </div>

            {multiScenarios.length===0?(
              <div style={{textAlign:"center",padding:"40px",color:DS.inkTer,
                border:"1.5px dashed "+DS.canvasBdr,borderRadius:10}}>
                <div style={{fontSize:28,opacity:.4,marginBottom:8}}>◈</div>
                <div style={{fontSize:13,fontWeight:700}}>Click AI Generate to build your scenarios</div>
                <div style={{fontSize:11,marginTop:6,color:DS.inkTer}}>
                  The AI will combine all {uncertainties.length} uncertainties into 4 distinct future worlds.
                </div>
              </div>
            ):(
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:14}}>
                {multiScenarios.map((s,i)=>(
                  <div key={s.id} style={{padding:"16px 18px",background:DS.canvas,
                    border:"1px solid "+DS.canvasBdr,borderRadius:10,
                    borderTop:"3px solid "+DS.accent}}>
                    <input value={s.name}
                      onChange={e=>setMultiScenarios(prev=>prev.map(x=>x.id===s.id?{...x,name:e.target.value}:x))}
                      style={{width:"100%",fontSize:14,fontWeight:700,color:DS.ink,
                        background:"transparent",border:"none",outline:"none",
                        fontFamily:"inherit",marginBottom:8,boxSizing:"border-box"}}/>
                    {/* How each uncertainty resolves */}
                    {Object.keys(s.uncertaintyResolutions||{}).length>0&&(
                      <div style={{marginBottom:10,padding:"8px 10px",
                        background:DS.canvasAlt,borderRadius:6,
                        border:"1px solid "+DS.canvasBdr}}>
                        <div style={{fontSize:9,fontWeight:700,color:DS.inkTer,
                          textTransform:"uppercase",letterSpacing:.5,marginBottom:5}}>
                          Uncertainty Resolutions
                        </div>
                        {Object.entries(s.uncertaintyResolutions).map(([k,v])=>(
                          <div key={k} style={{display:"flex",gap:6,marginBottom:3,fontSize:10}}>
                            <span style={{color:DS.inkTer,minWidth:120}}>{k.slice(0,25)}{k.length>25?"…":""}:</span>
                            <span style={{color:DS.ink,fontWeight:600}}>{typeof v==="string"?v:JSON.stringify(v)}</span>
                          </div>
                        ))}
                      </div>
                    )}
                    {[
                      {key:"narrative",label:"Narrative",rows:3},
                      {key:"earlyWarningIndicators",label:"Early Warning Indicators",rows:2},
                      {key:"risks",label:"Strategic Risks",rows:2},
                      {key:"opportunities",label:"Opportunities",rows:2},
                    ].map(f=>(
                      <div key={f.key} style={{marginBottom:8}}>
                        <div style={{fontSize:9,fontWeight:700,color:DS.inkTer,
                          textTransform:"uppercase",letterSpacing:.5,marginBottom:2}}>{f.label}</div>
                        <textarea value={s[f.key]||""}
                          onChange={e=>setMultiScenarios(prev=>prev.map(x=>x.id===s.id?{...x,[f.key]:e.target.value}:x))}
                          rows={f.rows}
                          style={{width:"100%",fontSize:11,padding:"5px 7px",fontFamily:"inherit",
                            background:DS.canvasAlt,border:"1px solid "+DS.canvasBdr,borderRadius:5,
                            color:DS.ink,outline:"none",resize:"vertical",lineHeight:1.5,boxSizing:"border-box"}}/>
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            )}
            {multiScenarios.length>0&&(
              <div style={{marginTop:16,textAlign:"center"}}>
                <Btn variant="primary" size="sm" onClick={()=>setView("test")}>Test Strategies →</Btn>
              </div>
            )}
          </div>
        )}

        {/* ── MULTI-SCENARIO MODE ── */}
        {view==="multi" && (
          <div>
            <div style={{fontSize:12,color:DS.inkSub,marginBottom:16,lineHeight:1.6,maxWidth:700}}>
              With <strong>{uncertainties.length} uncertainties</strong>, the AI will build 4 coherent scenarios
              where every uncertainty informs the narrative — richer than a 2×2.
            </div>
            <div style={{display:"flex",gap:10,marginBottom:20,alignItems:"center",flexWrap:"wrap"}}>
              <Btn variant="primary" onClick={generateMultiScenarios} disabled={aiBusy||fillingScenarios}>
                {fillingScenarios?"Generating…":"AI Generate 4 Scenarios"}
              </Btn>
              <Btn variant="secondary" size="sm"
                onClick={()=>{setScenarioMode("2x2");setView("uncertainties");}}>
                Switch to 2×2 instead
              </Btn>
            </div>
            {multiScenarios.length===0?(
              <div style={{textAlign:"center",padding:"40px",color:DS.inkTer,
                border:"1.5px dashed "+DS.canvasBdr,borderRadius:10}}>
                <div style={{fontSize:28,opacity:.4,marginBottom:8}}>◈</div>
                <div style={{fontSize:13,fontWeight:700}}>Click AI Generate to build your scenarios</div>
                <div style={{fontSize:11,marginTop:6}}>The AI will combine all {uncertainties.length} uncertainties into 4 distinct future worlds.</div>
              </div>
            ):(
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:14}}>
                {multiScenarios.map(s=>(
                  <div key={s.id} style={{padding:"16px 18px",background:DS.canvas,
                    border:"1px solid "+DS.canvasBdr,borderRadius:10,
                    borderTop:"3px solid "+DS.accent}}>
                    <input value={s.name}
                      onChange={e=>setMultiScenarios(prev=>prev.map(x=>x.id===s.id?{...x,name:e.target.value}:x))}
                      style={{width:"100%",fontSize:14,fontWeight:700,color:DS.ink,
                        background:"transparent",border:"none",outline:"none",
                        fontFamily:"inherit",marginBottom:8,boxSizing:"border-box"}}/>
                    {Object.keys(s.uncertaintyResolutions||{}).length>0&&(
                      <div style={{marginBottom:10,padding:"8px 10px",background:DS.canvasAlt,
                        borderRadius:6,border:"1px solid "+DS.canvasBdr}}>
                        <div style={{fontSize:9,fontWeight:700,color:DS.inkTer,
                          textTransform:"uppercase",letterSpacing:.5,marginBottom:5}}>How Uncertainties Resolve</div>
                        {Object.entries(s.uncertaintyResolutions).map(([k,v])=>(
                          <div key={k} style={{display:"flex",gap:6,marginBottom:3,fontSize:10}}>
                            <span style={{color:DS.inkTer,minWidth:120,flexShrink:0}}>{k.slice(0,28)}{k.length>28?"…":""}:</span>
                            <span style={{color:DS.ink,fontWeight:600}}>{typeof v==="string"?v:JSON.stringify(v)}</span>
                          </div>
                        ))}
                      </div>
                    )}
                    {[
                      {key:"narrative",label:"Narrative",rows:3},
                      {key:"earlyWarningIndicators",label:"Early Warning Indicators",rows:2},
                      {key:"risks",label:"Strategic Risks",rows:2},
                      {key:"opportunities",label:"Opportunities",rows:2},
                    ].map(f=>(
                      <div key={f.key} style={{marginBottom:8}}>
                        <div style={{fontSize:9,fontWeight:700,color:DS.inkTer,
                          textTransform:"uppercase",letterSpacing:.5,marginBottom:2}}>{f.label}</div>
                        <textarea value={s[f.key]||""}
                          onChange={e=>setMultiScenarios(prev=>prev.map(x=>x.id===s.id?{...x,[f.key]:e.target.value}:x))}
                          rows={f.rows}
                          style={{width:"100%",fontSize:11,padding:"5px 7px",fontFamily:"inherit",
                            background:DS.canvasAlt,border:"1px solid "+DS.canvasBdr,borderRadius:5,
                            color:DS.ink,outline:"none",resize:"vertical",lineHeight:1.5,boxSizing:"border-box"}}/>
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            )}
            {multiScenarios.length>0&&(
              <div style={{marginTop:16,textAlign:"center"}}>
                <Btn variant="primary" size="sm" onClick={()=>setView("test")}>Test Strategies →</Btn>
              </div>
            )}
          </div>
        )}

        {/* ── STEP 4: TEST STRATEGIES ── */}
        {view==="test" && (
          <div>
            <div style={{fontSize:12,color:DS.inkSub,marginBottom:16,lineHeight:1.6}}>
              How does each strategy perform across your four scenarios?
              Use <strong>AI Fill Matrix</strong> or click to rate each cell manually.
            </div>
            {strategies.length===0?(
              <div style={{color:DS.inkTer,fontSize:13,padding:20,textAlign:"center"}}>
                Build strategies in Module 04 first.
              </div>
            ):(
              <div style={{overflowX:"auto"}}>
                <table style={{width:"100%",borderCollapse:"collapse",minWidth:300+scenarios.length*180}}>
                  <thead>
                    <tr>
                      <th style={{padding:"10px 14px",background:DS.ink,color:"#fff",textAlign:"left",
                        fontSize:10,fontWeight:700,width:220,position:"sticky",left:0,zIndex:3}}>Strategy</th>
                      {scenarios.map(sc=>(
                        <th key={sc.id} style={{padding:"10px 14px",background:DS.ink,color:"#fff",
                          textAlign:"center",fontSize:10,fontWeight:700,minWidth:180}}>
                          <div>{sc.name}</div>
                          <div style={{fontSize:8,color:"#94a3b8",fontWeight:400,marginTop:2}}>
                            {u1?.label}: {QUADRANTS.find(q=>q.pos===sc.pos)?.ax1} | {u2?.label}: {QUADRANTS.find(q=>q.pos===sc.pos)?.ax2}
                          </div>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {strategies.map(s=>{
                      const col = DS.s?.[s.colorIdx]||{fill:"#6b7280",soft:"#f9fafb"};
                      return (
                        <tr key={s.id} style={{borderTop:"1px solid "+DS.canvasBdr}}>
                          <td style={{padding:"12px 14px",background:col.soft||DS.canvasAlt,
                            borderRight:"2px solid "+(col.fill||DS.canvasBdr),position:"sticky",left:0,zIndex:1}}>
                            <div style={{fontSize:12,fontWeight:700,color:col.fill||DS.ink}}>{s.name}</div>
                            {s.objective&&<div style={{fontSize:10,color:DS.inkTer,marginTop:2}}>{s.objective.slice(0,60)}{s.objective.length>60?"…":""}</div>}
                          </td>
                          {scenarios.map(sc=>{
                            const cell=perfMatrix[s.id+"_"+sc.id]||{};
                            const rating=RATINGS.find(r=>r.id===cell.rating);
                            return (
                              <td key={sc.id} style={{padding:0,verticalAlign:"top",
                                background:rating?.bg||DS.canvas,border:"1px solid "+DS.canvasBdr}}>
                                <div style={{padding:"8px 10px"}}>
                                  <div style={{display:"flex",gap:3,marginBottom:5,justifyContent:"center",flexWrap:"wrap"}}>
                                    {RATINGS.map(r=>(
                                      <button key={r.id} onClick={()=>updateCell(s.id,sc.id,{rating:r.id})}
                                        style={{padding:"2px 7px",fontSize:9,fontWeight:700,fontFamily:"inherit",
                                          cursor:"pointer",
                                          border:"1.5px solid "+(cell.rating===r.id?r.color:DS.canvasBdr),
                                          borderRadius:4,
                                          background:cell.rating===r.id?r.bg:"transparent",
                                          color:cell.rating===r.id?r.color:DS.inkTer}}>
                                        {r.icon}
                                      </button>
                                    ))}
                                  </div>
                                  <textarea value={cell.note||""}
                                    onChange={e=>updateCell(s.id,sc.id,{note:e.target.value})}
                                    placeholder="Reason…" rows={2}
                                    style={{width:"100%",fontSize:10,padding:"3px 5px",fontFamily:"inherit",
                                      background:"rgba(255,255,255,.7)",border:"1px solid "+DS.canvasBdr,
                                      borderRadius:4,color:DS.ink,outline:"none",resize:"none",
                                      lineHeight:1.4,boxSizing:"border-box"}}/>
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
            )}
          </div>
        )}

        {/* ── STEP 5: ROBUSTNESS INSIGHTS ── */}
        {view==="insights" && (
          <div>
            <div style={{fontSize:13,fontWeight:700,color:DS.ink,marginBottom:4}}>Strategy Robustness</div>
            <div style={{fontSize:11,color:DS.inkTer,marginBottom:16}}>
              Ranked by performance across all four scenarios.
            </div>
            {robustness.map((s,i)=>{
              const col=DS.s?.[s.colorIdx]||{fill:"#6b7280",soft:"#f9fafb"};
              const isTop=i===0;
              const classification = s.counts.thrives>=3?"Robust":s.counts.struggles>=2?"Fragile":s.counts.struggles===0?"Hedge":"Conditional";
              const classColor = {Robust:DS.success,Fragile:DS.danger,Hedge:DS.accent,Conditional:DS.warning}[classification];
              return (
                <div key={s.id} style={{padding:"16px 18px",marginBottom:10,
                  background:isTop?col.soft:DS.canvas,
                  border:"1px solid "+(isTop?col.fill:DS.canvasBdr),
                  borderRadius:10,borderLeft:"4px solid "+col.fill}}>
                  <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:8}}>
                    <div style={{fontFamily:"'Libre Baskerville',serif",fontSize:22,fontWeight:700,color:col.fill,width:28}}>{i+1}</div>
                    <div style={{flex:1}}>
                      <div style={{fontSize:14,fontWeight:700,color:DS.ink}}>{s.name}</div>
                      {s.objective&&<div style={{fontSize:11,color:DS.inkTer,marginTop:1}}>{s.objective}</div>}
                    </div>
                    <span style={{padding:"3px 10px",background:classColor+"20",color:classColor,
                      borderRadius:5,fontSize:10,fontWeight:700,border:"1px solid "+classColor+"40"}}>
                      {classification}
                    </span>
                    <div style={{textAlign:"right"}}>
                      <div style={{fontSize:20,fontWeight:700,color:col.fill,fontFamily:"'Libre Baskerville',serif"}}>{s.score}%</div>
                      <div style={{fontSize:9,color:DS.inkTer}}>robust</div>
                    </div>
                  </div>
                  <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
                    {RATINGS.map(r=>(
                      <span key={r.id} style={{padding:"2px 8px",fontSize:10,background:r.bg,
                        border:"1px solid "+r.border,borderRadius:4,color:r.color,fontWeight:700}}>
                        {r.icon} {s.counts[r.id]} {r.label}
                      </span>
                    ))}
                    {s.filled<scenarios.length&&(
                      <span style={{padding:"2px 8px",fontSize:10,background:DS.canvasAlt,
                        border:"1px solid "+DS.canvasBdr,borderRadius:4,color:DS.inkTer}}>
                        {scenarios.length-s.filled} unrated
                      </span>
                    )}
                  </div>
                </div>
              );
            })}

            {/* Signposts summary */}
            {scenarios.some(s=>s.earlyWarningIndicators)&&(
              <div style={{marginTop:20,padding:"16px 18px",background:DS.accentSoft,
                border:"1px solid "+DS.accentLine,borderRadius:10}}>
                <div style={{fontSize:11,fontWeight:700,color:DS.accent,marginBottom:10}}>
                  ⚡ Early Warning Indicators — Watch for these signposts
                </div>
                {scenarios.filter(s=>s.earlyWarningIndicators).map(s=>(
                  <div key={s.id} style={{marginBottom:8}}>
                    <div style={{fontSize:10,fontWeight:700,color:DS.ink,marginBottom:2}}>{s.name}:</div>
                    <div style={{fontSize:11,color:DS.inkSub,lineHeight:1.5}}>{s.earlyWarningIndicators}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}


function ModuleVoI({ nodes, edges, issues, strategies, decisions, problem, aiCall, aiBusy, onAIMsg }) {

  const RESOLVABILITY = ["Easy","Moderate","Hard","Not possible"];
  const DECISION_IMPACT = ["High","Medium","Low"];
  const CLASSIFICATION = [
    {id:"do_now",    label:"Do Now",           color:"#059669", bg:"#ecfdf5"},
    {id:"do_later",  label:"Do Later",         color:"#2563eb", bg:"#eff6ff"},
    {id:"conditional",label:"If Trigger",      color:"#d97706", bg:"#fffbeb"},
    {id:"do_not",   label:"Do Not Do",         color:"#dc2626", bg:"#fef2f2"},
    {id:"bundle",   label:"Bundle With Other", color:"#7c3aed", bg:"#f5f3ff"},
  ];

  const [view, setView]         = useState("screening"); // screening | options | recommendation
  const [items, setItems]       = useState([]);
  const [analysing, setAnalysing] = useState(false);

  // Seed from influence diagram
  useEffect(() => {
    if (items.length>0) return;
    const uncNodes = (nodes||[]).filter(n=>n.type==="uncertainty");
    const uncIssues = issues.filter(i=>i.category?.includes("uncertainty")||i.severity==="Critical");
    const seeded = [
      ...uncNodes.map(n=>({
        id:n.id, source:"diagram", label:n.label, description:n.description||"",
        decisionImpact:n.impact==="High"||n.impact==="Critical"?"High":"Medium",
        currentUncertainty:"High",
        resolvability:n.control==="High"?"Easy":n.control==="Medium"?"Moderate":"Hard",
        costToLearn:"", timeToLearn:"",
        changeProbability:"Medium",
        isDecisionCritical:null,
        informationOptions:[],
        classification:"", voiNote:"", voiScore:0,
      })),
      ...uncIssues
        .filter(i=>!(nodes||[]).some(n=>n.label?.toLowerCase()===i.text?.slice(0,30).toLowerCase()))
        .slice(0,5)
        .map(i=>({
          id:i.id, source:"issues", label:i.text.slice(0,70),
          description:i.text,
          decisionImpact:i.severity==="Critical"?"High":i.severity==="High"?"High":"Medium",
          currentUncertainty:"High",
          resolvability:"Moderate",
          costToLearn:"", timeToLearn:"",
          changeProbability:"Medium",
          isDecisionCritical:null,
          informationOptions:[],
          classification:"", voiNote:"", voiScore:0,
        })),
    ];
    if (seeded.length>0) setItems(seeded);
  }, [nodes?.length, issues?.length]);

  const updateItem = (id, patch) => setItems(prev=>prev.map(x=>x.id===id?{...x,...patch}:x));
  const removeItem = (id) => setItems(prev=>prev.filter(x=>x.id!==id));
  const addItem = () => setItems(prev=>[...prev,{
    id:uid("vi"),source:"manual",label:"",description:"",
    decisionImpact:"Medium",currentUncertainty:"High",
    resolvability:"Moderate",costToLearn:"",timeToLearn:"",
    changeProbability:"Medium",isDecisionCritical:null,
    informationOptions:[],classification:"",voiNote:"",voiScore:0,
  }]);

  const addInfoOption = (itemId) => setItems(prev=>prev.map(x=>x.id===itemId?{...x,
    informationOptions:[...(x.informationOptions||[]),{
      id:uid("io"),type:"Market research",cost:"",duration:"",
      accuracy:"Medium",description:"",reduces:"",
    }]
  }:x));

  const updateInfoOption = (itemId, optId, patch) => setItems(prev=>prev.map(x=>x.id===itemId?{...x,
    informationOptions:(x.informationOptions||[]).map(o=>o.id===optId?{...o,...patch}:o)
  }:x));

  const removeInfoOption = (itemId, optId) => setItems(prev=>prev.map(x=>x.id===itemId?{...x,
    informationOptions:(x.informationOptions||[]).filter(o=>o.id!==optId)
  }:x));

  // VoI score (qualitative)
  const calcVoI = (x) => {
    const imp = {High:3,Medium:2,Low:1}[x.decisionImpact]||2;
    const unc = {High:3,Medium:2,Low:1}[x.currentUncertainty]||2;
    const res = {Easy:3,Moderate:2,Hard:1,"Not possible":0}[x.resolvability]||1;
    const chg = {High:3,Medium:2,Low:1}[x.changeProbability]||2;
    return imp * unc * res * chg;
  };

  const sortedItems = [...items].map(x=>({...x,voiScore:calcVoI(x)})).sort((a,b)=>b.voiScore-a.voiScore);

  // AI analyse
  const analyseVoI = () => {
    if (!items.length) return;
    setAnalysing(true);
    const stratList = strategies.map(s=>s.name+(s.objective?" — "+s.objective:"")).join("; ");
    const uncList = items.map((x,i)=>
      (i+1)+". "+x.label+" | Decision Impact: "+x.decisionImpact+" | Uncertainty: "+x.currentUncertainty+" | Resolvability: "+x.resolvability
    ).join("\n");
    aiCall(
      "You are a Decision Quality expert assessing Value of Information. " +
      "Decision: "+(problem?.decisionStatement||"Not defined")+".\n" +
      "Strategies: "+(stratList||"none")+".\n\n" +
      "UNCERTAINTIES:\n"+uncList+"\n\n" +
      "For each uncertainty: " +
      "(1) Is it truly decision-critical — would knowing it change which strategy to pick? " +
      "(2) Suggest the best information option to reduce it (be specific: e.g. commission market research, run 8-week pilot, obtain legal opinion). " +
      "(3) Classify as: do_now | do_later | conditional | do_not | bundle. " +
      "(4) Provide a plain-language VoI note for executives. " +
      "(5) Give a priority rank (1=highest). " +
      "Key principle: information only has value if it can change the decision. " +
      "Return ONLY JSON:\n" +
      '{"assessments":[{"label":"uncertainty label","isDecisionCritical":true,"classification":"do_now","bestAction":"specific action","timeToLearn":"e.g. 6-8 weeks","costToLearn":"e.g. Low/Medium/High","voiNote":"plain language explanation","rank":1}],' +
      '"resolveBeforeCommit":["label1"],"acceptAndMonitor":["label2"],"doNotStudy":["label3"],"insight":"executive summary observation"}',
    (r)=>{
      let result=r;
      if (r&&r._raw){try{result=JSON.parse(r._raw.replace(/```json|```/g,"").trim());}catch(e){setAnalysing(false);return;}}
      if (!result||result.error){setAnalysing(false);return;}
      const assessments=result.assessments||[];
      setItems(prev=>prev.map(x=>{
        const match=assessments.find(a=>a.label?.toLowerCase().includes(x.label.toLowerCase().slice(0,15))||x.label.toLowerCase().includes((a.label||"").toLowerCase().slice(0,15)));
        if (!match) return x;
        return {...x,
          isDecisionCritical:match.isDecisionCritical,
          classification:match.classification||"",
          voiNote:match.voiNote||"",
          costToLearn:match.costToLearn||x.costToLearn,
          timeToLearn:match.timeToLearn||x.timeToLearn,
          informationOptions:x.informationOptions.length>0?x.informationOptions:[{
            id:uid("io"),type:"AI Suggested",
            description:match.bestAction||"",
            cost:match.costToLearn||"",
            duration:match.timeToLearn||"",
            accuracy:"Medium",reduces:x.label,
          }],
        };
      }));
      onAIMsg({role:"ai",text:
        (result.insight||"VoI analysis complete.")+" "+
        (result.resolveBeforeCommit?.length?"→ Resolve before committing: "+result.resolveBeforeCommit.join(", ")+". ":"")+
        (result.doNotStudy?.length?"✗ Do not study: "+result.doNotStudy.join(", "):"")+
        (result.acceptAndMonitor?.length?" Monitor: "+result.acceptAndMonitor.join(", "):"")
      });
      setView("recommendation");
      setAnalysing(false);
    });
  };

  const classInfo = (id) => CLASSIFICATION.find(c=>c.id===id)||{label:id,color:DS.inkTer,bg:DS.canvasAlt};
  const resolveFirst = sortedItems.filter(x=>x.classification==="do_now");
  const INFO_TYPES = ["Market research","Pilot project","Expert elicitation","Legal/regulatory opinion","Technical study","Customer discovery","Data purchase","Engineering study","Vendor quote","Prototype test"];

  return (
    <div style={{display:"flex",flexDirection:"column",height:"100%",overflow:"hidden"}}>

      {/* Header */}
      <div style={{background:DS.canvas,borderBottom:"1px solid "+DS.canvasBdr,flexShrink:0}}>
        <div style={{padding:"10px 20px",display:"flex",alignItems:"center",gap:10,flexWrap:"wrap"}}>
          <div style={{flex:1}}>
            <div style={{fontSize:9,color:DS.inkTer,textTransform:"uppercase",fontWeight:700,letterSpacing:1}}>Module 11</div>
            <div style={{fontFamily:"'Libre Baskerville',serif",fontSize:18,fontWeight:700,color:DS.ink}}>Value of Information</div>
          </div>
          <Btn variant="secondary" size="sm" onClick={addItem}>+ Add Uncertainty</Btn>
          <Btn variant="primary" size="sm" onClick={analyseVoI} disabled={aiBusy||analysing||!items.length}>
            {analysing?"Analysing…":"AI Analyse VoI"}
          </Btn>
        </div>
        <div style={{padding:"0 20px 8px",display:"flex",gap:2}}>
          {[{id:"screening",label:"1. Screening"},{id:"options",label:"2. Information Options"},{id:"recommendation",label:"3. Recommendations"}].map(v=>(
            <button key={v.id} onClick={()=>setView(v.id)}
              style={{padding:"5px 12px",fontSize:11,fontWeight:700,fontFamily:"inherit",
                cursor:"pointer",border:"none",borderRadius:5,
                background:view===v.id?DS.accent:"transparent",
                color:view===v.id?"#fff":DS.inkSub}}>
              {v.label}
            </button>
          ))}
        </div>
      </div>

      <div style={{flex:1,overflowY:"auto",padding:20}}>

        {/* ── STEP 1: SCREENING ── */}
        {view==="screening" && (
          <div>
            <div style={{fontSize:12,color:DS.inkSub,marginBottom:16,lineHeight:1.6,maxWidth:700}}>
              Score each uncertainty on four dimensions. The VoI score identifies which uncertainties deserve further analysis.
              <strong> Key principle: more data is not always better</strong> — information only has value if it can change the decision.
            </div>

            {items.length===0?(
              <div style={{textAlign:"center",padding:"40px",color:DS.inkTer,border:"1.5px dashed "+DS.canvasBdr,borderRadius:10}}>
                <div style={{fontSize:28,marginBottom:8,opacity:.4}}>◎</div>
                <div style={{fontSize:13,fontWeight:700,marginBottom:6}}>No uncertainties loaded</div>
                <div style={{fontSize:12,marginBottom:16,lineHeight:1.6}}>
                  Build the <strong>Influence Diagram</strong> (Module 09) with uncertainty nodes — they auto-populate here.
                  Or add manually.
                </div>
                <Btn variant="secondary" onClick={addItem}>+ Add Uncertainty</Btn>
              </div>
            ):(
              <table style={{width:"100%",borderCollapse:"collapse"}}>
                <thead>
                  <tr>
                    {["#","Uncertainty","Decision Impact","Current Uncertainty","Resolvability","Change Probability","VoI Score",""].map(h=>(
                      <th key={h} style={{padding:"8px 10px",background:DS.ink,color:"#fff",
                        fontSize:9,fontWeight:700,textAlign:"left",letterSpacing:.5,whiteSpace:"nowrap"}}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {sortedItems.map((x,i)=>{
                    const pct = Math.min(100,Math.round(x.voiScore/36*100));
                    const scoreColor = pct>=70?"#059669":pct>=40?"#d97706":"#6b7280";
                    return (
                      <tr key={x.id} style={{borderTop:"1px solid "+DS.canvasBdr,background:i%2===0?DS.canvas:DS.canvasAlt}}>
                        <td style={{padding:"8px 10px",fontSize:11,color:DS.inkTer,fontWeight:700}}>{i+1}</td>
                        <td style={{padding:"8px 10px",minWidth:180}}>
                          <input value={x.label} onChange={e=>updateItem(x.id,{label:e.target.value})}
                            style={{width:"100%",fontSize:12,fontWeight:700,color:DS.ink,
                              background:"transparent",border:"none",outline:"none",fontFamily:"inherit"}}/>
                          <div style={{fontSize:9,color:DS.inkTer,marginTop:1}}>From: {x.source}</div>
                        </td>
                        {[
                          {key:"decisionImpact",opts:DECISION_IMPACT,label:"If known, would it change the decision?"},
                          {key:"currentUncertainty",opts:["High","Medium","Low"],label:"How uncertain is this today?"},
                          {key:"resolvability",opts:RESOLVABILITY,label:"How feasible to obtain before deadline?"},
                          {key:"changeProbability",opts:["High","Medium","Low"],label:"Probability new info changes the preferred alternative?"},
                        ].map(f=>{
                          const val = x[f.key];
                          const color = val==="High"||val==="Easy"?"#059669":val==="Medium"||val==="Moderate"?"#d97706":val==="Low"?"#6b7280":"#dc2626";
                          return (
                            <td key={f.key} style={{padding:"8px 10px"}}>
                              <select value={val} onChange={e=>updateItem(x.id,{[f.key]:e.target.value})}
                                style={{fontSize:11,padding:"3px 6px",border:"1px solid "+DS.canvasBdr,
                                  borderRadius:4,background:DS.canvas,color,fontFamily:"inherit",fontWeight:600}}>
                                {f.opts.map(o=><option key={o}>{o}</option>)}
                              </select>
                            </td>
                          );
                        })}
                        <td style={{padding:"8px 10px",minWidth:80}}>
                          <div style={{display:"flex",alignItems:"center",gap:6}}>
                            <div style={{flex:1,height:6,background:DS.canvasBdr,borderRadius:3,overflow:"hidden"}}>
                              <div style={{width:pct+"%",height:"100%",background:scoreColor,borderRadius:3}}/>
                            </div>
                            <span style={{fontSize:10,fontWeight:700,color:scoreColor,minWidth:28}}>{pct}%</span>
                          </div>
                        </td>
                        <td style={{padding:"8px 10px"}}>
                          <button onClick={()=>removeItem(x.id)}
                            style={{background:"none",border:"none",cursor:"pointer",color:DS.inkTer,fontSize:14}}>×</button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
            {items.length>0&&(
              <div style={{marginTop:12,display:"flex",gap:8}}>
                <Btn variant="secondary" size="sm" onClick={addItem}>+ Add</Btn>
                <Btn variant="primary" size="sm" onClick={()=>setView("options")}>Define Information Options →</Btn>
              </div>
            )}
          </div>
        )}

        {/* ── STEP 2: INFORMATION OPTIONS ── */}
        {view==="options" && (
          <div>
            <div style={{fontSize:12,color:DS.inkSub,marginBottom:16,lineHeight:1.6,maxWidth:700}}>
              For each high-VoI uncertainty, define what learning option would reduce it and at what cost/time.
              This feeds the AI recommendation on whether to pursue each study.
            </div>
            {sortedItems.filter(x=>x.voiScore>0).map(x=>{
              const pct=Math.min(100,Math.round(x.voiScore/36*100));
              const scoreColor=pct>=70?"#059669":pct>=40?"#d97706":"#6b7280";
              return (
                <div key={x.id} style={{marginBottom:16,padding:"14px 16px",background:DS.canvas,
                  border:"1px solid "+DS.canvasBdr,borderRadius:10,
                  borderLeft:"4px solid "+scoreColor}}>
                  <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:10}}>
                    <div style={{fontSize:13,fontWeight:700,color:DS.ink,flex:1}}>{x.label}</div>
                    <span style={{fontSize:10,fontWeight:700,color:scoreColor}}>VoI: {pct}%</span>
                    <button onClick={()=>addInfoOption(x.id)}
                      style={{fontSize:10,padding:"3px 9px",background:DS.accentSoft,
                        border:"1px solid "+DS.accentLine,borderRadius:4,cursor:"pointer",
                        color:DS.accent,fontFamily:"inherit",fontWeight:700}}>
                      + Add Option
                    </button>
                  </div>
                  {(x.informationOptions||[]).length===0?(
                    <div style={{fontSize:11,color:DS.inkTer,fontStyle:"italic"}}>
                      No information options defined. Click "+ Add Option" or run AI Analyse VoI to suggest one.
                    </div>
                  ):(x.informationOptions||[]).map(opt=>(
                    <div key={opt.id} style={{padding:"10px 12px",marginBottom:8,
                      background:DS.canvasAlt,border:"1px solid "+DS.canvasBdr,
                      borderRadius:7}}>
                      <div style={{display:"flex",gap:10,flexWrap:"wrap",marginBottom:8}}>
                        <select value={opt.type||""} onChange={e=>updateInfoOption(x.id,opt.id,{type:e.target.value})}
                          style={{fontSize:11,padding:"4px 7px",border:"1px solid "+DS.canvasBdr,
                            borderRadius:4,fontFamily:"inherit",background:DS.canvas,color:DS.ink}}>
                          {INFO_TYPES.map(t=><option key={t}>{t}</option>)}
                        </select>
                        <input value={opt.cost||""} onChange={e=>updateInfoOption(x.id,opt.id,{cost:e.target.value})}
                          placeholder="Cost (e.g. $50K)"
                          style={{flex:1,minWidth:100,padding:"4px 7px",fontSize:11,fontFamily:"inherit",
                            background:DS.canvas,border:"1px solid "+DS.canvasBdr,borderRadius:4,color:DS.ink,outline:"none"}}/>
                        <input value={opt.duration||""} onChange={e=>updateInfoOption(x.id,opt.id,{duration:e.target.value})}
                          placeholder="Duration (e.g. 6 weeks)"
                          style={{flex:1,minWidth:100,padding:"4px 7px",fontSize:11,fontFamily:"inherit",
                            background:DS.canvas,border:"1px solid "+DS.canvasBdr,borderRadius:4,color:DS.ink,outline:"none"}}/>
                        <select value={opt.accuracy||"Medium"} onChange={e=>updateInfoOption(x.id,opt.id,{accuracy:e.target.value})}
                          style={{fontSize:11,padding:"4px 7px",border:"1px solid "+DS.canvasBdr,
                            borderRadius:4,fontFamily:"inherit",background:DS.canvas,color:DS.ink}}>
                          {["High","Medium","Low"].map(v=><option key={v}>{v} Accuracy</option>)}
                        </select>
                        <button onClick={()=>removeInfoOption(x.id,opt.id)}
                          style={{background:"none",border:"none",cursor:"pointer",color:DS.inkTer,fontSize:14}}>×</button>
                      </div>
                      <textarea value={opt.description||""} onChange={e=>updateInfoOption(x.id,opt.id,{description:e.target.value})}
                        placeholder="What would this study do and what would it tell us?"
                        rows={2}
                        style={{width:"100%",fontSize:11,padding:"5px 7px",fontFamily:"inherit",
                          background:DS.canvas,border:"1px solid "+DS.canvasBdr,borderRadius:5,
                          color:DS.ink,outline:"none",resize:"none",lineHeight:1.5,boxSizing:"border-box"}}/>
                    </div>
                  ))}
                </div>
              );
            })}
            <div style={{marginTop:8,textAlign:"center"}}>
              <Btn variant="primary" size="sm" onClick={analyseVoI} disabled={aiBusy||analysing}>
                {analysing?"Analysing…":"AI Analyse & Recommend →"}
              </Btn>
            </div>
          </div>
        )}

        {/* ── STEP 3: RECOMMENDATIONS ── */}
        {view==="recommendation" && (
          <div>
            {/* Resolve before commit */}
            {resolveFirst.length>0&&(
              <div style={{padding:"14px 16px",background:DS.accentSoft,
                border:"2px solid "+DS.accent,borderRadius:10,marginBottom:20}}>
                <div style={{fontSize:11,fontWeight:700,color:DS.accent,
                  textTransform:"uppercase",letterSpacing:.5,marginBottom:8}}>
                  ⬆ Resolve Before Committing
                </div>
                {resolveFirst.map((x,i)=>{
                  const opt=x.informationOptions?.[0];
                  return (
                    <div key={x.id} style={{display:"flex",gap:10,marginBottom:6,alignItems:"flex-start"}}>
                      <span style={{fontSize:11,fontWeight:700,color:DS.accent,minWidth:16}}>{i+1}.</span>
                      <div>
                        <span style={{fontSize:12,fontWeight:700,color:DS.ink}}>{x.label}</span>
                        {opt&&<span style={{fontSize:11,color:DS.inkSub}}> — {opt.description||opt.type}</span>}
                        {(opt?.cost||opt?.duration)&&<span style={{fontSize:10,color:DS.inkTer}}> ({[opt.cost,opt.duration].filter(Boolean).join(", ")})</span>}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Full recommendation list */}
            <div style={{display:"flex",flexDirection:"column",gap:8}}>
              {sortedItems.map(x=>{
                const cls=classInfo(x.classification);
                const opt=x.informationOptions?.[0];
                return (
                  <div key={x.id} style={{padding:"14px 16px",background:cls.bg||DS.canvas,
                    border:"1px solid "+DS.canvasBdr,borderRadius:8,
                    display:"flex",gap:14,alignItems:"flex-start"}}>
                    <div style={{flex:1}}>
                      <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:4}}>
                        <span style={{fontSize:12,fontWeight:700,color:DS.ink}}>{x.label}</span>
                        {x.isDecisionCritical===true&&<span style={{fontSize:9,padding:"1px 6px",background:"#fef3c7",color:"#92400e",borderRadius:3,fontWeight:700}}>DECISION CRITICAL</span>}
                        {x.isDecisionCritical===false&&<span style={{fontSize:9,padding:"1px 6px",background:DS.canvasAlt,color:DS.inkTer,borderRadius:3}}>Not decision-critical</span>}
                      </div>
                      {x.voiNote&&<div style={{fontSize:11,color:DS.inkSub,lineHeight:1.5,marginBottom:6}}>{x.voiNote}</div>}
                      {opt&&<div style={{fontSize:10,color:DS.inkTer}}>{opt.description||opt.type}{opt.cost?" · "+opt.cost:""}{opt.duration?" · "+opt.duration:""}</div>}
                    </div>
                    <div>
                      {x.classification?(
                        <span style={{padding:"5px 12px",background:cls.color+"20",color:cls.color,
                          border:"1px solid "+cls.color+"40",borderRadius:6,
                          fontSize:10,fontWeight:700,whiteSpace:"nowrap"}}>
                          {cls.label}
                        </span>
                      ):(
                        <select value={x.classification||""} onChange={e=>updateItem(x.id,{classification:e.target.value})}
                          style={{fontSize:11,padding:"4px 7px",border:"1px solid "+DS.canvasBdr,
                            borderRadius:5,fontFamily:"inherit",background:DS.canvas,color:DS.ink}}>
                          <option value="">Classify…</option>
                          {CLASSIFICATION.map(c=><option key={c.id} value={c.id}>{c.label}</option>)}
                        </select>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}


function CrossModuleAI({ problem, issues, decisions, criteria, strategies, assessmentScores, dqScores, aiCall, aiBusy, onAIMsg }) {
  const [insights, setInsights] = useState(null);
  const [running, setRunning]   = useState(false);
  const [open, setOpen]         = useState(false);

  const run = () => {
    setRunning(true);
    const focusDecs = decisions.filter(d=>d.tier==="focus");
    const issueCats = {};
    ISSUE_CATEGORIES.forEach(c => { issueCats[c.key] = issues.filter(i=>i.category===c.key).length; });
    const brutals  = issues.filter(i=>i.category==="brutal-truth").map(i=>i.text.slice(0,80));
    const assumptions = issues.filter(i=>i.category==="assumption").map(i=>i.text.slice(0,80));
    const dqEl = DQ_ELEMENTS.map(e=>`${e.label}:${dqScores[e.key]||0}`).join(", ");
    const scored = strategies.map(s => {
      const total = criteria.reduce((sum,c)=>{
        const sc = assessmentScores[`${s.id}__${c.id}`]||0;
        return sum+sc;
      },0);
      return `${DS.sNames[s.colorIdx]||s.name}:${total}pts`;
    }).join(", ");

    aiCall(`You are a senior DQ expert performing a cross-module intelligence audit of a decision framing session.

Decision: "${problem.decisionStatement}"
Frame quality indicators: owner="${problem.owner}", scope-in="${problem.scopeIn?.slice(0,60)}", deadline="${problem.deadline}"
Issues: ${issues.length} total, ${issueCats["brutal-truth"]||0} brutal truths, ${issueCats["assumption"]||0} assumptions, ${issueCats["information-gap"]||0} info gaps
Brutal truths raised: ${brutals.join("; ")||"none"}
Assumptions: ${assumptions.join("; ")||"none"}
Focus decisions: ${focusDecs.map(d=>d.label).join(", ")||"none"}
Criteria: ${criteria.map(c=>c.label).join(", ")||"none"}
Strategies: ${strategies.map(s=>DS.sNames[s.colorIdx]||s.name).join(", ")||"none"}
Assessment scores: ${scored||"not scored"}
DQ element scores: ${dqEl}

Identify CROSS-MODULE inconsistencies, blind spots, and opportunities that a single-module view would miss.
Be specific and direct. Each insight must reference at least two modules.

Return ONLY JSON:
{
  "insights":[{
    "title":"short headline",
    "body":"2-3 sentences — specific observation referencing actual data from the session",
    "modules":["Module A","Module B"],
    "severity":"critical|warning|opportunity",
    "action":"specific recommended action"
  }],
  "healthScore":0-100,
  "healthSummary":"one frank sentence on overall session coherence"
}`,
    (r) => {
      if (!r.error) {
        setInsights(r);
        onAIMsg({ role:"ai", text: r.healthSummary || "Cross-module analysis complete." });
      }
      setRunning(false);
    });
  };

  const sevColor = { critical:DS.danger, warning:DS.warning, opportunity:DS.success };
  const sevBg    = { critical:DS.dangerSoft, warning:DS.warnSoft, opportunity:DS.successSoft };
  const sevLine  = { critical:DS.dangerLine, warning:DS.warnLine, opportunity:DS.successLine };
  const sevVar   = { critical:"danger", warning:"warn", opportunity:"green" };

  return (
    <>
      {/* Trigger button in top bar */}
      <button onClick={()=>setOpen(o=>!o)}
        style={{ padding:"5px 12px", border:`1px solid ${open?DS.accent:DS.border}`,
          borderRadius:6, background:open?DS.chromeMid:"transparent",
          color:open?DS.accent:DS.textSec, cursor:"pointer", fontSize:11,
          fontWeight:600, display:"flex", alignItems:"center", gap:5,
          fontFamily:"inherit", transition:"all .12s",
          ...(insights ? { borderColor:insights.insights?.some(i=>i.severity==="critical")?DS.danger:DS.accent } : {}) }}
        onMouseEnter={e=>{e.currentTarget.style.borderColor=DS.accent;e.currentTarget.style.color=DS.accent;}}
        onMouseLeave={e=>{if(!open){e.currentTarget.style.borderColor=DS.border;e.currentTarget.style.color=DS.textSec;}}}>
        <Svg path={ICONS.link} size={12} color="currentColor"/>
        Cross-Module AI
        {insights?.insights?.filter(i=>i.severity==="critical").length > 0 && (
          <span style={{ width:7,height:7,borderRadius:"50%",background:DS.danger,display:"inline-block"}}/>
        )}
      </button>

      {/* Panel */}
      {open && (
        <div style={{ position:"fixed", right:0, top:46, width:380, height:"calc(100vh - 46px)",
          background:DS.canvas, borderLeft:`1px solid ${DS.canvasBdr}`,
          display:"flex", flexDirection:"column", zIndex:150,
          fontFamily:"'IBM Plex Sans','Helvetica Neue',sans-serif",
          boxShadow:"-4px 0 24px rgba(0,0,0,.1)" }}>

          <div style={{ padding:"14px 18px", borderBottom:`1px solid ${DS.canvasBdr}`,
            display:"flex", alignItems:"center", justifyContent:"space-between",
            background:DS.canvasAlt }}>
            <div>
              <div style={{ fontSize:13, fontWeight:700, color:DS.ink }}>Cross-Module Intelligence</div>
              <div style={{ fontSize:11, color:DS.inkTer, marginTop:1 }}>
                AI reads the full session for blind spots
              </div>
            </div>
            <button onClick={()=>setOpen(false)}
              style={{ background:"none", border:"none", cursor:"pointer", color:DS.inkTer }}>
              <Svg path={ICONS.x} size={16} color={DS.inkTer}/>
            </button>
          </div>

          {!insights ? (
            <div style={{ flex:1, display:"flex", flexDirection:"column", alignItems:"center",
              justifyContent:"center", padding:"28px", textAlign:"center", gap:14 }}>
              <Svg path={ICONS.link} size={32} color={DS.inkDis}/>
              <div style={{ fontSize:13, color:DS.inkSub, lineHeight:1.6 }}>
                Reads all seven modules simultaneously and surfaces inconsistencies, blind spots, and opportunities that single-module views miss.
              </div>
              <Btn variant="primary" icon="spark" onClick={run} disabled={aiBusy||running}>
                {running?"Analysing…":"Run Cross-Module Analysis"}
              </Btn>
            </div>
          ) : (
            <>
              {/* Health score */}
              <div style={{ padding:"14px 18px", borderBottom:`1px solid ${DS.canvasBdr}`,
                display:"flex", alignItems:"center", gap:14, background:
                  insights.healthScore>=70?DS.successSoft:insights.healthScore>=45?DS.warnSoft:DS.dangerSoft }}>
                <div style={{ fontSize:28, fontWeight:700,
                  fontFamily:"'Libre Baskerville',Georgia,serif",
                  color:insights.healthScore>=70?DS.success:insights.healthScore>=45?DS.warning:DS.danger }}>
                  {insights.healthScore}
                </div>
                <div style={{ flex:1 }}>
                  <div style={{ fontSize:10, fontWeight:700,
                    color:insights.healthScore>=70?DS.success:insights.healthScore>=45?DS.warning:DS.danger,
                    letterSpacing:.8, textTransform:"uppercase", marginBottom:3 }}>Session Coherence</div>
                  <div style={{ fontSize:11, color:DS.ink, lineHeight:1.5 }}>{insights.healthSummary}</div>
                </div>
                <Btn variant="secondary" size="sm" icon="spark" onClick={run} disabled={aiBusy||running}>Refresh</Btn>
              </div>

              {/* Insights list */}
              <div style={{ flex:1, overflowY:"auto", padding:"12px" }}>
                {insights.insights?.map((ins, i) => (
                  <div key={i} style={{ marginBottom:10, padding:"12px 14px", borderRadius:8,
                    background:sevBg[ins.severity]||DS.canvasAlt,
                    border:`1px solid ${sevLine[ins.severity]||DS.canvasBdr}` }}>
                    <div style={{ display:"flex", alignItems:"flex-start", gap:8, marginBottom:6 }}>
                      <Badge variant={sevVar[ins.severity]||"default"} size="xs">{ins.severity}</Badge>
                      <div style={{ fontSize:12, fontWeight:700, color:DS.ink, flex:1, lineHeight:1.3 }}>{ins.title}</div>
                    </div>
                    <div style={{ fontSize:11, color:DS.inkSub, lineHeight:1.6, marginBottom:8 }}>{ins.body}</div>
                    <div style={{ display:"flex", gap:5, flexWrap:"wrap", marginBottom:ins.action?8:0 }}>
                      {ins.modules?.map((m,j) => <Badge key={j} variant="chrome" size="xs">{m}</Badge>)}
                    </div>
                    {ins.action && (
                      <div style={{ fontSize:11, color:sevColor[ins.severity]||DS.inkSub,
                        fontWeight:600, lineHeight:1.4 }}>→ {ins.action}</div>
                    )}
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      )}
    </>
  );
}

/* ─────────────────────────────────────────────────────────────────────────────
   PHASE 2 — DQI DASHBOARD (Organisation-Level)
───────────────────────────────────────────────────────────────────────────── */

function DQiDashboard({ currentProject, dqScores, strategies, issues, aiCall, aiBusy, onClose }) {
  const [projects, setProjects] = useState(() => {
    try {
      const saved = localStorage.getItem("vantage_dq_projects_v1");
      const existing = saved ? JSON.parse(saved) : [];
      // Add current project if not present
      const cur = {
        id: "current",
        name: currentProject.projectName || currentProject.decisionStatement?.slice(0,50) || "Current Decision",
        owner: currentProject.owner||"—",
        date: new Date().toISOString().slice(0,10),
        dqScores: { ...dqScores },
        issueCount: issues.length,
        strategyCount: strategies.length,
        status: "Active",
        overall: DQ_ELEMENTS.length > 0 ? Math.round(DQ_ELEMENTS.reduce((s,e)=>s+(dqScores[e.key]||0),0)/DQ_ELEMENTS.length) : 0,
      };
      const others = existing.filter(p=>p.id!=="current");
      return [cur, ...others];
    } catch { return []; }
  });

  const saveCurrentProject = () => {
    const toSave = projects.filter(p=>p.id!=="current");
    const newEntry = {
      id: uid("proj"),
      name: currentProject.decisionStatement?.slice(0,50)||"Untitled",
      owner: currentProject.owner||"—",
      date: new Date().toISOString().slice(0,10),
      dqScores: { ...dqScores },
      issueCount: issues.length,
      strategyCount: strategies.length,
      status: "Archived",
      overall: Math.round(DQ_ELEMENTS.reduce((s,e)=>s+(dqScores[e.key]||0),0)/DQ_ELEMENTS.length),
    };
    const updated = [projects.find(p=>p.id==="current"), newEntry, ...toSave].filter(Boolean);
    setProjects(updated);
    localStorage.setItem("vantage_dq_projects_v1", JSON.stringify(updated.filter(p=>p.id!=="current")));
  };

  const deleteProject = (id) => {
    const updated = projects.filter(p=>p.id!==id);
    setProjects(updated);
    localStorage.setItem("vantage_dq_projects_v1", JSON.stringify(updated.filter(p=>p.id!=="current")));
  };

  // Analytics
  const allScored = projects.filter(p=>p.overall>0);
  const avgOverall = allScored.length ? Math.round(allScored.reduce((s,p)=>s+p.overall,0)/allScored.length) : 0;

  const elementAverages = DQ_ELEMENTS.map(el => ({
    ...el,
    avg: allScored.length
      ? Math.round(allScored.reduce((s,p)=>s+(p.dqScores?.[el.key]||0),0)/allScored.length)
      : 0,
  })).sort((a,b)=>a.avg-b.avg);

  const weakestElement = elementAverages[0];
  const strongestElement = elementAverages[elementAverages.length-1];

  const scoreColor = (s) => s>=70?"#059669":s>=45?"#d97706":s>0?"#dc2626":"#b0b5c8";

  return (
    <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,.55)", zIndex:250,
      display:"flex", alignItems:"center", justifyContent:"center",
      fontFamily:"'IBM Plex Sans','Helvetica Neue',sans-serif" }}>
      <div style={{ background:DS.canvas, borderRadius:14, width:"95%", maxWidth:1000,
        maxHeight:"90vh", display:"flex", flexDirection:"column",
        boxShadow:"0 32px 80px rgba(0,0,0,.22)", border:`1px solid ${DS.canvasBdr}` }}>

        {/* Header */}
        <div style={{ padding:"16px 24px", borderBottom:`1px solid ${DS.canvasBdr}`,
          display:"flex", alignItems:"center", gap:14, background:DS.ink }}>
          <div>
            <div style={{ fontFamily:"'Libre Baskerville',Georgia,serif", fontSize:18,
              fontWeight:700, color:DS.textPri }}>Decision Quality Index</div>
            <div style={{ fontSize:11, color:DS.textTer }}>
              Organisation-level DQ performance across all projects
            </div>
          </div>
          <div style={{ marginLeft:"auto", display:"flex", gap:8 }}>
            <Btn variant="chrome" size="sm" onClick={saveCurrentProject}>Archive Current Project</Btn>
            <button onClick={onClose}
              style={{ background:"none", border:"none", cursor:"pointer", color:DS.textSec, display:"flex" }}>
              <Svg path={ICONS.x} size={18} color={DS.textSec}/>
            </button>
          </div>
        </div>

        <div style={{ flex:1, overflowY:"auto", padding:"20px 24px" }}>

          {/* Summary KPIs */}
          <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:12, marginBottom:24 }}>
            {[
              { label:"Projects Tracked", value:projects.length, sub:"active + archived", color:DS.accent },
              { label:"Avg DQ Score", value:avgOverall>0?`${avgOverall}/100`:"—", sub:"across all projects", color:scoreColor(avgOverall) },
              { label:"Consistently Weak", value:weakestElement.avg>0?weakestElement.label:"—", sub:`avg ${weakestElement.avg||"—"}/100`, color:DS.danger },
              { label:"Consistently Strong", value:strongestElement.avg>0?strongestElement.label:"—", sub:`avg ${strongestElement.avg||"—"}/100`, color:DS.success },
            ].map((kpi,i)=>(
              <div key={i} style={{ padding:"16px 18px", background:DS.canvas,
                border:`1px solid ${DS.canvasBdr}`, borderRadius:9,
                boxShadow:"0 1px 4px rgba(0,0,0,.06)" }}>
                <div style={{ fontSize:10, fontWeight:700, color:DS.inkTer,
                  letterSpacing:.8, textTransform:"uppercase", marginBottom:6 }}>{kpi.label}</div>
                <div style={{ fontSize:18, fontWeight:700, color:kpi.color,
                  fontFamily:"'Libre Baskerville',Georgia,serif", lineHeight:1.2, marginBottom:3 }}>{kpi.value}</div>
                <div style={{ fontSize:10, color:DS.inkTer }}>{kpi.sub}</div>
              </div>
            ))}
          </div>

          <div style={{ display:"grid", gridTemplateColumns:"2fr 1fr", gap:16, marginBottom:20 }}>

            {/* Project table */}
            <div style={{ border:`1px solid ${DS.canvasBdr}`, borderRadius:9, overflow:"hidden" }}>
              <div style={{ padding:"11px 16px", background:DS.canvasAlt,
                borderBottom:`1px solid ${DS.canvasBdr}`, fontSize:11, fontWeight:700, color:DS.ink }}>
                Project Library
              </div>
              <table style={{ width:"100%", borderCollapse:"collapse" }}>
                <thead>
                  <tr style={{ background:DS.canvasAlt }}>
                    {["Project","Owner","Date","DQ Score","Status",""].map(h=>(
                      <th key={h} style={{ padding:"8px 12px", textAlign:"left", fontSize:10,
                        fontWeight:700, color:DS.inkTer, letterSpacing:.6, textTransform:"uppercase",
                        borderBottom:`1px solid ${DS.canvasBdr}` }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {projects.map((p,i)=>(
                    <tr key={p.id} style={{ borderTop:i>0?`1px solid ${DS.canvasBdr}`:"none",
                      background:p.id==="current"?DS.accentSoft:DS.canvas }}>
                      <td style={{ padding:"10px 12px" }}>
                        <div style={{ fontSize:12, fontWeight:600, color:DS.ink, lineHeight:1.3 }}>{p.name}</div>
                        <div style={{ fontSize:10, color:DS.inkTer }}>{p.issueCount||0} issues · {p.strategyCount||0} strategies</div>
                      </td>
                      <td style={{ padding:"10px 12px", fontSize:11, color:DS.inkSub }}>{p.owner}</td>
                      <td style={{ padding:"10px 12px", fontSize:11, color:DS.inkTer }}>{p.date}</td>
                      <td style={{ padding:"10px 12px", textAlign:"center" }}>
                        <span style={{ fontSize:14, fontWeight:700,
                          fontFamily:"'Libre Baskerville',Georgia,serif",
                          color:scoreColor(p.overall) }}>{p.overall>0?p.overall:"—"}</span>
                      </td>
                      <td style={{ padding:"10px 12px" }}>
                        <Badge variant={p.id==="current"?"blue":p.status==="Archived"?"default":"green"} size="xs">
                          {p.id==="current"?"Active":p.status}
                        </Badge>
                      </td>
                      <td style={{ padding:"10px 12px" }}>
                        {p.id!=="current" && (
                          <button onClick={()=>deleteProject(p.id)}
                            style={{ background:"none", border:"none", cursor:"pointer", color:DS.inkDis }}>
                            <Svg path={ICONS.x} size={13} color={DS.inkTer}/>
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Element performance */}
            <div style={{ border:`1px solid ${DS.canvasBdr}`, borderRadius:9, overflow:"hidden" }}>
              <div style={{ padding:"11px 16px", background:DS.canvasAlt,
                borderBottom:`1px solid ${DS.canvasBdr}`, fontSize:11, fontWeight:700, color:DS.ink }}>
                DQ Element Performance
              </div>
              <div style={{ padding:"12px 14px" }}>
                {elementAverages.map((el, i) => (
                  <div key={el.key} style={{ marginBottom:12 }}>
                    <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:4 }}>
                      <span style={{ fontSize:13 }}>{el.icon}</span>
                      <span style={{ fontSize:11, fontWeight:700, color:DS.ink, flex:1 }}>{el.label}</span>
                      <span style={{ fontSize:12, fontWeight:700,
                        fontFamily:"'Libre Baskerville',Georgia,serif",
                        color:scoreColor(el.avg) }}>{el.avg>0?el.avg:"—"}</span>
                    </div>
                    <div style={{ height:5, background:DS.canvasBdr, borderRadius:3, overflow:"hidden" }}>
                      <div style={{ width:`${el.avg}%`, height:"100%", borderRadius:3,
                        background:scoreColor(el.avg), transition:"width .5s" }}/>
                    </div>
                    {i===0 && el.avg>0 && (
                      <div style={{ fontSize:9, color:DS.danger, fontWeight:700, marginTop:2 }}>
                        CONSISTENTLY WEAKEST
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
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
  const [accepted, setAccepted] = useState({});
  const [dragOver, setDragOver] = useState(false);
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
    const text = getInputText();
    if (!text.trim() || text.trim().length < 40) return;
    setPhase("analysing");
    setAnalysisProgress([]);

    const prompt = `You are a senior Decision Quality expert performing a deep-dive analysis of a decision problem.

Read the following input and produce a complete structured first draft for a Decision Quality framing exercise. Be specific — extract real details from the text, not generic placeholders.

=== INPUT ===
${text}
=== END INPUT ===

Return ONLY valid JSON:
{
  "projectName": "short project name from context",
  "executiveSummary": "2-3 sentence summary reframed through a DQ lens",
  "frame": {
    "decisionStatement": "precise decision statement starting with How should we... or What is the best...",
    "context": "business context from text",
    "background": "relevant history or strategic context",
    "trigger": "what precipitated this decision now",
    "symptoms": "observable symptoms vs root decision",
    "rootDecision": "underlying strategic choice",
    "scopeIn": "what is in scope",
    "scopeOut": "what should be out of scope",
    "timeHorizon": "time horizon",
    "deadline": "decision deadline",
    "owner": "decision owner",
    "stakeholders": [{"name":"name","role":"role","influence":"High|Medium|Low"}],
    "constraints": "hard constraints",
    "assumptions": "stated or implied assumptions",
    "successCriteria": "what good looks like",
    "failureConsequences": "consequences of poor decision",
    "urgency": "High — Decide within weeks",
    "importance": "Strategically significant",
    "confidence": "high|medium|low",
    "confidenceNote": "why this confidence level"
  },
  "issues": [
    {
      "text": "specific actionable issue statement",
      "type": "Risk|Opportunity|Constraint|Assumption|Stakeholder Concern|Operational|Financial|Technical|Strategic|Regulatory|Data Gap|Open Question|Dependency",
      "severity": "Critical|High|Medium|Low",
      "hat": "Team / Internal|Customer / Market|Competition|Risk / Downside|Regulator / External",
      "confidence": "high|medium|low",
      "source": "brief phrase from input that drove this inference"
    }
  ],
  "decisions": [
    {
      "label": "Decision label",
      "choices": ["Option A", "Option B", "Option C"],
      "tier": "given|focus|tactical|deferred|dependency",
      "owner": "who owns this",
      "rationale": "why in this tier",
      "confidence": "high|medium|low"
    }
  ],
  "criteria": [
    {
      "label": "criterion name",
      "type": "financial|strategic|operational|risk|commercial|technical",
      "weight": "high|medium|low",
      "description": "what this measures",
      "confidence": "high|medium|low"
    }
  ],
  "strategies": [
    {
      "name": "Strategy name",
      "description": "one sentence — what this strategy does",
      "rationale": "why this is a coherent distinct direction",
      "keyTheme": "central logic in 4-6 words",
      "confidence": "high|medium|low"
    }
  ],
  "dqObservations": ["Key DQ observation about the framing quality"],
  "weakestLink": "Which DQ element is weakest and why",
  "recommendedFirstStep": "Single most important thing to do first"
}

Generate 8-12 issues, 6-10 decisions across all tiers, 4-7 criteria, 2-4 strategies. Be specific to the actual content.`;

    const progressTimer = setInterval(() => {
      setAnalysisProgress(p => {
        if (p.length < ANALYSIS_STEPS.length) return [...p, ANALYSIS_STEPS[p.length].id];
        clearInterval(progressTimer);
        return p;
      });
    }, 950);

    call(prompt, (result) => {
      clearInterval(progressTimer);
      setAnalysisProgress(ANALYSIS_STEPS.map(s => s.id));
      if (result.error || result._raw) { setPhase("input"); return; }
      setDraft(result);
      setAccepted({ frame:true, issues:true, decisions:true, criteria:true, strategies:true });
      setTimeout(() => setPhase("review"), 600);
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

        {/* Four start paths */}
        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:12, marginBottom:24 }}>
          {[
            { mode:"paste",  icon:"📄", title:"AI Deep Dive",
              sub:"Best for most sessions",
              desc:"Paste any brief, memo or document. AI populates all modules in seconds.",
              accent:DS.accent },
            { mode:"guided", icon:"🗂", title:"Guided Questions",
              sub:"No document? Start here",
              desc:"Answer 5 structured questions and we build your first draft.",
              accent:"#7c3aed" },
          ].map(opt => (
            <button key={opt.mode}
              onClick={()=>{ setInputMode(opt.mode); setPhase("input"); }}
              style={{ padding:"18px 16px", background:DS.chromeMid,
                border:"1.5px solid "+DS.borderMid,
                borderRadius:10, cursor:"pointer", textAlign:"left",
                transition:"all .15s", fontFamily:"inherit" }}
              onMouseEnter={e=>{ e.currentTarget.style.borderColor=opt.accent; e.currentTarget.style.background=DS.chromeSub; }}
              onMouseLeave={e=>{ e.currentTarget.style.borderColor=DS.borderMid; e.currentTarget.style.background=DS.chromeMid; }}>
              <div style={{ fontSize:20, marginBottom:8 }}>{opt.icon}</div>
              <div style={{ fontSize:12, fontWeight:700, color:DS.textPri, marginBottom:2 }}>{opt.title}</div>
              <div style={{ fontSize:9, fontWeight:700, color:opt.accent,
                letterSpacing:.5, textTransform:"uppercase", marginBottom:8 }}>{opt.sub}</div>
              <div style={{ fontSize:10, color:DS.textTer, lineHeight:1.6 }}>{opt.desc}</div>
            </button>
          ))}

          {/* Start Clean */}
          <button
            onClick={()=>{ if(window.confirm("Start with completely empty modules?")) onSkip("clean"); }}
            style={{ padding:"18px 16px", background:"transparent",
              border:"1.5px dashed "+DS.border, borderRadius:10,
              cursor:"pointer", textAlign:"left", transition:"all .15s",
              fontFamily:"inherit" }}
            onMouseEnter={e=>{ e.currentTarget.style.borderColor=DS.textSec; e.currentTarget.style.background=DS.chromeMid; }}
            onMouseLeave={e=>{ e.currentTarget.style.borderColor=DS.border; e.currentTarget.style.background="transparent"; }}>
            <div style={{ fontSize:20, marginBottom:8 }}>◎</div>
            <div style={{ fontSize:12, fontWeight:700, color:DS.textPri, marginBottom:2 }}>Start Clean</div>
            <div style={{ fontSize:9, fontWeight:700, color:DS.textTer,
              letterSpacing:.5, textTransform:"uppercase", marginBottom:8 }}>Blank canvas</div>
            <div style={{ fontSize:10, color:DS.textTer, lineHeight:1.6 }}>
              Begin with empty modules and build everything from scratch.
            </div>
          </button>
        </div>

        {/* Load example */}
        <div style={{ padding:"13px 16px", background:DS.chromeMid,
          border:"1px solid "+DS.border, borderRadius:8,
          display:"flex", alignItems:"center", gap:12, marginBottom:8 }}>
          <div style={{ fontSize:18, flexShrink:0 }}>🏢</div>
          <div style={{ flex:1 }}>
            <div style={{ fontSize:12, fontWeight:700, color:DS.textPri, marginBottom:2 }}>
              Load Pre-built Example
            </div>
            <div style={{ fontSize:10, color:DS.textTer }}>
              APAC market entry case — fully populated with frame, issues, decisions, strategies and assessment.
            </div>
          </div>
          <button onClick={()=>onSkip("example")}
            style={{ padding:"7px 16px", background:DS.accent, border:"none",
              borderRadius:6, color:"#fff", fontSize:11, fontWeight:700,
              cursor:"pointer", fontFamily:"inherit", flexShrink:0 }}>
            Load Example →
          </button>
        </div>      </div>
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
  if (phase === "review" && draft) {
    const sections = [
      { key:"frame",      label:"Problem Definition",  count:null },
      { key:"issues",     label:"Issues",              count:draft.issues?.length },
      { key:"decisions",  label:"Decision Hierarchy",  count:draft.decisions?.length },
      { key:"criteria",   label:"Criteria",            count:draft.criteria?.length },
      { key:"strategies", label:"Strategies",          count:draft.strategies?.length },
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
            <div style={{ fontSize:13, fontWeight:700, color:DS.textPri }}>First Draft Ready — {draft.projectName}</div>
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

            {draft.executiveSummary && (
              <div style={{ marginBottom:18, paddingBottom:18, borderBottom:`1px solid ${DS.border}` }}>
                <div style={{ fontSize:9, fontWeight:700, color:DS.textTer, letterSpacing:1,
                  textTransform:"uppercase", marginBottom:8 }}>Executive Summary</div>
                <div style={{ fontSize:11, color:DS.textSec, lineHeight:1.65 }}>{draft.executiveSummary}</div>
              </div>
            )}

            {draft.dqObservations?.length > 0 && (
              <div style={{ marginBottom:18, paddingBottom:18, borderBottom:`1px solid ${DS.border}` }}>
                <div style={{ fontSize:9, fontWeight:700, color:DS.textTer, letterSpacing:1,
                  textTransform:"uppercase", marginBottom:8 }}>DQ Observations</div>
                {draft.dqObservations.map((obs,i) => (
                  <div key={i} style={{ fontSize:11, color:"#fbbf24", lineHeight:1.5, marginBottom:6,
                    paddingLeft:8, borderLeft:`2px solid #f59e0b` }}>{obs}</div>
                ))}
              </div>
            )}

            {draft.weakestLink && (
              <div style={{ marginBottom:18, paddingBottom:18, borderBottom:`1px solid ${DS.border}` }}>
                <div style={{ fontSize:9, fontWeight:700, color:DS.danger, letterSpacing:1,
                  textTransform:"uppercase", marginBottom:6 }}>Weakest DQ Link</div>
                <div style={{ fontSize:11, color:DS.textSec, lineHeight:1.5 }}>{draft.weakestLink}</div>
              </div>
            )}

            {draft.recommendedFirstStep && (
              <div>
                <div style={{ fontSize:9, fontWeight:700, color:DS.success, letterSpacing:1,
                  textTransform:"uppercase", marginBottom:6 }}>First Step</div>
                <div style={{ fontSize:11, color:DS.textSec, lineHeight:1.5 }}>{draft.recommendedFirstStep}</div>
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
            {accepted.frame && draft.frame && (
              <div style={{ marginBottom:16, border:`1px solid ${DS.canvasBdr}`, borderRadius:8,
                overflow:"hidden", background:DS.canvas }}>
                <div style={{ padding:"10px 16px", background:DS.canvasAlt,
                  borderBottom:`1px solid ${DS.canvasBdr}`, display:"flex", alignItems:"center", justifyContent:"space-between" }}>
                  <div style={{ fontSize:12, fontWeight:700, color:DS.ink }}>◎ Problem Definition</div>
                  <Badge variant={confVar(draft.frame.confidence)} size="xs">{draft.frame.confidence} confidence</Badge>
                </div>
                <div style={{ padding:"14px 16px", display:"grid", gridTemplateColumns:"1fr 1fr", gap:12 }}>
                  {[
                    ["Decision Statement", draft.frame.decisionStatement],
                    ["Owner", draft.frame.owner],
                    ["Trigger", draft.frame.trigger],
                    ["Deadline", draft.frame.deadline],
                    ["Scope In", draft.frame.scopeIn],
                    ["Scope Out", draft.frame.scopeOut],
                    ["Constraints", draft.frame.constraints],
                    ["Success Criteria", draft.frame.successCriteria],
                  ].filter(([,v])=>v).map(([label, val]) => (
                    <div key={label}>
                      <div style={{ fontSize:10, fontWeight:700, color:DS.inkTer,
                        letterSpacing:.6, textTransform:"uppercase", marginBottom:3 }}>{label}</div>
                      <div style={{ fontSize:12, color:DS.ink, lineHeight:1.5 }}>{val}</div>
                    </div>
                  ))}
                </div>
                {draft.frame.confidenceNote && (
                  <div style={{ padding:"8px 16px", borderTop:`1px solid ${DS.canvasBdr}`,
                    fontSize:11, color:DS.inkTer, fontStyle:"italic" }}>
                    ℹ {draft.frame.confidenceNote}
                  </div>
                )}
              </div>
            )}

            {/* ISSUES */}
            {accepted.issues && draft.issues?.length > 0 && (
              <div style={{ marginBottom:16, border:`1px solid ${DS.canvasBdr}`, borderRadius:8,
                overflow:"hidden", background:DS.canvas }}>
                <div style={{ padding:"10px 16px", background:DS.canvasAlt, borderBottom:`1px solid ${DS.canvasBdr}` }}>
                  <div style={{ fontSize:12, fontWeight:700, color:DS.ink }}>◈ Issues Raised — {draft.issues.length} identified</div>
                </div>
                <div style={{ maxHeight:260, overflowY:"auto" }}>
                  {draft.issues.map((issue, i) => (
                    <div key={i} style={{ padding:"9px 16px", display:"flex", alignItems:"flex-start", gap:10,
                      borderBottom:i<draft.issues.length-1?`1px solid ${DS.canvasBdr}`:"none" }}>
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
            {accepted.decisions && draft.decisions?.length > 0 && (
              <div style={{ marginBottom:16, border:`1px solid ${DS.canvasBdr}`, borderRadius:8,
                overflow:"hidden", background:DS.canvas }}>
                <div style={{ padding:"10px 16px", background:DS.canvasAlt, borderBottom:`1px solid ${DS.canvasBdr}` }}>
                  <div style={{ fontSize:12, fontWeight:700, color:DS.ink }}>◧ Decision Hierarchy — {draft.decisions.length} decisions</div>
                </div>
                <div style={{ padding:"12px 16px", display:"flex", flexDirection:"column", gap:10 }}>
                  {["given","focus","tactical","deferred","dependency"].map(tier => {
                    const td = draft.decisions.filter(d=>d.tier===tier);
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
            {accepted.criteria && draft.criteria?.length > 0 && (
              <div style={{ marginBottom:16, border:`1px solid ${DS.canvasBdr}`, borderRadius:8,
                overflow:"hidden", background:DS.canvas }}>
                <div style={{ padding:"10px 16px", background:DS.canvasAlt, borderBottom:`1px solid ${DS.canvasBdr}` }}>
                  <div style={{ fontSize:12, fontWeight:700, color:DS.ink }}>◫ Decision Criteria — {draft.criteria.length} criteria</div>
                </div>
                <div>
                  {draft.criteria.map((c,i) => (
                    <div key={i} style={{ padding:"9px 16px", display:"flex", alignItems:"center", gap:10,
                      borderBottom:i<draft.criteria.length-1?`1px solid ${DS.canvasBdr}`:"none" }}>
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
            {accepted.strategies && draft.strategies?.length > 0 && (
              <div style={{ marginBottom:16, border:`1px solid ${DS.canvasBdr}`, borderRadius:8,
                overflow:"hidden", background:DS.canvas }}>
                <div style={{ padding:"10px 16px", background:DS.canvasAlt, borderBottom:`1px solid ${DS.canvasBdr}` }}>
                  <div style={{ fontSize:12, fontWeight:700, color:DS.ink }}>⊞ Strategy Directions — {draft.strategies.length} directions</div>
                </div>
                <div style={{ padding:"12px 16px", display:"grid",
                  gridTemplateColumns:"repeat(auto-fill,minmax(220px,1fr))", gap:10 }}>
                  {draft.strategies.map((s,i) => {
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
  { id:"scenarios",  num:"05", label:"Scenario Planning",      sub:"Test across futures",       icon:"◈" },
  { id:"assessment", num:"06", label:"Qualitative Assessment", sub:"Score & compare",           icon:"◫" },
  { id:"scorecard",  num:"07", label:"DQ Scorecard",           sub:"Chain analysis",            icon:"◑" },
  { id:"export",     num:"08", label:"Export & Report",        sub:"Executive package",         icon:"◉" },
];
const PHASE2 = [
  { id:"influence",  num:"09", label:"Influence Map",          sub:"Uncertainty analysis",      icon:"⊕" },
  { id:"timeline",   num:"10", label:"Decision Risk Timeline", sub:"Time, gates & risk",       icon:"⊳" },
  { id:"voi",        num:"11", label:"Value of Information",   sub:"What to resolve first",    icon:"◎" },
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
function ToolsMenu({ onWorkshop, onVersions, onDqi, onDeepDive, onProject, onNew, aiBusy }) {
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
    { icon:"◌", label:"New Workspace",    sub:"Start a fresh decision",        action:onNew, highlight:true },
    { icon:"⊕", label:"AI Deep Dive",     sub:"Analyse a problem brief",       action:onDeepDive },
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
              onMouseEnter={e=>e.currentTarget.style.background=DS.chromeMid}
              onMouseLeave={e=>e.currentTarget.style.background="transparent"}>
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

/* ── MAIN APP ─────────────────────────────────────────────────────────────── */


/* ─────────────────────────────────────────────────────────────────────────────
   MODULE 09 — DECISION RISK TIMELINE
───────────────────────────────────────────────────────────────────────────── */

function ModuleTimeline({ decisions, strategies, issues, problem, aiCall, aiBusy, onAIMsg }) {

  // ── Object types per spec ─────────────────────────────────────────────────
  const OBJECT_TYPES = {
    gate:        { label:"Decision Gate",           color:"#2563eb", bg:"#eff4ff", icon:"▼", desc:"A critical decision point requiring readiness" },
    risk:        { label:"Risk Window",             color:"#dc2626", bg:"#fef2f2", icon:"▬", desc:"A period of elevated risk exposure" },
    uncertainty: { label:"Uncertainty Reduction",   color:"#d97706", bg:"#fffbeb", icon:"◎", desc:"Activity that reduces uncertainty before commitment" },
    trigger:     { label:"Trigger Event",           color:"#7c3aed", bg:"#f5f3ff", icon:"⚡", desc:"An event that activates a decision or path" },
    milestone:   { label:"Milestone",               color:"#059669", bg:"#ecfdf5", icon:"◆", desc:"A key achievement or delivery point" },
  };

  // ── State ─────────────────────────────────────────────────────────────────
  const [view, setView]           = useState("timeline"); // timeline | readiness | lanes
  const [events, setEvents]       = useState([]);
  const [risks, setRisks]         = useState([]);
  const [selected, setSelected]   = useState(null);
  const [generating, setGenerating] = useState(false);
  const [showAdd, setShowAdd]     = useState(false);
  const [addType, setAddType]     = useState("gate");
  const [addLabel, setAddLabel]   = useState("");
  const [addDate, setAddDate]     = useState("");
  const [addEnd, setAddEnd]       = useState("");
  const [zoom, setZoom]           = useState(1);
  const canvasRef = useRef(null);

  const selectedEvent = events.find(e=>e.id===selected) || risks.find(r=>r.id===selected);

  // ── Helpers ───────────────────────────────────────────────────────────────
  const getDateRange = () => {
    const allDates = [
      ...events.map(e=>e.date),
      ...risks.map(r=>r.startDate),
      ...risks.map(r=>r.endDate),
    ].filter(Boolean).map(d=>new Date(d));
    if (allDates.length === 0) {
      const now = new Date();
      return { min: now, max: new Date(now.getFullYear()+3, 0, 1) };
    }
    const min = new Date(Math.min(...allDates));
    const max = new Date(Math.max(...allDates));
    // Add padding
    min.setMonth(min.getMonth()-2);
    max.setMonth(max.getMonth()+3);
    return { min, max };
  };

  const dateToX = (dateStr, canvasW) => {
    const { min, max } = getDateRange();
    const d = new Date(dateStr);
    const total = max - min;
    return total > 0 ? ((d - min) / total) * canvasW : 0;
  };

  const addEvent = () => {
    if (!addLabel.trim() || !addDate) return;
    const ev = {
      id: uid("ev"), type: addType, label: addLabel.trim(),
      date: addDate, endDate: addEnd||null,
      description: "", owner: "", readinessScore: 50,
      unresolvedUncertainties: [], dependencies: [],
    };
    if (addType === "risk") {
      setRisks(prev=>[...prev, {...ev, startDate:addDate}]);
    } else {
      setEvents(prev=>[...prev, ev]);
    }
    setAddLabel(""); setAddDate(""); setAddEnd("");
    setShowAdd(false);
  };

  const updateEvent = (id, patch) => {
    setEvents(prev=>prev.map(e=>e.id===id?{...e,...patch}:e));
    setRisks(prev=>prev.map(r=>r.id===id?{...r,...patch}:r));
  };

  const removeEvent = (id) => {
    setEvents(prev=>prev.filter(e=>e.id!==id));
    setRisks(prev=>prev.filter(r=>r.id!==id));
    if (selected===id) setSelected(null);
  };

  // ── AI Generate ───────────────────────────────────────────────────────────
  const generateTimeline = () => {
    setGenerating(true);
    const decList = decisions.filter(d=>d.tier==="focus").map(d=>d.label).join(", ");
    const issueList = issues.filter(i=>i.severity==="Critical"||i.severity==="High")
      .slice(0,5).map(i=>i.text.slice(0,60)).join("; ");
    const today = new Date().toISOString().slice(0,10);

    aiCall(
      "You are a decision risk analyst building a Decision Risk Timeline. " +
      "Decision: " + (problem.decisionStatement||"Not defined") + ". " +
      "Focus decisions: " + (decList||"none") + ". " +
      "Key risks: " + (issueList||"none") + ". " +
      "Today is: " + today + ". " +
      "Generate a realistic decision risk timeline for the next 18-36 months. Include: " +
      "3-5 decision gates (critical go/no-go points), " +
      "2-4 risk windows (periods of elevated exposure), " +
      "2-3 uncertainty reduction activities, " +
      "1-2 trigger events. " +
      "Use realistic dates starting from today. " +
      'Return ONLY JSON: {"events":[{"type":"gate","label":"FID","date":"2026-06-01","description":"Final investment decision","owner":"CEO","readinessScore":45}],' +
      '"risks":[{"type":"risk","label":"Regulatory Risk Window","startDate":"2026-01-01","endDate":"2026-04-01","description":"Election period creates regulatory uncertainty","severity":"high"}],' +
      '"insight":"Key observation about the timeline"}',
    (r)=>{
      let result = r;
      if (r._raw) { try { result=JSON.parse(r._raw.replace(/```json|```/g,"").trim()); } catch(e) { setGenerating(false); onAIMsg({role:"ai",text:"Could not parse timeline response."}); return; } }
      if (result.error) { setGenerating(false); onAIMsg({role:"ai",text:"AI error: "+result.error}); return; }
      if (result.events?.length) {
        const newEvs = result.events.map(e=>({
          id:uid("ev"), type:e.type||"gate", label:e.label,
          date:e.date, description:e.description||"",
          owner:e.owner||"", readinessScore:e.readinessScore||50,
          unresolvedUncertainties:[], dependencies:[],
        }));
        setEvents(prev=>[...prev,...newEvs]);
      }
      if (result.risks?.length) {
        const newRisks = result.risks.map(r=>({
          id:uid("rk"), type:"risk", label:r.label,
          startDate:r.startDate, endDate:r.endDate,
          description:r.description||"",
          severity:r.severity||"medium",
        }));
        setRisks(prev=>[...prev,...newRisks]);
      }
      onAIMsg({role:"ai",text:result.insight||("Timeline generated with "+( result.events?.length||0)+" events and "+(result.risks?.length||0)+" risk windows.")});
      setGenerating(false);
    });
  };

  // ── Timeline canvas ───────────────────────────────────────────────────────
  const CANVAS_W = 1200 * zoom;
  const LANE_H = 64;
  const LANES = [
    { id:"gates",         label:"Decision Gates",          types:["gate"],        color:"#2563eb" },
    { id:"triggers",      label:"Triggers & Milestones",   types:["trigger","milestone"], color:"#7c3aed" },
    { id:"uncertainty",   label:"Uncertainty Reduction",   types:["uncertainty"], color:"#d97706" },
    { id:"risks",         label:"Risk Windows",            types:["risk"],        color:"#dc2626" },
  ];

  const { min: dateMin, max: dateMax } = getDateRange();
  const totalMs = dateMax - dateMin;

  const getX = (dateStr) => {
    if (!dateStr) return 0;
    const d = new Date(dateStr);
    return totalMs > 0 ? ((d - dateMin) / totalMs) * CANVAS_W : 0;
  };

  // Generate month ticks
  const monthTicks = [];
  const cursor = new Date(dateMin);
  cursor.setDate(1);
  while (cursor < dateMax) {
    monthTicks.push(new Date(cursor));
    cursor.setMonth(cursor.getMonth()+1);
  }

  const svgH = LANES.length * LANE_H + 60; // 60 for header

  return (
    <div style={{ display:"flex", flexDirection:"column", height:"100%", overflow:"hidden" }}>

      {/* Header */}
      <div style={{ padding:"14px 24px", background:DS.canvas,
        borderBottom:"1px solid "+DS.canvasBdr,
        display:"flex", alignItems:"center", gap:12, flexShrink:0, flexWrap:"wrap" }}>
        <div style={{ flex:1 }}>
          <div style={{ fontSize:10, color:DS.inkTer, letterSpacing:1,
            textTransform:"uppercase", fontWeight:700, marginBottom:2 }}>Module 09</div>
          <div style={{ fontFamily:"'Libre Baskerville',Georgia,serif",
            fontSize:20, fontWeight:700, color:DS.ink }}>Decision Risk Timeline</div>
        </div>

        {/* View tabs */}
        <div style={{ display:"flex", border:"1px solid "+DS.canvasBdr,
          borderRadius:7, overflow:"hidden" }}>
          {[{id:"timeline",label:"Timeline"},{id:"readiness",label:"Readiness"},{id:"register",label:"Event Register"}].map(v=>(
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

        {/* Zoom */}
        {view==="timeline" && (
          <div style={{ display:"flex", alignItems:"center", gap:6 }}>
            <button onClick={()=>setZoom(z=>Math.max(0.5,z-0.25))}
              style={{ width:24,height:24,borderRadius:4,border:"1px solid "+DS.canvasBdr,
                background:"transparent",cursor:"pointer",fontFamily:"inherit",fontSize:14 }}>−</button>
            <span style={{ fontSize:10,color:DS.inkTer,width:36,textAlign:"center" }}>{Math.round(zoom*100)}%</span>
            <button onClick={()=>setZoom(z=>Math.min(2.5,z+0.25))}
              style={{ width:24,height:24,borderRadius:4,border:"1px solid "+DS.canvasBdr,
                background:"transparent",cursor:"pointer",fontFamily:"inherit",fontSize:14 }}>+</button>
          </div>
        )}

        <Btn variant="secondary" size="sm" onClick={()=>setShowAdd(p=>!p)}>+ Add Event</Btn>
        <Btn variant="primary" icon="spark" size="sm"
          onClick={generateTimeline} disabled={aiBusy||generating}>
          {generating?"Generating…":"AI Generate"}
        </Btn>
      </div>

      {/* Add event panel */}
      {showAdd && (
        <div style={{ padding:"12px 24px", background:DS.accentSoft,
          borderBottom:"1px solid "+DS.accentLine,
          display:"flex", gap:10, alignItems:"center", flexWrap:"wrap" }}>
          <span style={{ fontSize:11, fontWeight:700, color:DS.accent }}>Type:</span>
          {Object.entries(OBJECT_TYPES).map(([key,ot])=>(
            <button key={key} onClick={()=>setAddType(key)}
              style={{ padding:"3px 10px", fontSize:10, fontWeight:700,
                fontFamily:"inherit", cursor:"pointer",
                border:"1.5px solid "+(addType===key?ot.color:DS.canvasBdr),
                borderRadius:5, background:addType===key?ot.bg:"transparent",
                color:addType===key?ot.color:DS.inkSub }}>
              {ot.icon} {ot.label}
            </button>
          ))}
          <input value={addLabel} onChange={e=>setAddLabel(e.target.value)}
            placeholder="Label..."
            style={{ padding:"5px 9px", fontSize:11, fontFamily:"inherit",
              background:DS.canvas, border:"1px solid "+DS.accentLine,
              borderRadius:5, color:DS.ink, outline:"none", width:180 }}/>
          <input type="date" value={addDate} onChange={e=>setAddDate(e.target.value)}
            style={{ padding:"5px 9px", fontSize:11, fontFamily:"inherit",
              background:DS.canvas, border:"1px solid "+DS.accentLine,
              borderRadius:5, color:DS.ink, outline:"none" }}/>
          {(addType==="risk") && (
            <input type="date" value={addEnd} onChange={e=>setAddEnd(e.target.value)}
              placeholder="End date"
              style={{ padding:"5px 9px", fontSize:11, fontFamily:"inherit",
                background:DS.canvas, border:"1px solid "+DS.accentLine,
                borderRadius:5, color:DS.ink, outline:"none" }}/>
          )}
          <Btn variant="primary" size="sm" onClick={addEvent}>Add</Btn>
          <Btn variant="secondary" size="sm" onClick={()=>setShowAdd(false)}>Cancel</Btn>
        </div>
      )}

      {/* Main content */}
      <div style={{ flex:1, overflow:"hidden", display:"flex" }}>

        {/* ── TIMELINE VIEW ─────────────────────────────────────────── */}
        {view==="timeline" && (
          <div style={{ flex:1, overflow:"auto", background:"#fafbfc" }}>
            {events.length===0 && risks.length===0 ? (
              <div style={{ display:"flex", flexDirection:"column",
                alignItems:"center", justifyContent:"center",
                height:"100%", color:DS.inkTer, gap:12 }}>
                <div style={{ fontSize:32 }}>⊳</div>
                <div style={{ fontSize:14, fontWeight:600 }}>No timeline events yet</div>
                <div style={{ fontSize:12 }}>Click "+ Add Event" or use "AI Generate" to build your timeline.</div>
              </div>
            ) : (
              <div style={{ minWidth:CANVAS_W+200, padding:"0 0 24px" }}>
                <svg width={CANVAS_W+200} height={svgH}
                  style={{ display:"block", fontFamily:"'IBM Plex Sans',sans-serif" }}>

                  {/* Lane backgrounds */}
                  {LANES.map((lane,li)=>(
                    <g key={lane.id}>
                      <rect x={120} y={40+li*LANE_H} width={CANVAS_W}
                        height={LANE_H}
                        fill={li%2===0?"#f8f9fb":"#f2f4f7"} stroke="#e5e7eb" strokeWidth={0.5}/>
                      {/* Lane label */}
                      <text x={8} y={40+li*LANE_H+LANE_H/2+5}
                        fontSize={9} fontWeight={700} fill={lane.color}
                        textAnchor="start"
                        style={{ textTransform:"uppercase", letterSpacing:0.5 }}>
                        {lane.label.split(" ").map((w,wi)=>(
                          <tspan key={wi} x={8} dy={wi===0?(li===0?0:-5):12}>{w}</tspan>
                        ))}
                      </text>
                    </g>
                  ))}

                  {/* Month ticks */}
                  {monthTicks.map((tick,ti)=>{
                    const x = 120 + ((tick - dateMin) / totalMs) * CANVAS_W;
                    const isYear = tick.getMonth()===0;
                    return (
                      <g key={ti}>
                        <line x1={x} y1={40} x2={x} y2={40+LANES.length*LANE_H}
                          stroke={isYear?"#9ca3af":"#e5e7eb"}
                          strokeWidth={isYear?1:0.5}
                          strokeDasharray={isYear?"none":"4,2"}/>
                        <text x={x} y={32} textAnchor="middle"
                          fontSize={isYear?10:8}
                          fontWeight={isYear?700:400}
                          fill={isYear?"#374151":"#9ca3af"}>
                          {isYear
                            ? tick.getFullYear()
                            : tick.toLocaleString("default",{month:"short"})}
                        </text>
                      </g>
                    );
                  })}

                  {/* Today line */}
                  {(()=>{
                    const todayX = 120 + getX(new Date().toISOString().slice(0,10));
                    return (
                      <g>
                        <line x1={todayX} y1={36} x2={todayX}
                          y2={40+LANES.length*LANE_H}
                          stroke="#2563eb" strokeWidth={2}/>
                        <text x={todayX} y={15} textAnchor="middle"
                          fontSize={9} fontWeight={700} fill="#2563eb">TODAY</text>
                        <rect x={todayX-18} y={18} width={36} height={14}
                          rx={3} fill="#2563eb" opacity={0.1}/>
                      </g>
                    );
                  })()}

                  {/* Risk windows */}
                  {risks.map(rk=>{
                    const x1 = 120 + getX(rk.startDate);
                    const x2 = 120 + getX(rk.endDate||rk.startDate);
                    const laneY = 40 + 3*LANE_H; // risks lane
                    const sev = rk.severity;
                    const col = sev==="high"?"#dc2626":sev==="medium"?"#d97706":"#059669";
                    return (
                      <g key={rk.id} style={{ cursor:"pointer" }}
                        onClick={()=>setSelected(sel=>sel===rk.id?null:rk.id)}>
                        <rect x={x1} y={laneY+4} width={Math.max(8,x2-x1)}
                          height={LANE_H-8} rx={4}
                          fill={col} fillOpacity={selected===rk.id?0.4:0.18}
                          stroke={col} strokeWidth={selected===rk.id?2:1}/>
                        {(x2-x1)>45 && <text x={x1+8} y={laneY+LANE_H/2+4} fontSize={8} fontWeight={600} fill={col}>{rk.label.slice(0,Math.max(5,Math.floor((x2-x1)/7)))}{rk.label.length>Math.floor((x2-x1)/7)?"…":""}</text>}
                      </g>
                    );
                  })}

                  {/* Events */}
                  {events.map((ev,evIdx)=>{
                    const ot = OBJECT_TYPES[ev.type]||OBJECT_TYPES.milestone;
                    const laneIdx = LANES.findIndex(l=>l.types.includes(ev.type));
                    const laneY = 40 + (laneIdx>=0?laneIdx:0)*LANE_H;
                    const x = 120 + getX(ev.date);
                    const isSel = selected===ev.id;

                    if (ev.type==="gate") {
                      // Diamond marker for gates
                      const r = ev.readinessScore||0;
                      const color = r>=70?DS.success:r>=40?DS.warning:DS.danger;
                      return (
                        <g key={ev.id} style={{ cursor:"pointer" }}
                          onClick={()=>setSelected(sel=>sel===ev.id?null:ev.id)}>
                          {/* Vertical line */}
                          <line x1={x} y1={40} x2={x} y2={40+LANES.length*LANE_H}
                            stroke={ot.color} strokeWidth={isSel?2:1.5}
                            strokeDasharray="5,3" opacity={0.6}/>
                          {/* Diamond */}
                          <polygon points={x+","+laneY+" "+(x+10)+","+(laneY+LANE_H/2)+" "+x+","+(laneY+LANE_H)+" "+(x-10)+","+(laneY+LANE_H/2)}
                            fill={isSel?ot.color:ot.bg} stroke={ot.color} strokeWidth={2}/>
                          {/* Label above */}
                          {/* Staggered label with pill background */}
                          {(() => {
                            const gi = events.filter(e=>e.type==="gate").indexOf(ev);
                            const off = (gi%3)*13;
                            const lbl = ev.label.length>22?ev.label.slice(0,20)+"…":ev.label;
                            const ly = laneY - 10 - off;
                            return (
                              <g>
                                {off>0&&<line x1={x} y1={ly+3} x2={x} y2={laneY} stroke={ot.color} strokeWidth={0.5} strokeDasharray="2,2" opacity={0.4}/>}
                                <rect x={x-lbl.length*3.5-4} y={ly-11} width={lbl.length*7+8} height={14} rx={3} fill={isSel?ot.color:ot.bg} stroke={ot.color} strokeWidth={1}/>
                                <text x={x} y={ly} textAnchor="middle" fontSize={9} fontWeight={700} fill={isSel?"#fff":ot.color}>{lbl}</text>
                              </g>
                            );
                          })()}
                          {/* Readiness badge */}
                          <rect x={x-12} y={laneY+LANE_H} width={24} height={12}
                            rx={3} fill={color} opacity={0.9}/>
                          <text x={x} y={laneY+LANE_H+9} textAnchor="middle"
                            fontSize={8} fontWeight={700} fill="white">
                            {r}%
                          </text>
                        </g>
                      );
                    }

                    return (
                      <g key={ev.id} style={{ cursor:"pointer" }}
                        onClick={()=>setSelected(sel=>sel===ev.id?null:ev.id)}>
                        <circle cx={x} cy={laneY+LANE_H/2} r={isSel?10:7}
                          fill={isSel?ot.color:ot.bg} stroke={ot.color} strokeWidth={2}/>
                        <text x={x} y={laneY+LANE_H/2+3.5} textAnchor="middle"
                          fontSize={8} fill={isSel?"white":ot.color}>{ot.icon}</text>
                        <text x={x+14} y={laneY+LANE_H/2+4}
                          fontSize={9} fontWeight={600} fill={ot.color}>
                          {ev.label.slice(0,20)}{ev.label.length>20?"…":""}
                        </text>
                      </g>
                    );
                  })}

                </svg>
              </div>
            )}
          </div>
        )}

        {/* ── READINESS VIEW ─────────────────────────────────────────── */}
        {view==="readiness" && (
          <div style={{ flex:1, overflowY:"auto", padding:24 }}>
            <div style={{ marginBottom:16 }}>
              <div style={{ fontSize:13, fontWeight:700, color:DS.ink, marginBottom:4 }}>
                Decision Gate Readiness
              </div>
              <div style={{ fontSize:11, color:DS.inkTer }}>
                How ready is each decision gate? Track unresolved uncertainties and confidence levels.
              </div>
            </div>
            {events.filter(e=>e.type==="gate").length===0 ? (
              <div style={{ padding:"40px", textAlign:"center", color:DS.inkTer, fontSize:13,
                border:"1.5px dashed "+DS.canvasMid, borderRadius:10 }}>
                No decision gates yet. Add gates in the Timeline view or use AI Generate.
              </div>
            ) : events.filter(e=>e.type==="gate").map(gate=>{
              const r = gate.readinessScore||0;
              const color = r>=70?DS.success:r>=40?DS.warning:DS.danger;
              const ot = OBJECT_TYPES.gate;
              return (
                <div key={gate.id} style={{ padding:"18px 20px", marginBottom:14,
                  background:DS.canvas, border:"1px solid "+DS.canvasBdr,
                  borderRadius:10, borderLeft:"4px solid "+color }}>
                  <div style={{ display:"flex", alignItems:"flex-start",
                    gap:14, marginBottom:12 }}>
                    <div style={{ textAlign:"center", flexShrink:0 }}>
                      <div style={{ fontFamily:"'Libre Baskerville',serif",
                        fontSize:28, fontWeight:700, color,
                        lineHeight:1 }}>{r}%</div>
                      <div style={{ fontSize:9, color:DS.inkTer,
                        fontWeight:700, textTransform:"uppercase" }}>Ready</div>
                    </div>
                    <div style={{ flex:1 }}>
                      <div style={{ fontSize:14, fontWeight:700, color:DS.ink,
                        marginBottom:3 }}>{gate.label}</div>
                      <div style={{ fontSize:11, color:DS.inkTer }}>
                        {gate.date ? new Date(gate.date).toLocaleDateString("en-GB",{day:"numeric",month:"long",year:"numeric"}) : "No date set"}
                        {gate.owner ? " · Owner: "+gate.owner : ""}
                      </div>
                    </div>
                    {/* Readiness slider */}
                    <div style={{ display:"flex", flexDirection:"column",
                      alignItems:"center", gap:4, flexShrink:0 }}>
                      <input type="range" min={0} max={100}
                        value={gate.readinessScore||0}
                        onChange={e=>updateEvent(gate.id,{readinessScore:+e.target.value})}
                        style={{ width:100 }}/>
                      <span style={{ fontSize:9, color:DS.inkTer }}>Adjust readiness</span>
                    </div>
                  </div>

                  {/* Progress bar */}
                  <div style={{ height:6, background:DS.canvasBdr,
                    borderRadius:3, overflow:"hidden", marginBottom:12 }}>
                    <div style={{ width:r+"%", height:"100%", background:color,
                      borderRadius:3, transition:"width .3s" }}/>
                  </div>

                  {/* Description */}
                  <textarea value={gate.description||""}
                    onChange={e=>updateEvent(gate.id,{description:e.target.value})}
                    placeholder="What inputs and conditions are required for this gate? What remains unresolved?"
                    rows={2}
                    style={{ width:"100%", padding:"7px 9px", fontSize:11,
                      fontFamily:"inherit", background:DS.canvasAlt,
                      border:"1px solid "+DS.canvasBdr, borderRadius:5,
                      color:DS.ink, outline:"none", resize:"none",
                      lineHeight:1.5, boxSizing:"border-box", marginBottom:10 }}/>

                  {/* Status badge */}
                  <div style={{ display:"flex", gap:8, alignItems:"center" }}>
                    <span style={{ fontSize:10, padding:"2px 9px", borderRadius:4,
                      fontWeight:700, background:color+"20", color,
                      border:"1px solid "+color+"40" }}>
                      {r>=70?"READY TO DECIDE":r>=40?"IN PROGRESS":"NOT READY"}
                    </span>
                    {r < 50 && (
                      <span style={{ fontSize:10, color:DS.danger }}>
                        ⚠ High uncertainty — resolve critical unknowns before committing
                      </span>
                    )}
                    <button onClick={()=>removeEvent(gate.id)}
                      style={{ marginLeft:"auto", background:"none", border:"none",
                        cursor:"pointer", color:"#9ca3af", fontSize:12 }}>
                      Remove gate
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* ── EVENT REGISTER VIEW ─────────────────────────────────────── */}
        {view==="register" && (
          <div style={{ flex:1, overflowY:"auto", padding:24 }}>
            {[...events, ...risks].length===0 ? (
              <div style={{ padding:"40px", textAlign:"center", color:DS.inkTer,
                fontSize:13, border:"1.5px dashed "+DS.canvasMid, borderRadius:10 }}>
                No events yet. Add events or use AI Generate.
              </div>
            ) : (
              <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
                {/* Group by type */}
                {Object.entries(OBJECT_TYPES).map(([type,ot])=>{
                  const typeEvs = type==="risk"
                    ? risks
                    : events.filter(e=>e.type===type);
                  if (typeEvs.length===0) return null;
                  return (
                    <div key={type}>
                      <div style={{ fontSize:10, fontWeight:700, color:ot.color,
                        letterSpacing:.6, textTransform:"uppercase",
                        marginBottom:6, display:"flex", alignItems:"center", gap:6 }}>
                        {ot.icon} {ot.label} ({typeEvs.length})
                      </div>
                      {typeEvs.map(ev=>(
                        <div key={ev.id} style={{ padding:"12px 16px", marginBottom:6,
                          background:ot.bg, border:"1px solid "+ot.color+"30",
                          borderRadius:8, borderLeft:"3px solid "+ot.color,
                          display:"flex", alignItems:"flex-start", gap:12 }}>
                          <div style={{ flex:1 }}>
                            <div style={{ fontSize:12, fontWeight:700,
                              color:ot.color, marginBottom:2 }}>{ev.label}</div>
                            <div style={{ fontSize:10, color:DS.inkTer }}>
                              {ev.date||ev.startDate
                                ? new Date(ev.date||ev.startDate).toLocaleDateString("en-GB",{month:"short",year:"numeric"})
                                : "No date"}
                              {ev.endDate
                                ? " → "+new Date(ev.endDate).toLocaleDateString("en-GB",{month:"short",year:"numeric"})
                                : ""}
                              {ev.owner ? " · "+ev.owner : ""}
                              {ev.severity ? " · "+ev.severity+" severity" : ""}
                            </div>
                            {ev.description && (
                              <div style={{ fontSize:11, color:DS.inkSub,
                                marginTop:3 }}>{ev.description}</div>
                            )}
                          </div>
                          {ev.type==="gate" && (
                            <div style={{ fontSize:12, fontWeight:700,
                              color:ev.readinessScore>=70?DS.success:ev.readinessScore>=40?DS.warning:DS.danger,
                              flexShrink:0 }}>
                              {ev.readinessScore||0}% ready
                            </div>
                          )}
                          <button onClick={()=>removeEvent(ev.id)}
                            style={{ background:"none", border:"none",
                              cursor:"pointer", color:"#9ca3af",
                              fontSize:14, flexShrink:0 }}>×</button>
                        </div>
                      ))}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

      </div>

      {/* Detail panel - slides in when event selected */}
      {selected && selectedEvent && (
        <div style={{ position:"absolute", right:0, top:0, bottom:0, width:280,
          background:DS.canvas, borderLeft:"1px solid "+DS.canvasBdr,
          boxShadow:"-4px 0 20px rgba(0,0,0,.08)",
          display:"flex", flexDirection:"column",
          zIndex:10, overflowY:"auto" }}>
          <div style={{ padding:"14px 16px", borderBottom:"1px solid "+DS.canvasBdr,
            display:"flex", alignItems:"center", gap:8 }}>
            <div style={{ flex:1, fontSize:13, fontWeight:700, color:DS.ink }}>
              {selectedEvent.label}
            </div>
            <button onClick={()=>setSelected(null)}
              style={{ background:"none", border:"none",
                cursor:"pointer", color:DS.inkTer, fontSize:16 }}>×</button>
          </div>
          <div style={{ padding:"14px 16px", flex:1 }}>
            {(() => {
              const ot = OBJECT_TYPES[selectedEvent.type]||OBJECT_TYPES.milestone;
              return (
                <div>
                  <div style={{ fontSize:9, fontWeight:700, color:ot.color,
                    letterSpacing:.6, textTransform:"uppercase",
                    marginBottom:12 }}>{ot.icon} {ot.label}</div>

                  <div style={{ marginBottom:10 }}>
                    <div style={{ fontSize:10, fontWeight:700, color:DS.inkTer,
                      marginBottom:4, textTransform:"uppercase", letterSpacing:.5 }}>Label</div>
                    <input value={selectedEvent.label}
                      onChange={e=>updateEvent(selected,{label:e.target.value})}
                      style={{ width:"100%", padding:"6px 8px", fontSize:12,
                        fontFamily:"inherit", background:DS.canvasAlt,
                        border:"1px solid "+DS.canvasBdr, borderRadius:5,
                        color:DS.ink, outline:"none", boxSizing:"border-box" }}/>
                  </div>

                  <div style={{ marginBottom:10 }}>
                    <div style={{ fontSize:10, fontWeight:700, color:DS.inkTer,
                      marginBottom:4, textTransform:"uppercase", letterSpacing:.5 }}>Date</div>
                    <input type="date"
                      value={selectedEvent.date||selectedEvent.startDate||""}
                      onChange={e=>updateEvent(selected,{date:e.target.value,startDate:e.target.value})}
                      style={{ width:"100%", padding:"6px 8px", fontSize:12,
                        fontFamily:"inherit", background:DS.canvasAlt,
                        border:"1px solid "+DS.canvasBdr, borderRadius:5,
                        color:DS.ink, outline:"none" }}/>
                  </div>

                  {selectedEvent.type==="risk" && (
                    <div style={{ marginBottom:10 }}>
                      <div style={{ fontSize:10, fontWeight:700, color:DS.inkTer,
                        marginBottom:4, textTransform:"uppercase", letterSpacing:.5 }}>End Date</div>
                      <input type="date" value={selectedEvent.endDate||""}
                        onChange={e=>updateEvent(selected,{endDate:e.target.value})}
                        style={{ width:"100%", padding:"6px 8px", fontSize:12,
                          fontFamily:"inherit", background:DS.canvasAlt,
                          border:"1px solid "+DS.canvasBdr, borderRadius:5,
                          color:DS.ink, outline:"none" }}/>
                    </div>
                  )}

                  {selectedEvent.type==="gate" && (
                    <div style={{ marginBottom:10 }}>
                      <div style={{ fontSize:10, fontWeight:700, color:DS.inkTer,
                        marginBottom:4, textTransform:"uppercase", letterSpacing:.5 }}>
                        Readiness Score
                      </div>
                      <div style={{ display:"flex", alignItems:"center", gap:8 }}>
                        <input type="range" min={0} max={100}
                          value={selectedEvent.readinessScore||0}
                          onChange={e=>updateEvent(selected,{readinessScore:+e.target.value})}
                          style={{ flex:1 }}/>
                        <span style={{ fontSize:12, fontWeight:700,
                          color:selectedEvent.readinessScore>=70?DS.success:selectedEvent.readinessScore>=40?DS.warning:DS.danger }}>
                          {selectedEvent.readinessScore||0}%
                        </span>
                      </div>
                    </div>
                  )}

                  {selectedEvent.type==="risk" && (
                    <div style={{ marginBottom:10 }}>
                      <div style={{ fontSize:10, fontWeight:700, color:DS.inkTer,
                        marginBottom:4, textTransform:"uppercase", letterSpacing:.5 }}>Severity</div>
                      <select value={selectedEvent.severity||"medium"}
                        onChange={e=>updateEvent(selected,{severity:e.target.value})}
                        style={{ width:"100%", padding:"6px 8px", fontSize:12,
                          fontFamily:"inherit", background:DS.canvasAlt,
                          border:"1px solid "+DS.canvasBdr, borderRadius:5,
                          color:DS.ink, outline:"none" }}>
                        <option value="high">High</option>
                        <option value="medium">Medium</option>
                        <option value="low">Low</option>
                      </select>
                    </div>
                  )}

                  <div style={{ marginBottom:10 }}>
                    <div style={{ fontSize:10, fontWeight:700, color:DS.inkTer,
                      marginBottom:4, textTransform:"uppercase", letterSpacing:.5 }}>Owner</div>
                    <input value={selectedEvent.owner||""}
                      onChange={e=>updateEvent(selected,{owner:e.target.value})}
                      placeholder="Decision owner..."
                      style={{ width:"100%", padding:"6px 8px", fontSize:12,
                        fontFamily:"inherit", background:DS.canvasAlt,
                        border:"1px solid "+DS.canvasBdr, borderRadius:5,
                        color:DS.ink, outline:"none", boxSizing:"border-box" }}/>
                  </div>

                  <div style={{ marginBottom:10 }}>
                    <div style={{ fontSize:10, fontWeight:700, color:DS.inkTer,
                      marginBottom:4, textTransform:"uppercase", letterSpacing:.5 }}>Description</div>
                    <textarea value={selectedEvent.description||""}
                      onChange={e=>updateEvent(selected,{description:e.target.value})}
                      placeholder="Context, criteria, dependencies..."
                      rows={4}
                      style={{ width:"100%", padding:"6px 8px", fontSize:11,
                        fontFamily:"inherit", background:DS.canvasAlt,
                        border:"1px solid "+DS.canvasBdr, borderRadius:5,
                        color:DS.ink, outline:"none", resize:"vertical",
                        lineHeight:1.5, boxSizing:"border-box" }}/>
                  </div>

                  <button onClick={()=>removeEvent(selected)}
                    style={{ width:"100%", padding:"7px", fontSize:11,
                      fontFamily:"inherit", background:"transparent",
                      border:"1px solid "+DS.dangerLine, borderRadius:6,
                      color:DS.danger, cursor:"pointer", fontWeight:700 }}>
                    Remove Event
                  </button>
                </div>
              );
            })()}
          </div>
        </div>
      )}
    </div>
  );
}





/* ── MAIN APP ─────────────────────────────────── */


const HARDCODED_API_KEY = null;

export default function App() {
  const [module, setModule]               = useState("problem");
  const [customTabs, setCustomTabs]       = useState([]);
  const [influenceNodes, setInfluenceNodes] = useState([]);
  const [influenceEdges, setInfluenceEdges] = useState([]);
  const [showTabPicker, setShowTabPicker] = useState(false);
  const [showCrossModule, setShowCrossModule] = useState(false);
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

  const { busy: aiBusy, call: aiCall } = useAI();
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
    pushAIMsg({ role:"ai", text:`First draft loaded. Project: "${draft.projectName||"Untitled"}". Review each module and refine with your team.` });
    // Show onboarding after first draft load if not seen before
    try { if (!localStorage.getItem("vantage_onboarded")) setOnboardingStep(0); } catch {}
  };

  const handleAISend = (text) => {
    pushAIMsg({ role:"user", text });
    const ctx = `Project:"${problem.projectName||problem.decisionStatement}" | Module:${module} | Issues:${issues.length} | Focus:${decisions.filter(d=>d.tier==="focus").length} | Strategies:${strategies.length} | Criteria:${criteria.length}`;
    aiCall(`You are a DQ expert facilitator. Context: ${ctx}\n\nQuestion: "${text}"\n\nReply in 80 words or less. Plain text only.`,
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
    strategy: { decisions, strategies, onChange:setStrategies, aiCall, aiBusy, problem, onAIMsg:pushAIMsg },
    scenarios: { strategies, decisions, issues, problem, nodes:influenceNodes, edges:influenceEdges, aiCall, aiBusy, onAIMsg:pushAIMsg },
    assessment:{ strategies, decisions, criteria, problem, scores:assessmentScores, onScores:setAssessmentScores, aiCall, aiBusy, onAIMsg:pushAIMsg },
    scorecard: { problem, issues, decisions, strategies, criteria, assessmentScores, brief, scores:dqScores, onScores:setDqScores, aiCall, aiBusy, onAIMsg:pushAIMsg },
    export:    { problem, issues, decisions, criteria, strategies, assessmentScores, dqScores, brief, narrative, aiCall, aiBusy, onAIMsg:pushAIMsg },
    timeline: { decisions, strategies, issues, problem, aiCall, aiBusy, onAIMsg:pushAIMsg },
    influence: { issues, decisions, strategies, aiCall, aiBusy, onAIMsg:pushAIMsg, problem, onNodesChange:setInfluenceNodes, onEdgesChange:setInfluenceEdges },
    voi:      { nodes:influenceNodes, edges:influenceEdges, issues, strategies, decisions, problem, aiCall, aiBusy, onAIMsg:pushAIMsg },
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
        <QuickStartScreen onComplete={handleQuickStartComplete} onSkip={(mode)=>{
          setShowQuickStart(false);
          if (mode === "clean") {
            // Reset everything to truly empty
            setProblem({ id: uid("prob"), decisionStatement:"", context:"", owner:"", deadline:"", successCriteria:"", scopeIn:"", scopeOut:"", projectName:"", projectCode:"", client:"", sector:"", facilitator:"", sessionDate:"", decisionType:"", confidentiality:"Internal", stakeholders:[], constraints:[], assumptions:[] });
            setIssues([]);
            setDecisions([]);
            setCriteria([]);
            setStrategies([]);
            setAssessmentScores({});
            setDqScores({});
            setBriefState(null);
            setNarrative(null);
            setAIMessages([]);
            setModule("problem");
            try { localStorage.removeItem(SESSION_KEY); } catch(e) {}
          }
        }}/>
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
            onMouseEnter={e=>e.currentTarget.style.background=DS.chromeMid}
            onMouseLeave={e=>e.currentTarget.style.background="transparent"}>
            <div style={{ fontSize:8, color:DS.textTer, letterSpacing:1.2,
              textTransform:"uppercase", marginBottom:5 }}>Active Project</div>

            {/* Project name if set */}
            {problem.projectName && (
              <div style={{ fontSize:11, fontWeight:700, color:DS.textPri, lineHeight:1.3,
                fontFamily:"'Libre Baskerville',Georgia,serif", marginBottom:4 }}>
                {problem.projectName}
              </div>
            )}

            {/* Full decision statement */}
            {problem.decisionStatement && (
              <div style={{ fontSize:10, color:DS.textSec, lineHeight:1.5, marginBottom:6 }}>
                {problem.decisionStatement}
              </div>
            )}

            {/* Meta badges */}
            <div style={{ display:"flex", gap:5, flexWrap:"wrap", marginBottom:4 }}>
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
              {!problem.projectName && !problem.decisionStatement && (
                <span style={{ fontSize:10, color:DS.textTer, fontStyle:"italic" }}>
                  No project defined yet
                </span>
              )}
            </div>
            {problem.facilitator && (
              <div style={{ fontSize:9, color:DS.textTer, marginTop:2 }}>
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

        {/* Session Snapshot */}
        {!navCollapsed && (
          <div style={{ padding:"10px 12px", borderTop:"1px solid "+DS.border, flexShrink:0 }}>
            <div style={{ fontSize:8, color:DS.textTer, letterSpacing:1.2,
              textTransform:"uppercase", fontWeight:700, marginBottom:6 }}>
              Session Snapshot
            </div>
            {problem.decisionStatement && (
              <div style={{ fontSize:10, color:DS.textSec, lineHeight:1.4,
                marginBottom:8, fontStyle:"italic" }}>
                {problem.decisionStatement.slice(0,80)}{problem.decisionStatement.length>80?"…":""}
              </div>
            )}
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:5, marginBottom:6 }}>
              {[
                { label:"Issues", val:issues.length, sub:issues.filter(i=>i.severity==="Critical"&&i.status==="Open").length+" critical", warn:issues.filter(i=>i.severity==="Critical"&&i.status==="Open").length>0 },
                { label:"Focus Dec.", val:decisions.filter(d=>d.tier==="focus").length, sub:"in scope", warn:false },
                { label:"Strategies", val:strategies.length, sub:"built", warn:false },
                { label:"Criteria", val:criteria.length, sub:"defined", warn:false },
              ].map(item=>(
                <div key={item.label} style={{ padding:"5px 7px",
                  background:DS.chromeMid, borderRadius:5, border:"1px solid "+DS.border }}>
                  <div style={{ fontSize:14, fontWeight:700,
                    color:item.warn?DS.danger:DS.textPri,
                    fontFamily:"'Libre Baskerville',serif", lineHeight:1 }}>
                    {item.val}
                  </div>
                  <div style={{ fontSize:8, color:DS.textTer, marginTop:2, fontWeight:600 }}>{item.label}</div>
                  <div style={{ fontSize:7, color:item.warn?DS.danger:DS.textTer, marginTop:1 }}>{item.sub}</div>
                </div>
              ))}
            </div>
            <div style={{ height:3, background:DS.chromeMid, borderRadius:2, overflow:"hidden" }}>
              <div style={{ height:"100%", borderRadius:2, transition:"width .5s",
                background:"linear-gradient(90deg, "+DS.accent+", #60a5fa)",
                width:overall+"%" }}/>
            </div>
            <div style={{ display:"flex", justifyContent:"space-between", marginTop:3 }}>
              <span style={{ fontSize:8, color:DS.textTer }}>Overall Progress</span>
              <span style={{ fontSize:8, color:DS.textSec, fontWeight:700 }}>{overall}%</span>
            </div>
          </div>
        )}
        {!navCollapsed && (
          <NudgeBar module={module} issues={issues} decisions={decisions}
            criteria={criteria} strategies={strategies}
            assessmentScores={assessmentScores} dqScores={{}}
            onNavigate={setModule}/>
        )}
      </div>

      {/* ── MAIN CONTENT ── */}
      <div style={{ flex:1, display:"flex", flexDirection:"column", minWidth:0, overflow:"hidden" }}>

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

            {/* Cross-Module AI modal */}
            {showCrossModule && (
              <CrossModuleAI problem={problem} issues={issues} decisions={decisions}
                criteria={criteria} strategies={strategies}
                assessmentScores={assessmentScores} dqScores={dqScores}
                aiCall={aiCall} aiBusy={aiBusy} onAIMsg={pushAIMsg}
                onClose={()=>setShowCrossModule(false)}/>
            )}

            {/* Tools dropdown */}
            <button onClick={()=>setShowCrossModule(true)} style={{ padding:"5px 13px", border:"1px solid "+DS.border, borderRadius:6, background:"transparent", color:DS.textSec, cursor:"pointer", fontSize:11, fontWeight:700, fontFamily:"inherit" }}>✦ Cross-Module AI</button>
            <ToolsMenu
              onDeepDive={()=>setShowQuickStart(true)}
              onWorkshop={()=>setWorkshopOpen(true)}
              onVersions={()=>setVersionOpen(true)}
              onDqi={()=>setDqiOpen(true)}
              onProject={()=>setProjectSetupOpen(true)}
              onNew={()=>setShowQuickStart(true)}
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
            {module==="problem"    && <ModuleProblemDefinition    {...moduleProps.problem}/>}
            {module==="issues"     && <ModuleIssueRaising         {...moduleProps.issues}/>}
            {module==="hierarchy"  && <ModuleDecisionHierarchy    {...moduleProps.hierarchy}/>}
            {module==="strategy"   && <ModuleStrategyTable        {...moduleProps.strategy}/>}
            {module==="scenarios"   && <ModuleScenarios      {...moduleProps.scenarios}/>}
            {module==="assessment" && <ModuleQualitativeAssessment {...moduleProps.assessment}/>}
            {module==="scorecard"  && <ModuleDQScorecard          {...moduleProps.scorecard}/>}
            {module==="export"     && <ModuleExport               {...moduleProps.export}/>}
            {module==="timeline" && <ModuleTimeline decisions={decisions} strategies={strategies} issues={issues} problem={problem} aiCall={aiCall} aiBusy={aiBusy} onAIMsg={pushAIMsg}/>}
            {module==="voi"        && <ModuleVoI             {...moduleProps.voi}/>}
            {module==="influence"  && <ModuleInfluenceMap         {...moduleProps.influence}/>}
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
