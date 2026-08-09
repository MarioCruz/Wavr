/**
 * Main App Controller
 * Wires hand tracking → audio engine, manages UI and page lifecycle.
 */

(function () {
    const videoEl = document.getElementById('webcam');
    const canvasEl = document.getElementById('overlay');
    const noCameraEl = document.getElementById('no-camera');
    const noCameraTitleEl = document.getElementById('no-camera-title');
    const noCameraDetailEl = document.getElementById('no-camera-detail');
    const retryCameraButton = document.getElementById('retry-camera');
    const powerToggleButton = document.getElementById('power-toggle');
    const powerLabelEl = document.getElementById('power-label');
    const statusEl = document.getElementById('status');
    const statusTextEl = document.getElementById('status-text');
    const synthSelect = document.getElementById('synth-select');
    const scaleSelect = document.getElementById('scale-select');
    const rootSelect = document.getElementById('root-select');
    const glideSlider = document.getElementById('glide-slider');
    const glideLabel = document.getElementById('glide-label');
    const waveformSelect = document.getElementById('waveform-select');
    const waveformSetting = document.getElementById('waveform-setting');
    const multihandToggle = document.getElementById('multihand-toggle');
    const hand1Row = document.getElementById('hand-1-row');

    const handDisplays = [
        {
            freq: document.getElementById('hand-0-freq'),
            vol: document.getElementById('hand-0-vol'),
            filter: document.getElementById('hand-0-filter'),
        },
        {
            freq: document.getElementById('hand-1-freq'),
            vol: document.getElementById('hand-1-vol'),
            filter: document.getElementById('hand-1-filter'),
        },
    ];

    const activeVoices = new Set();
    let multiHandEnabled = false;
    let isPoweredOn = true;
    let powerTransitionPending = false;
    let audioResumePending = false;
    let pageDestroyed = false;
    let lastCameraError = null;

    function clamp(value, min = 0, max = 1) {
        return Math.min(max, Math.max(min, value));
    }

    function updatePowerUI() {
        document.body.classList.toggle('is-powered-off', !isPoweredOn);
        powerToggleButton.setAttribute('aria-pressed', String(isPoweredOn));
        powerToggleButton.setAttribute('aria-label', isPoweredOn ? 'Turn Wavr off' : 'Turn Wavr on');
        powerLabelEl.textContent = isPoweredOn ? 'Power off' : 'Power on';
    }

    function showPoweredOffState() {
        showCameraState({
            title: 'Instrument is off',
            detail: 'Use Power on when you are ready to play again.',
        });
    }

    function showPausedState() {
        showCameraState({
            title: 'Instrument is paused',
            detail: 'Return to this tab to restore camera and audio.',
        });
    }

    function setStatus(text, active = false) {
        statusEl.classList.toggle('active', active);
        statusTextEl.textContent = text;
    }

    function showCameraState({ title, detail, retryable = false }) {
        noCameraTitleEl.textContent = title;
        noCameraDetailEl.textContent = detail;
        retryCameraButton.hidden = !retryable;
        retryCameraButton.disabled = false;
        noCameraEl.style.display = 'flex';
        setStatus(title, false);
    }

    function hideCameraState() {
        if (!isPoweredOn) {
            showPoweredOffState();
            return;
        }
        noCameraEl.style.display = 'none';
        retryCameraButton.hidden = true;
        setStatus('Show hand to play', false);
    }

    function resetHandDisplay(id) {
        const display = handDisplays[id];
        if (!display) return;
        display.freq.textContent = '--';
        display.vol.textContent = '--%';
        display.filter.textContent = '--';
    }

    function stopAllVoices() {
        AudioEngine.stopAll();
        activeVoices.clear();
        handDisplays.forEach((_, id) => resetHandDisplay(id));
        setStatus('Show hand to play', false);
    }

    function updateHandDisplay(id, freq, volume, openness) {
        const display = handDisplays[id];
        if (!display) return;
        display.freq.textContent = `${AudioEngine.getNoteName(freq)} ${freq.toFixed(0)}Hz`;
        display.vol.textContent = `${Math.round(volume * 100)}%`;
        display.filter.textContent = openness > 0.5 ? 'Open' : 'Closed';
    }

    function onHandData(handsData) {
        if (!isPoweredOn || pageDestroyed || document.hidden) return;
        const currentIds = new Set();

        for (const hand of handsData) {
            const id = hand.id;
            if (!multiHandEnabled && id > 0) continue;

            currentIds.add(id);

            // Landmarks can briefly leave the video frame, so constrain all controls.
            const freqNorm = clamp(1 - hand.x);
            const volNorm = clamp(1 - hand.y);
            const openness = clamp(hand.openness);
            const freq = AudioEngine.updateVoice(id, freqNorm, volNorm, openness);

            updateHandDisplay(id, freq, volNorm, openness);
            activeVoices.add(id);
        }

        for (const id of Array.from(activeVoices)) {
            if (!currentIds.has(id)) {
                AudioEngine.stopVoice(id);
                activeVoices.delete(id);
                resetHandDisplay(id);
            }
        }

        if (currentIds.size > 0) {
            setStatus(currentIds.size > 1 ? 'Playing (2 hands)' : 'Playing', true);
        } else {
            setStatus('Show hand to play', false);
        }
    }

    async function resumeAudioOnGesture() {
        if (!isPoweredOn || audioResumePending) return;
        audioResumePending = true;
        try {
            await AudioEngine.ensureAndResume();
        } catch (error) {
            console.warn('Audio could not be enabled yet.', error);
        } finally {
            audioResumePending = false;
        }
    }

    async function retryCamera() {
        if (!isPoweredOn) return;
        if (pageDestroyed || document.hidden) {
            showPausedState();
            return;
        }
        lastCameraError = null;
        showCameraState({
            title: 'Starting camera…',
            detail: 'Approve camera access if your browser asks.',
        });
        retryCameraButton.disabled = true;
        await HandTracking.start();
    }

    async function restoreCamera() {
        if (!isPoweredOn) {
            showPoweredOffState();
            return;
        }
        if (pageDestroyed || document.hidden) {
            showPausedState();
            return;
        }
        if (lastCameraError) {
            showCameraState(lastCameraError);
            return;
        }
        showCameraState({
            title: 'Starting camera…',
            detail: 'Restoring hand tracking.',
        });
        await HandTracking.start();
    }

    async function setPower(poweredOn) {
        if (powerTransitionPending || poweredOn === isPoweredOn) return;

        powerTransitionPending = true;
        powerToggleButton.disabled = true;
        isPoweredOn = poweredOn;
        updatePowerUI();

        try {
            if (!poweredOn) {
                stopAllVoices();
                HandTracking.stop();
                try {
                    await AudioEngine.suspend();
                } catch (error) {
                    console.warn('Audio could not be suspended.', error);
                }
                showPoweredOffState();
                return;
            }

            try {
                await AudioEngine.ensureAndResume();
            } catch (error) {
                console.warn('Audio could not be enabled yet.', error);
            }
            await restoreCamera();
        } catch (error) {
            console.error('Could not change Wavr power state.', error);
            if (isPoweredOn) {
                showCameraState({
                    title: 'Could not power on',
                    detail: 'Try the power button again.',
                });
            }
        } finally {
            powerTransitionPending = false;
            powerToggleButton.disabled = false;
        }
    }

    function togglePower(event) {
        event.stopPropagation();
        void setPower(!isPoweredOn);
    }

    synthSelect.addEventListener('change', (event) => {
        AudioEngine.setMode(event.target.value);
        waveformSetting.style.display = event.target.value === 'clean' ? '' : 'none';
    });

    waveformSelect.addEventListener('change', (event) => {
        AudioEngine.setWaveform(event.target.value);
    });

    scaleSelect.addEventListener('change', (event) => {
        AudioEngine.setScale(event.target.value);
    });

    rootSelect.addEventListener('change', (event) => {
        AudioEngine.setRootNote(parseInt(event.target.value, 10));
    });

    glideSlider.addEventListener('input', (event) => {
        const milliseconds = parseInt(event.target.value, 10);
        AudioEngine.setGlideTime(milliseconds / 1000);
        if (milliseconds <= 20) {
            glideLabel.textContent = 'Snap';
        } else if (milliseconds <= 150) {
            glideLabel.textContent = `${milliseconds}ms`;
        } else {
            glideLabel.textContent = `${milliseconds}ms (slow)`;
        }
    });

    multihandToggle.addEventListener('change', (event) => {
        multiHandEnabled = event.target.checked;
        hand1Row.classList.toggle('hidden', !multiHandEnabled);
        HandTracking.setMaxHands(multiHandEnabled ? 2 : 1);

        if (!multiHandEnabled) {
            AudioEngine.stopVoice(1);
            activeVoices.delete(1);
            resetHandDisplay(1);
        }
    });

    retryCameraButton.addEventListener('click', retryCamera);
    powerToggleButton.addEventListener('click', togglePower);
    document.addEventListener('click', resumeAudioOnGesture);
    document.addEventListener('touchstart', resumeAudioOnGesture);
    document.addEventListener('keydown', resumeAudioOnGesture);

    document.addEventListener('visibilitychange', () => {
        if (pageDestroyed) return;
        if (document.hidden) {
            stopAllVoices();
            HandTracking.stop();
            if (isPoweredOn) {
                showPausedState();
            } else {
                showPoweredOffState();
            }
            void AudioEngine.suspend().catch((error) => {
                console.warn('Audio could not be suspended.', error);
            });
        } else if (isPoweredOn) {
            void restoreCamera();
        } else {
            showPoweredOffState();
        }
    });

    window.addEventListener('pagehide', (event) => {
        stopAllVoices();
        if (event.persisted) {
            HandTracking.stop();
            void AudioEngine.suspend().catch((error) => {
                console.warn('Audio could not be suspended.', error);
            });
            return;
        }

        pageDestroyed = true;
        void Promise.allSettled([
            HandTracking.destroy(),
            AudioEngine.close(),
        ]);
    });

    window.addEventListener('pageshow', (event) => {
        if (event.persisted && !pageDestroyed && isPoweredOn) {
            void restoreCamera();
        }
    });

    AudioEngine.setScale('major');
    AudioEngine.setGlideTime(0.02);
    updatePowerUI();

    const startImmediately = !document.hidden;
    if (startImmediately) {
        showCameraState({
            title: 'Starting camera…',
            detail: 'Approve camera access if your browser asks.',
        });
    } else {
        showPausedState();
    }
    void HandTracking.init(videoEl, canvasEl, onHandData, {
        maxHands: 1,
        autoStart: startImmediately,
        onError: (details) => {
            lastCameraError = details;
            stopAllVoices();
            if (isPoweredOn) {
                showCameraState(details);
            } else {
                showPoweredOffState();
            }
        },
        onReady: () => {
            lastCameraError = null;
            if (isPoweredOn) {
                hideCameraState();
            }
        },
    });
})();
