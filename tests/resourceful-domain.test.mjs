import assert from "node:assert/strict";
import test from "node:test";
import { createInitialState, transition } from "../lib/resourceful-domain.ts";
const now = Date.parse("2026-09-01T12:00:00Z");
function confirmedState() {
  let s = createInitialState();
  s = transition(s, { type: "review_intent", transcript: "BP-2048, cheti hakipo" }, now).state;
  s = transition(s, { type: "start_renewal", expectedStateVersion: s.stateVersion }, now).state;
  s = transition(s, { type: "authorize_recovery", resolutionId: "alternative_identity_verification", expectedStateVersion: s.stateVersion }, now).state;
  s = transition(s, { type: "verify_identity", expectedStateVersion: s.stateVersion }, now).state;
  s = transition(s, { type: "continue_with_reference", expectedStateVersion: s.stateVersion }, now).state;
  return transition(s, { type: "confirm_review", expectedStateVersion: s.stateVersion }, now).state;
}
test("approved recovery reaches confirmed state", () => {
  const s = confirmedState(); assert.equal(s.stage, "confirmed"); assert.equal(s.temporaryReference, "TMP-2048-A"); assert.equal(s.stateVersion, 6);
});
test("stale writes fail without mutation", () => {
  const s = transition(createInitialState(), { type: "review_intent", transcript: "BP-2048" }, now).state;
  const out = transition(s, { type: "start_renewal", expectedStateVersion: 0 }, now);
  assert.equal(out.result.errorCode, "STALE_STATE_VERSION"); assert.deepEqual(out.state, s);
});
test("expired recovery grant is rejected", () => {
  let s = createInitialState();
  s = transition(s, { type: "review_intent", transcript: "BP-2048" }, now).state;
  s = transition(s, { type: "start_renewal", expectedStateVersion: s.stateVersion }, now).state;
  s = transition(s, { type: "authorize_recovery", resolutionId: "alternative_identity_verification", expectedStateVersion: s.stateVersion }, now).state;
  const out = transition(s, { type: "verify_identity", expectedStateVersion: s.stateVersion }, now + 16 * 60_000);
  assert.equal(out.result.errorCode, "GRANT_EXPIRED"); assert.equal(out.state.stage, "recovery_authorized");
});
test("duplicate submission returns one receipt", () => {
  const s = confirmedState();
  const first = transition(s, { type: "submit", confirmationToken: s.confirmationToken, expectedStateVersion: s.stateVersion, idempotencyKey: "resourceful-final" }, now);
  const second = transition(first.state, { type: "submit", confirmationToken: s.confirmationToken, expectedStateVersion: first.state.stateVersion, idempotencyKey: "resourceful-final" }, now + 1_000);
  assert.deepEqual(second.result.receipt, first.result.receipt); assert.equal(second.state.stateVersion, first.state.stateVersion);
});
