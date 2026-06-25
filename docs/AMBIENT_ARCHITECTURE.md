# JISSI — Ambient Assistant Architecture (Wake Word + System Overlay)

> Status: **design / future work.** None of this runs in Expo Go — all of it
> requires a custom **EAS development build** with native modules.

## Overview
To evolve JISSI from a tap-to-talk app into an **ambient assistant**, three
native capabilities are needed:
1. A **background wake-word service** ("Hey JISSI").
2. A **system overlay** (the "Pink Aura") that floats above other apps.
3. A way to **build & test** these natively, since Expo Go cannot run native
   background services or overlays.

---

## 1. Wake-word background service ("Hey JISSI")

```
┌─ Android Foreground Service (persistent notification) ────────────────────────┐
│  Permissions: RECORD_AUDIO, FOREGROUND_SERVICE, FOREGROUND_SERVICE_MICROPHONE, │
│               POST_NOTIFICATIONS                                               │
│                                                                               │
│  Porcupine wake-word engine   ← @picovoice/porcupine-react-native             │
│    + @picovoice/react-native-voice-processor  (16 kHz mono mic stream)        │
│                                                                               │
│  Loops at low power, listening ONLY for the keyword "Jissi".                   │
│  On detection → DeviceEventEmitter event → JS layer →                          │
│     show overlay (Pink Aura) + start full STT (SpeechService).                 │
└────────────────────────────────────────────────────────────────────────────────┘
```

**Library choice:** `@picovoice/porcupine-react-native` (+ voice-processor).
- Needs a free **Picovoice access key**; train a custom **"Jissi"** keyword in the
  Picovoice Console.
- Keyword spotting is cheap and on-device; full STT only starts *after* the wake
  word, keeping battery/privacy cost low.

**Background persistence (Android):** a **Foreground Service** keeps the mic alive
when the app is backgrounded. Add the service + permissions to `AndroidManifest.xml`
via an **Expo config plugin** (so it survives `expo prebuild`).

**Trade-offs (call these out in interviews):**
- Always-on mic = battery + privacy concerns → mitigate with on-device keyword
  spotting (no audio leaves the device until activation), a visible persistent
  notification, and a user on/off toggle.
- **iOS:** true always-listening background mic is effectively disallowed by the
  OS — wake word there is limited to the foreground. This is a hard platform
  constraint, not a bug.

---

## 2. System Overlay — the "Pink Aura"

- **Permission:** `SYSTEM_ALERT_WINDOW` ("Display over other apps"). The **user must
  grant it** in Android Settings (cannot be auto-granted). The existing
  `useOverlayPermission` hook already deep-links the user there.
- **Implementation:** there is no pure-Expo API. A thin **native module** uses
  Android `WindowManager` + `TYPE_APPLICATION_OVERLAY` to draw a view above all
  apps (like Messenger chat-heads). The "aura" = a translucent pink gradient
  ring / edge-glow rendered by that overlay window, toggled on wake-word activation.
- **Options:**
  - Write a small custom native module (cleanest, most control).
  - Or evaluate a community library (overlay / floating-bubble modules) — vet
    maturity and SDK-54 compatibility first.
- **MVP shortcut:** ship an **in-app** edge-glow first (pure RN, works today), then
  promote it to a true system overlay once the native module is in place — so the
  *look* can be demoed immediately.

---

## 3. EAS Development build — step-by-step

This is also the answer to the local-machine limits (low RAM / full C: drive):
**EAS builds the native binary in the cloud**, so your laptop is not the bottleneck.

```bash
# 0. one-time
npm i -g eas-cli
eas login

# 1. add the dev client + configure
npx expo install expo-dev-client
eas build:configure            # creates eas.json

# 2. add native deps + their config plugins
npx expo install @picovoice/porcupine-react-native @picovoice/react-native-voice-processor
#   (+ your overlay native module / config plugin; add a foreground-service plugin)

# 3. eas.json -> ensure a "development" profile:
#    { "build": { "development": { "developmentClient": true, "distribution": "internal" } } }

# 4. cloud-build an installable Android dev APK (NOT on your laptop)
eas build --profile development --platform android

# 5. install the APK on a REAL Android phone (scan the QR EAS returns)

# 6. run Metro against the dev build (JS hot-reload; native is baked in)
npx expo start --dev-client

# 7. on the phone: grant mic + "display over other apps" → say "Jissi" → aura appears
```

**Why this is the minimal viable path:**
- Native binary builds in the cloud → low-RAM / full-disk machine is not a blocker.
- JS changes hot-reload instantly via Metro; you only re-run `eas build` when
  **native** code or permissions change.
- The free tier covers occasional Android dev builds.

---

## Summary
| Capability | Requires | Runtime |
|---|---|---|
| Wake word ("Hey JISSI") | Porcupine + foreground service + config plugin | EAS dev build |
| Pink Aura overlay | `SYSTEM_ALERT_WINDOW` + native WindowManager module | EAS dev build |
| Tap-to-talk STT | Web Speech API (web) / `@react-native-voice/voice` (native) | Web today; native via EAS dev build |
