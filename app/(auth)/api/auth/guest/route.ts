import { signIn } from '@/app/(auth)/auth';
import { isDevelopmentEnvironment } from '@/lib/constants';
import { getToken } from 'next-auth/jwt';
import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  try {
    // 게스트 로그인 - redirect: false로 무한 루프 방지
    const result = await signIn('guest', { 
      redirect: false
    });
    
    // 성공 시 메인 페이지로 리다이렉트
    return NextResponse.redirect(new URL('/', request.url));
  } catch (error) {
    console.error('게스트 로그인 오류:', error);
    // 에러 발생 시 로그인 페이지로
    return NextResponse.redirect(new URL('/login', request.url));
  }
}
