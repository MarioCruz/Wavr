/**
 * Hand Tracking Module
 * MediaPipe Hands — supports 1 or 2 hands with stable per-hand coloring.
 */

const HandTracking = (() => {
    const HANDS_VERSION = '0.4.1675469240';
    const TRACK_MEMORY_MS = 750;
    const MAX_TRACK_DISTANCE = 0.45;

    let hands = null;
    let camera = null;
    let videoEl = null;
    let canvasEl = null;
    let canvasCtx = null;
    let resultCallback = null;
    let errorCallback = null;
    let readyCallback = null;
    let maxHands = 1;
    let cameraRunning = false;
    let cameraStarting = false;
    let startPromise = null;
    let lifecycleGeneration = 0;
    let hasLiveFrame = false;
    let processingFailed = false;
    let destroyed = false;
    let previousHands = new Map();

    // Per-hand colors (Beach Boys palette)
    const HAND_COLORS = [
        { line: 'rgba(255, 107, 107, 0.7)', dot: 'rgba(255, 107, 107, 0.9)' },
        { line: 'rgba(78, 205, 196, 0.7)', dot: 'rgba(78, 205, 196, 0.9)' },
    ];

    const CONNECTIONS = [
        [0,1],[1,2],[2,3],[3,4],
        [0,5],[5,6],[6,7],[7,8],
        [5,9],[9,10],[10,11],[11,12],
        [9,13],[13,14],[14,15],[15,16],
        [13,17],[17,18],[18,19],[19,20],
        [0,17],
    ];

    function distance(a, b) {
        return Math.sqrt((a.x-b.x)**2 + (a.y-b.y)**2 + (a.z-b.z)**2);
    }

    function distance2d(a, b) {
        return Math.hypot(a.x - b.x, a.y - b.y);
    }

    function getOpenness(landmarks) {
        const wrist = landmarks[0];
        const tipIndices = [8, 12, 16, 20];
        const mcpIndices = [5, 9, 13, 17];

        let extended = 0;
        for (let i = 0; i < tipIndices.length; i++) {
            const tipDist = distance(landmarks[tipIndices[i]], wrist);
            const mcpDist = distance(landmarks[mcpIndices[i]], wrist);
            if (tipDist > mcpDist * 1.1) extended++;
        }
        return extended / tipIndices.length;
    }

    function drawHand(landmarks, width, height, colorIdx) {
        const colors = HAND_COLORS[colorIdx % HAND_COLORS.length];

        canvasCtx.strokeStyle = colors.line;
        canvasCtx.lineWidth = 2;

        for (const [a, b] of CONNECTIONS) {
            canvasCtx.beginPath();
            canvasCtx.moveTo(landmarks[a].x * width, landmarks[a].y * height);
            canvasCtx.lineTo(landmarks[b].x * width, landmarks[b].y * height);
            canvasCtx.stroke();
        }

        for (const lm of landmarks) {
            canvasCtx.beginPath();
            canvasCtx.arc(lm.x * width, lm.y * height, 4, 0, 2 * Math.PI);
            canvasCtx.fillStyle = colors.dot;
            canvasCtx.fill();
        }
    }

    function extractHandData(landmarks, handedness) {
        const wrist = landmarks[0];
        const palm = landmarks[9];
        return {
            x: (wrist.x + palm.x) / 2,
            y: (wrist.y + palm.y) / 2,
            openness: getOpenness(landmarks),
            handedness,
        };
    }

    function getHandedness(entry) {
        if (!entry) return null;
        if (entry.label) return entry.label;
        const classification = entry.classification && entry.classification[0];
        return classification ? classification.label : null;
    }

    /**
     * Match detections to recent positions instead of trusting MediaPipe's array order.
     */
    function assignStableIds(detections) {
        const now = performance.now();
        for (const [id, previous] of previousHands) {
            if (now - previous.seenAt > TRACK_MEMORY_MS || id >= maxHands) {
                previousHands.delete(id);
            }
        }

        const assignments = new Map();
        const unmatchedDetections = new Set(detections.map((_, index) => index));
        const unmatchedPrevious = new Set(previousHands.keys());

        function score(detectionIndex, id) {
            const detection = detections[detectionIndex];
            const previous = previousHands.get(id);
            const spatialDistance = distance2d(detection, previous);
            if (spatialDistance > MAX_TRACK_DISTANCE) return Infinity;

            const handednessPenalty = detection.handedness && previous.handedness &&
                detection.handedness !== previous.handedness ? 0.5 : 0;
            return spatialDistance + handednessPenalty;
        }

        // With two hands, compare both complete assignments before committing either pair.
        if (unmatchedDetections.size === 2 && unmatchedPrevious.size === 2) {
            const detectionIds = Array.from(unmatchedDetections);
            const previousIds = Array.from(unmatchedPrevious);
            const options = [
                [[detectionIds[0], previousIds[0]], [detectionIds[1], previousIds[1]]],
                [[detectionIds[0], previousIds[1]], [detectionIds[1], previousIds[0]]],
            ];
            let bestOption = null;
            let bestTotal = Infinity;

            for (const option of options) {
                const total = option.reduce((sum, [detectionIndex, id]) =>
                    sum + score(detectionIndex, id), 0);
                if (total < bestTotal) {
                    bestTotal = total;
                    bestOption = option;
                }
            }

            if (bestOption && Number.isFinite(bestTotal)) {
                for (const [detectionIndex, id] of bestOption) {
                    assignments.set(detectionIndex, id);
                    unmatchedDetections.delete(detectionIndex);
                    unmatchedPrevious.delete(id);
                }
            }
        }

        // Handle one-to-one leftovers, but reject implausibly distant remembered tracks.
        while (unmatchedDetections.size && unmatchedPrevious.size) {
            let best = null;
            for (const detectionIndex of unmatchedDetections) {
                for (const id of unmatchedPrevious) {
                    const pairScore = score(detectionIndex, id);
                    if (Number.isFinite(pairScore) && (!best || pairScore < best.score)) {
                        best = { detectionIndex, id, score: pairScore };
                    }
                }
            }
            if (!best) break;

            assignments.set(best.detectionIndex, best.id);
            unmatchedDetections.delete(best.detectionIndex);
            unmatchedPrevious.delete(best.id);
        }

        const usedIds = new Set(assignments.values());
        const remainingIds = Array.from({ length: maxHands }, (_, id) => id)
            .filter((id) => !usedIds.has(id))
            .sort((a, b) => Number(previousHands.has(a)) - Number(previousHands.has(b)));
        const remainingDetections = Array.from(unmatchedDetections)
            .sort((a, b) => detections[a].x - detections[b].x);

        for (let i = 0; i < remainingDetections.length && i < remainingIds.length; i++) {
            assignments.set(remainingDetections[i], remainingIds[i]);
        }

        for (const [detectionIndex, id] of assignments) {
            const detection = detections[detectionIndex];
            previousHands.set(id, {
                x: detection.x,
                y: detection.y,
                handedness: detection.handedness,
                seenAt: now,
            });
        }

        return assignments;
    }

    function processResults(results, resultGeneration) {
        if (!cameraRunning || destroyed || resultGeneration !== lifecycleGeneration) return;
        if (!canvasEl || !canvasCtx) return;

        const width = canvasEl.width;
        const height = canvasEl.height;
        canvasCtx.clearRect(0, 0, width, height);

        const landmarksList = results.multiHandLandmarks || [];
        const handednessList = results.multiHandedness || [];
        const detections = landmarksList.map((landmarks, index) => ({
            landmarks,
            ...extractHandData(landmarks, getHandedness(handednessList[index])),
        }));
        const assignments = assignStableIds(detections);
        const handsData = [];

        for (const [detectionIndex, id] of assignments) {
            const detection = detections[detectionIndex];
            drawHand(detection.landmarks, width, height, id);
            handsData.push({
                id,
                x: detection.x,
                y: detection.y,
                openness: detection.openness,
            });
        }

        handsData.sort((a, b) => a.id - b.id);
        if (resultCallback) resultCallback(handsData);
    }

    function describeCameraError(error) {
        const name = error && error.name;
        if (name === 'NotAllowedError' || name === 'SecurityError') {
            return {
                title: 'Camera permission denied',
                detail: 'Allow camera access in your browser settings, then try again.',
                retryable: true,
            };
        }
        if (name === 'NotFoundError' || name === 'DevicesNotFoundError') {
            return {
                title: 'No camera found',
                detail: 'Connect a camera and try again.',
                retryable: true,
            };
        }
        if (name === 'NotReadableError' || name === 'TrackStartError') {
            return {
                title: 'Camera is unavailable',
                detail: 'Close other apps using the camera, then try again.',
                retryable: true,
            };
        }
        return {
            title: 'Could not start the camera',
            detail: 'Check camera permissions and try again.',
            retryable: true,
        };
    }

    function reportError(details, error) {
        console.error(details.title, error || details.detail);
        if (errorCallback) errorCallback(details);
    }

    function checkSupport() {
        if (window.isSecureContext === false || !navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
            return {
                title: 'A secure connection is required',
                detail: 'Open this app on localhost, or serve this device address over HTTPS.',
                retryable: false,
            };
        }
        if (typeof window.Hands !== 'function' || typeof window.Camera !== 'function') {
            return {
                title: 'Hand tracking failed to load',
                detail: 'Check your internet connection and reload the page.',
                retryable: false,
            };
        }
        return null;
    }

    function createHands() {
        const resultGeneration = lifecycleGeneration;
        const instance = new window.Hands({
            locateFile: (file) =>
                `https://cdn.jsdelivr.net/npm/@mediapipe/hands@${HANDS_VERSION}/${file}`,
        });

        instance.setOptions({
            maxNumHands: maxHands,
            modelComplexity: 1,
            minDetectionConfidence: 0.7,
            minTrackingConfidence: 0.5,
        });
        instance.onResults((results) => processResults(results, resultGeneration));
        hands = instance;
        return instance;
    }

    function releaseHands() {
        const instance = hands;
        hands = null;
        if (instance && typeof instance.close === 'function') {
            void Promise.resolve(instance.close()).catch((error) => {
                console.warn('Could not close MediaPipe Hands cleanly.', error);
            });
        }
    }

    async function start() {
        if (destroyed || !camera) return false;
        if (cameraRunning) return true;

        const requestedGeneration = lifecycleGeneration;
        if (startPromise) {
            await startPromise;
            if (!destroyed && !cameraRunning && requestedGeneration === lifecycleGeneration) {
                return start();
            }
            return cameraRunning;
        }

        if (!hands) createHands();
        const attemptGeneration = lifecycleGeneration;
        cameraStarting = true;
        hasLiveFrame = false;
        processingFailed = false;

        const attemptPromise = (async () => {
            try {
                await camera.start();
                if (destroyed || attemptGeneration !== lifecycleGeneration) {
                    stopCameraStream();
                    return false;
                }
                cameraRunning = true;
                return true;
            } catch (error) {
                cameraRunning = false;
                if (!destroyed && attemptGeneration === lifecycleGeneration) {
                    reportError(describeCameraError(error), error);
                }
                return false;
            }
        })();

        startPromise = attemptPromise;
        const result = await attemptPromise;
        if (startPromise === attemptPromise) startPromise = null;
        cameraStarting = false;
        return result;
    }

    /**
     * Initialize hand tracking.
     * opts supports { maxHands, onError, onReady, autoStart }.
     */
    function init(video, canvas, callback, opts = {}) {
        videoEl = video;
        canvasEl = canvas;
        canvasCtx = canvas.getContext('2d');
        resultCallback = callback;
        errorCallback = opts.onError || null;
        readyCallback = opts.onReady || null;
        maxHands = opts.maxHands || 1;
        destroyed = false;
        previousHands.clear();

        const supportError = checkSupport();
        if (supportError) {
            reportError(supportError);
            return Promise.resolve(false);
        }
        if (!canvasCtx) {
            reportError({
                title: 'Canvas is unavailable',
                detail: 'Your browser could not initialize the video overlay.',
                retryable: false,
            });
            return Promise.resolve(false);
        }

        createHands();

        camera = new window.Camera(videoEl, {
            onFrame: async () => {
                if (destroyed || (!cameraRunning && !cameraStarting) ||
                    !videoEl.videoWidth || !videoEl.videoHeight || processingFailed) return;

                const frameGeneration = lifecycleGeneration;
                const handsInstance = hands;
                if (!handsInstance) return;
                if (canvasEl.width !== videoEl.videoWidth || canvasEl.height !== videoEl.videoHeight) {
                    canvasEl.width = videoEl.videoWidth;
                    canvasEl.height = videoEl.videoHeight;
                }

                cameraRunning = true;
                if (!hasLiveFrame) {
                    hasLiveFrame = true;
                    if (readyCallback) readyCallback();
                }

                try {
                    await handsInstance.send({ image: videoEl });
                } catch (error) {
                    if (destroyed || frameGeneration !== lifecycleGeneration) return;
                    processingFailed = true;
                    stop();
                    reportError({
                        title: 'Hand tracking stopped',
                        detail: 'Reload the page or try starting the camera again.',
                        retryable: true,
                    }, error);
                }
            },
            width: 640,
            height: 480,
        });

        return opts.autoStart === false ? Promise.resolve(false) : start();
    }

    function setMaxHands(n) {
        const nextMax = n === 2 ? 2 : 1;
        if (nextMax !== maxHands) previousHands.clear();
        maxHands = nextMax;
        if (hands) hands.setOptions({ maxNumHands: nextMax });
    }

    function stopCameraStream() {
        if (camera) camera.stop();
        if (videoEl && videoEl.srcObject) {
            for (const track of videoEl.srcObject.getTracks()) track.stop();
            videoEl.srcObject = null;
        }
    }

    function stop() {
        lifecycleGeneration++;
        cameraRunning = false;
        hasLiveFrame = false;
        stopCameraStream();
        releaseHands();
    }

    async function destroy() {
        destroyed = true;
        stop();
        previousHands.clear();
        resultCallback = null;
        errorCallback = null;
        readyCallback = null;
        hands = null;
        camera = null;
    }

    return { init, start, stop, destroy, setMaxHands };
})();
