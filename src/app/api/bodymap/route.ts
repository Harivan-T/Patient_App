import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getSessionFromCookies } from '@/lib/auth';
import { getBodyMapAnnotations, saveBodyMapAnnotation, deleteBodyMapAnnotations } from '@/lib/epr';

export async function GET() {
  const session = await getSessionFromCookies();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const annotations = await getBodyMapAnnotations(session.patientId);
    return NextResponse.json({ annotations });
  } catch {
    return NextResponse.json({ annotations: [] });
  }
}

const annotationSchema = z.object({
  area: z.string().min(1),
  side: z.enum(['front', 'back']),
  x: z.number().min(0).max(100),
  y: z.number().min(0).max(100),
  severity: z.number().int().min(1).max(5),
  description: z.string().min(1).max(500),
});

export async function POST(req: NextRequest) {
  const session = await getSessionFromCookies();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await req.json();
  const parsed = annotationSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid input' }, { status: 400 });
  }

  try {
    const annotation = await saveBodyMapAnnotation({
      patientId: session.patientId,
      ...parsed.data,
      severity: parsed.data.severity as 1 | 2 | 3 | 4 | 5,
    });
    return NextResponse.json({ annotation }, { status: 201 });
  } catch {
    return NextResponse.json(
      { error: 'Body map storage is not set up yet. Run the DB migration to enable this feature.' },
      { status: 503 }
    );
  }
}

export async function DELETE() {
  const session = await getSessionFromCookies();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    await deleteBodyMapAnnotations(session.patientId);
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ success: true });
  }
}
