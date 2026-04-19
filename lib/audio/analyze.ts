export interface AnalysisResult {
  bpm: number;
  key: string;
  lufs: number;
}

const TARGET_SAMPLE_RATE = 22050;
const MAX_DURATION_S = 15 * 60;

export async function analyzeAudio(file: File): Promise<AnalysisResult> {
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

  console.log("[analyze] decoded audio", {
    duration: audioBuffer.duration,
    samples: monoData.length,
  });

  console.log("[analyze] importing essentia.js (web variant)");
  // Use the MODULARIZE'd `.web.js` build — it's browser-only, fetches the
  // `.wasm` file separately (served from /public), and avoids the UMD build's
  // Node-environment detection that pulls in `fs`/`path`.
  const [wasmMod, coreMod] = await Promise.all([
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    import("essentia.js/dist/essentia-wasm.web.js") as Promise<any>,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    import("essentia.js/dist/essentia.js-core.es.js") as Promise<any>,
  ]);
  const EssentiaWASM = wasmMod.default ?? wasmMod.EssentiaWASM ?? wasmMod;
  const EssentiaClass = coreMod.default ?? coreMod.Essentia ?? coreMod;

  console.log("[analyze] instantiating WASM");
  const t0 = performance.now();
  const wasmModule = await EssentiaWASM({
    locateFile: (file: string) => `/${file}`,
  });
  console.log("[analyze] WASM ready in", Math.round(performance.now() - t0), "ms");

  const essentia = new EssentiaClass(wasmModule);

  console.log("[analyze] running RhythmExtractor2013");
  const bpmVector = essentia.arrayToVector(monoData);
  const rhythm = essentia.RhythmExtractor2013(bpmVector);
  const bpm = Math.round(rhythm.bpm * 10) / 10;

  console.log("[analyze] running KeyExtractor");
  const keyVector = essentia.arrayToVector(monoData);
  const keyResult = essentia.KeyExtractor(
    keyVector,
    true, 4096, 4096, 12, 3500, 60, 25, 0.2, "temperley", TARGET_SAMPLE_RATE
  );
  const key = `${keyResult.key} ${keyResult.scale}`;

  console.log("[analyze] running LoudnessEBUR128");
  const leftVector = essentia.arrayToVector(monoData);
  const rightVector = essentia.arrayToVector(monoData);
  const loudness = essentia.LoudnessEBUR128(
    leftVector, rightVector, 0.1, TARGET_SAMPLE_RATE
  );
  const lufs = Math.round(loudness.integratedLoudness * 10) / 10;
  console.log("[analyze] done", { bpm, key, lufs });

  return { bpm, key, lufs };
}
