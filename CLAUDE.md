# CLAUDE.md — Developer Guide

## Project

Wavr is a static browser-based visual theremin by Mario the Maker. MediaPipe hand tracking and Web Audio synthesis run entirely client-side. The root `index.html` is compatible with GitHub Pages.

## Quick Start

```bash
python3 -m http.server 5050
# http://localhost:5050
```

Do not open the app through a plain HTTP LAN IP when camera access is required. Use localhost or HTTPS.

## Architecture

- **`index.html`** — Static application entry point, record-sleeve interface, controls, About section, and pinned MediaPipe scripts.
- **`static/js/hand-tracking.js`** — MediaPipe/camera lifecycle, stable one- or two-hand identity, gesture extraction, retries, and cleanup.
- **`static/js/audio-engine.js`** — Multi-voice Web Audio synth, scale quantization, seven sound modes, and context lifecycle.
- **`static/js/app.js`** — DOM controller for settings, metrics, camera states, explicit power, visibility, and BFCache behavior.
- **`static/css/style.css`** — Six-token 1960s surf-pop design system, responsive layout, power states, focus treatment, and reduced motion.

## Runtime Flow

```text
Camera frame
  → HandTracking assigns stable IDs and extracts x/y/openness
  → app.js clamps normalized controls
  → AudioEngine creates or updates the matching voice
  → app.js renders note, level, tone, and status
```

A lifecycle generation in `hand-tracking.js` invalidates pending camera starts and late MediaPipe results after stop/destroy. Each `Hands` instance captures its generation in the result callback. Preserve this contract when changing camera code.

## Audio

Scales are pitch-class arrays in `audio-engine.js`. `quantize()` searches valid pitch classes around the input note's octave. Each voice owns its oscillator graph, low-pass filter, and gain node.

| Mode | Key | Design |
|---|---|---|
| FM Synth | `fm` | Carrier and modulator |
| Clean Wave | `clean` | Sine or sawtooth |
| Warm Tone | `warm` | Triangle plus delay character |
| Pad | `pad` | Three detuned oscillators |
| Theremin | `theremin` | Sine plus vibrato LFO |
| Organ | `organ` | Fundamental plus harmonics |
| Bitcrush | `bitcrush` | Sawtooth through stepped waveshaping |

When destroying a voice, always clean up the captured old graph even if the same ID has already been reused.

## Power and Page Lifecycle

Power Off must:

1. Stop all voices.
2. Stop camera tracks and invalidate pending tracking work.
3. Suspend the AudioContext.
4. Prevent visibility/BFCache restoration from restarting the instrument.

Power On runs from a user gesture, resumes audio, and restores camera state. Camera callbacks and `onHandData()` must continue to respect explicit power and document visibility.

## Camera Security

`getUserMedia()` requires HTTPS except on loopback origins. Use `http://localhost:5050` or `http://127.0.0.1:5050` locally. GitHub Pages provides HTTPS. Do not suggest a plain LAN IP as a camera-capable URL.

## Conventions

- No backend, build step, bundler, npm, or external font dependency.
- Browser modules use revealing IIFEs with explicit public APIs.
- Keep all base colors in the six `:root` tokens; derive variants with `color-mix()`.
- Preserve existing element IDs because `app.js` binds directly to them.
- Keep MediaPipe package versions pinned consistently in `index.html` and the hand asset resolver.
- Use relative local asset URLs so GitHub Pages works under `/Wavr/`.
- Do not commit `venv/`, `__pycache__/`, `.DS_Store`, or local editor settings.

## Validation

```bash
node --check static/js/audio-engine.js
node --check static/js/hand-tracking.js
node --check static/js/app.js
git diff --check
```

Then manually verify in a camera-capable browser:

1. Camera success and failure/retry states.
2. Audio after the first click/key gesture.
3. Valid notes after scale/root changes.
4. Stable one- and two-hand voices.
5. Power Off releases the camera and Power On restores it.
6. Hide/show and browser back/forward cache behavior.
7. Phone-width layout and keyboard focus.

## Common Changes

| Task | Files |
|---|---|
| Add a scale | `audio-engine.js` and scale dropdown in `index.html` |
| Add a synth | `audio-engine.js` and synth dropdown in `index.html` |
| Change gestures | `hand-tracking.js` and `app.js` |
| Change layout/theme | `index.html` and `style.css` |
| Change power/lifecycle | `app.js`, `hand-tracking.js`, and `audio-engine.js` |
