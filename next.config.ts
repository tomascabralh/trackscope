import type { NextConfig } from "next";

const emptyModule = "./lib/empty-module.js";

const nextConfig: NextConfig = {
  headers: async () => [
    {
      source: "/:path*.wasm",
      headers: [{ key: "Content-Type", value: "application/wasm" }],
    },
  ],
  // essentia.js's Emscripten glue statically references node built-ins behind
  // runtime environment checks. Stub them out in the browser bundle only; the
  // server still needs the real `fs`, `path`, `crypto`.
  webpack: (config, { isServer }) => {
    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        path: false,
        crypto: false,
      };
    }
    return config;
  },
  turbopack: {
    resolveAlias: {
      fs: { browser: emptyModule },
      path: { browser: emptyModule },
      crypto: { browser: emptyModule },
    },
  },
};

export default nextConfig;
