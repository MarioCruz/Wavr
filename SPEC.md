# Wavr Visual Theremin — Specification

## Overview

Wavr is a static web-based musical instrument controlled by hand gestures detected through a webcam. MediaPipe maps hand position and openness to a multi-voice Web Audio synthesizer. All behavior runs client-side and the root `index.html` can be hosted on GitHub Pages.

**Creator:** Mario the Maker

**Target platform:** Chromium on desktop or Raspberry Pi 5

**Stack:** MediaPipe Hands, Web Audio API, vanilla HTML/CSS/JavaScript

## Interaction Model

| Gesture | Parameter | Mapping |
|---|---|---|
| Horizontal hand position | Pitch | Left = low, right = high |
| Vertical hand position | Voice level | Bottom = quiet, top = loud |
| Hand openness | Low-pass cutoff | Fist = dark, open = bright |

Input values are clamped to `0..1` because landmarks can briefly leave the camera frame.

### Ranges

- Frequency: approximately 65 Hz (C2) to 1047 Hz (C6), logarithmically mapped
- Voice level: 0% to 50% before multi-voice scaling
- Filter cutoff: 200 Hz to 8000 Hz
- Glide: 0 to 500 ms
- Tracked hands: one by default, two when enabled

### Activation and Power

- A detected hand creates a voice; removing it fades and destroys that voice.
- Power Off stops every voice, camera track, and pending tracking generation, then suspends audio.
- Power On resumes audio from the user gesture and restarts tracking or restores the last camera error.
- Hiding the page pauses camera/audio work. Hidden initial loads do not acquire the camera.
- BFCache restoration respects both visibility and explicit power state.

## Hand Tracking

`static/js/hand-tracking.js` owns MediaPipe and camera lifecycle behavior.

- MediaPipe versions are pinned in `index.html` and the hand asset resolver.
- Two-hand detections compare complete identity assignments before committing matches.
- Handedness and recent position contribute to continuity scoring.
- Implausibly distant remembered tracks are rejected.
- Identity memory persists briefly through tracking flicker.
- Camera startup uses lifecycle generations so a pending start cannot outlive a stop request.
- Every `Hands` instance captures its generation; late callbacks from released instances are discarded.
- Canvas dimensions change only when source dimensions change.
- Permission denial, missing or busy devices, insecure contexts, processing failures, and missing CDN globals receive user-facing errors.

## Audio Engine

Each hand receives an independent oscillator graph ending in a low-pass filter and gain node.

| Mode | Sound design |
|---|---|
| FM Synth | Sine carrier with frequency modulation |
| Clean Wave | Selectable sine or sawtooth oscillator |
| Warm Tone | Triangle oscillator with delay character |
| Pad | Three lightly detuned oscillators |
| Theremin | Sine oscillator with vibrato LFO |
| Organ | Fundamental plus second and third harmonics |
| Bitcrush | Sawtooth through a stepped waveshaper |

### Pitch System

The engine supports Chromatic, Major, Natural Minor, Major Pentatonic, Minor Pentatonic, Blues, Dorian, Mixolydian, Harmonic Minor, and Whole Tone scales in all 12 roots. Non-chromatic candidates are anchored to octave pitch classes and searched across adjacent octaves.

### Lifecycle

- Voice destruction always tears down the captured old graph even if its ID is immediately reused.
- Gain fades prevent abrupt voice removal.
- `ensureAndResume()`, `suspend()`, and `close()` expose AudioContext lifecycle operations.
- Final close disconnects all nodes and releases the context.

## User Interface

The interface uses a 1960s surf-pop record-sleeve visual language without external fonts.

- Side A live camera stage
- Side B studio console
- Live voice metrics and instrument status
- Album track-list instructions
- About Mario the Maker sleeve notes
- Keyboard-accessible camera retry and power controls
- Responsive single-column layouts below tablet widths
- Reduced-motion support

The six base colors are defined once in `static/css/style.css`; derived colors use `color-mix()`.

## Architecture

```text
Static host / GitHub Pages
└── index.html + static assets
    ├── MediaPipe Hands + Camera Utils
    │   └── webcam → stable hand IDs → normalized controls
    ├── Web Audio API
    │   └── per-hand oscillators → low-pass filter → gain → output
    └── App controller
        └── settings, metrics, errors, power, visibility, and BFCache
```

## Secure-Origin Requirements

Camera access requires HTTPS except for browser-recognized loopback origins such as `localhost` and `127.0.0.1`. GitHub Pages supplies HTTPS. Plain HTTP LAN addresses are not camera-capable secure origins for remote viewers.

Local asset paths must remain relative so project-page hosting under `/Wavr/` works.

## File Structure

```text
Wavr/
├── index.html
├── README.md
├── SPEC.md
├── CLAUDE.md
└── static/
    ├── css/style.css
    └── js/
        ├── audio-engine.js
        ├── hand-tracking.js
        └── app.js
```

## Acceptance Checks

1. Camera starts on localhost and the HTTPS GitHub Pages deployment.
2. Actionable errors appear when the camera cannot start.
3. One and two hands retain stable voice IDs while moving or result order changes.
4. Every selected scale emits only valid pitch classes for its root.
5. Disappearing/reappearing hands do not leak oscillator graphs.
6. Power Off releases camera tracks and silences/suspends audio.
7. Power On restores the instrument without reloading.
8. Hidden pages do not acquire the camera or recreate voices from stale results.
9. Relative CSS and JavaScript assets load under the `/Wavr/` GitHub Pages path.
10. The interface reflows without horizontal scrolling on phone widths.
