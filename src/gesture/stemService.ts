/**
 * Stem separation service client.
 * Connects to external API to separate audio tracks into vocals, drums, bass.
 */

import { getConfig } from "./config";

// Environment-based defaults
const STEM_API_BASE = import.meta.env.VITE_STEM_API_BASE ?? "https://api.example.com";
const STEM_API_KEY = import.meta.env.VITE_STEM_API_KEY ?? "YOUR_API_KEY_HERE";

export type StemResult = {
  vocals: string;
  drums: string;
  bass: string;
};

/**
 * Submit audio for stem separation.
 * @param input - Audio file or URL to separate
 * @returns Job ID for polling
 */
export async function submitForSeparation(
  input: { file?: File | Blob; url?: string }
): Promise<{ jobId: string }> {
  const cfg = getConfig();
  const apiBase = cfg.stemApiBase ?? STEM_API_BASE;
  const apiKey = cfg.stemApiKey ?? STEM_API_KEY;

  if (!input.file && !input.url) {
    throw new Error("Must provide either file or url");
  }

  const formData = new FormData();

  if (input.file) {
    formData.append("file", input.file, "audio.mp3");
  } else if (input.url) {
    formData.append("url", input.url);
  }

  try {
    const response = await fetch(`${apiBase}/separate`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
      },
      body: formData,
    });

    if (!response.ok) {
      throw new Error(`API error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();

    if (!data.jobId) {
      throw new Error("API response missing jobId");
    }

    return { jobId: data.jobId };
  } catch (error) {
    throw new Error(
      `Failed to submit for separation: ${error instanceof Error ? error.message : "Unknown error"}`
    );
  }
}

/**
 * Poll job status.
 * @param jobId - Job ID from submitForSeparation
 * @returns Job status and stems (if done)
 */
export async function pollJob(
  jobId: string
): Promise<{ status: "pending" | "done" | "error"; stems?: StemResult }> {
  const cfg = getConfig();
  const apiBase = cfg.stemApiBase ?? STEM_API_BASE;
  const apiKey = cfg.stemApiKey ?? STEM_API_KEY;

  try {
    const response = await fetch(`${apiBase}/jobs/${jobId}`, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${apiKey}`,
      },
    });

    if (!response.ok) {
      throw new Error(`API error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();

    if (data.status === "done" && data.stems) {
      return {
        status: "done",
        stems: {
          vocals: data.stems.vocals,
          drums: data.stems.drums,
          bass: data.stems.bass,
        },
      };
    } else if (data.status === "error") {
      return { status: "error" };
    } else {
      return { status: "pending" };
    }
  } catch (error) {
    throw new Error(
      `Failed to poll job: ${error instanceof Error ? error.message : "Unknown error"}`
    );
  }
}

/**
 * Separate audio track into stems (vocals, drums, bass).
 * Submits job and polls until complete or timeout.
 * @param input - Audio file or URL to separate
 * @returns URLs for separated stems
 */
export async function separateTrack(
  input: { file?: File | Blob; url?: string }
): Promise<StemResult> {
  const cfg = getConfig();

  // Check if mock mode is enabled
  if (cfg.stemMockEnabled) {
    console.log("🎭 Mock mode enabled - simulating stem separation...");
    const delay = cfg.stemMockDelayMs;

    // Simulate processing delay
    await new Promise((resolve) => setTimeout(resolve, delay));

    console.log("✅ Mock separation complete!");
    return {
      vocals: "/samples/mock_vocals.mp3",
      drums: "/samples/mock_drums.mp3",
      bass: "/samples/mock_bass.mp3",
    };
  }

  // Real API mode (existing logic)
  const pollInterval = cfg.stemPollIntervalMs ?? 3000;
  const pollTimeout = cfg.stemPollTimeoutMs ?? 90000;

  // Submit job
  console.log("🎵 Submitting track for stem separation...");
  const { jobId } = await submitForSeparation(input);
  console.log(`📝 Job submitted: ${jobId}`);

  // Poll until done or timeout
  const startTime = Date.now();

  while (true) {
    const elapsed = Date.now() - startTime;

    if (elapsed > pollTimeout) {
      throw new Error(`Stem separation timed out after ${pollTimeout}ms`);
    }

    const result = await pollJob(jobId);

    if (result.status === "done" && result.stems) {
      console.log("✅ Stem separation complete!");
      return result.stems;
    } else if (result.status === "error") {
      throw new Error("Stem separation failed on server");
    }

    // Still pending, wait before next poll
    console.log(`⏳ Waiting for stems... (${Math.round(elapsed / 1000)}s elapsed)`);
    await new Promise((resolve) => setTimeout(resolve, pollInterval));
  }
}
