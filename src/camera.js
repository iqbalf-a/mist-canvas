/**
 * camera.js — Request webcam access and bind stream to a <video> element.
 */

export async function setupCamera(videoEl) {
  if (!navigator.mediaDevices?.getUserMedia) {
    throw new Error('Browser tidak mendukung akses kamera.');
  }

  const stream = await navigator.mediaDevices.getUserMedia({
    video: { facingMode: 'user', width: { ideal: 1280 }, height: { ideal: 720 } },
    audio: false,
  });

  videoEl.srcObject = stream;

  return new Promise((resolve, reject) => {
    videoEl.onloadedmetadata = () => videoEl.play().then(() => resolve(videoEl)).catch(reject);
    videoEl.onerror = reject;
  });
}
