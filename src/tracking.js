/**
 * tracking.js — Wraps MediaPipe FaceLandmarker and HandLandmarker.
 *
 * Models and WASM are loaded from public CDNs so no extra asset-copy step is
 * needed in Vite.
 */

import { FaceLandmarker, HandLandmarker, FilesetResolver } from '@mediapipe/tasks-vision';

const WASM_URL =
  'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/wasm';

const FACE_MODEL_URL =
  'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task';

const HAND_MODEL_URL =
  'https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task';

/**
 * Download WASM runtime and both .task models.
 * @param {(msg: string) => void} onStatus  - progress callback for the loading screen
 */
export async function initLandmarkers(onStatus) {
  onStatus('Memuat runtime MediaPipe…');
  const vision = await FilesetResolver.forVisionTasks(WASM_URL);

  onStatus('Memuat model wajah…');
  const faceLandmarker = await FaceLandmarker.createFromOptions(vision, {
    baseOptions: { modelAssetPath: FACE_MODEL_URL, delegate: 'GPU' },
    runningMode: 'VIDEO',
    outputFaceBlendshapes: true,
    numFaces: 1,
  });

  onStatus('Memuat model tangan…');
  const handLandmarker = await HandLandmarker.createFromOptions(vision, {
    baseOptions: { modelAssetPath: HAND_MODEL_URL, delegate: 'GPU' },
    runningMode: 'VIDEO',
    numHands: 1,
  });

  return { faceLandmarker, handLandmarker };
}

/**
 * Run face detection and return:
 *   jawOpen      — blendshape score 0–1
 *   mouthCenter  — normalized {x, y} of mouth area (or null if no face)
 */
export function detectFace(faceLandmarker, video, timestamp) {
  const result = faceLandmarker.detectForVideo(video, timestamp);
  const cats = result.faceBlendshapes?.[0]?.categories ?? [];
  const jawOpen = cats.find(c => c.categoryName === 'jawOpen')?.score ?? 0;

  const face = result.faceLandmarks?.[0];
  let mouthCenter = null;

  if (face?.length) {
    // Derive mouth Y from the face bounding box (≈78 % down the face height)
    let minY = 1, maxY = 0, minX = 1, maxX = 0;
    for (const lm of face) {
      if (lm.y < minY) minY = lm.y;
      if (lm.y > maxY) maxY = lm.y;
      if (lm.x < minX) minX = lm.x;
      if (lm.x > maxX) maxX = lm.x;
    }
    mouthCenter = {
      x: (minX + maxX) / 2,
      y: minY + (maxY - minY) * 0.78,
    };
  }

  return { jawOpen, mouthCenter };
}

/**
 * Run hand detection and return:
 *   indexTip  — normalized {x, y, z} of landmark 8 (index fingertip), or null
 *   isPinching — true when thumb tip ↔ index tip distance < threshold
 */
export function detectHand(handLandmarker, video, timestamp) {
  const result = handLandmarker.detectForVideo(video, timestamp);
  const lms = result.landmarks?.[0];
  if (!lms) return { indexTip: null, isPinching: false };

  const indexTip = lms[8];

  // Y-axis approach — paling direkomendasikan di komunitas MediaPipe.
  // y makin besar = makin bawah di layar.
  //
  // Telunjuk terentang  : tip (8) lebih tinggi dari PIP-nya (6)  → lms[8].y < lms[6].y
  // Jari tengah melipat : tip (12) lebih rendah dari PIP-nya (10) → lms[12].y > lms[10].y
  //
  // Tambahan: ujung telunjuk harus jelas lebih tinggi dari ujung jari tengah & manis
  // agar tidak false-positive saat semua jari agak turun (telapak datar, dst.)
  const isPointing =
    lms[8].y  < lms[6].y  &&              // telunjuk terentang
    lms[8].y  < lms[12].y - 0.03 &&      // ujung telunjuk lebih tinggi dari tengah
    lms[8].y  < lms[16].y - 0.03;        // ujung telunjuk lebih tinggi dari manis

  return { indexTip, isPointing };
}
