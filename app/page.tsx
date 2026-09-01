"use client";

import { ArrowRight, Check, CheckCircle2, ChevronDown, CircleAlert, FileCheck2, Globe2, KeyRound, Languages, Mic, MicOff, PlugZap, RefreshCcw, Route, ShieldCheck, Sparkles, TerminalSquare, UserRound } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { ACTIVE_TOOLS, createInitialState, transition, type AppState, type Command, type ToolResult } from "@/lib/resourceful-domain";

type Tool = { name: string; description: string; inputSchema: Record<string, unknown>; annotations?: { readOnlyHint?: boolean; untrustedContentHint?: boolean }; execute: (input: Record<string, unknown>) => unknown };
declare global {
  interface Document { modelContext?: { registerTool: (tool: Tool, options?: { signal?: AbortSignal }) => Promise<void> | void } }
  interface Window { webkitSpeechRecognition?: new () => { lang: string; interimResults: boolean; continuous: boolean; start(): void; stop(): void; onresult: ((event: { results: ArrayLike<{ 0: { transcript: string } }> }) => void) | null; onerror: (() => void) | null; onend: (() => void) | null } }
}
type Activity = { id: number; source: "person" | "agent" | "website"; title: string; detail: string; ok: boolean };
const SW = "Nataka kufanya upya kibali changu cha biashara BP-2048, lakini sina cheti cha asili.";
const labels: Record<AppState["stage"], string> = { idle: "Ready", intent_review: "Review intent", blocked: "Standard path blocked", recovery_authorized: "Recovery authorized", identity_verified: "Identity verified", ready_review: "Final review", confirmed: "Confirmed", submitted: "Submitted" };
const progress: Record<AppState["stage"], number> = { idle: 8, intent_review: 22, blocked: 40, recovery_authorized: 56, identity_verified: 72, ready_review: 84, confirmed: 92, submitted: 100 };

export default function Home() {
  const [app, setApp] = useState<AppState>(createInitialState);
  const appRef = useRef(app);
  const [transcript, setTranscript] = useState(SW);
  const [activities, setActivities] = useState<Activity[]>([{ id: 1, source: "website", title: "Portal ready", detail: "Synthetic permit BP-2048 is ready.", ok: true }]);
  const [webmcp, setWebmcp] = useState<boolean | null>(null);
  const [registered, setRegistered] = useState<string[]>([]);
  const [inspector, setInspector] = useState(false);
  const [meaningOk, setMeaningOk] = useState(false);
  const [finalOk, setFinalOk] = useState(false);
  const [listening, setListening] = useState(false);
  const id = useRef(2);
  const recognition = useRef<InstanceType<NonNullable<typeof window.webkitSpeechRecognition>> | null>(null);
  useEffect(() => { appRef.current = app; }, [app]);
  const browserReady = useSyncExternalStore(() => () => {}, () => true, () => false);
  const voiceAvailable = browserReady && typeof window.webkitSpeechRecognition === "function";

  const log = useCallback((source: Activity["source"], title: string, detail: string, ok = true) => {
    setActivities(items => [...items, { id: id.current++, source, title, detail, ok }]);
  }, []);
  const run = useCallback((command: Command, source: Activity["source"]): ToolResult => {
    const out = transition(appRef.current, command, Date.now());
    appRef.current = out.state; setApp(out.state); log(source, out.result.title, out.result.message, out.result.ok); return out.result;
  }, [log]);
  const runRef = useRef(run); useEffect(() => { runRef.current = run; }, [run]);
  const reset = useCallback((source: Activity["source"] = "person") => {
    const fresh = createInitialState(); appRef.current = fresh; setApp(fresh); setTranscript(SW); setMeaningOk(false); setFinalOk(false); setActivities([]); log(source, "Demo reset", "A fresh synthetic session is ready.");
    return { ok: true, status: "reset", stateVersion: 0 };
  }, [log]);

  useEffect(() => {
    const mc = document.modelContext;
    if (!mc?.registerTool) { queueMicrotask(() => setWebmcp(false)); return; }
    queueMicrotask(() => setWebmcp(true)); const ctl = new AbortController();
    const tools: Tool[] = [
      { name: "list_services", description: "List services offered by this fictional portal. Read-only.", inputSchema: { type: "object", properties: {}, additionalProperties: false }, annotations: { readOnlyHint: true }, execute: () => ({ services: [{ id: "business-permit-renewal", name: "Business permit renewal", languages: ["sw", "en"] }] }) },
      { name: "inspect_service_requirements", description: "Read website-owned permit renewal requirements without changing state.", inputSchema: { type: "object", properties: { serviceId: { type: "string", const: "business-permit-renewal" } }, required: ["serviceId"], additionalProperties: false }, annotations: { readOnlyHint: true }, execute: () => ({ requirements: ["Permit reference", "Certificate or approved recovery", "User confirmation"], syntheticDemo: true }) },
      { name: "start_permit_renewal", description: "Start the synthetic renewal after the user reviewed their intent. Creates a draft and may return a Resolution Contract.", inputSchema: { type: "object", properties: { permitId: { type: "string", const: "BP-2048" }, originalCertificateAvailable: { type: "boolean", const: false }, expectedStateVersion: { type: "integer", minimum: 0 } }, required: ["permitId", "originalCertificateAvailable", "expectedStateVersion"], additionalProperties: false }, execute: input => runRef.current({ type: "start_renewal", expectedStateVersion: Number(input.expectedStateVersion) }, "agent") },
      { name: "get_resolution_options", description: "Read only the website-approved recovery options for the blocked application.", inputSchema: { type: "object", properties: {}, additionalProperties: false }, annotations: { readOnlyHint: true }, execute: () => ({ ok: !!appRef.current.resolutionContract, resolutionContract: appRef.current.resolutionContract, stateVersion: appRef.current.stateVersion }) },
      { name: "authorize_recovery_path", description: "Record the user's explicit choice of the alternative-verification recovery path. Does not submit.", inputSchema: { type: "object", properties: { resolutionId: { type: "string", const: "alternative_identity_verification" }, expectedStateVersion: { type: "integer", minimum: 0 } }, required: ["resolutionId", "expectedStateVersion"], additionalProperties: false }, execute: input => runRef.current({ type: "authorize_recovery", resolutionId: "alternative_identity_verification", expectedStateVersion: Number(input.expectedStateVersion) }, "agent") },
      { name: "review_permit_submission", description: "Return the bilingual final review. Read-only; never confirms or submits.", inputSchema: { type: "object", properties: {}, additionalProperties: false }, annotations: { readOnlyHint: true }, execute: () => ({ state: appRef.current.stage, review: appRef.current.review, requiresUserConfirmation: appRef.current.stage === "ready_review", stateVersion: appRef.current.stateVersion }) },
      { name: "submit_permit_renewal", description: "Submit only after the person confirmed the bilingual review. Idempotent duplicates return the original receipt.", inputSchema: { type: "object", properties: { confirmationToken: { type: "string", minLength: 8 }, expectedStateVersion: { type: "integer", minimum: 0 }, idempotencyKey: { type: "string", minLength: 8 } }, required: ["confirmationToken", "expectedStateVersion", "idempotencyKey"], additionalProperties: false }, execute: input => runRef.current({ type: "submit", confirmationToken: String(input.confirmationToken), expectedStateVersion: Number(input.expectedStateVersion), idempotencyKey: String(input.idempotencyKey) }, "agent") },
      { name: "get_application_receipt", description: "Read an existing synthetic receipt. Does not create a submission.", inputSchema: { type: "object", properties: {}, additionalProperties: false }, annotations: { readOnlyHint: true }, execute: () => ({ receipt: appRef.current.receipt, stateVersion: appRef.current.stateVersion }) },
      { name: "reset_demo_session", description: "Reset only this synthetic demo session and its draft.", inputSchema: { type: "object", properties: { confirmReset: { type: "boolean", const: true } }, required: ["confirmReset"], additionalProperties: false }, execute: () => reset("agent") },
    ];
    Promise.all(tools.map(tool => Promise.resolve(mc.registerTool(tool, { signal: ctl.signal })))).then(() => setRegistered(tools.map(t => t.name))).catch(() => { if (!ctl.signal.aborted) setWebmcp(false); });
    return () => ctl.abort();
  }, [reset]);

  useEffect(() => {
    const mc = document.modelContext; if (!mc?.registerTool) return;
    const ctl = new AbortController(); const tools: Tool[] = [];
    if (app.stage === "recovery_authorized") tools.push({ name: "verify_alternative_identity", description: "Consume the user-authorized, session-bound synthetic identity recovery grant.", inputSchema: { type: "object", properties: { expectedStateVersion: { type: "integer", minimum: 0 } }, required: ["expectedStateVersion"], additionalProperties: false }, execute: input => runRef.current({ type: "verify_identity", expectedStateVersion: Number(input.expectedStateVersion) }, "agent") });
    if (app.stage === "identity_verified") tools.push({ name: "continue_renewal_with_temporary_reference", description: "Continue using the website-issued temporary reference after verification.", inputSchema: { type: "object", properties: { expectedStateVersion: { type: "integer", minimum: 0 } }, required: ["expectedStateVersion"], additionalProperties: false }, execute: input => runRef.current({ type: "continue_with_reference", expectedStateVersion: Number(input.expectedStateVersion) }, "agent") });
    if (!tools.length) return;
    Promise.all(tools.map(tool => Promise.resolve(mc.registerTool(tool, { signal: ctl.signal })))).then(() => setRegistered(current => [...current.filter(n => !n.startsWith("verify_alternative") && !n.startsWith("continue_renewal")), ...tools.map(t => t.name)]));
    return () => { ctl.abort(); setRegistered(current => current.filter(n => !tools.some(t => t.name === n))); };
  }, [app.stage]);

  const active = useMemo(() => ACTIVE_TOOLS[app.stage], [app.stage]);
  function startVoice() {
    if (!window.webkitSpeechRecognition || listening) return;
    const r = new window.webkitSpeechRecognition(); r.lang = "sw-KE"; r.interimResults = false; r.continuous = false;
    r.onresult = e => { const value = e.results[0]?.[0]?.transcript; if (value) setTranscript(value); log("person", "Kiswahili captured", "The editable transcript is ready."); };
    r.onerror = () => { log("website", "Voice unavailable", "Use text input; no state changed.", false); setListening(false); };
    r.onend = () => setListening(false); recognition.current = r; setListening(true); r.start();
  }

  return <main className="app-shell">
    <header className="topbar">
      <div className="brand"><span className="brand-mark"><PlugZap size={20}/></span><div><strong>Resourceful Plug</strong><small>Fictional service portal</small></div></div>
      <div className="top-actions"><span className={`connection ${webmcp ? "on" : ""}`}><i/>{webmcp === null ? "Checking WebMCP" : webmcp ? `${registered.length} site tools live` : "Human mode"}</span><button className="ghost" onClick={() => reset()}><RefreshCcw size={15}/> Reset</button></div>
    </header>

    <section className="heading"><div><p className="eyebrow">Business permit renewal · BP-2048</p><h1>A valid path, even when the standard one stops.</h1></div><div className="stage"><span>{labels[app.stage]}</span><b>{progress[app.stage]}%</b><div><i style={{width: `${progress[app.stage]}%`}}/></div></div></section>

    <div className="main-grid">
      <section className="journey">
        <div className="kicker"><Languages size={17}/> Kiswahili intent <span>SW → EN</span></div>
        <h2>What does Amina need?</h2><p className="intro">Speak or type naturally. Review the meaning before the portal takes any action.</p>
        <div className="transcript"><label htmlFor="sw-input">Editable transcript</label><textarea id="sw-input" value={transcript} onChange={e => setTranscript(e.target.value)} disabled={app.stage !== "idle"}/><div><button disabled={!voiceAvailable || app.stage !== "idle"} onClick={() => listening ? recognition.current?.stop() : startVoice()}>{listening ? <MicOff size={16}/> : <Mic size={16}/>} {listening ? "Stop listening" : voiceAvailable ? "Speak Kiswahili" : "Voice unavailable"}</button><small>Demo phrase · machine draft</small></div></div>
        {app.stage === "idle" && <button className="primary wide" disabled={!transcript.trim()} onClick={() => run({type: "review_intent", transcript}, "person")}>Review meaning <ArrowRight size={16}/></button>}

        {app.intent && <div className="meaning"><span><Sparkles size={17}/></span><div><p className="mini">Structured meaning</p><strong>{app.intent.englishMeaning}</strong><dl><div><dt>Permit</dt><dd>BP-2048</dd></div><div><dt>Goal</dt><dd>Renew</dd></div><div><dt>Missing</dt><dd>Certificate</dd></div></dl></div></div>}
        {app.stage === "intent_review" && <div className="confirm"><label><input type="checkbox" checked={meaningOk} onChange={e => setMeaningOk(e.target.checked)}/><span><Check size={13}/></span> Meaning is correct</label><button className="primary" disabled={!meaningOk} onClick={() => run({type: "start_renewal", expectedStateVersion: app.stateVersion}, "person")}>Start renewal <ArrowRight size={16}/></button></div>}

        {app.stage === "blocked" && app.resolutionContract && <div className="contract">
          <div className="contract-head"><span><CircleAlert size={19}/></span><div><p className="mini">Resolution Contract</p><h3>Standard renewal cannot continue</h3></div><code>{app.resolutionContract.contractId}</code></div>
          <p className="sw-message">{app.resolutionContract.userMessage.sw}</p><p className="en-message">{app.resolutionContract.userMessage.en}</p>
          {app.resolutionContract.resolutions.map((option, index) => <article className={index === 0 ? "option chosen" : "option"} key={option.resolutionId}><b>0{index+1}</b><div><strong>{option.title.sw}</strong><span>{option.title.en}</span><p>{option.description.en}</p></div>{index === 0 ? <button onClick={() => run({type: "authorize_recovery", resolutionId: "alternative_identity_verification", expectedStateVersion: app.stateVersion}, "person")}>Choose path <ArrowRight size={14}/></button> : <small>Resume later</small>}</article>)}
        </div>}

        {app.stage === "recovery_authorized" && <div className="grant"><span><KeyRound size={21}/></span><div><p className="mini">Temporary capability granted</p><h3>verify_alternative_identity</h3><p>Session-bound · permit-bound · expires in 15 minutes</p></div><button onClick={() => run({type: "verify_identity", expectedStateVersion: app.stateVersion}, "person")}>Verify synthetic identity <ArrowRight size={15}/></button></div>}
        {app.stage === "identity_verified" && <div className="success"><CheckCircle2 size={23}/><div><p className="mini">Website condition satisfied</p><h3>Temporary reference: TMP-2048-A</h3><p>The renewal may continue without the lost certificate.</p></div><button className="primary" onClick={() => run({type: "continue_with_reference", expectedStateVersion: app.stateVersion}, "person")}>Continue <ArrowRight size={15}/></button></div>}

        {["ready_review","confirmed","submitted"].includes(app.stage) && <div className="review"><div className="review-head"><FileCheck2 size={20}/><div><p className="mini">Bilingual final review</p><h3>Confirm exactly what will be submitted</h3></div></div><div className="bilingual"><div><span>Kiswahili</span><p>{app.review?.sw}</p></div><div><span>English</span><p>{app.review?.en}</p></div></div>
          {app.stage === "ready_review" && <div className="confirm final"><label><input type="checkbox" checked={finalOk} onChange={e => setFinalOk(e.target.checked)}/><span><Check size={13}/></span> Amina confirms these details</label><button className="primary" disabled={!finalOk} onClick={() => run({type: "confirm_review", expectedStateVersion: app.stateVersion}, "person")}>Confirm <ShieldCheck size={16}/></button></div>}
          {app.stage === "confirmed" && <button className="submit" onClick={() => run({type: "submit", confirmationToken: app.confirmationToken ?? "missing", expectedStateVersion: app.stateVersion, idempotencyKey: "resourceful-bp2048-final"}, "person")}>Submit renewal once <ArrowRight size={16}/></button>}
        </div>}
        {app.stage === "submitted" && app.receipt && <div className="receipt"><CheckCircle2 size={27}/><div><p className="mini">Application received</p><h3>{app.receipt.applicationId}</h3><p>Submitted once · BP-2048 · state version {app.receipt.stateVersion}</p></div><b>VALID</b></div>}
      </section>

      <aside className="permit">
        <div className="permit-title"><div><p className="mini">Mji Business Services</p><h2>Permit BP-2048</h2></div><span>SYNTHETIC</span></div>
        <div className="owner"><i><UserRound size={19}/></i><div><small>Permit holder</small><strong>Amina Salim</strong></div><span>Active</span></div>
        <dl className="facts"><div><dt>Business</dt><dd>Amina Tailoring Studio</dd></div><div><dt>Permit type</dt><dd>Micro-enterprise</dd></div><div><dt>Expires</dt><dd>30 Sep 2026</dd></div><div><dt>Portal state</dt><dd>{labels[app.stage]}</dd></div></dl>
        <div className="actions"><header><Route size={16}/> Valid actions now <b>{active.length}</b></header><div>{active.map(tool => <code key={tool}>{tool}</code>)}</div></div>
        <div className="boundary"><ShieldCheck size={18}/><p><strong>The website sets the rules.</strong>The agent may translate and call tools, but cannot invent a recovery path or bypass confirmation.</p></div>
      </aside>
    </div>

    <section className="evidence"><div className="evidence-head"><div><p className="eyebrow">Shared evidence</p><h2>Who did what—and what changed?</h2></div><button className="ghost" onClick={() => setInspector(v => !v)}><TerminalSquare size={16}/> Developer inspector <ChevronDown className={inspector ? "flip" : ""} size={15}/></button></div>
      <div className="timeline">{activities.slice().reverse().map(item => <article key={item.id}><i className={item.source}>{item.ok ? <Check size={13}/> : <CircleAlert size={13}/>}</i><div><small>{item.source === "person" ? "Amina" : item.source === "agent" ? "Agent via WebMCP" : "Service portal"}</small><strong>{item.title}</strong><p>{item.detail}</p></div></article>)}</div>
      {inspector && <div className="inspector"><pre>{JSON.stringify({webmcpSupported: webmcp, registeredTools: registered, activeForState: active}, null, 2)}</pre><pre>{JSON.stringify({stage: app.stage, stateVersion: app.stateVersion, grant: app.recoveryGrant, receipt: app.receipt}, null, 2)}</pre></div>}
    </section>
    <footer><span><Globe2 size={15}/> Kiswahili-first · English judge view</span><p>Demonstration software only. No real government service or legal advice.</p></footer>
  </main>;
}
