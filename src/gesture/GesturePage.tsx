import { useState, useRef, useEffect } from 'react';
import { startGestureModule, stopGestureModule, subscribe, emit } from './index';
import type { DJEvent } from './types';
import * as camera from './camera';
import * as audioEngine from './audioEngine';
import './posture'; // Import for dev mode window exposure
import './normalize'; // Import for dev mode window exposure
import './modes'; // Import for dev mode window exposure
import './GesturePage.css';

export function GesturePage() {
  const [logs, setLogs] = useState<string[]>([]);
  const [cameraStarted, setCameraStarted] = useState(false);
  const [vocalFile, setVocalFile] = useState<File | null>(null);
  const [instrumentalFile, setInstrumentalFile] = useState<File | null>(null);
  const [audioLoaded, setAudioLoaded] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const vocalInputRef = useRef<HTMLInputElement>(null);
  const instrumentalInputRef = useRef<HTMLInputElement>(null);

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

      // Initialize audio engine (requires user gesture)
      addLog('Initializing audio engine...');
      try {
        await audioEngine.initAudio();
        addLog('✅ Audio engine ready');
      } catch (audioError) {
        addLog(`⚠️ Audio warning: ${audioError instanceof Error ? audioError.message : 'Unknown error'}`);
      }

      addLog('🎉 Gesture module started! Gesture controls:');
      addLog('  - 4-finger palm (hold): PLAY');
      addLog('  - Fist (hold): PAUSE');
      addLog('  - Pinch + move: TEMPO + FILTER control');
      addLog('  - 1 finger: Toggle VOCALS');
      addLog('  - 2 fingers: Toggle INSTRUMENTAL');
      addLog('');
      addLog('📁 Upload vocal and instrumental stem files to get started!');

    } catch (error) {
      addLog(`Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
      setCameraStarted(false);
    }
  };

  const handleVocalUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setVocalFile(file);
    addLog(`📁 Vocal stem uploaded: ${file.name}`);

    // Try to load stems if both are ready
    if (instrumentalFile) {
      await loadStems(file, instrumentalFile);
    } else {
      addLog('  ⏳ Waiting for instrumental stem...');
    }
  };

  const handleInstrumentalUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setInstrumentalFile(file);
    addLog(`📁 Instrumental stem uploaded: ${file.name}`);

    // Try to load stems if both are ready
    if (vocalFile) {
      await loadStems(vocalFile, file);
    } else {
      addLog('  ⏳ Waiting for vocal stem...');
    }
  };

  const loadStems = async (vocal: File, instrumental: File) => {
    try {
      addLog('🎵 Loading stems into audio engine...');

      // Create object URLs for the uploaded files
      const vocalUrl = URL.createObjectURL(vocal);
      const instrumentalUrl = URL.createObjectURL(instrumental);

      // Load: vocals = vocal file, drums + bass = instrumental file
      await audioEngine.loadStems({
        vocals: vocalUrl,
        drums: instrumentalUrl,
        bass: instrumentalUrl, // Same as drums for "instrumental" control
      });

      setAudioLoaded(true);
      addLog('✅ All stems loaded! Ready to play.');
      addLog('');
      addLog('🎵 Gesture controls:');
      addLog('  - 4-finger palm (hold): PLAY');
      addLog('  - Fist (hold): PAUSE');
      addLog('  - Pinch + move: TEMPO/FILTER');
      addLog('  - 1 finger: Toggle VOCALS');
      addLog('  - 2 fingers: Toggle INSTRUMENTAL');
    } catch (error) {
      addLog(`❌ Failed to load stems: ${error instanceof Error ? error.message : 'Unknown error'}`);
      setAudioLoaded(false);
    }
  };

  // Format DJ events as human-readable strings
  const formatEvent = (event: DJEvent): string => {
    switch (event.type) {
      case 'PLAY':
        return 'Event: PLAY';
      case 'PAUSE':
        return 'Event: PAUSE';
      case 'TEMPO_SET':
        return `Event: TEMPO_SET ${event.value.toFixed(2)}`;
      case 'FILTER_SWEEP':
        return `Event: FILTER_SWEEP ${event.value.toFixed(2)}`;
      case 'SCRATCH_JOG':
        return `Event: SCRATCH_JOG ${event.delta > 0 ? '+' : ''}${event.delta.toFixed(2)}`;
      case 'PAD_TRIGGER':
        return `Event: PAD_TRIGGER ${event.pad}`;
      case 'CROSSFADER_SET':
        return `Event: CROSSFADER_SET ${event.value.toFixed(2)}`;
      case 'STEM_TOGGLE':
        return `Event: STEM_TOGGLE ${event.stem} ${event.enabled ? 'ON' : 'OFF'}`;
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
          <div className="audio-upload-section">
            <h3 className="audio-upload-header">Load Stem Files</h3>

            {/* Vocal stem upload */}
            <input
              ref={vocalInputRef}
              type="file"
              accept="audio/*"
              onChange={handleVocalUpload}
              style={{ display: 'none' }}
            />
            <button
              className="upload-button"
              onClick={() => vocalInputRef.current?.click()}
            >
              {vocalFile ? `✅ Vocal: ${vocalFile.name}` : '🎤 Upload Vocal Stem'}
            </button>

            {/* Instrumental stem upload */}
            <input
              ref={instrumentalInputRef}
              type="file"
              accept="audio/*"
              onChange={handleInstrumentalUpload}
              style={{ display: 'none' }}
            />
            <button
              className="upload-button"
              onClick={() => instrumentalInputRef.current?.click()}
            >
              {instrumentalFile ? `✅ Instrumental: ${instrumentalFile.name}` : '🎸 Upload Instrumental Stem'}
            </button>

            {audioLoaded && (
              <div className="audio-status">
                🎵 Both stems loaded! Use gestures to control playback.
              </div>
            )}
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
