/**
 * Dependency checker for gesture recognition module.
 * Verifies that all required browser APIs and libraries are available.
 */

export interface DepsCheckResult {
  ok: boolean;
  notes: string[];
}

export async function checkGestureDeps(): Promise<DepsCheckResult> {
  const notes: string[] = [];
  let ok = true;

  console.log('🔍 Checking gesture module dependencies...');

  // Check 1: MediaPipe Tasks Vision library
  try {
    await import('@mediapipe/tasks-vision');
    notes.push('✅ MediaPipe Tasks Vision loaded');
    console.log('✅ MediaPipe Tasks Vision loaded');
  } catch (error) {
    ok = false;
    const msg = `❌ Failed to load @mediapipe/tasks-vision: ${error}`;
    notes.push(msg);
    console.error(msg);
  }

  // Check 2: Secure context (required for camera access)
  if (window.isSecureContext) {
    notes.push('✅ Secure context (HTTPS or localhost)');
    console.log('✅ Secure context available');
  } else {
    ok = false;
    const msg = '❌ Insecure context - HTTPS or localhost required';
    notes.push(msg);
    console.error(msg);
  }

  // Check 3: MediaDevices API (for camera access)
  if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
    notes.push('✅ MediaDevices API available');
    console.log('✅ MediaDevices API available');
  } else {
    ok = false;
    const msg = '❌ MediaDevices API not available';
    notes.push(msg);
    console.error(msg);
  }

  // Check 4: WebAssembly (required by MediaPipe)
  if (typeof WebAssembly !== 'undefined') {
    notes.push('✅ WebAssembly available');
    console.log('✅ WebAssembly available');
  } else {
    ok = false;
    const msg = '❌ WebAssembly not supported';
    notes.push(msg);
    console.error(msg);
  }

  // Final summary
  if (ok) {
    console.log('🎉 All dependency checks passed!');
    notes.push('🎉 All checks passed - ready for gesture recognition');
  } else {
    console.error('⚠️ Some dependency checks failed');
    notes.push('⚠️ Some checks failed - see above for details');
  }

  return { ok, notes };
}
