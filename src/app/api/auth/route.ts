import { prisma } from '@/lib/prisma';
import { signToken, getUserFromRequest } from '@/lib/auth';
import bcrypt from 'bcryptjs';
import { NextRequest, NextResponse } from 'next/server';

export async function GET(req: NextRequest) {
  const user = getUserFromRequest(req);
  if (!user) return NextResponse.json({ user: null });
  const dbUser = await prisma.user.findUnique({
    where: { id: user.userId },
    select: { id: true, name: true, email: true, role: true },
  });
  return NextResponse.json({ user: dbUser });
}

export async function POST(req: NextRequest) {
  try {
    const { action, email, password, name, role } = await req.json();

    if (action === 'register') {
      const existing = await prisma.user.findUnique({ where: { email } });
      if (existing) return NextResponse.json({ error: 'Email already exists' }, { status: 400 });

      const hashedPassword = await bcrypt.hash(password, 10);
      const user = await prisma.user.create({
        data: {
          email,
          name,
          password: hashedPassword,
          role: role || 'CUSTOMER',
        },
      });

      const token = signToken({ userId: user.id, email: user.email, role: user.role });
      const res = NextResponse.json({ user: { id: user.id, name: user.name, email: user.email, role: user.role }, token });
      res.cookies.set('token', token, { httpOnly: true, path: '/' });
      return res;
    }

    if (action === 'login') {
      const user = await prisma.user.findUnique({ where: { email } });
      if (!user) return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 });

      const valid = await bcrypt.compare(password, user.password);
      if (!valid) return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 });

      const token = signToken({ userId: user.id, email: user.email, role: user.role });
      const res = NextResponse.json({ user: { id: user.id, name: user.name, email: user.email, role: user.role }, token });
      res.cookies.set('token', token, { httpOnly: true, path: '/' });
      return res;
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}