export interface BandFilterControl {
  lowCut: BiquadFilterNode
  highCut: BiquadFilterNode
  setLowCut: (percent: number) => void
  setHighCut: (percent: number) => void
  resetBand: () => void
  getLowCutFrequency: () => number
  getHighCutFrequency: () => number
}

export function createBandFilterControl(audioContext: AudioContext): BandFilterControl {
  // Create two biquad filters for band-pass behavior
  const lowCut = audioContext.createBiquadFilter()
  const highCut = audioContext.createBiquadFilter()

  // Set Q to 0.707 for Butterworth response
  lowCut.Q.value = 0.707
  highCut.Q.value = 0.707

  // Set filter types
  lowCut.type = "highpass" // Low-cut = highpass filter
  highCut.type = "lowpass" // High-cut = lowpass filter

  let lowCutPercent = 0 // Default to 20 Hz (0%)
  let highCutPercent = 100 // Default to 20 kHz (100%)

  const percentToHz = (percent: number): number => {
    return 20 * Math.pow(20000 / 20, percent / 100)
  }

  const updateLowCut = () => {
    const frequency = percentToHz(lowCutPercent)
    const now = audioContext.currentTime
    lowCut.frequency.setTargetAtTime(frequency, now, 0.012)
  }

  const updateHighCut = () => {
    const frequency = percentToHz(highCutPercent)
    const now = audioContext.currentTime
    highCut.frequency.setTargetAtTime(frequency, now, 0.012)
  }

  const setLowCut = (percent: number) => {
    lowCutPercent = Math.max(0, Math.min(100, percent))

    // Clamp so lowCutFreq < highCutFreq
    const lowFreq = percentToHz(lowCutPercent)
    const highFreq = percentToHz(highCutPercent)

    if (lowFreq >= highFreq) {
      // Adjust lowCut to be just below highCut
      lowCutPercent = Math.max(0, highCutPercent - 1)
    }

    updateLowCut()
  }

  const setHighCut = (percent: number) => {
    highCutPercent = Math.max(0, Math.min(100, percent))

    // Clamp so lowCutFreq < highCutFreq
    const lowFreq = percentToHz(lowCutPercent)
    const highFreq = percentToHz(highCutPercent)

    if (highFreq <= lowFreq) {
      // Adjust highCut to be just above lowCut
      highCutPercent = Math.min(100, lowCutPercent + 1)
    }

    updateHighCut()
  }

  const resetBand = () => {
    lowCutPercent = 0 // 20 Hz
    highCutPercent = 100 // 20 kHz
    updateLowCut()
    updateHighCut()
  }

  const getLowCutFrequency = () => percentToHz(lowCutPercent)
  const getHighCutFrequency = () => percentToHz(highCutPercent)

  // Initialize filters
  updateLowCut()
  updateHighCut()

  return {
    lowCut,
    highCut,
    setLowCut,
    setHighCut,
    resetBand,
    getLowCutFrequency,
    getHighCutFrequency,
  }
}
