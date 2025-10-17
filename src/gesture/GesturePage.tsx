import { useState, useRef, useEffect } from 'react';
import { startGestureModule, stopGestureModule, subscribe, emit, engineA, engineB } from './index';
import type { DJEvent } from './types';
import * as camera from './camera';
import './posture'; // Import for dev mode window exposure
import './normalize'; // Import for dev mode window exposure
import './modes'; // Import for dev mode window exposure
import './GesturePage.css';

export function GesturePage() {
  const [logs, setLogs] = useState<string[]>([]);
  const [cameraStarted, setCameraStarted] = useState(false);

  // Deck A state
  const [vocalFileA, setVocalFileA] = useState<File | null>(null);
  const [instrumentalFileA, setInstrumentalFileA] = useState<File | null>(null);
  const [audioLoadedA, setAudioLoadedA] = useState(false);

  // Deck B state
  const [vocalFileB, setVocalFileB] = useState<File | null>(null);
  const [instrumentalFileB, setInstrumentalFileB] = useState<File | null>(null);
  const [audioLoadedB, setAudioLoadedB] = useState(false);

  const videoRef = useRef<HTMLVideoElement>(null);
  const vocalInputRefA = useRef<HTMLInputElement>(null);
  const instrumentalInputRefA = useRef<HTMLInputElement>(null);
  const vocalInputRefB = useRef<HTMLInputElement>(null);
  const instrumentalInputRefB = useRef<HTMLInputElement>(null);

  const addLog = (message: string) => {
    const timestamp = new Date().toLocaleTimeString();
    setLogs((prev) => [...prev, `[${timestamp}] ${message}`]);
  };

  const handleStartCamera = async () => {
    try {
      addLog('Start Camera button clicked');

      // Start the unified gesture module (model + camera + detection loop)
      addLog('Starting gesture module...');
      await startGestureModule({ modelUrl: '/models/hand_landmarker.task' });

      // Get the camera's video element and replace the ref
      const cameraVideo = camera.getVideoElement();
      if (videoRef.current && videoRef.current.parentElement) {
        // Replace the placeholder video with the actual camera video
        videoRef.current.parentElement.replaceChild(cameraVideo, videoRef.current);
        // Update the ref to point to the camera video
        (videoRef as any).current = cameraVideo;
        // Apply the same classes
        cameraVideo.className = 'gesture-video visible';
      }

      setCameraStarted(true);

      // Initialize both audio engines (requires user gesture)
      addLog('Initializing audio engines...');
      try {
        await Promise.all([
          engineA.ensureAudio(),
          engineB.ensureAudio()
        ]);
        addLog('✅ Audio engines ready (Deck A + Deck B)');
      } catch (audioError) {
        addLog(`⚠️ Audio warning: ${audioError instanceof Error ? audioError.message : 'Unknown error'}`);
      }

      addLog('🎉 Two-hand gesture module started!');
      addLog('');
      addLog('🎮 RIGHT HAND → Deck A:');
      addLog('  - Palm (hold 600ms): PLAY A');
      addLog('  - Fist (hold 600ms): PAUSE A');
      addLog('  - Pinch + move: TEMPO/FILTER A');
      addLog('  - 1 finger: Toggle vocals A');
      addLog('  - 2 fingers: Toggle drums+bass A');
      addLog('  - 3 fingers: BLEND mode (crossfade control)');
      addLog('');
      addLog('🎮 LEFT HAND → Deck B:');
      addLog('  - Palm (hold 600ms): PLAY B');
      addLog('  - Fist (hold 600ms): PAUSE B');
      addLog('  - Pinch + move: TEMPO/FILTER B');
      addLog('  - 1 finger: Toggle vocals B');
      addLog('  - 2 fingers: Toggle drums+bass B');
      addLog('  - 3 fingers: BLEND mode (crossfade control)');
      addLog('');
      addLog('🔗 Deck B auto-syncs tempo to Deck A when loaded!');
      addLog('📁 Upload stem files for both decks to get started!');

    } catch (error) {
      addLog(`Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
      setCameraStarted(false);
    }
  };

  // Deck A upload handlers
  const handleVocalUploadA = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setVocalFileA(file);
    addLog(`📁 Deck A - Vocal stem uploaded: ${file.name}`);

    // Try to load stems if both are ready
    if (instrumentalFileA) {
      await loadStemsA(file, instrumentalFileA);
    } else {
      addLog('  ⏳ Deck A - Waiting for instrumental stem...');
    }
  };

  const handleInstrumentalUploadA = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setInstrumentalFileA(file);
    addLog(`📁 Deck A - Instrumental stem uploaded: ${file.name}`);

    // Try to load stems if both are ready
    if (vocalFileA) {
      await loadStemsA(vocalFileA, file);
    } else {
      addLog('  ⏳ Deck A - Waiting for vocal stem...');
    }
  };

  const loadStemsA = async (vocal: File, instrumental: File) => {
    try {
      addLog('🎵 Loading stems into Deck A...');

      // Create object URLs for the uploaded files
      const vocalUrl = URL.createObjectURL(vocal);
      const instrumentalUrl = URL.createObjectURL(instrumental);

      // Load: vocals = vocal file, drums + bass = instrumental file
      await engineA.loadStems({
        vocals: vocalUrl,
        drums: instrumentalUrl,
        bass: instrumentalUrl, // Same as drums for "instrumental" control
      });

      setAudioLoadedA(true);
      addLog('✅ Deck A loaded! Left hand controls ready.');
    } catch (error) {
      addLog(`❌ Failed to load Deck A stems: ${error instanceof Error ? error.message : 'Unknown error'}`);
      setAudioLoadedA(false);
    }
  };

  // Deck B upload handlers
  const handleVocalUploadB = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setVocalFileB(file);
    addLog(`📁 Deck B - Vocal stem uploaded: ${file.name}`);

    // Try to load stems if both are ready
    if (instrumentalFileB) {
      await loadStemsB(file, instrumentalFileB);
    } else {
      addLog('  ⏳ Deck B - Waiting for instrumental stem...');
    }
  };

  const handleInstrumentalUploadB = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setInstrumentalFileB(file);
    addLog(`📁 Deck B - Instrumental stem uploaded: ${file.name}`);

    // Try to load stems if both are ready
    if (vocalFileB) {
      await loadStemsB(vocalFileB, file);
    } else {
      addLog('  ⏳ Deck B - Waiting for vocal stem...');
    }
  };

  const loadStemsB = async (vocal: File, instrumental: File) => {
    try {
      addLog('🎵 Loading stems into Deck B...');

      // Create object URLs for the uploaded files
      const vocalUrl = URL.createObjectURL(vocal);
      const instrumentalUrl = URL.createObjectURL(instrumental);

      // Load: vocals = vocal file, drums + bass = instrumental file
      await engineB.loadStems({
        vocals: vocalUrl,
        drums: instrumentalUrl,
        bass: instrumentalUrl, // Same as drums for "instrumental" control
      });

      setAudioLoadedB(true);
      addLog('✅ Deck B loaded! Right hand controls ready.');
    } catch (error) {
      addLog(`❌ Failed to load Deck B stems: ${error instanceof Error ? error.message : 'Unknown error'}`);
      setAudioLoadedB(false);
    }
  };

  // Format DJ events as human-readable strings
  const formatEvent = (event: DJEvent): string => {
    const deckTag = event.deck ? ` [${event.deck}]` : '';

    switch (event.type) {
      case 'PLAY':
        return `Event: PLAY${deckTag}`;
      case 'PAUSE':
        return `Event: PAUSE${deckTag}`;
      case 'TEMPO_SET':
        return `Event: TEMPO_SET ${event.value.toFixed(2)}${deckTag}`;
      case 'FILTER_SWEEP':
        return `Event: FILTER_SWEEP ${event.value.toFixed(2)}${deckTag}`;
      case 'SCRATCH_JOG':
        return `Event: SCRATCH_JOG ${event.delta > 0 ? '+' : ''}${event.delta.toFixed(2)}${deckTag}`;
      case 'PAD_TRIGGER':
        return `Event: PAD_TRIGGER ${event.pad}`;
      case 'CROSSFADER_SET':
        return `Event: CROSSFADER_SET ${event.value.toFixed(2)}`;
      case 'STEM_TOGGLE':
        return `Event: STEM_TOGGLE ${event.stem} ${event.enabled ? 'ON' : 'OFF'}${deckTag}`;
      case 'STEM_LEVEL':
        return `Event: STEM_LEVEL ${event.stem} ${event.value.toFixed(2)}${deckTag}`;
      default:
        return `Event: ${JSON.stringify(event)}`;
    }
  };

  // Subscribe to the event bus on mount
  useEffect(() => {
    const unsubscribe = subscribe((event) => {
      addLog(formatEvent(event));
    });

    // Cleanup: unsubscribe on unmount
    return unsubscribe;
  }, []);

  // Cleanup: stop gesture module on unmount
  useEffect(() => {
    return () => {
      stopGestureModule();
    };
  }, []);

  return (
    <div className="gesture-page">
      <div className="gesture-container">
        <h1 className="gesture-header">DJ Gesture Module</h1>

        <video
          ref={videoRef}
          className={`gesture-video ${cameraStarted ? 'visible' : 'hidden'}`}
          autoPlay
          muted
          playsInline
        />

        <button
          className="start-button"
          onClick={handleStartCamera}
          disabled={cameraStarted}
        >
          {cameraStarted ? 'Camera Started' : 'Start Camera'}
        </button>

        {cameraStarted && (
          <div className="dual-deck-section">
            {/* Deck A (Right Hand) */}
            <div className="audio-upload-section deck-a">
              <h3 className="audio-upload-header">🎮 Deck A (Right Hand)</h3>

              {/* Vocal stem upload */}
              <input
                ref={vocalInputRefA}
                type="file"
                accept="audio/*"
                onChange={handleVocalUploadA}
                style={{ display: 'none' }}
              />
              <button
                className="upload-button"
                onClick={() => vocalInputRefA.current?.click()}
              >
                {vocalFileA ? `✅ Vocal: ${vocalFileA.name}` : '🎤 Upload Vocal Stem'}
              </button>

              {/* Instrumental stem upload */}
              <input
                ref={instrumentalInputRefA}
                type="file"
                accept="audio/*"
                onChange={handleInstrumentalUploadA}
                style={{ display: 'none' }}
              />
              <button
                className="upload-button"
                onClick={() => instrumentalInputRefA.current?.click()}
              >
                {instrumentalFileA ? `✅ Instrumental: ${instrumentalFileA.name}` : '🎸 Upload Instrumental Stem'}
              </button>

              {audioLoadedA && (
                <div className="audio-status">
                  ✅ Deck A ready! Use right hand gestures.
                </div>
              )}
            </div>

            {/* Deck B (Left Hand) */}
            <div className="audio-upload-section deck-b">
              <h3 className="audio-upload-header">🎮 Deck B (Left Hand)</h3>

              {/* Vocal stem upload */}
              <input
                ref={vocalInputRefB}
                type="file"
                accept="audio/*"
                onChange={handleVocalUploadB}
                style={{ display: 'none' }}
              />
              <button
                className="upload-button"
                onClick={() => vocalInputRefB.current?.click()}
              >
                {vocalFileB ? `✅ Vocal: ${vocalFileB.name}` : '🎤 Upload Vocal Stem'}
              </button>

              {/* Instrumental stem upload */}
              <input
                ref={instrumentalInputRefB}
                type="file"
                accept="audio/*"
                onChange={handleInstrumentalUploadB}
                style={{ display: 'none' }}
              />
              <button
                className="upload-button"
                onClick={() => instrumentalInputRefB.current?.click()}
              >
                {instrumentalFileB ? `✅ Instrumental: ${instrumentalFileB.name}` : '🎸 Upload Instrumental Stem'}
              </button>

              {audioLoadedB && (
                <div className="audio-status">
                  ✅ Deck B ready! Use left hand gestures.
                </div>
              )}
            </div>
          </div>
        )}

        <div className="test-events-section">
          <h3 className="test-events-header">Test Events</h3>
          <div className="test-events-grid">
            <button onClick={() => emit({ type: 'PLAY' })}>PLAY</button>
            <button onClick={() => emit({ type: 'PAUSE' })}>PAUSE</button>
            <button onClick={() => emit({ type: 'TEMPO_SET', value: 1.10 })}>
              TEMPO_SET (1.10)
            </button>
            <button onClick={() => emit({ type: 'FILTER_SWEEP', value: 0.75 })}>
              FILTER_SWEEP (0.75)
            </button>
            <button onClick={() => emit({ type: 'SCRATCH_JOG', delta: 0.2 })}>
              SCRATCH_JOG (+0.2)
            </button>
            <button onClick={() => emit({ type: 'PAD_TRIGGER', pad: 3 })}>
              PAD_TRIGGER (3)
            </button>
          </div>
        </div>

        <div className="log-box">
          <div className="log-header">Console Log</div>
          <div className="log-content">
            {logs.length === 0 ? (
              <div className="log-empty">No logs yet...</div>
            ) : (
              logs.map((log, index) => (
                <div key={index} className="log-entry">
                  {log}
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
