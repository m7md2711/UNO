import { NextResponse } from 'next/server';
import { resetAllRooms, persistAllRooms } from '@/lib/room-store';

export async function POST() {
  resetAllRooms();
  await persistAllRooms();
  return NextResponse.json({ ok: true, message: 'All rooms reset' });
}
