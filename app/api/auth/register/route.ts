import { NextRequest, NextResponse } from 'next/server';
import { register } from '@/lib/auth-store';

export async function POST(req: NextRequest) {
  const { username, password } = await req.json();
  if (!username || !password) return NextResponse.json({ error: 'Username and password required' }, { status: 400 });
  const result = register(username, password);
  if ('error' in result) return NextResponse.json(result, { status: 400 });
  return NextResponse.json(result, { status: 201 });
}
