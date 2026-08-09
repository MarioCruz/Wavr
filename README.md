# Wavr — Visual Theremin

Wavr is a browser-based musical instrument by **Mario the Maker**. It uses your webcam to turn hand movement into pitch, volume, and tone in real time—no strings or keys required.

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
- **One- or two-hand performance** with stable hand identity and an independent voice per hand
- **Live readouts** for note, frequency, level, and tone
- **Power control** that stops the camera, silences voices, and suspends audio until explicitly restored
- **Camera recovery UI** for permission, unavailable-device, insecure-origin, and MediaPipe loading failures
- **Responsive 1960s record-sleeve interface** with an About Mario the Maker section
- **Page lifecycle cleanup** to prevent hidden tabs from retaining camera and audio resources

## Tech Stack

- **Backend:** Python 3.9+ and Flask
- **Hand tracking:** pinned MediaPipe Hands and Camera Utils packages loaded from jsDelivr
- **Audio:** Web Audio API
- **UI:** semantic HTML, token-based CSS, and vanilla JavaScript

There is no build step, bundler, npm dependency, or external font dependency.

## Quick Start

```bash
git clone https://github.com/MarioCruz/Wavr.git
cd Wavr

python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
python app.py
```

Open **http://127.0.0.1:5050** or **http://localhost:5050**, allow camera access, and click or press a key once if the browser requires an audio gesture.

The MediaPipe assets are loaded from a CDN, so the browser needs network access on first load.

## Server Configuration

The development server is intentionally local-only and debug mode is off by default.

| Variable | Default | Purpose |
|---|---|---|
| `WAVR_HOST` | `127.0.0.1` | Listening interface |
| `WAVR_PORT` | `5050` | Listening port |
| `WAVR_DEBUG` | unset / false | Enable Flask debug mode for trusted development only |

Example:

```bash
WAVR_PORT=8080 WAVR_DEBUG=1 python app.py
```

## Camera and HTTPS Requirements

Browsers expose `navigator.mediaDevices.getUserMedia()` only in a secure context:

- `http://localhost` and `http://127.0.0.1` are accepted for local use.
- A LAN address such as `http://192.168.x.x:5050` is not a secure origin and normally cannot access the viewing device's camera.
- Remote-device access should use HTTPS through a reverse proxy or another trusted TLS setup.

## Raspberry Pi 5

For a kiosk running directly on the Pi:

```bash
WAVR_HOST=0.0.0.0 python app.py
chromium-browser --kiosk http://localhost:5050
```

Although Flask can bind to the LAN, other devices still need HTTPS to use their own cameras. Use a production WSGI server and HTTPS reverse proxy for a persistent network deployment; Flask's built-in server is for development.

## Validation

The repository has no build step. Useful checks are:

```bash
node --check static/js/audio-engine.js
node --check static/js/hand-tracking.js
node --check static/js/app.js
venv/bin/python -c "from app import app; assert app.test_client().get('/').status_code == 200"
git diff --check
```

Camera permission and real-time sound should also be verified manually in a browser with a webcam.

## Project Structure

```text
Wavr/
├── app.py                    # Flask entry point and environment configuration
├── requirements.txt          # Pinned Python dependency
├── SPEC.md                   # Current behavior and design specification
├── CLAUDE.md                 # Developer guide
├── static/
│   ├── css/
│   │   └── style.css         # Record-sleeve design system and responsive UI
│   └── js/
│       ├── audio-engine.js   # Multi-voice synthesis, scales, and audio lifecycle
│       ├── hand-tracking.js  # MediaPipe camera lifecycle and stable hand tracking
│       └── app.js            # UI, power, camera, audio, and page lifecycle controller
└── templates/
    └── index.html            # Main Flask/Jinja template
```

## About

Wavr was designed and built by **Mario the Maker**, creating playful instruments and interactive experiences where music, technology, and imagination meet.

## License

MIT
