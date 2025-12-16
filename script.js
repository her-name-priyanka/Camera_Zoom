const videoElement = document.getElementById('video');
const canvasElement = document.getElementById('canvas');
const canvasCtx = canvasElement.getContext('2d');
const loader = document.getElementById('loader');
const error = document.getElementById('error');

const mpHands = window.Hands;
const drawingUtils = window.DrawingUtils;

const VIDEO_WIDTH = 640;
const VIDEO_HEIGHT = 480;
const ZOOM_SENSITIVITY = 100;
const MAX_ZOOM = 3.0;
const MIN_ZOOM = 1.0;

canvasElement.width = VIDEO_WIDTH;
canvasElement.height = VIDEO_HEIGHT;

let zoomFactor = MIN_ZOOM;

function calculateDistance(p1, p2) {
    const dx = p1.x - p2.x;
    const dy = p1.y - p2.y;
    return Math.sqrt(dx * dx + dy * dy); 
}



function onResults(results) {
    loader.style.display = 'none';
    canvasElement.style.display = 'block';

    canvasCtx.save();
    canvasCtx.clearRect(0, 0, canvasElement.width, canvasElement.height);

    if (results.multiHandLandmarks && results.multiHandLandmarks.length > 0) {
        const landmarks = results.multiHandLandmarks[0];
        
        const thumb_tip = landmarks[mpHands.HandLandmark.THUMB_TIP];
        const index_finger_tip = landmarks[mpHands.HandLandmark.INDEX_FINGER_TIP];
        
        const normalizedDistance = calculateDistance(thumb_tip, index_finger_tip);
        const scaledDistance = normalizedDistance * videoElement.videoWidth; 
        
        zoomFactor = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, scaledDistance / ZOOM_SENSITIVITY));
        
        for (const landmarks of results.multiHandLandmarks) {
            drawingUtils.drawConnectors(canvasCtx, landmarks, mpHands.HAND_CONNECTIONS, { color: '#00FF00', lineWidth: 2 });
            drawingUtils.drawLandmarks(canvasCtx, landmarks, { color: '#FF0000', lineWidth: 1, radius: 2 });
        }

    } else {
        zoomFactor = zoomFactor + (MIN_ZOOM - zoomFactor) * 0.1;
    }

    canvasCtx.translate(canvasElement.width, 0);
    canvasCtx.scale(-1, 1);
    
    const displayWidth = videoElement.videoWidth;
    const displayHeight = videoElement.videoHeight;
    const zoomedWidth = displayWidth / zoomFactor;
    const zoomedHeight = displayHeight / zoomFactor;
    
    const center_x = displayWidth / 2;
    const center_y = displayHeight / 2;
    
    const sourceX = center_x - zoomedWidth / 2;
    const sourceY = center_y - zoomedHeight / 2;
    
    canvasCtx.drawImage(
        results.image, 
        sourceX, sourceY,
        zoomedWidth, zoomedHeight,
        0, 0, 
        canvasElement.width, canvasElement.height 
    );

    canvasCtx.restore();
    
    requestAnimationFrame(sendToMediaPipe);
}

const hands = new mpHands.Hands({
    locateFile: (file) => {
        return `https://cdn.jsdelivr.net/npm/@mediapipe/hands@0.4/${file}`;
    }
});
hands.setOptions({
    maxNumHands: 1,
    minDetectionConfidence: 0.5,
    minTrackingConfidence: 0.5
});
hands.onResults(onResults);

async function sendToMediaPipe() {
    if (videoElement.readyState < 2 || videoElement.paused || videoElement.ended) {
        requestAnimationFrame(sendToMediaPipe);
        return;
    }

    await hands.send({ image: videoElement });
}


async function startCamera() {
    try {
        const stream = await navigator.mediaDevices.getUserMedia({ 
            video: { 
                facingMode: 'user', 
                width: VIDEO_WIDTH, 
                height: VIDEO_HEIGHT 
            } 
        });
        videoElement.srcObject = stream;
        
        await new Promise((resolve) => {
            videoElement.onloadedmetadata = () => {
                resolve();
            };
        });
        
        setTimeout(() => {
            videoElement.play().then(() => {
                sendToMediaPipe();
            }).catch(e => {
                console.error("Video Playback Failed:", e);
                loader.textContent = 'Autoplay blocked. Please refresh and click on the screen.';
            });
        }, 100);

    } catch (e) {
        console.error("Error accessing camera:", e);
        loader.style.display = 'none';
        error.style.display = 'block';
    }
}

window.onload = startCamera;
