/**
 * Pure TypeScript camera module for gesture recognition.
 * Manages webcam access with a hidden video element and RAF-based frame loop.
 */

// ============================================================================
// Types
// ============================================================================

export type Frame = {
  video: HTMLVideoElement;
  width: number;
  height: number;
  timestamp: number;
};

export type FrameCallback = (frame: Frame) => void;

export interface CameraOptions {
  width?: number;
  height?: number;
  fps?: number;
  facingMode?: "user" | "environment";
}

// ============================================================================
// Module-level singletons
// ============================================================================

let _video: HTMLVideoElement | null = null;
let _stream: MediaStream | null = null;
let _rafId: number | null = null;
let _cb: FrameCallback | null = null;
let _running: boolean = false;

// ============================================================================
// Private helpers
// ============================================================================

/**
 * Ensures the video element exists (created once, reused).
 */
function ensureVideoElement(): HTMLVideoElement {
  if (!_video) {
    _video = document.createElement('video');
    _video.playsInline = true;
    _video.muted = true;
    _video.autoplay = true;
    // Note: video is NOT appended to the DOM (hidden/headless)
  }
  return _video;
}

/**
 * RAF loop that calls the frame callback when video has data.
 */
function rafLoop(): void {
  const video = _video;
  if (!video || !_running) {
    return;
  }

  // Check if video has current frame data
  if (video.readyState >= 2) { // HAVE_CURRENT_DATA or better
    const width = video.videoWidth;
    const height = video.videoHeight;
    const timestamp = performance.now();

    // Invoke callback if set
    if (_cb && width > 0 && height > 0) {
      _cb({ video, width, height, timestamp });
    }
  }

  // Schedule next frame
  _rafId = requestAnimationFrame(rafLoop);
}

// ============================================================================
// Public API
// ============================================================================

/**
 * Start the camera with specified constraints.
 * Creates a hidden video element and starts the RAF frame loop.
 *
 * @param opts - Camera options (defaults: 640x480@30fps, facing user)
 * @throws Error if secure context or getUserMedia unavailable
 * @throws Error if browser blocks autoplay
 * @throws Error if permission denied or camera unavailable
 */
export async function startCamera(opts?: CameraOptions): Promise<void> {
  // Already running - skip
  if (_running) {
    console.warn('Camera already running');
    return;
  }

  // Validate environment
  if (!window.isSecureContext) {
    throw new Error(
      'Camera requires secure context (HTTPS or localhost). Current context is not secure.'
    );
  }

  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
    throw new Error(
      'getUserMedia is not available. Check browser compatibility and permissions.'
    );
  }

  // Build constraints
  const width = opts?.width ?? 640;
  const height = opts?.height ?? 480;
  const fps = opts?.fps ?? 30;
  const facingMode = opts?.facingMode ?? "user";

  const constraints: MediaStreamConstraints = {
    video: {
      width: { ideal: width },
      height: { ideal: height },
      frameRate: { ideal: fps },
      facingMode: facingMode,
    },
  };

  console.log('📷 Requesting camera with constraints:', constraints);

  try {
    // Request camera stream
    _stream = await navigator.mediaDevices.getUserMedia(constraints);
    console.log('✅ Camera stream acquired');

    // Ensure video element exists
    const video = ensureVideoElement();

    // Attach stream to video
    video.srcObject = _stream;

    // Wait for video to be ready
    try {
      await video.play();
      console.log('✅ Video playback started');
    } catch (playError) {
      // Cleanup on play failure
      _stream.getTracks().forEach((track) => track.stop());
      _stream = null;
      video.srcObject = null;

      throw new Error(
        `Browser blocked autoplay. Call startCamera() after a user gesture. Details: ${playError}`
      );
    }

    // Start RAF loop
    _running = true;
    _rafId = requestAnimationFrame(rafLoop);
    console.log('✅ Camera running with RAF loop');
    console.log('   - _running:', _running);

    // Expose for debugging in dev mode
    if (import.meta.env.DEV) {
      (window as any).__cameraModule = { startCamera, stopCamera, onFrame, isRunning, getVideoElement };
    }

  } catch (error) {
    // Cleanup on error
    if (_stream) {
      _stream.getTracks().forEach((track) => track.stop());
      _stream = null;
    }

    if (error instanceof Error) {
      if (error.name === 'NotAllowedError' || error.name === 'PermissionDeniedError') {
        throw new Error('Camera permission denied by user');
      } else if (error.name === 'NotFoundError' || error.name === 'DevicesNotFoundError') {
        throw new Error('No camera device found');
      } else if (error.name === 'NotReadableError' || error.name === 'TrackStartError') {
        throw new Error('Camera is already in use by another application');
      } else {
        throw error;
      }
    }

    throw new Error(`Failed to start camera: ${error}`);
  }
}

/**
 * Stop the camera and clean up all resources.
 * Safe to call multiple times. Camera can be restarted after stop.
 */
export async function stopCamera(): Promise<void> {
  console.log('🛑 Stopping camera...');

  // Cancel RAF loop
  if (_rafId !== null) {
    cancelAnimationFrame(_rafId);
    _rafId = null;
  }

  // Stop video playback
  if (_video) {
    _video.pause();
    _video.srcObject = null;
  }

  // Stop all media tracks
  if (_stream) {
    _stream.getTracks().forEach((track) => {
      track.stop();
      console.log(`  Stopped track: ${track.kind} (${track.label})`);
    });
    _stream = null;
  }

  // Clear state
  _running = false;
  _cb = null;

  console.log('✅ Camera stopped and cleaned up');
}

/**
 * Set or replace the frame callback.
 * Pass null to clear the callback.
 *
 * @param cb - Frame callback function or null
 */
export function onFrame(cb: FrameCallback | null): void {
  _cb = cb;
}

/**
 * Check if the camera is currently running.
 *
 * @returns true if camera is running, false otherwise
 */
export function isRunning(): boolean {
  console.log("[DEBUG] isRunning() called:", _running);
  return _running;
}

/**
 * Get the hidden video element.
 * Creates it if it doesn't exist yet.
 * Note: This element is NOT attached to the DOM.
 *
 * @returns The video element
 */
export function getVideoElement(): HTMLVideoElement {
  return ensureVideoElement();
}
