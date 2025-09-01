import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';

import { Chat } from '@/components/chat';
import { DEFAULT_CHAT_MODEL } from '@/lib/ai/models';
import { generateUUID } from '@/lib/utils';
import { auth } from '../(auth)/auth';

export default async function ChatPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const session = await auth();

  if (!session) {
    redirect('/api/auth/guest');
  }

  const id = generateUUID();
  const params = await searchParams;
  const initialMessage = params.q;

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
    />
  );
}

export const metadata = {
  title: '미니학습지 AI 상담사',
  description: '미니학습지 관련 궁금한 점을 AI 상담사에게 문의하세요',
};
