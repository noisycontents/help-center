'use client';

import { useSession } from 'next-auth/react';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export function AuthGuard({ children }: { children: React.ReactNode }) {
  const { data: session, status } = useSession();
  const router = useRouter();

  useEffect(() => {
    if (status === 'loading') return; // 로딩 중이면 대기

    if (!session) {
      // 세션이 없으면 게스트 로그인 시도
      fetch('/api/auth/guest', {
        method: 'GET',
        credentials: 'include',
      }).then(response => {
        if (response.redirected) {
          window.location.href = response.url;
        } else if (!response.ok) {
          console.error('게스트 로그인 실패');
          router.push('/login');
        }
      }).catch(error => {
        console.error('인증 오류:', error);
        router.push('/login');
      });
    }
  }, [session, status, router]);

  // 로딩 중이거나 세션이 없으면 로딩 표시
  if (status === 'loading' || !session) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return <>{children}</>;
}
