// essentia.js ships prebuilt WASM/ESM bundles under dist/ with no type
// declarations, so these deep imports trip TS7016 and break `next build`.
// We already treat them as `any` at the import site (lib/audio/essentia.ts);
// these ambient declarations make that explicit and let the type-checker pass.
declare module "essentia.js/dist/essentia-wasm.web.js";
declare module "essentia.js/dist/essentia.js-core.es.js";
