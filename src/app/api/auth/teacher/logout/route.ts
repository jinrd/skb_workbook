import { NextResponse } from 'next/server';
import { clearTeacherSession } from '@/lib/auth';

export async function POST(request: Request) {
  await clearTeacherSession();
  
  // POST form submit 시 /teacher/login 페이지로 자동 리다이렉트
  const loginUrl = new URL('/teacher/login', request.url);
  return NextResponse.redirect(loginUrl, 303);
}

export async function GET(request: Request) {
  await clearTeacherSession();
  const loginUrl = new URL('/teacher/login', request.url);
  return NextResponse.redirect(loginUrl, 303);
}
