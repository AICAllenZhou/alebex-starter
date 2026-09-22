// Alebex POSTs the call report here when a call finishes: who said what, how
// long it ran, and a link to the recording.
//
// Set this URL under Voice Agents in the Alebex dev console:
//   https://your-project.vercel.app/api/alebex/end-of-call
//
// There is no signature on this request, so treat the body as a claim, not a
// fact: only trust an `id` that matches a call you started.

export async function POST(request) {
  const report = await request.json();

  const { id, callType, endedReason, durationSeconds, transcript, recordingUrl } = report;

  console.log('[alebex] call finished', { id, callType, endedReason, durationSeconds });
  console.log('[alebex] transcript\n' + transcript);

  // The recording link is signed and expires 60 minutes after this request.
  // Download it now if you want to keep it.
  if (recordingUrl) {
    // await fetch(recordingUrl) and store the bytes somewhere.
  }

  // Delivery is best effort and never retried, and the same call can arrive
  // twice. Store by `id` so a repeat overwrites rather than duplicates.
  // await saveCallOutcome(id, endedReason, durationSeconds, transcript);

  // Answer 2xx or Alebex will consider the delivery failed.
  return new Response(null, { status: 204 });
}
