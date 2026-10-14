# Upgrade plan: oscd-menu-subscriber-lb-sel

Status: **Agreed, implementation starting** · Branch: `upgrade` · Last updated: 2026-10-14

This plan upgrades the SEL companion plugin for the Subscriber Later Binding
plugin to the current OpenSCD stack:

- `@openscd/oscd-api` EditV2
- `@openscd/scl-lib` v2
- `@omicronenergy/oscd-ui`
- `@omicronenergy/oscd-shell`
- `@omicronenergy/oscd-tooling`
- the oscd-api theming contract

The package will be published as **`@openpowershift/oscd-menu-subscriber-lb-sel`**.

The same procedure will be repeated for the **Siemens** (`oscd-menu-subscriber-lb-siemens`)
and **NR** (`oscd-menu-subscriber-lb-nr`) plugins. Everything that is not
SEL-specific is marked **[shared]** and recorded so that it can be copied across
unchanged. See [§8 Replication guide](#8-replication-guide-siemens-nr).

---

## 0. Step status

Update this table as each step completes, and add a completion summary to
[§9 Worklog](#9-worklog).

| # | Step | Shared? | Status |
|---|------|---------|--------|
| 1 | Plan and review (this document) | — | ✅ |
| 2 | Scaffold onto oscd-tooling (`src/`, ESM, configs, CI) | [shared] | ⬜ |
| 3 | Companion core: event interpretation and squashed dispatch | [shared] | ⬜ |
| 4 | SEL rules ported to pure `foundation/` functions plus EditV2 | SEL | ⬜ |
| 5 | Logic gap fixes (§5) | SEL (+ shared items) | ⬜ |
| 6 | UI: oscd-ui dialog, theming, localisation | [shared] | ⬜ |
| 7 | Tests: unit, integration with the real later-binding plugin, and visual | mostly [shared] harness | ⬜ |
| 8 | Demo page (oscd-shell) and README | [shared] | ⬜ |
| 9 | Clean-up: remove legacy files, final verify, CHANGELOG/release-please | [shared] | ⬜ |
| LB | Later-binding changes: companion protocol + `apply`, auto-increment stops at a subscribed input, companion badge (§2.2, §2.4, Step LB) | other repo | ⬜ |

---

## 1. Current state (as found)

| Area | Today | Problem |
|---|---|---|
| Layout | Source at repo root (`oscd-subscriber-lb-sel.ts`, `foundation/`, `test/`) | No `src/`; `rootDir` is the repo root; `dist/` has stale Siemens artefacts |
| Tooling | Local rollup, WTR, WDS, eslint 8, husky 4, TS 4.8, `es-dev-server` | Duplicated and outdated; replaced by `oscd` CLI |
| Edit API | `@openscd/open-scd-core` `EditEvent`, `isUpdate`, `newEditEvent` (EditV1) | The later-binding plugin now emits **EditV2** (`oscd-edit-v2`), so the companion **never fires** |
| scl-lib | `@openenergytools/scl-lib` 0.2 | Must use `@openscd/scl-lib` v2, which returns EditV2 |
| Identity | Listens for `danyill.oscd-subscriber-later-binding` | Later binding is now `openpowershift.oscd-editor-subscriber-later-binding` |
| Undo | Each extra subscription is a separate `oscd-edit` event, so each is a **separate undo step** | Must be squashed into the later-binding user action |
| UI | `mwc-dialog`, `mwc-switch`, `mwc-formfield`, `mwc-button` | Replaced with oscd-ui; no theming |
| Foundation | Local copies of `identities/*` (~1.5k lines, **unused**), `utils/scldata.ts` (unused), `subscription.ts` | Delete; use scl-lib (`sourceControlBlock`, `isSubscribed`, …) |
| Tests | `test/*.ts` copied from Siemens: wrong fixture name (`SV_and_GOOSE.scd`), legacy `open-scd` host, sleep-based, mock is fully commented out | Effectively **no coverage** of SEL logic |
| Localisation | `@lit/localize` 0.11 with `de` and `pt` XLIFF; menu translation strings are copy-pasted from "Communication export" | Wrong translations |
| Demo | `open-scd` core, legacy plugin URLs | Replace with oscd-shell demo |
| package.json | `description` says "exporting the Communication section" | Wrong |

---

## 2. Target architecture

### 2.1 Package layout (from the OMICRONEnergyOSS template)

Layout follows [`oscd-editor-subscriber-databinding`](https://github.com/OMICRONEnergyOSS/oscd-editor-subscriber-databinding)
and the already-migrated sibling `../oscd-editor-subscriber-later-binding`
(branch `plugin-migration`).

```
src/
  oscd-menu-subscriber-lb-sel.ts        # LitElement: menu plugin, dialog, wiring only
  oscd-menu-subscriber-lb-sel.spec.ts   # component and integration specs (oscd-shell)
  oscd-menu-subscriber-lb-sel.test.ts   # visual regression (oscd test --visual)
  theme.ts                              # [shared] --oscd-* tokens -> md-sys tokens
  companion/                            # [shared] identical in SEL/Siemens/NR
    companion.ts                        #   event interpretation + squash dispatch
    companion.spec.ts
    settings.ts                         #   enabled flag persistence
    settings.spec.ts
  foundation/                           # SEL-specific pure functions
    sel.ts                              #   planSelEdits(change, context) -> Connection[] / ExtRef[]
    sel.spec.ts
    sampled-values.ts / .spec.ts        #   phase matching
    double-point.ts / .spec.ts          #   Dbpos/DPC pairing
  testing/                              # [shared] fixtures + helpers (excluded from bundle)
    fixtures.ts                         #   tiny inline SCL builders
    shell.ts                            #   mount oscd-shell + later-binding + companion
demo/
  index.html  plugins.js  sample.scd
docs/
  plan.md  media/
```

The files kept are:

- `package.json`: `"type": "module"`, `name: @openpowershift/oscd-menu-subscriber-lb-sel`, `exports`, and `files` excluding specs and tests.
- `tsconfig.json`: extends `@omicronenergy/oscd-tooling/configs/base.tsconfig.json` with `rootDir: src`.
- `eslint.config.js`
- `lit-localize.json`
- `release-please-config.json` and `.release-please-manifest.json`
- `.github/workflows/{test,release-please,continuous-deployment}.yml`
- `.githooks/` (via `oscd install-hooks`)

Scripts are exactly the template's `oscd lint|start|build|bundle|test|test:visual|test:update|deploy|prepare`.

**Dependencies.** Pin to the latest published versions at implementation time.
Today's versions are:

| Kind | Packages |
|---|---|
| Runtime | `lit@^3`, `@lit/localize@^0.12`, `@open-wc/scoped-elements@^3`, `@omicronenergy/oscd-ui@^0.1.1`, `@openscd/oscd-api@^0.1.6`, `@openscd/scl-lib@^2.0.1`, `tslib` |
| Dev | `@omicronenergy/oscd-tooling@0.0.8`, `@omicronenergy/oscd-shell@^0.0.18`, `@omicronenergy/oscd-menu-open`, `@omicronenergy/oscd-menu-save`, `@openpowershift/oscd-editor-subscriber-later-binding` (for integration tests and the demo), `@open-wc/testing@^4`, `@web/test-runner-commands`, `@webcomponents/scoped-custom-element-registry`, `sinon` |

### 2.2 Companion protocol: window events, not edit sniffing [shared + later binding]

**Decision (2026-10-14).** Companions no longer listen to or interpret
`oscd-edit` / `oscd-edit-v2` events. Later binding tells companions **what it
did** through a small, versioned set of `window` events. It also **dispatches
the companions' edits for them**. Only later binding touches the host's edit
event contract, so if that contract changes, the companions are unaffected.
The companions still build `EditV2` *values* with scl-lib, but never dispatch
edit events.

The shared module is `src/companion/protocol.ts`. It holds the event names, the
detail types, `PROTOCOL_VERSION = 1` and small typed `listen*` and `dispatch*`
helpers. An identical copy lives in later binding (`src/foundation/companion-protocol.ts`)
until the core is extracted (Q9).

| Event (on `window`) | Sent by | When | `detail` |
|---|---|---|---|
| `oscd-lb-subscription-change` | later binding | after each subscribe or unsubscribe it commits, **only if `allowExternalPlugins`** | `SubscriptionChange` (below) |
| `oscd-lb-companion-request` | later binding | `connectedCallback` | `{ version }` |
| `oscd-lb-companion-announce` | companion | on connect, in reply to a request, and when `enabled` changes | `{ version, identity, name, enabled }` |
| `oscd-lb-companion-withdraw` | companion | `disconnectedCallback` | `{ version, identity }` |

```ts
interface SubscriptionChange {
  version: 1;
  action: 'subscribe' | 'unsubscribe';
  extRef: Element;              // the ExtRef later binding changed
  fcda?: Element;               // bound FCDA; for unsubscribe, the one it WAS bound to
  controlBlock?: Element;       // likewise (resolved by later binding before unsubscribing)
  settings: { ignoreSupervision: boolean; checkOnlyPreferredBasicType: boolean };
  /** Apply edits as part of this user action. Later binding dispatches them
   *  immediately with squash: true, so they join the same undo entry and the
   *  document is up to date for the next companion. */
  apply(edits: EditV2[], options?: { title?: string }): void;
}
```

**Flow for one later-binding subscribe:**

```
later binding
  ├─ dispatch oscd-edit-v2 (subscribe ExtRef A)       → shell commits (sync)
  ├─ window.dispatchEvent(oscd-lb-subscription-change{subscribe, A, fcda, cb, apply})
  │     └─ SEL companion: plan → subscribe([...]) → change.apply(edits, {title:'SEL subscribe'})
  │            └─ later binding: dispatch oscd-edit-v2(edits, {squash:true, title}) → shell commits
  │     └─ (other companions: their IEDs don't match → no-op)
  └─ auto-increment: if next ExtRef is now subscribed → STOP (Step LB)
```

For a re-subscribe, later binding sends an `unsubscribe` change and then a
`subscribe` change. Each is handled in turn, and everything stays in one undo
entry.

**Why after the commit, and not "companions contribute edits before it"?**
scl-lib's `subscribe` and `unsubscribe` diff against the live document.

- On unsubscribe, whether the supervision is removed depends on whether *other* ExtRefs of the control block are still bound.
- If the companion planned before later binding's edit was applied, neither side would remove the supervision (stale LGOS/LSVS).
- On subscribe, both sides would insert it.

Applying in sequence avoids both problems.

**Rules for the companion core:**

1. Window listeners are added in `connectedCallback` and removed in `disconnectedCallback`. Today they are added in the constructor and never removed (L11).
2. The core ignores a change if the companion is disabled, the `version` is unsupported, the `fcda` or `controlBlock` is missing, or `extRef.closest('IED')` fails the vendor predicate (`manufacturer === 'SEL'`, exact).
3. The vendor `plan(change)` returns `{subscribe: Connection[], unsubscribe: Element[]}`. The core builds the edits with **one** `subscribe([...], {ignoreSupervision, checkOnlyBType, force: false})` call and **one** `unsubscribe([...], {ignoreSupervision})` call. It then calls `change.apply(edits, {title})` once.
4. **Skip, never overwrite** (Q3). A subscribe target is skipped if it is already subscribed or partially configured. An unsubscribe target is touched only if it is bound to the expected FCDA and control block.
5. No recursion. Later binding never emits changes for edits it applies on a companion's behalf.
6. Undo and redo emit nothing, so companions never react to them.
7. Title (Q5): `msg('SEL subscribe')` or `msg('SEL unsubscribe')`, so an undo label reads "Undo SEL subscribe". The title replaces later binding's title for that history entry. oscd-shell 0.0.18 does not display titles yet.
8. `apply` is synchronous. If a companion throws, later binding catches it, logs it and carries on, so its own action is never broken.

**Host facts this relies on** (verified in later binding's `node_modules`):

- `oscd-shell` 0.0.18 commits `oscd-edit-v2` **synchronously** in a bubble listener on its host.
- `XMLEditor.commit(…, {squash:true})` merges into the last history entry.
- Menu plugins are rendered off-screen while a document is open, so the companion is present to listen.

### 2.3 Plugin component

- `ScopedElementsMixin(LitElement)` with **no** `customElements.define`. Registration is the host's job.
- Properties: `doc`, `docName`, `docVersion`, `editor?`.
- `run()` opens the dialog.
- Root `:host` sets the `--oscd-*` variables from `--oscd-theme-*` with the defaults from theming.md. `theme.ts` then maps them to `--md-sys-color-*`, the shape and the font. Sub-parts use only `--oscd-*`.
- Its identity `openpowershift.oscd-menu-subscriber-lb-sel` is sent in its announce event (§2.2) and also reflected as an attribute.
- `enabled` is **on by default** (Q6). It is stored under the new key `oscd-menu-subscriber-lb-sel`; the old key is ignored.

### 2.4 Companion badge (Q8) [later binding]

Later binding keeps a `Map<identity, {name, enabled}>` from the
announce and withdraw events in §2.2. The badge shows the number with
`enabled: true`, and a tooltip lists the names, e.g. "Active companion plugins:
SEL, NR".

**Placement (Q15 → a).** The settings live in an `oscd-selection-list`, whose
items take only `headline` and `supportingText`. So:

- the "Allow External Plugins" item gets `supportingText` such as "2 active: SEL, NR", or "No active companion plugins";
- the settings button gets an `oscd-ui` `labs/badge` with the count, hidden at 0.

This applies to both the publisher and the subscriber settings menus.

---

## 3. Steps in detail

Each step ends with the verification sequence `npm i` → `npx tsc --noEmit` → `npm run build` → `npm test`.
Skills to load are noted in brackets.

### Step 2: scaffold [shared] (`plugin-migration` step 2, `plugin-to-oscd-tooling`, `adapt-menu-template`)

1. Copy the template's config files: `tsconfig.json`, `eslint.config.js`, `package.json` scripts, `.githooks`, workflows and release-please.
2. `git mv` the source into `src/` and rename it to `oscd-menu-subscriber-lb-sel.ts`.
3. Delete the legacy files:
   - `rollup.config.js`, `web-*.config.mjs`
   - `.rollup.cache`, `.tsbuildinfo`, `coverage/`, `dist/`, `custom-elements.json`
   - `foundation/identities`, `foundation/utils`
4. Update `package.json`: name, description, repository URL and keywords.
5. Run `npm run prepare`, then check that `git config core.hooksPath` is `.githooks`.
6. Expect a one-time Prettier reformat diff and commit it separately.

### Step 3: companion core [shared] (`oscd-api`, `implementation-hardening`)

1. `src/companion/protocol.ts`: event names, detail types, version, and typed dispatch and listen helpers.
2. `src/companion/companion.ts`: a `CompanionController` (a Lit `ReactiveController`) configured with `{identity, name, isVendorIed, plan, titles}`. It handles the window listener lifecycle, gating, the skip-never-overwrite filter, the batched scl-lib calls, `apply`, and announce/withdraw/request replies.
3. `src/companion/settings.ts`: `enabled` defaults to **true**, under key `oscd-menu-subscriber-lb-sel`.
4. Nothing in `src/companion/**` mentions SEL.

### Step 4: SEL rules (`scl-lib`, `editv1-to-editv2`, `iec-61850` as needed)

1. Move `decodeIntAddr`, `findMatchingExtRefs`, `svOrderedFCDAs`, `matchFCDAsToExtRefsSEL` and the Dbpos/DPC logic into `foundation/` as pure functions. The inputs are the ExtRef, its pre-edit attributes and the FCDA. The output is connections or ExtRefs to unsubscribe.
2. Replace local `findControlBlock` and `isSubscribed` with scl-lib `sourceControlBlock` and a small local `extRefIsSubscribed`. Keep `findFCDAs`, which is needed for pre-edit attribute lookups. Use scl-lib `fcdaBaseTypes`.
3. Check behaviour parity using the existing fixture before applying the §5 fixes.

### Step 5: logic gap fixes

See §5. Each fix gets a failing spec first.

### Step 6: UI (`mwc-to-oscd-ui`, `oscd-ui`, `lit-translate-to-lit-localize`, `scoped-elements`)

See §6.

### Step 7: tests (`test-hardening`)

See §7.

### Step 8: demo and README

1. `demo/index.html` and `demo/plugins.js` follow the template pattern: `registry.define` plus `tagName` for local plugins, `src` for remote ones.
2. The demo includes:
   - Open
   - Save
   - **Subscriber Later Binding** (from the npm devDependency, via `tagName`)
   - **this plugin** (menu)
   - Source Editor (via `src`)
3. The demo `sample.scd` is the SEL fixture (SEL 487E plus the NR merging unit).
4. Keep `README.adoc` (Q12). Fix the stale lint, build and test prose, the "Try it" links and the later-binding setting name.

### Step LB: later-binding changes (in `../oscd-editor-subscriber-later-binding`)

Work directly on `plugin-migration` (Q13).

0. **Companion protocol (§2.2).**
   - Add `src/foundation/companion-protocol.ts` (a copy of `protocol.ts`).
   - In `subscribe()` and `unsubscribe()`: resolve the `fcda` and `controlBlock` *before* dispatching an unsubscribe. After dispatching, if `allowExternalPlugins`, emit `oscd-lb-subscription-change` with an `apply` that dispatches `newEditEventV2(edits, {squash: true, title})` from the plugin, and catches and logs companion errors.
   - Keep the reflected `identity`, `allowexternalplugins` and `ignoresupervision` attributes for backwards compatibility, but no companion relies on them now.
   - Specs:
     - a fake companion receives the correct change for subscribe, unsubscribe and re-subscribe;
     - `apply` edits land in the same history entry;
     - no change is emitted when `allowExternalPlugins` is off;
     - no change is emitted for applied edits;
     - a throwing companion does not break the action.
1. **Auto-increment (L14, Q1).** Restore the original behaviour: auto-increment **never removes a subscription**. In `handleFcdaSelect`:
   - after dispatching the subscribe, re-check `next`;
   - if it is now subscribed or partially configured, for example filled by a companion, **stop**. Clear the selection and do not advance;
   - otherwise select it **without** calling `unsubscribe`. The `squash` unsubscribe path in `chooseSubscriberExtRef` is no longer used by auto-increment.
   - Specs: a companion stub subscribes the next ExtRef, so auto-increment stops and the history has one entry. A free next ExtRef is selected. No auto-increment path dispatches an unsubscribe.
2. **Companion badge (Q8).** Implement the §2.2 request/announce/withdraw listener and the count on the "Allow External Plugins" item (and the settings button, if (a)), in both the publisher and subscriber settings menus. Add specs with a fake companion announcing, toggling and withdrawing.

### Step 9: clean-up

1. Grep `src/` for forbidden imports: `@openscd/open-scd*`, `@material/*`, `@openenergytools/*`, `lit-translate`.
2. Check that `dist/` has no spec files and that the bundle builds.
3. Measure coverage.
4. Update the CHANGELOG through release-please.

---

## 4. Behaviour to preserve (SEL rules)

Applies only to ExtRefs inside `IED[manufacturer="SEL"]`, when the companion is
enabled and later binding has `allowexternalplugins`.

**A. Multi-phase sampled values.** When `serviceType="SMV"` and the first FCDA
starts an ordered run of `MX` value/`q` pairs, the companion subscribes the
other phases. The run must be in the same LD, `lnClass` and `doName`, with a
non-decreasing `lnInst`. The ExtRefs it subscribes:

- are in the same LN,
- come after the chosen ExtRef,
- have the same `intAddr` once the phase letter is removed (`IAS`/`IBS`/`ICS` → `IS`),
- are of transducer type `I` with `TCTR`, or `V` with `TVTR`.

Unsubscribing reverses this.

**B. Double position.** If the FCDA's base type is `Dbpos` with CDC `DPC`, the
next sibling ExtRef is subscribed to the same FCDA. The first is the "A
contact" (closed) and the second the "B contact" (open). Unsubscribing
reverses this.

---

## 5. Logic review: gaps and proposed fixes

| # | Finding | Severity | Proposed fix |
|---|---|---|---|
| L1 | Listens for the EditV1 `oscd-edit` and `isUpdate`, so it is **inert** with the current later-binding plugin | Blocker | Replaced by the window-event protocol (§2.2). No edit sniffing |
| L2 | Wrong identity string | Blocker | Identity gating removed. Only later binding emits protocol events (§2.2) |
| L3 | Each extra subscription is its own event, so its own undo step, and is not atomic | Blocker (requirement) | One `change.apply()` per change, squashed by later binding |
| L4 | `subscribe()` is called once per connection and dispatched between calls. scl-lib v2 diffs against live SCL, so batched calls would duplicate supervision `Insert`s | High | Single `subscribe([...])` |
| L5 | `matchFCDAsToExtRefsSEL`: `subscriptionStatus` is compared with itself (always true). The intended check that the other phases' state matches never runs. On **unsubscribe**, phases B/C are unsubscribed **even if subscribed to something else**. On **subscribe**, existing B/C subscriptions are overwritten without being unsubscribed first | High | Subscribe only phases that are **unsubscribed** (Q3: skip). Unsubscribe only phases whose current source **equals the expected FCDA and control block** |
| L6 | Array index mismatch: ExtRefs are sliced to `numberOfSvs` (which counts `q` entries), but FCDAs are filtered to values only. A 2-phase run gives 4 → 3 ExtRefs but 2 FCDAs, so `fcdas[2].getAttribute` throws a **TypeError** inside the event listener | High (crash) | Pair by phase, bounded by `min(len)` |
| L7 | Phases are paired by **document order**, not by phase letter. If the ExtRefs are ordered differently or start at phase B (`IBS`), IBS→phase-A FCDA | Medium | Map the phase letter `A/B/C` to FCDA position in the run. There is **no neutral for SEL** (Q4). Do not subscribe on a mismatch |
| L8 | DPC: the "next sibling" is not checked to be an ExtRef with the same `serviceType` and an `intAddr`, nor to be unsubscribed. Unsubscribe removes the next sibling's subscription **regardless of its source** | High | Require an ExtRef with `intAddr` and the same `serviceType`. Subscribe only if it is free. Unsubscribe only if it is bound to the same FCDA and control block |
| L9 | `ignoreSupervision` is applied only to SV unsubscribe. DPC unsubscribe and all subscribes ignore it | Medium | Apply consistently (§2.2 rule 5) |
| L10 | `preEventExtRef` aligns with `flatEdits` by index, using whole ExtRef clones via `importNode` | Low | Removed. Later binding passes the previous `fcda` and `controlBlock` |
| L11 | Window listeners are added in the constructor and never removed, which leaks across instances and tests | Medium | Controller lifecycle |
| L12 | `svOrderedFCDAs` is limited to 8 FCDAs (4 pairs). The `daName` "update" is a no-op. `lnInst` is compared only with the first FCDA, not the previous one. `parseInt('')` gives `NaN`, which silently passes | Low | Rewrite clearly, compare with the previous FCDA, treat `NaN` as a break. Cap at 3 pairs for SEL (Q4) |
| L13 | `manufacturer === 'SEL'` is exact | — | **Keep exact** (Q7) |
| L14 | **Auto-increment interaction**. In the subscriber view with auto-increment, later binding computes `next` *before* subscribing. The companion then subscribes that same next ExtRef (DPC B contact, or the next phase). Later binding's `chooseSubscriberExtRef(next, squash)` then **unsubscribes it**. The companion sees that unsubscribe and may cascade to *its* next sibling | High (cross-plugin) | **Decided (Q1), do both:** later binding stops auto-increment at a subscribed input and never unsubscribes as part of it (Step LB). The L8 fix in the companion acts as a safety net |
| L15 | Reacts to any later-binding `Update`, including ones that only clear partially configured ExtRefs | Low | Later binding states the `action` explicitly. Add a spec |

---

## 6. UI review: gaps and proposed changes

| # | Finding | Proposed |
|---|---|---|
| U1 | `mwc-*` dialog with a hard-coded `float:right` and the `?checked` workaround for old mwc | `oscd-dialog` with headline, content and actions. Use `oscd-switch` with a `<label>`, not `formfield`, and `oscd-text-button` "Close". Use the `@omicronenergy/oscd-ui` scoped imports |
| U2 | `enabled` is only committed on "Close", so dismissing with Esc or the scrim loses the change. The original comment says this was a workaround | Commit on switch `change`. "Close" only closes |
| U3 | Later binding cannot tell which companions are active | Companion announces itself (§2.2). Later binding shows the count badge (Step LB) |
| U4 | No feedback when the companion acts | Undo entry title "SEL subscribe" / "SEL unsubscribe" (Q5) |
| U5 | No theming | `:host` palette per theming.md. Dialog and switch use `--oscd-*` through `theme.ts` |
| U6 | Link points to `danyill/oscd-subscriber-later-binding` | Point to the OpenPowerShift repo |
| U7 | Accessibility | Dialog is labelled, switch has an accessible name, focus returns on close |
| U8 | Localisation: menu `translations` in the README and demo are wrong ("Kommunikationsexport") | Fix `de` and `pt`, regenerate the XLIFF and keep `locales` generation in the build |

---

## 7. Test strategy (target ≥ 95 % statements, suite < 10 s)

Most coverage comes from **pure foundation specs on tiny inline SCL** built in
`src/testing/fixtures.ts`. These need no shell, no network and no sleeps. The
fixture builders make a few-hundred-line SCL with one SEL IED and one publisher.

| Layer | What | How |
|---|---|---|
| Unit: SEL foundation | `decodeIntAddr`, the phase run detection (all L6/L7/L12 cases), DPC pairing (L8), and planning for subscribe/unsubscribe/no-op | `@open-wc/testing` `expect`, inline SCL |
| Unit: companion core [shared] | Version, enabled and manufacturer gating; a single batched subscribe and unsubscribe (L4); settings passthrough (L9); skip-never-overwrite; listener removal (L11); announce, withdraw and request replies | Dispatch synthetic `oscd-lb-subscription-change` on `window` with a sinon `apply` spy. **No shell needed** |
| Integration: atomicity | Real `oscd-shell` + real later binding + companion. Perform a subscribe through later binding, then check: history has **one** entry, `undo()` restores the original SCL byte-for-byte, and `redo()` restores the subscribed state. Repeat for unsubscribe, re-subscribe and auto-increment (L14) | `src/testing/shell.ts` mounts once per file. Drive later binding through its public handlers or `extref-select` / `fcda-select` events, not mouse coordinates |
| Component | Dialog opens via `run()`; default on; switch persists to `localStorage`; announce/withdraw/request handshake (§2.2) | `fixture()` |
| Visual | Dialog closed or open, light and dark theme | `oscd test --visual`, few baselines, Chromium only |

The old `test/` directory, its screenshots and the commented-out mock are removed.

---

## 8. Replication guide (Siemens, NR) and shared-core study

### 8.1 What the three plugins share (studied 2026-10-14)

`oscd-subscriber-lb-{sel,siemens,nr}.ts` are about 80% identical.
`foundation/subscription/subscription.ts` is byte-identical in all three, and
`foundation/identities/*` and `utils/scldata.ts` are unused copies.

| Concern | SEL | Siemens | NR | → Core? |
|---|---|---|---|---|
| `shouldListen`, `captureMetadata`, change classification (edit sniffing) | ✔ | ✔ | ✔ | **deleted**, replaced by the protocol (§2.2) |
| Enabled gate, manufacturer filter | `SEL` | `SIEMENS` | `NRR` | **core**, parameterised by a manufacturer predicate |
| Dialog + enable switch + storage | ✔ | ✔ | ✔ | **core** component, vendor gives title, bullets, key |
| `getNextSiblings`, `svOrderedFCDAs` | ✔ | ✔ identical | — | **core** rule primitive |
| Rule: SV phases | intAddr phase letter, same LN | intAddr `doName;lnClass/doName/daName`, consecutive ExtRefs in LDevice | — | vendor *matcher* on a core "SV run" primitive |
| Rule: value + quality pair | — | quality ExtRef found by parsed intAddr in the same `Inputs` | quality ExtRef = next sibling, matched by intAddr | vendor *matcher* on a core "pair" primitive |
| Rule: DPC A/B contacts | ✔ | — | — | vendor |

**Conclusion: there is an extractable core.** A vendor plugin then reduces to:

```ts
defineCompanion({
  identity, name, storageKey, titlePrefix,      // 'SEL'
  isVendorIed: ied => ied.getAttribute('manufacturer') === 'SEL',
  plan: (change: ExtRefChange, ctx) => Planned, // { subscribe: Connection[], unsubscribe: Element[] }
  description: () => html`<ul>…</ul>`,
});
```

The core owns:

- the protocol listener and gating,
- the skip-never-overwrite filter (§2.2 rule 6),
- batched scl-lib calls,
- `change.apply` with the title,
- announce, withdraw and request replies,
- the dialog, theming and settings,
- the integration test harness.

**Approach (Q9):** build `src/companion/**` in SEL with exactly this boundary,
so nothing in it mentions SEL. After SEL is merged, refactor Siemens and NR onto
it. Then decide between a shared package (e.g.
`@openpowershift/oscd-later-binding-companion`) and copying. Later binding
would also import `protocol.ts` from that package.

### 8.2 Bugs found in the siblings (to fix during their upgrades)

| # | Plugin | Finding |
|---|---|---|
| S1 | Siemens | Same self-comparison as L5: `subscriptionStatus` is always true, so it unsubscribes or overwrites regardless of source |
| S2 | Siemens | `extRef.closest('LN')!` gives `null` for an ExtRef in `LN0`, so it **crashes** with a TypeError |
| S3 | Siemens | Quality subscribe hard-codes `ignoreSupervision: false`. Quality unsubscribe ignores the setting. SV subscribe ignores `checkOnlyBType` |
| S4 | Siemens | SV threshold `> 2` versus SEL `> 1`. Needs to be confirmed as intentional |
| S5 | Siemens | Per-connection `subscribe` calls (L4) and per-edit undo steps (L3) |
| N1 | NR | `extRefMatchNR` splits intAddr on `.`. For `RxExtIn1;/Ind/stVal` both prefixes are empty, so **any next sibling ending in `q`** matches |
| N2 | NR | Unsubscribes the next sibling regardless of its source (like L8) |
| N3 | NR | The test fixture is a copy of the Siemens one and has **no NR IED**. Real NR intAddr examples are needed (Q14) |
| N4 | NR | Value/quality on the next sibling means every auto-increment subscribe hit L14 (fixed by Step LB) |

### 8.3 Procedure per sibling (on an `upgrade` branch)

1. Run Step 2 (scaffold) exactly as in this repo.
2. Add the core: copy `src/companion/**`, or depend on the extracted package.
3. Port the vendor rules into `src/foundation/<vendor>.ts` as a `plan()` function, then fix the S-numbered or N-numbered items with failing specs first.
4. Write vendor fixtures and the parameterised integration specs: one history entry, undo, redo, auto-increment stop.
5. Do the demo, README and clean-up as in Steps 8 and 9.
6. Record a worklog entry in that repo's `docs/plan.md`.

---

## 9. Worklog

_Append a "Step N completion summary" (skill: `worklog-completion-summary`) as
each step completes: what changed, verification commands and results, deviations, and follow-ups._

- **Step 1** (2026-10-14): plan drafted on branch `upgrade`. Inspected:
  - the later-binding plugin (`../oscd-editor-subscriber-later-binding`, branch `plugin-migration`)
  - oscd-shell 0.0.18 and oscd-editor `XMLEditor.commit` squash semantics
  - scl-lib v2 subscribe/unsubscribe
  - the OMICRON databinding template
  - theming.md @153e3d5

---

## 10. Questions and decisions

| # | Topic | Decision |
|---|---|---|
| Q1 | Auto-increment (L14) | **Both.** Later binding stops at a subscribed next input and never unsubscribes during auto-increment (original behaviour). The companion also gets the L8 safety net |
| Q2 | Identity | Superseded by the window-event protocol (§2.2): companions no longer gate on later binding's identity, and the legacy one is dropped. The companion advertises `openpowershift.oscd-menu-subscriber-lb-sel` in its announce event |
| — | Integration | **Window events, not edit sniffing** (§2.2). Later binding dispatches companion edits via `apply`, so companions are insulated from edit-event contract changes |
| Q3 | Overwrite policy | **Skip** already-bound targets |
| Q4 | Neutral channel | **Not for SEL** |
| Q5 | Undo title | "SEL subscribe" / "SEL unsubscribe", so an undo label reads "Undo SEL subscribe" |
| Q6 | Settings | **Enabled by default**; new key; old key ignored |
| Q7 | Manufacturer | Exact `"SEL"` |
| Q8 | Status | Count badge of active companions in later binding by "Allow External Plugins" (§2.4). Placement (a) or (b) is Q15 |
| Q9 | Shared core | Build a vendor-neutral `src/companion/**` here, then refactor Siemens and NR onto it (§8.1) |
| Q10 | Package | `@openpowershift/oscd-menu-subscriber-lb-sel`; remote already moved |
| Q11 | Template | `OMICRONEnergyOSS/oscd-editor-subscriber-databinding` |
| — | Commits | Authored as the user only, with no Claude co-author trailer |

| Q12 | README | **Keep AsciiDoc** (`README.adoc`), as later binding does |
| Q13 | Later-binding branch | Work directly on `plugin-migration` (clean) |
| Q15 | Badge | **(a)** supporting text on "Allow External Plugins" (e.g. "2 active: SEL, NR") plus an `oscd-ui` badge with the count on the settings button |

**Still open**

- **Q14, NR intAddr samples:** needed for the NR upgrade (N1/N3). Not blocking SEL.
