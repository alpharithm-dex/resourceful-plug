# Resourceful Plug — Codex Handoff

Last updated: 2026-09-01

## Product thesis

Resourceful Plug is a Kiswahili-first WebMCP recovery layer. When an ordinary
website action is blocked, the website—not the agent—returns a typed Resolution
Contract containing legitimate recovery paths. After explicit user approval,
the site exposes a narrow, temporary capability that permits only the selected
recovery action.

The product's novel core is portal-defined recovery and scoped authorization.
Kiswahili voice is progressive enhancement, not the security or protocol layer.

## Current working slice

- Fictional business-permit renewal journey for Amina and permit `BP-2048`.
- Kiswahili text input with browser speech recognition using `sw-KE` when the
  browser exposes the required API.
- Nine top-level imperative WebMCP tools registered through
  `document.modelContext.registerTool`.
- Dynamic recovery tools exposed only during the relevant workflow stages.
- Deterministic state machine shared by the human UI and WebMCP handlers.
- Two portal-defined recovery paths for a missing original certificate.
- Expiring recovery grant, version guards, explicit confirmation, and an
  idempotent submission receipt.
- Visible activity log and developer inspector for demo evidence.
- Private Sites deployment:
  `https://resourceful-plug.bryanbongani.chatgpt.site`

## Verified baseline

Run from the repository root:

```bash
npm run install:ci
npm run lint
npm test
```

The latest verified baseline passes lint, a production build, and all nine
automated tests. The domain tests cover the approved recovery path, stale-write
rejection without mutation, expired-grant rejection, and idempotent duplicate
submission.

## Important files

- `app/page.tsx`: interface, voice enhancement, WebMCP registration, activity
  evidence, and developer inspector.
- `lib/resourceful-domain.ts`: deterministic workflow and authorization rules.
- `tests/resourceful-domain.test.mjs`: core recovery and safety tests.
- `app/globals.css`: responsive visual system.
- `AGENTS.md`: repository constraints Codex must preserve.
- `docs/evidence/build-status.md`: evidence inventory.

## Honest limitations

- Workflow state and grant enforcement are currently browser-local and
  in-memory; this is a demonstrator, not production authorization.
- No external WebMCP-capable judge client has yet been used to discover and
  invoke the tools end to end.
- Kiswahili copy and speech behavior have not yet been reviewed by a native
  speaker across supported browsers.
- The portal, people, identity checks, permits, and receipts are synthetic.
- There is no real government, payment, identity-provider, or merchant
  integration.
- The production deployment is owner-only until public release is explicitly
  approved.

## Next milestone: real WebMCP interoperability proof

Do not begin with cosmetic work. First prove that an external WebMCP-capable
client can:

1. Discover the registered read and write tools.
2. Inspect service requirements without mutating state.
3. Start the permit renewal and receive the Resolution Contract.
4. Authorize exactly one recovery path.
5. Discover the stage-specific identity and continuation tools.
6. Reach the review stage, require explicit confirmation, and submit once.
7. Retrieve the same receipt after a duplicate submission attempt.
8. Reject a stale version, expired grant, premature submission, and unapproved
   recovery path without mutating state.

Capture the client name and version, exact tool transcript, observed results,
and any compatibility fixes under `docs/evidence/`. Never claim compatibility
from mocked calls alone.

## Milestones after interoperability

1. Move authoritative state, grant validation, confirmation, and idempotency to
   a server boundary while keeping the same typed tool contracts.
2. Add one compact commerce proof using the same recovery protocol, such as an
   unavailable product where the merchant grants a time-limited equivalent-item
   selection within a price ceiling.
3. Conduct native-speaker Kiswahili review, browser accessibility testing, and
   failure-path evaluation.
4. Prepare the public deployment, architecture evidence, demo recording, and
   Devpost submission materials after re-checking the official rules.

## Codex execution rule

Before each milestone, read this file and `AGENTS.md`, verify the baseline, make
the smallest coherent change, add failure-path tests, and update this document
with evidence. Do not turn the model into the authority: the site defines valid
recovery choices and deterministic code validates every state transition.
