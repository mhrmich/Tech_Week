# Mock Audio Samples

This directory contains placeholder audio files for stem separation mock mode.

## Required Files

The mock stem service returns URLs to these files:

- `mock_vocals.mp3` - Placeholder for vocals stem
- `mock_drums.mp3` - Placeholder for drums stem
- `mock_bass.mp3` - Placeholder for bass stem

## Usage

When `stemMockEnabled: true` in the config, the stem separation service returns these local URLs instead of calling a real API.

You can:
1. Add your own audio files here with these exact names
2. Use any short audio loops or samples
3. Leave them as TODO - the mock service will return the URLs regardless (they'll 404 if the files don't exist, but the service flow still works)

## For Step 13D (Audio Engine Integration)

When integrating with the audio engine, you'll likely want to add real audio samples here so you can test the stem toggling functionality without needing a real API.
