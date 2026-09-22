// An example custom tool. Alebex POSTs here mid-conversation when the model
// decides the caller's question needs it, waits for your answer, and reads it
// back out loud. Rename the folder to rename the tool.
//
// Ask your AI tool to replace lookUpStock() with whatever your agent should
// really do — check an order, book a slot, read a spreadsheet, hit your API.

export async function POST(request) {
  // 1. Prove the request came from your agent, not from a stranger with the URL.
  if (request.headers.get('authorization') !== `Bearer ${process.env.TOOL_SECRET}`) {
    return Response.json({ error: 'bad tool credential' }, { status: 401 });
  }

  const body = await request.json();

  // 2. `arguments` holds exactly the fields your schema declared. Only `sku` is
  //    required, so treat everything else as possibly missing.
  const args = body.arguments ?? {};

  // 3. `call.id` is the engine's id for this call. It is NOT the Twilio call SID.
  //    Use it to make side effects safe: the model may call the same tool twice
  //    in one turn, so key anything you book, charge or send on call.id + args.
  const callId = body.call?.id;

  const stock = lookUpStock(args.sku, args.size);

  // 4. Whatever you return is handed to the model verbatim. Write values a
  //    person could hear: "20 minutes", not a unix timestamp.
  if (!stock) {
    return Response.json({
      inStock: false,
      reason: `We do not carry SKU ${args.sku}`,
    });
  }

  return Response.json({
    inStock: true,
    available: stock.count,
    store: stock.store,
    readyIn: '20 minutes',
  });
}

// Fake data so the tool answers before you have a real backend.
// Replace this whole function.
function lookUpStock(sku, size) {
  if (!sku) return null;
  const catalog = {
    'A-1024': { count: 6, store: 'Broadway & Main' },
    'A-1099': { count: 2, store: 'Granville' },
  };
  const hit = catalog[sku.toUpperCase()];
  if (!hit) return null;
  return size === 'XL' ? null : hit;
}
