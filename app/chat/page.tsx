import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';

import { Chat } from '@/components/chat';
import { HelpContent } from '@/components/help-content';
import { DEFAULT_CHAT_MODEL } from '@/lib/ai/models';
import { generateUUID } from '@/lib/utils';
import { auth } from '../(auth)/auth';

export default async function ChatPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; mode?: string; category?: string }>;
}) {
  const session = await auth();

  if (!session) {
    redirect('/api/auth/guest');
  }

  const id = generateUUID(); // 기본 UUID 사용
  const params = await searchParams;
  let initialMessage = params.q;
  const mode = params.mode; // 'help' 모드 확인
  const category = params.category;
  
  console.log('새 채팅/도움말 생성:', {
    id,
    mode,
    category,
    hasInitialMessage: !!initialMessage,
    sessionUserId: session?.user?.id
  });
  
  // 한글 처리 개선
  if (initialMessage) {
    try {
      // URL 디코딩이 제대로 되었는지 확인
      const testDecode = decodeURIComponent(initialMessage);
      if (testDecode !== initialMessage) {
        initialMessage = testDecode;
      }
      console.log('서버에서 초기 메시지 처리:', initialMessage);
    } catch (error) {
      console.warn('서버 URL 디코딩 실패:', error);
    }
  }

  // 도움말 모드인 경우에도 채팅 컴포넌트 사용하되, 초기 상태를 도움말로 설정
  const isHelpMode = mode === 'help';

  const cookieStore = await cookies();
  const modelIdFromCookie = cookieStore.get('chat-model');

  const initialMessages = initialMessage
    ? [
        {
          id: generateUUID(),
          role: 'user' as const,
          parts: [{ type: 'text' as const, text: initialMessage }],
        },
      ]
    : [];

  if (!modelIdFromCookie) {
    return (
      <Chat
        key={id}
        id={id}
        initialMessages={initialMessages}
        initialChatModel={DEFAULT_CHAT_MODEL}
        initialVisibilityType="private"
        isReadonly={false}
        session={session}
        autoResume={false}
        isHelpMode={isHelpMode}
        helpCategory={category}
      />
    );
  }

  return (
    <Chat
      key={id}
      id={id}
      initialMessages={initialMessages}
      initialChatModel={modelIdFromCookie.value}
      initialVisibilityType="private"
      isReadonly={false}
      session={session}
      autoResume={false}
      isHelpMode={isHelpMode}
      helpCategory={category}
    />
  );
}

export const metadata = {
  title: '미니학습지 AI 상담사',
  description: '미니학습지 관련 궁금한 점을 AI 상담사에게 문의하세요',
};
