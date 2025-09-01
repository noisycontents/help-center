'use client';

import { signIn } from 'next-auth/react';

export default function Page() {
  return (
    <div className="flex h-dvh w-screen items-center justify-center bg-gradient-to-br from-orange-50 to-white">
      <div className="w-full max-w-md overflow-hidden rounded-3xl bg-white shadow-2xl border border-gray-100">
        <div className="p-8 flex flex-col items-center gap-8">
          {/* 미니학습지 로고 */}
          <div className="flex flex-col items-center gap-4">
            <div className="w-20 h-20 rounded-full overflow-hidden shadow-lg">
              <img 
                src="/images/mini-logo.png" 
                alt="미니학습지 로고" 
                className="w-full h-full object-cover"
              />
            </div>
            
            <div className="text-center">
              <h1 className="text-2xl font-bold text-gray-900 mb-2">미니학습지 헬프센터</h1>
              <p className="text-gray-600">
                로그인하면 상담 내용을 저장할 수 있어요.
              </p>
            </div>
          </div>
          
          {/* WordPress OAuth 로그인 버튼 */}
          <button
            onClick={() => signIn('wordpress', { callbackUrl: '/' })}
            className="w-full flex items-center justify-center gap-3 px-6 py-4 bg-[#FF5100] text-white rounded-xl hover:bg-[#E6470E] transition-all duration-200 font-semibold text-lg shadow-lg hover:shadow-xl transform hover:scale-[1.02]"
          >
            미니학습지 계정으로 로그인
          </button>

          {/* 회원가입 링크 */}
          <div className="text-center">
            <p className="text-sm text-gray-600">
              계정이 없으신가요?{' '}
              <a 
                href="https://studymini.com/register/"
                target="_blank"
                rel="noopener noreferrer"
                className="font-semibold text-[#FF5100] hover:text-[#E6470E] hover:underline transition-colors"
              >
                회원가입
              </a>{' '}
              하세요.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}