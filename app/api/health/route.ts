/**
 * Liveness probe for the deployed app.
 *
 * Returns the running commit so a smoke test can tell which build answered.
 * The only environment variable it reads is the commit SHA: nothing else about
 * the environment — keys, hosts, agent ids — belongs on a public response.
 *
 * force-dynamic keeps `time` and the commit from being baked in at build time;
 * a no-store header keeps proxies from serving a stale one.
 */
export const dynamic = 'force-dynamic';

export async function GET() {
  return Response.json(
    {
      ok: true,
      service: 'alebex-demo-studio-trial',
      commit:
        process.env.VERCEL_GIT_COMMIT_SHA ?? process.env.GIT_COMMIT_SHA ?? 'local',
      time: new Date().toISOString(),
    },
    { headers: { 'Cache-Control': 'no-store' } },
  );
}
