// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Essentia = any;

let cached: Promise<Essentia> | null = null;

export function getEssentia(): Promise<Essentia> {
  if (cached) return cached;
  cached = (async () => {
    const [wasmMod, coreMod] = await Promise.all([
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      import("essentia.js/dist/essentia-wasm.web.js") as Promise<any>,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      import("essentia.js/dist/essentia.js-core.es.js") as Promise<any>,
    ]);
    const EssentiaWASM = wasmMod.default ?? wasmMod.EssentiaWASM ?? wasmMod;
    const EssentiaClass = coreMod.default ?? coreMod.Essentia ?? coreMod;
    const wasmModule = await EssentiaWASM({
      locateFile: (file: string) => `/${file}`,
    });
    return new EssentiaClass(wasmModule);
  })();
  return cached;
}
