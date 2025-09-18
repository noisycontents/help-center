import { PreviewMessage, ThinkingMessage } from './message';
import { Greeting } from './greeting';
import { memo, useEffect, useState } from 'react';
import type { Vote } from '@/lib/db/schema';
import equal from 'fast-deep-equal';
import type { UseChatHelpers } from '@ai-sdk/react';
import { motion } from 'framer-motion';
import { useMessages } from '@/hooks/use-messages';
import type { ChatMessage } from '@/lib/types';
import { useDataStream } from './data-stream-provider';
import { Conversation, ConversationContent, ConversationScrollButton } from './elements/conversation';

interface MessagesProps {
  chatId: string;
  status: UseChatHelpers<ChatMessage>['status'];
  votes: Array<Vote> | undefined;
  messages: ChatMessage[];
  setMessages: UseChatHelpers<ChatMessage>['setMessages'];
  regenerate: UseChatHelpers<ChatMessage>['regenerate'];
  isReadonly: boolean;
  isArtifactVisible: boolean;
}

function PureMessages({
  chatId,
  status,
  votes,
  messages,
  setMessages,
  regenerate,
  isReadonly,
}: MessagesProps) {
  const {
    containerRef: messagesContainerRef,
    endRef: messagesEndRef,
    onViewportEnter,
    onViewportLeave,
    hasSentMessage,
  } = useMessages({
    chatId,
    status,
  });

  // 🚀 시간 기반 ThinkingMessage 제어
  const [showThinking, setShowThinking] = useState(false);
  const [hideAiResponse, setHideAiResponse] = useState(false);
  const [aiResponseStartTime, setAiResponseStartTime] = useState<number | null>(null);

  useEffect(() => {
    if (messages.length === 0) {
      setShowThinking(false);
      setHideAiResponse(false);
      setAiResponseStartTime(null);
      return;
    }

    const lastMessage = messages[messages.length - 1];

    // submitted 상태에서는 항상 표시
    if (status === 'submitted') {
      setShowThinking(true);
      setHideAiResponse(false);
      setAiResponseStartTime(null);
      return;
    }

    // streaming 상태일 때
    if (status === 'streaming') {
      // 마지막 메시지가 사용자 메시지면 계속 표시
      if (lastMessage?.role === 'user') {
        setShowThinking(true);
        setHideAiResponse(false);
        setAiResponseStartTime(null);
        return;
      }

      // AI 메시지가 생성된 순간 타이머 시작
      if (lastMessage?.role === 'assistant' && !aiResponseStartTime) {
        setAiResponseStartTime(Date.now());
        setHideAiResponse(true); // AI 응답 일시적으로 숨김
        
        // 500ms 후에 ThinkingMessage 숨기고 AI 응답 표시
        setTimeout(() => {
          setShowThinking(false);
          setHideAiResponse(false);
        }, 500);
        
        return;
      }
    }

    // 다른 상태에서는 숨김
    if (status === 'ready' || status === 'error') {
      setShowThinking(false);
      setHideAiResponse(false);
      setAiResponseStartTime(null);
    }
  }, [status, messages, aiResponseStartTime]);

  useDataStream();

  return (
    <div ref={messagesContainerRef} className="flex-1 overflow-y-auto">
      <Conversation className="flex flex-col min-w-0 gap-4 pt-4 pb-4">
        <ConversationContent className="flex flex-col gap-4">
          {messages.length === 0 && <Greeting />}

          {messages.map((message, index) => (
            <div
              key={message.id}
              className={
                hideAiResponse && message.role === 'assistant' && index === messages.length - 1
                  ? 'hidden' // 완전히 숨김 (높이도 제거)
                  : ''
              }
            >
              <PreviewMessage
                chatId={chatId}
                message={message}
                isLoading={status === 'streaming' && messages.length - 1 === index}
                vote={
                  votes
                    ? votes.find((vote) => vote.messageId === message.id)
                    : undefined
                }
                setMessages={setMessages}
                regenerate={regenerate}
                isReadonly={isReadonly}
                requiresScrollPadding={
                  hasSentMessage && index === messages.length - 1
                }
              />
            </div>
          ))}

          {/* 🎯 단일 위치에서만 ThinkingMessage 표시 */}
          {showThinking && (
            <ThinkingMessage key="thinking-single" />
          )}

          <motion.div
            ref={messagesEndRef}
            className="shrink-0 min-w-[24px] min-h-[24px]"
            onViewportLeave={onViewportLeave}
            onViewportEnter={onViewportEnter}
          />
        </ConversationContent>
        <ConversationScrollButton />
      </Conversation>
    </div>
  );
}

export const Messages = memo(PureMessages, (prevProps, nextProps) => {
  if (prevProps.isArtifactVisible && nextProps.isArtifactVisible) return true;

  if (prevProps.status !== nextProps.status) return false;
  if (prevProps.messages.length !== nextProps.messages.length) return false;
  if (!equal(prevProps.messages, nextProps.messages)) return false;
  if (!equal(prevProps.votes, nextProps.votes)) return false;

  return false;
});
