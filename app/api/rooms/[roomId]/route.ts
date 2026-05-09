import { NextRequest, NextResponse } from 'next/server';
import { getRoomView, performAction, syncRoomFromDB, persistRoom } from '@/lib/room-store';

export const dynamic = 'force-dynamic';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ roomId: string }> }
) {
  const { roomId } = await params;
  const playerId = req.nextUrl.searchParams.get('playerId') ?? undefined;

  await syncRoomFromDB(roomId);

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

  // Load latest state from Supabase before applying action
  await syncRoomFromDB(roomId);

  const result = performAction(roomId, body);

  if ('error' in result) return NextResponse.json(result, { status: 400 });

  // Persist updated state to Supabase
  await persistRoom(roomId);

  // Return redacted view for the requesting player
  const view = getRoomView(roomId, body.playerId);
  return NextResponse.json(view ?? result);
}
