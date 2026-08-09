# Wavr — Visual Theremin

Wavr is a browser-based musical instrument by **Mario the Maker**. It uses your webcam to turn hand movement into pitch, volume, and tone in real time—no strings or keys required.

**Live site:** https://mariocruz.github.io/Wavr/

## How It Works

| Gesture | Controls | Mapping |
|---|---|---|
| Move left / right | **Pitch** | Low frequency → high frequency |
| Move up / down | **Volume** | Quiet → loud |
| Make a fist / open hand | **Filter** | Dark → bright |

Show a hand to play. Remove it to stop the voice.

## Features

- **7 synth modes:** FM Synth, Clean Wave, Warm Tone, Pad, Theremin, Organ, and Bitcrush
- **10 scales:** Chromatic, Major, Natural Minor, two Pentatonics, Blues, Dorian, Mixolydian, Harmonic Minor, and Whole Tone
- **12 root notes** with corrected nearest-note scale quantization
- **Glide control** from immediate note changes to slow portamento
- **One- or two-hand performance** with stable identity and an independent voice per hand
- **Live readouts** for note, frequency, level, and tone
- **Power control** that stops the camera, silences voices, and suspends audio until explicitly restored
- **Camera recovery UI** for permission, unavailable-device, insecure-origin, and MediaPipe loading failures
- **Responsive 1960s record-sleeve interface** with an About Mario the Maker section
- **Page lifecycle cleanup** to prevent hidden tabs from retaining camera and audio resources

## Tech Stack

- **Hand tracking:** pinned MediaPipe Hands and Camera Utils packages loaded from jsDelivr
- **Audio:** Web Audio API
- **UI:** semantic HTML, token-based CSS, and vanilla JavaScript
- **Hosting:** static files, compatible with GitHub Pages

There is no backend, build step, bundler, npm dependency, or external font dependency.

## Run Locally

```bash
git clone https://github.com/MarioCruz/Wavr.git
cd Wavr
python3 -m http.server 5050
```

Open **http://localhost:5050**, allow camera access, and click or press a key once if the browser requires an audio gesture.

MediaPipe assets are loaded from a CDN, so the browser needs network access on first load.

## Camera and HTTPS Requirements

Browsers expose `navigator.mediaDevices.getUserMedia()` only in a secure context:

- `http://localhost` and `http://127.0.0.1` are accepted for local use.
- GitHub Pages serves the live site over HTTPS.
- A LAN address such as `http://192.168.x.x:5050` is not a secure origin and normally cannot access the viewing device's camera.
- Other remote deployments should use HTTPS.

## GitHub Pages Deployment

The app is served directly from `main` and the repository root.

1. Open the repository's **Settings → Pages**.
2. Choose **Deploy from a branch**.
3. Select `main` and `/ (root)`.
4. Save and wait for deployment.

All local asset URLs are relative so the app works under the `/Wavr/` project path.

## Raspberry Pi 5

```bash
git clone https://github.com/MarioCruz/Wavr.git
cd Wavr
python3 -m http.server 5050 --bind 127.0.0.1
chromium-browser --kiosk http://localhost:5050
```

To access Wavr from another device, host it over HTTPS so that device can use its own camera.

## Validation

```bash
node --check static/js/audio-engine.js
node --check static/js/hand-tracking.js
node --check static/js/app.js
git diff --check
```

Camera permission and real-time sound should also be verified manually in a browser with a webcam.

## Project Structure

```text
Wavr/
├── index.html                 # Static application entry point
├── README.md                  # Setup, hosting, and usage
├── SPEC.md                    # Current behavior and design specification
├── CLAUDE.md                  # Developer guide
└── static/
    ├── css/
    │   └── style.css          # Record-sleeve design system and responsive UI
    └── js/
        ├── audio-engine.js    # Multi-voice synthesis, scales, and audio lifecycle
        ├── hand-tracking.js   # MediaPipe camera lifecycle and stable hand tracking
        └── app.js             # UI, power, camera, audio, and page lifecycle controller
```

## About

Wavr was designed and built by **Mario the Maker**, creating playful instruments and interactive experiences where music, technology, and imagination meet.

## License

MIT
