import { NextResponse } from 'next/server';
import { checkClassAccess } from '@/lib/accessControl';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await params;
    const result = await checkClassAccess({ joinToken: token });

    return NextResponse.json(result);
  } catch (error) {
    console.error('Check access status error:', error);
    return NextResponse.json(
      { isAllowed: false, reason: '접속 권한을 확인하는 도중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}
