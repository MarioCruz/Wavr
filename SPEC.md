# Wavr Visual Theremin — Specification

## Overview

Wavr is a web-based musical instrument controlled by hand gestures detected through a webcam. MediaPipe runs in the browser and maps hand position and openness to a multi-voice Web Audio synthesizer. Flask only renders the page and serves local assets.

**Creator:** Mario the Maker

**Target platform:** Chromium on desktop or Raspberry Pi 5

**Stack:** Python/Flask, MediaPipe Hands, Web Audio API, vanilla HTML/CSS/JavaScript

## Interaction Model

| Gesture | Parameter | Mapping |
|---|---|---|
| Horizontal hand position | Pitch | Left = low, right = high |
| Vertical hand position | Voice level | Bottom = quiet, top = loud |
| Hand openness | Low-pass cutoff | Fist = dark, open = bright |

Input values are clamped to `0..1` before synthesis because landmarks can briefly leave the camera frame.

### Ranges

- Frequency: approximately 65 Hz (C2) to 1047 Hz (C6), logarithmically mapped
- Voice level: 0% to 50% before multi-voice scaling
- Filter cutoff: 200 Hz to 8000 Hz
- Glide: 0 to 500 ms
- Tracked hands: one by default, two when enabled

### Activation and Power

- A detected hand creates a voice; removing it fades and destroys that voice.
- The Power Off control stops every voice, stops camera tracks and pending tracking work, suspends audio, and prevents visibility restoration from restarting the instrument.
- Power On resumes audio from the user gesture and restarts camera tracking or restores the last actionable camera error.
- Hiding the page pauses camera/audio work. BFCache restoration respects the current power state.

## Hand Tracking

`static/js/hand-tracking.js` owns MediaPipe and camera lifecycle behavior.

- MediaPipe package versions are pinned in the template and hand asset resolver.
- Detections are associated with recent position and handedness instead of trusting result-array order.
- Identity memory persists briefly through tracking flicker.
- Camera startup uses lifecycle generations so a pending start cannot outlive a stop request.
- Late MediaPipe results from stopped generations are discarded.
- Canvas dimensions change only when the source video dimensions change.
- Permission denial, missing devices, busy devices, insecure contexts, processing failures, and missing CDN globals receive user-facing errors.

## Audio Engine

Each hand receives an independent chain ending in a low-pass filter and gain node.

| Mode | Sound design |
|---|---|
| FM Synth | Sine carrier with frequency modulation |
| Clean Wave | Selectable sine or sawtooth oscillator |
| Warm Tone | Triangle oscillator with delay/reverb character |
| Pad | Three lightly detuned oscillators |
| Theremin | Sine oscillator with vibrato LFO |
| Organ | Fundamental plus second and third harmonics |
| Bitcrush | Sawtooth through a stepped waveshaper |

### Pitch System

The engine supports Chromatic, Major, Natural Minor, Major Pentatonic, Minor Pentatonic, Blues, Dorian, Mixolydian, Harmonic Minor, and Whole Tone scales in all 12 roots. Non-chromatic candidates are anchored to octave pitch classes and searched across adjacent octaves.

### Lifecycle

- Voice destruction captures and always tears down the old graph even if its numeric ID is immediately reused.
- Gain fades prevent abrupt voice removal.
- `ensureAndResume()`, `suspend()`, and `close()` expose AudioContext lifecycle operations.
- Final close disconnects all nodes and releases the context.

## User Interface

The interface uses a 1960s surf-pop record-sleeve visual language without external fonts.

- Side A: live camera stage
- Side B: studio console
- Live voice metrics and instrument status
- Album track-list instructions
- About Mario the Maker sleeve notes
- Keyboard-accessible camera retry and power controls
- Responsive single-column layouts below tablet widths
- Reduced-motion support

The six base color tokens are defined once in `static/css/style.css`; derived colors use `color-mix()`.

## Architecture

```text
Browser
├── MediaPipe Hands + Camera Utils
│   └── webcam → stable hand IDs → normalized controls
├── Web Audio API
│   └── per-hand oscillators → low-pass filter → gain → output
└── App controller
    └── settings, metrics, camera errors, power, and page lifecycle

Flask
└── renders templates/index.html and serves static assets
```

## Secure-Origin Requirements

Camera access requires HTTPS except for browser-recognized loopback origins such as `localhost` and `127.0.0.1`. A plain HTTP LAN IP is not sufficient for a remote viewer's camera.

The Flask entry point defaults to `127.0.0.1:5050` with debug mode off. `WAVR_HOST`, `WAVR_PORT`, and `WAVR_DEBUG` can override development settings. Production deployment requires a production WSGI server and HTTPS reverse proxy.

## File Structure

```text
Wavr/
├── app.py
├── requirements.txt
├── README.md
├── SPEC.md
├── CLAUDE.md
├── static/
│   ├── css/style.css
│   └── js/
│       ├── audio-engine.js
│       ├── hand-tracking.js
│       └── app.js
└── templates/index.html
```

## Acceptance Checks

1. Camera starts on localhost and actionable errors appear when it cannot.
2. One and two hands retain stable voice IDs while moving.
3. Every selected scale emits only valid pitch classes for its root.
4. Disappearing/reappearing hands do not leak oscillator graphs.
5. Power Off releases camera tracks and silences/suspends audio.
6. Power On restores the instrument without a page reload.
7. Hidden pages do not recreate voices from stale tracking results.
8. The interface reflows without horizontal scrolling on phone widths.
