'use client';

import { useEffect } from 'react';
import { useSession, signIn } from 'next-auth/react';
import { useSearchParams } from 'next/navigation';

export function AutoLoginCheck() {
  const { data: session, status } = useSession();
  const searchParams = useSearchParams();

  useEffect(() => {
    // 로딩 중이거나 이미 로그인되어 있으면 스킵
    if (status === 'loading' || session) {
      return;
    }

    // URL에 WordPress 인증 토큰이 있는지 확인
    const wpToken = searchParams.get('wp_token');
    const wpUser = searchParams.get('wp_user');
    
    if (wpToken && wpUser) {
      // WordPress에서 온 사용자 자동 로그인
      console.log('WordPress에서 온 사용자 자동 로그인 시도:', wpUser);
      signIn('wordpress', { 
        callbackUrl: '/',
        redirect: false 
      });
      return;
    }

    // studymini.com의 쿠키 확인 (교차 도메인)
    const checkMainSiteLogin = async () => {
      try {
        // studymini.com의 로그인 상태 확인
        const response = await fetch('https://studymini.com/wp-json/wp/v2/users/me', {
          credentials: 'include', // 쿠키 포함
          headers: {
            'Accept': 'application/json',
          },
        });

        if (response.ok) {
          const userData = await response.json();
          console.log('studymini.com에서 로그인된 사용자 발견:', userData);
          
          // 자동으로 WordPress OAuth 로그인 시도
          signIn('wordpress', { 
            callbackUrl: '/',
            redirect: false 
          });
        }
      } catch (error) {
        console.log('메인 사이트 로그인 상태 확인 실패:', error);
        // 에러는 무시 (CORS 등의 이유로 실패할 수 있음)
      }
    };

    // 페이지 로드 후 1초 뒤에 확인 (초기 로딩 완료 후)
    const timer = setTimeout(checkMainSiteLogin, 1000);
    
    return () => clearTimeout(timer);
  }, [session, status, searchParams]);

  return null; // UI 렌더링 없음
}
