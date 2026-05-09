import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth-store';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const auth  = req.headers.get('authorization') ?? '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : req.nextUrl.searchParams.get('token') ?? '';
  const session = getSession(token);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  return NextResponse.json({ userId: session.userId, username: session.username, displayName: session.displayName });
}
