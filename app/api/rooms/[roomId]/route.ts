import { NextRequest, NextResponse } from 'next/server';
import { getRoomView, performAction } from '@/lib/room-store';

export const dynamic = 'force-dynamic';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ roomId: string }> }
) {
  const { roomId } = await params;
  const playerId = req.nextUrl.searchParams.get('playerId') ?? undefined;
  const room = getRoomView(roomId, playerId);
  if (!room) return NextResponse.json({ error: 'Room not found' }, { status: 404 });
  return NextResponse.json(room);
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ roomId: string }> }
) {
  const { roomId } = await params;
  const body = await req.json();
  const result = performAction(roomId, body);
  if ('error' in result) {
    return NextResponse.json(result, { status: 400 });
  }
  return NextResponse.json(result);
}
