import { NextResponse } from 'next/server';
import { getRoomSummaries, syncAllRoomsFromDB } from '@/lib/room-store';

export const dynamic = 'force-dynamic';

export async function GET() {
  await syncAllRoomsFromDB();
  return NextResponse.json(getRoomSummaries());
}
