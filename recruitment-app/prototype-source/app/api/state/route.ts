import { eq } from 'drizzle-orm';
import { getDb } from '@/db';
import { prototypeState } from '@/db/schema';

export async function GET() {
  const db = getDb();
  const rows = await db
    .select()
    .from(prototypeState)
    .where(eq(prototypeState.id, 1))
    .limit(1);
  return Response.json(
    rows[0]
      ? { state: JSON.parse(rows[0].payload), updatedAt: rows[0].updatedAt }
      : { state: null },
  );
}

export async function POST(request: Request) {
  const body = (await request.json()) as { state?: unknown };
  if (!body || typeof body.state !== 'object' || body.state === null)
    return Response.json(
      { error: 'A valid prototype state is required.' },
      { status: 400 },
    );
  const payload = JSON.stringify(body.state);
  if (payload.length > 1_500_000)
    return Response.json(
      { error: 'Prototype state is too large.' },
      { status: 413 },
    );
  const updatedAt = new Date().toISOString();
  const db = getDb();
  await db
    .insert(prototypeState)
    .values({ id: 1, payload, updatedAt })
    .onConflictDoUpdate({
      target: prototypeState.id,
      set: { payload, updatedAt },
    });
  return Response.json({ saved: true, updatedAt });
}
