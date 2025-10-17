/**
 * MediaPipe hand landmark detection module.
 * Self-contained module for detecting hand landmarks using pre-trained models.
 */

import {
  FilesetResolver,
  HandLandmarker,
} from "@mediapipe/tasks-vision";

// ============================================================================
// Types
// ============================================================================

export type HandLandmark = {
  x: number;
  y: number;
  z: number;
};

export type HandDetection = {
  handedness: "Left" | "Right";
  landmarks: HandLandmark[];
  score: number;
};

// ============================================================================
// Module-level state
// ============================================================================

let handLandmarker: HandLandmarker | null = null;
const runningMode: "IMAGE" | "VIDEO" = "VIDEO";
let lastVideoTime = -1;
let cachedResults: HandDetection[] = [];

// ============================================================================
// Public API
// ============================================================================

/**
 * Initialize the hand landmark detection model.
 * Must be called before detectHands().
 *
 * @param modelUrl - Path to the hand_landmarker.task model file
 * @throws Error if WebAssembly or model loading fails
 */
export async function initHandModel(
  modelUrl: string = "/models/hand_landmarker.task"
): Promise<void> {
  if (handLandmarker) {
    console.warn("Hand model already initialized");
    return;
  }

  try {
    console.log("🤖 Initializing MediaPipe hand landmark model...");

    // Load the MediaPipe vision tasks WASM files
    const vision = await FilesetResolver.forVisionTasks(
      "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.0/wasm"
    );

    console.log("✅ MediaPipe WASM fileset loaded");

    // Create the HandLandmarker with the specified model
    handLandmarker = await HandLandmarker.createFromOptions(vision, {
      baseOptions: {
        modelAssetPath: modelUrl,
      },
      numHands: 2,
      runningMode: runningMode,
    });

    console.log(`✅ Hand landmark model loaded from: ${modelUrl}`);
    console.log("   - Max hands: 2");
    console.log("   - Running mode: VIDEO");
    console.log("   - handLandmarker instance:", !!handLandmarker);

    // Expose for debugging in dev mode
    if (import.meta.env.DEV) {
      (window as any).__mediapipeModule = { isModelReady, detectHands, initHandModel };
    }

  } catch (error) {
    handLandmarker = null;

    if (error instanceof Error) {
      // Check for common errors
      if (error.message.includes("Failed to fetch") || error.message.includes("404")) {
        throw new Error(
          `Failed to load model file from ${modelUrl}. ` +
          `Ensure hand_landmarker.task exists in public/models/. ` +
          `Original error: ${error.message}`
        );
      } else if (error.message.includes("WebAssembly")) {
        throw new Error(
          `WebAssembly error: ${error.message}. ` +
          `Ensure your browser supports WebAssembly and SIMD.`
        );
      }
      throw new Error(`Failed to initialize hand model: ${error.message}`);
    }

    throw new Error(`Failed to initialize hand model: ${error}`);
  }
}

/**
 * Detect hands in a video frame.
 * Returns 0-2 hand detections with 21 landmarks each.
 *
 * @param video - Video element containing the frame to analyze
 * @returns Array of hand detections (empty if no hands detected)
 */
export function detectHands(video: HTMLVideoElement): HandDetection[] {
  // Model not ready
  if (!handLandmarker) {
    console.warn("Hand model not initialized. Call initHandModel() first.");
    return [];
  }

  // Video not ready
  if (!video || video.readyState < 2) {
    return [];
  }

  // Skip duplicate frames (optimization)
  const currentTime = video.currentTime;
  if (currentTime === lastVideoTime) {
    return cachedResults;
  }
  lastVideoTime = currentTime;

  try {
    // Run detection
    const result = handLandmarker.detectForVideo(
      video,
      performance.now()
    );

    // Map results to our format
    const detections: HandDetection[] = [];

    if (result.landmarks && result.landmarks.length > 0) {
      // Get video dimensions for scaling normalized coordinates
      const videoWidth = video.videoWidth || 640;
      const videoHeight = video.videoHeight || 480;

      for (let i = 0; i < result.landmarks.length; i++) {
        const landmarks = result.landmarks[i];
        const handedness = result.handednesses?.[i]?.[0];
        const worldLandmarks = result.worldLandmarks?.[i];

        if (!landmarks || landmarks.length === 0) {
          continue;
        }

        // Determine handedness
        const hand: "Left" | "Right" =
          handedness?.categoryName === "Left" ? "Left" : "Right";

        // Get confidence score
        const score = handedness?.score ?? 0;

        // Map landmarks to pixel coordinates
        // MediaPipe returns normalized coordinates [0-1], scale by video dimensions
        const mappedLandmarks: HandLandmark[] = landmarks.map((lm, idx) => {
          const worldLm = worldLandmarks?.[idx];
          return {
            x: lm.x * videoWidth,    // Scale to pixels
            y: lm.y * videoHeight,   // Scale to pixels
            z: worldLm?.z ?? 0,      // Use world z (depth in meters)
          };
        });

        detections.push({
          handedness: hand,
          landmarks: mappedLandmarks,
          score,
        });
      }
    }

    // Cache results
    cachedResults = detections;
    return detections;

  } catch (error) {
    console.error("Error during hand detection:", error);
    return [];
  }
}

/**
 * Check if the hand model is ready for detection.
 *
 * @returns true if model is initialized, false otherwise
 */
export function isModelReady(): boolean {
  const ready = handLandmarker !== null;
  console.log("[DEBUG] isModelReady() called:", ready, "handLandmarker:", !!handLandmarker);
  return ready;
}

/**
 * Close and clean up the hand model.
 * Safe to call multiple times.
 */
export async function closeModel(): Promise<void> {
  if (handLandmarker) {
    try {
      // MediaPipe HandLandmarker has a close() method
      await handLandmarker.close();
      console.log("✅ Hand model closed");
    } catch (error) {
      console.warn("Error closing hand model:", error);
    }
  }
  handLandmarker = null;
  lastVideoTime = -1;
  cachedResults = [];
}
