import { NextResponse, type NextRequest } from 'next/server';
import { getToken } from 'next-auth/jwt';
import { guestRegex, isDevelopmentEnvironment } from './lib/constants';

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  /*
   * Playwright starts the dev server and requires a 200 status to
   * begin the tests, so this ensures that the tests can start
   */
  if (pathname.startsWith('/ping')) {
    return new Response('pong', { status: 200 });
  }

  // 인증이 필요하지 않은 경로들
  const publicPaths = ['/login', '/register', '/api/auth'];
  const isPublicPath = publicPaths.some(path => pathname.startsWith(path));
  
  if (isPublicPath) {
    return NextResponse.next();
  }

  try {
    // 🚀 성능 최적화: 개발 환경에서만 토큰 로그 출력
    const token = await getToken({
      req: request,
      secret: process.env.AUTH_SECRET,
      secureCookie: !isDevelopmentEnvironment,
    });
    
    // 개발 환경에서만 상세 로그 출력
    if (isDevelopmentEnvironment && pathname.startsWith('/api/chat')) {
      console.log('미들웨어 - 토큰 확인:', { 
        pathname, 
        hasToken: !!token, 
        tokenType: token?.type 
      });
    }
    
    return NextResponse.next();
  } catch (error) {
    console.error('미들웨어 토큰 확인 오류:', error);
    return NextResponse.next();
  }
}

export const config = {
  matcher: [
    '/',
    '/chat/:id',
    '/api/:path*',
    '/login',
    '/register',

    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico, sitemap.xml, robots.txt (metadata files)
     */
    '/((?!_next/static|_next/image|favicon.ico|sitemap.xml|robots.txt).*)',
  ],
};
