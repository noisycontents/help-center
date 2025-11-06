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

  const assistantMessageHasVisibleContent = (message: ChatMessage | undefined) => {
    if (!message || message.role !== 'assistant') return false;

    return message.parts.some((part) => {
      if (!part) return false;
      if (part.type === 'text' && part.text?.trim().length > 0) return true;
      if (part.type === 'text-delta' && part.text?.trim().length > 0)
        return true;
      if (part.type === 'reasoning' && part.text?.trim().length > 0)
        return true;
      return false;
    });
  };

  useEffect(() => {
    if (messages.length === 0) {
      setShowThinking(false);
      return;
    }

    const lastMessage = messages[messages.length - 1];

    if (status === 'submitted') {
      setShowThinking(true);
      return;
    }

    if (status === 'streaming') {
      if (lastMessage?.role === 'user') {
        setShowThinking(true);
        return;
      }

      if (assistantMessageHasVisibleContent(lastMessage)) {
        setShowThinking(false);
      } else {
        setShowThinking(true);
      }
      return;
    }

    if (status === 'ready' || status === 'error') {
      setShowThinking(false);
    }
  }, [status, messages]);

  useDataStream();

  return (
    <div ref={messagesContainerRef} className="flex-1 overflow-y-auto">
      <Conversation className="flex flex-col min-w-0 gap-4 pt-4 pb-4">
        <ConversationContent className="flex flex-col gap-4">
          {messages.length === 0 && <Greeting />}

          {messages.map((message, index) => {
            const isLastMessage = index === messages.length - 1;
            const shouldHideAssistantPlaceholder =
              showThinking &&
              isLastMessage &&
              message.role === 'assistant' &&
              !assistantMessageHasVisibleContent(message);

            if (shouldHideAssistantPlaceholder) {
              return null;
            }

            return (
              <PreviewMessage
                key={message.id}
                chatId={chatId}
                message={message}
                isLoading={status === 'streaming' && isLastMessage}
                vote={
                  votes
                    ? votes.find((vote) => vote.messageId === message.id)
                    : undefined
                }
                setMessages={setMessages}
                regenerate={regenerate}
                isReadonly={isReadonly}
                requiresScrollPadding={hasSentMessage && isLastMessage}
              />
            );
          })}

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
