# JISSI — Project Story (Portfolio / Interview)

> Framing: **building (and recovering) an AI-native voice assistant.** The honest,
> modern angle: strong architecture + AI-assisted engineering + verification.

## One-paragraph version (portfolio intro)
JISSI is a cross-platform AI voice assistant (Expo / React Native, Google Gemini,
Web Speech + native STT) designed **architecture-first**: a clean, downward-only
dependency flow from UI → hooks → services. That design was tested for real when the
entire source tree was lost and the backup turned out to be empty — the app was
**reconstructed layer by layer** using AI-assisted recovery and a precise
architectural map, then the voice → AI → speech pipeline was brought up on web.
It's a case study in **layered design, crisis recovery, and navigating hard
platform constraints** (native modules vs. web).

---

## The three pillars (talking points)

### 1. Architecture-first — the design that paid off
- Strict layers with dependencies pointing **only downward**:
  `UI (screens/components) → hooks (orchestration) → services (AI, speech, voice,
  actions, storage) → engine`.
- Services are singletons that know nothing about React. Hooks are the bridge; the
  UI stays declarative.
- **Interview line:** *"The proof the architecture was right is that when I lost the
  files, the `services/` layer was the one piece that survived intact and reusable —
  because it had zero upward dependencies. Good boundaries aren't theoretical; they
  showed up as resilience."*

### 2. Crisis management — the recovery
- The project was accidentally deleted; the "backup" ZIP was hollow (folder
  structure, **0 files**).
- Instead of panicking, I ran a **forensic recovery**: located the real project
  root, proved the backup was empty, mapped exactly what survived vs. what was
  missing, and built a **dependency-ordered restoration plan**
  (config → engine/constants → hooks → components → screens).
- Rebuilt **phase by phase**, verifying module resolution (`tsc --noEmit`) and a
  renderable app after each phase — restoring with verification gates rather than
  all at once.
- **Interview line:** *"I treated it like an incident: assess blast radius,
  establish source of truth, restore in dependency order with verification gates.
  The architecture was my recovery map."*

### 3. Platform-specific engineering — web vs. native
- Diagnosed that **STT behaves completely differently per platform**: the browser
  **Web Speech API** on web vs. the native `@react-native-voice/voice` module on
  Android — which **isn't available in Expo Go at all**.
- Fixed a real crash (`startSpeech of null`) by detecting the *actual* native module
  (`NativeModules.Voice`) instead of the always-present JS wrapper, so the app
  **degrades gracefully** where STT can't run.
- Made a deliberate call: validate the full pipeline on **web** first (zero native
  build), and scope **wake word + system overlay** to an **EAS dev build** —
  understanding the boundary between what Expo Go can and can't do.
- **Interview line:** *"I don't assume 'one codebase works everywhere.' I map each
  capability to its runtime requirement — and make features fail gracefully when the
  runtime can't support them."*

---

## Why this reads as "AI Native Engineer" growth
- **Architected for an LLM at the core** (Gemini), with a swappable `detectIntent`
  seam — regex today, an LLM classifier tomorrow — behind the same interface, so no
  caller changes.
- **Used AI as a force-multiplier** for recovery and refactoring — and, crucially,
  **verified** its output (resolution checks, runtime traces, dedup and version
  diagnostics) rather than trusting it blindly. *Orchestrate AI, then verify* — that
  judgment is the differentiator.
- Can speak precisely to **the limits**: where the AI / native / runtime boundaries
  are, and how the system was designed around them.

---

## A note on integrity
Tell it as it happened: *"I lost the files and used AI-assisted reconstruction
guided by my architecture."* That is a **stronger** story than "I retyped it from
memory," and it is the genuinely modern engineering skill worth showcasing.

---

## Quick facts (for a résumé bullet)
- **Stack:** Expo (SDK 54), React Native 0.81, TypeScript, Expo Router, Google
  Gemini, Web Speech API / `@react-native-voice/voice`, `expo-speech`.
- **Pattern:** layered architecture (UI → hooks → singleton services → engine),
  observer pattern for service state, rule-based intent engine with an LLM-swap seam.
- **Highlights:** full forensic recovery after data loss; web voice→AI→TTS pipeline;
  graceful platform degradation; EAS-based plan for native wake word + system overlay.
