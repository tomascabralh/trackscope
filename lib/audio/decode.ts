export const TARGET_SAMPLE_RATE = 22050;
export const MAX_DURATION_S = 15 * 60;

export interface DecodedAudio {
  monoData: Float32Array;
  sampleRate: number;
  durationS: number;
}

export async function decodeToMono22k(file: File): Promise<DecodedAudio> {
  const arrayBuffer = await file.arrayBuffer();

  const audioCtx = new AudioContext();
  const audioBuffer = await audioCtx.decodeAudioData(arrayBuffer);
  audioCtx.close();

  if (audioBuffer.duration > MAX_DURATION_S) {
    throw new Error(
      `File exceeds 15-minute limit (${Math.round(audioBuffer.duration / 60)} min)`
    );
  }

  const frameCount = Math.ceil(audioBuffer.duration * TARGET_SAMPLE_RATE);
  const offlineCtx = new OfflineAudioContext(1, frameCount, TARGET_SAMPLE_RATE);
  const source = offlineCtx.createBufferSource();
  source.buffer = audioBuffer;
  source.connect(offlineCtx.destination);
  source.start(0);
  const rendered = await offlineCtx.startRendering();
  const monoData = rendered.getChannelData(0);

  return {
    monoData,
    sampleRate: TARGET_SAMPLE_RATE,
    durationS: audioBuffer.duration,
  };
}
