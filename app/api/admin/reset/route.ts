import { NextResponse } from 'next/server';
import { resetAllRooms } from '@/lib/room-store';
import { clearAllSessions } from '@/lib/auth-store';

export async function POST() {
  resetAllRooms();
  // Keep user accounts; only clear game sessions
  return NextResponse.json({ ok: true, message: 'All rooms reset' });
}
