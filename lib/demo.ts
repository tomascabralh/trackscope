// Hosted demo mode: the analysis is fully client-side and works anywhere, but
// the production-notes breakdown needs a local Ollama server, so a public
// deploy ships with NEXT_PUBLIC_DEMO_MODE=1 to switch the breakdown UI to a
// "run it locally" notice and refuse /api/breakdown outright.
//
// Read lazily (not a module-level constant) so the server respects runtime env
// and tests can stub it; in client bundles Next.js inlines the env reference.
export function isDemoMode(): boolean {
  return process.env.NEXT_PUBLIC_DEMO_MODE === "1";
}

export const REPO_URL = "https://github.com/tomascabralh/trackscope";
