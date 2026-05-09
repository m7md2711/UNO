import { NextResponse } from 'next/server';
import { getRoomSummaries } from '@/lib/room-store';

export const dynamic = 'force-dynamic';

export async function GET() {
  return NextResponse.json(getRoomSummaries());
}
