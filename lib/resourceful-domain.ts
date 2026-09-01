export type Stage = "idle" | "intent_review" | "blocked" | "recovery_authorized" | "identity_verified" | "ready_review" | "confirmed" | "submitted";
export type BilingualText = { en: string; sw: string };
export type ResolutionContract = {
  contractId: string;
  blockedAction: "start_permit_renewal";
  reasonCode: "ORIGINAL_CERTIFICATE_MISSING";
  userMessage: BilingualText;
  resolutions: Array<{
    resolutionId: "alternative_identity_verification" | "request_replacement_certificate";
    title: BilingualText;
    description: BilingualText;
    requirements: string[];
    consequence: "write";
    requiresConfirmation: true;
    grantsCapability: string;
  }>;
  expiresAt: string;
  stateVersion: number;
};
export type RecoveryGrant = {
  grantId: string;
  contractId: string;
  resolutionId: "alternative_identity_verification";
  capability: "verify_alternative_identity";
  issuedAt: string;
  expiresAt: string;
  consumedAt?: string;
};
export type AppState = {
  stage: Stage;
  stateVersion: number;
  intent?: { transcript: string; englishMeaning: string; permitId: "BP-2048"; originalCertificateAvailable: false };
  resolutionContract?: ResolutionContract;
  recoveryGrant?: RecoveryGrant;
  temporaryReference?: "TMP-2048-A";
  review?: BilingualText;
  confirmationToken?: string;
  receipt?: { applicationId: "RSP-2026-1042"; permitId: "BP-2048"; submittedAt: string; stateVersion: number; idempotencyKey: string };
};
export type Command =
  | { type: "review_intent"; transcript: string }
  | { type: "start_renewal"; expectedStateVersion: number }
  | { type: "authorize_recovery"; resolutionId: "alternative_identity_verification"; expectedStateVersion: number }
  | { type: "verify_identity"; expectedStateVersion: number }
  | { type: "continue_with_reference"; expectedStateVersion: number }
  | { type: "confirm_review"; expectedStateVersion: number }
  | { type: "submit"; confirmationToken: string; expectedStateVersion: number; idempotencyKey: string };
export type ToolResult = {
  ok: boolean; status: string; title: string; message: string; stateVersion: number;
  nextValidActions?: string[]; resolutionContract?: ResolutionContract; recoveryGrant?: RecoveryGrant;
  temporaryReference?: string; receipt?: AppState["receipt"]; errorCode?: string;
};
type Outcome = { state: AppState; result: ToolResult };

const REVIEW: BilingualText = {
  sw: "Amina Salim anaomba kufanya upya kibali BP-2048 kwa Amina Tailoring Studio. Cheti cha asili hakipo; utambulisho mbadala umethibitishwa kwa rejea TMP-2048-A.",
  en: "Amina Salim requests renewal of permit BP-2048 for Amina Tailoring Studio. The original certificate is unavailable; alternative identity was verified under reference TMP-2048-A.",
};
export const ACTIVE_TOOLS: Record<Stage, string[]> = {
  idle: ["list_services", "inspect_service_requirements"],
  intent_review: ["inspect_service_requirements", "start_permit_renewal"],
  blocked: ["get_resolution_options", "authorize_recovery_path"],
  recovery_authorized: ["verify_alternative_identity"],
  identity_verified: ["continue_renewal_with_temporary_reference"],
  ready_review: ["review_permit_submission"],
  confirmed: ["review_permit_submission", "submit_permit_renewal"],
  submitted: ["get_application_receipt"],
};
export function createInitialState(): AppState { return { stage: "idle", stateVersion: 0 }; }
function fail(state: AppState, title: string, message: string, errorCode: string): Outcome {
  return { state, result: { ok: false, status: "rejected", title, message, errorCode, stateVersion: state.stateVersion, nextValidActions: ACTIVE_TOOLS[state.stage] } };
}
function guard(state: AppState, expected: number): Outcome | null {
  return expected === state.stateVersion ? null : fail(state, "Stale application state", `Expected version ${state.stateVersion}; received ${expected}.`, "STALE_STATE_VERSION");
}
function ok(state: AppState, title: string, message: string, extras: Partial<ToolResult> = {}): Outcome {
  return { state, result: { ok: true, status: state.stage, title, message, stateVersion: state.stateVersion, nextValidActions: ACTIVE_TOOLS[state.stage], ...extras } };
}

export function transition(state: AppState, command: Command, nowMs: number): Outcome {
  if (command.type === "review_intent") {
    if (state.stage !== "idle") return fail(state, "Intent already reviewed", "Reset to begin again.", "INVALID_TRANSITION");
    if (!command.transcript.trim()) return fail(state, "Transcript required", "Provide Kiswahili speech or text.", "EMPTY_TRANSCRIPT");
    const next: AppState = { stage: "intent_review", stateVersion: 1, intent: { transcript: command.transcript.trim(), englishMeaning: "Renew business permit BP-2048; the original certificate is unavailable.", permitId: "BP-2048", originalCertificateAvailable: false } };
    return ok(next, "Meaning ready for review", "No portal action has been taken. Amina must confirm the meaning.");
  }
  const stale = guard(state, command.expectedStateVersion);
  if (stale) return stale;

  if (command.type === "start_renewal") {
    if (state.stage !== "intent_review" || !state.intent) return fail(state, "Renewal cannot start", "Review the interpreted intent first.", "INVALID_TRANSITION");
    const contract: ResolutionContract = {
      contractId: "RC-BP2048-01", blockedAction: "start_permit_renewal", reasonCode: "ORIGINAL_CERTIFICATE_MISSING",
      userMessage: { sw: "Njia ya kawaida imesimama kwa sababu cheti cha asili hakipo. Tovuti imetoa njia mbili halali za kuendelea.", en: "The standard path stopped because the original certificate is unavailable. The website offers two valid ways to continue." },
      resolutions: [
        { resolutionId: "alternative_identity_verification", title: { sw: "Thibitisha utambulisho kwa njia mbadala", en: "Verify identity another way" }, description: { sw: "Tumia taarifa za akaunti za mfano kupata rejea ya muda.", en: "Use synthetic account facts to receive a temporary reference." }, requirements: ["Explicit user authorization", "Synthetic account facts"], consequence: "write", requiresConfirmation: true, grantsCapability: "verify_alternative_identity" },
        { resolutionId: "request_replacement_certificate", title: { sw: "Omba cheti mbadala", en: "Request a replacement certificate" }, description: { sw: "Anza ombi la cheti kipya na urudi baadaye.", en: "Start a replacement request and resume later." }, requirements: ["Explicit user authorization"], consequence: "write", requiresConfirmation: true, grantsCapability: "request_replacement_certificate" },
      ],
      expiresAt: new Date(nowMs + 30 * 60_000).toISOString(), stateVersion: state.stateVersion + 1,
    };
    const next = { ...state, stage: "blocked" as const, stateVersion: state.stateVersion + 1, resolutionContract: contract };
    return ok(next, "Standard path blocked", "The website returned two approved recovery options.", { resolutionContract: contract });
  }
  if (command.type === "authorize_recovery") {
    if (state.stage !== "blocked" || !state.resolutionContract) return fail(state, "Recovery unavailable", "A current Resolution Contract is required.", "INVALID_TRANSITION");
    if (Date.parse(state.resolutionContract.expiresAt) <= nowMs) return fail(state, "Resolution expired", "Request current options.", "RESOLUTION_EXPIRED");
    const grant: RecoveryGrant = { grantId: "RG-BP2048-01", contractId: state.resolutionContract.contractId, resolutionId: command.resolutionId, capability: "verify_alternative_identity", issuedAt: new Date(nowMs).toISOString(), expiresAt: new Date(nowMs + 15 * 60_000).toISOString() };
    const next = { ...state, stage: "recovery_authorized" as const, stateVersion: state.stateVersion + 1, recoveryGrant: grant };
    return ok(next, "Recovery path authorized", "A session-bound verification capability is now available.", { recoveryGrant: grant });
  }
  if (command.type === "verify_identity") {
    if (state.stage !== "recovery_authorized" || !state.recoveryGrant) return fail(state, "Verification not authorized", "The user must approve this recovery path first.", "CAPABILITY_NOT_GRANTED");
    if (Date.parse(state.recoveryGrant.expiresAt) <= nowMs) return fail(state, "Recovery grant expired", "Authorize a new recovery path.", "GRANT_EXPIRED");
    const next: AppState = { ...state, stage: "identity_verified", stateVersion: state.stateVersion + 1, temporaryReference: "TMP-2048-A", recoveryGrant: { ...state.recoveryGrant, consumedAt: new Date(nowMs).toISOString() } };
    return ok(next, "Alternative identity verified", "Temporary reference TMP-2048-A was issued.", { temporaryReference: next.temporaryReference });
  }
  if (command.type === "continue_with_reference") {
    if (state.stage !== "identity_verified" || !state.temporaryReference) return fail(state, "Reference unavailable", "Complete approved verification first.", "INVALID_TRANSITION");
    const next = { ...state, stage: "ready_review" as const, stateVersion: state.stateVersion + 1, review: REVIEW };
    return ok(next, "Application ready for review", "Amina must review the bilingual facts.");
  }
  if (command.type === "confirm_review") {
    if (state.stage !== "ready_review" || !state.review) return fail(state, "Review not ready", "Complete the recovery path first.", "INVALID_TRANSITION");
    const next = { ...state, stage: "confirmed" as const, stateVersion: state.stateVersion + 1, confirmationToken: "confirm-BP2048-v6" };
    return ok(next, "Details confirmed by Amina", "The agent may submit exactly this reviewed application once.");
  }
  if (command.type === "submit") {
    if (state.stage === "submitted" && state.receipt) {
      return state.receipt.idempotencyKey === command.idempotencyKey
        ? ok(state, "Original receipt returned", "No duplicate submission was created.", { receipt: state.receipt })
        : fail(state, "Conflicting duplicate rejected", "Already submitted under another idempotency key.", "IDEMPOTENCY_CONFLICT");
    }
    if (state.stage !== "confirmed" || !state.confirmationToken) return fail(state, "Explicit confirmation required", "Amina must confirm the bilingual review.", "CONFIRMATION_REQUIRED");
    if (command.confirmationToken !== state.confirmationToken) return fail(state, "Confirmation rejected", "Confirmation does not match the reviewed state.", "INVALID_CONFIRMATION");
    const receipt: NonNullable<AppState["receipt"]> = { applicationId: "RSP-2026-1042", permitId: "BP-2048", submittedAt: new Date(nowMs).toISOString(), stateVersion: state.stateVersion + 1, idempotencyKey: command.idempotencyKey };
    const next = { ...state, stage: "submitted" as const, stateVersion: state.stateVersion + 1, receipt };
    return ok(next, "Permit renewal submitted", "Exactly one synthetic receipt was created.", { receipt });
  }
  return fail(state, "Unsupported action", "The portal does not define that recovery action.", "UNSUPPORTED_ACTION");
}
