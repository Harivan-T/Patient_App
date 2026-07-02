import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getSessionFromCookies } from '@/lib/auth';
import { getPatientById } from '@/lib/epr';
import { query } from '@/lib/db';

// GET /api/home-collection — all requests for the logged-in patient + prefill data
export async function GET() {
  const session = await getSessionFromCookies();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const [requestsResult, patient] = await Promise.all([
    query<{
      id: number;
      lab_order_id: string;
      address: string;
      preferred_datetime: string;
      phone: string;
      notes: string | null;
      status: string;
      created_at: string;
    }>(
      `SELECT id, lab_order_id, address, preferred_datetime, phone, notes, status, created_at
       FROM home_collection_requests
       WHERE patient_id = $1
       ORDER BY created_at DESC`,
      [session.patientId],
    ),
    getPatientById(session.patientId),
  ]);

  return NextResponse.json({
    requests: requestsResult.rows.map((r) => ({
      id:                r.id,
      labOrderId:        r.lab_order_id,
      address:           r.address,
      preferredDatetime: r.preferred_datetime,
      phone:             r.phone,
      notes:             r.notes,
      status:            r.status,
      createdAt:         r.created_at,
    })),
    patientPhone:   session.phone   ?? patient?.phoneNumber ?? '',
    patientAddress: patient?.address ?? '',
  });
}

const submitSchema = z.object({
  labOrderId:        z.string().min(1),
  address:           z.string().min(1),
  preferredDatetime: z.string().min(1),
  phone:             z.string().default(''),
  notes:             z.string().optional(),
});

// POST /api/home-collection — record a home collection request
export async function POST(req: NextRequest) {
  const session = await getSessionFromCookies();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const parsed = submitSchema.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: 'Invalid input' }, { status: 400 });

  const { labOrderId, address, preferredDatetime, phone, notes } = parsed.data;

  const result = await query<{ id: number }>(
    `INSERT INTO home_collection_requests
       (patient_id, lab_order_id, address, preferred_datetime, phone, notes)
     VALUES ($1, $2, $3, $4, $5, $6)
     ON CONFLICT (patient_id, lab_order_id)
     DO UPDATE SET
       address            = EXCLUDED.address,
       preferred_datetime = EXCLUDED.preferred_datetime,
       phone              = EXCLUDED.phone,
       notes              = EXCLUDED.notes,
       status             = 'requested'
     RETURNING id`,
    [session.patientId, labOrderId, address, preferredDatetime, phone, notes ?? null],
  );

  return NextResponse.json({ ok: true, id: result.rows[0].id });
}
