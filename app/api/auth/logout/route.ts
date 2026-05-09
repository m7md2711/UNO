import { NextRequest, NextResponse } from 'next/server';
import { logout } from '@/lib/auth-store';

export async function POST(req: NextRequest) {
  const { token } = await req.json();
  if (token) logout(token);
  return NextResponse.json({ ok: true });
}
