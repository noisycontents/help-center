import {
  convertToModelMessages,
  createUIMessageStream,
  JsonToSseTransformStream,
  smoothStream,
  stepCountIs,
  streamText,
} from 'ai';
import { auth, type UserType } from '@/app/(auth)/auth';
import { type RequestHints, systemPrompt, consultantSystemPrompt } from '@/lib/ai/prompts';
import {
  createStreamId,
  deleteChatById,
  getChatById,
  getMessageCountByUserId,
  getMessagesByChatId,
  saveChat,
  saveMessages,
  updateChatTitleById,
  getUserById,
} from '@/lib/db/queries';
import { convertToUIMessages, generateUUID } from '@/lib/utils';
import { generateTitleFromUserMessage } from '../../actions';
import { requestSuggestions } from '@/lib/ai/tools/request-suggestions';
import { searchFAQTool } from '@/lib/ai/tools/search-faq';
import { isProductionEnvironment } from '@/lib/constants';
import { myProvider } from '@/lib/ai/providers';
import { entitlementsByUserType } from '@/lib/ai/entitlements';
import { postRequestBodySchema, type PostRequestBody } from './schema';
import { geolocation } from '@vercel/functions';
import {
  createResumableStreamContext,
  type ResumableStreamContext,
} from 'resumable-stream';
import { after } from 'next/server';
import { ChatSDKError } from '@/lib/errors';
import type { ChatMessage } from '@/lib/types';
import type { ChatModel } from '@/lib/ai/models';
import type { VisibilityType } from '@/components/visibility-selector';

export const maxDuration = 60;

let globalStreamContext: ResumableStreamContext | null = null;

export function getStreamContext() {
  if (!globalStreamContext) {
    try {
      globalStreamContext = createResumableStreamContext({
        waitUntil: after,
      });
    } catch (error: any) {
      if (error.message.includes('REDIS_URL')) {
        console.log(
          ' > Resumable streams are disabled due to missing REDIS_URL',
        );
      } else {
        console.error(error);
      }
    }
  }

  return globalStreamContext;
}

export async function POST(request: Request) {
  let requestBody: PostRequestBody;

  try {
    const json = await request.json();
    requestBody = postRequestBodySchema.parse(json);
  } catch (_) {
    return new ChatSDKError('bad_request:api').toResponse();
  }

  try {
    const {
      id,
      message,
      selectedChatModel,
      selectedVisibilityType,
    }: {
      id: string;
      message: ChatMessage;
      selectedChatModel: ChatModel['id'];
      selectedVisibilityType: VisibilityType;
    } = requestBody;

    const session = await auth();

    if (!session?.user) {
      console.log('❌ 세션 없음 - guest 사용자 생성 필요');
      return new ChatSDKError('unauthorized:chat').toResponse();
    }

    console.log('✅ Session user:', session.user);

    const userType: UserType = session.user.type;

    // 🚀 관리자 사용자 확인 (wpUserId 기반)
    const adminWpUserIds = ['6', '8323', '16557'];
    let isAdmin = false;

    try {
      const userDetails = await getUserById(session.user.id);
      isAdmin = !!(userDetails?.wpUserId && adminWpUserIds.includes(userDetails.wpUserId));
      
      if (isAdmin && userDetails) {
        console.log(`✅ 관리자 사용자 확인: wpUserId ${userDetails.wpUserId}`);
      }
    } catch (error) {
      console.warn('사용자 정보 조회 실패:', error);
    }

    // 관리자가 아닌 경우에만 메시지 한도 체크
    if (!isAdmin) {
      const messageCount = await getMessageCountByUserId({
        id: session.user.id,
        differenceInHours: 24,
      });

      if (messageCount > entitlementsByUserType[userType].maxMessagesPerDay) {
        // 🚀 Rate limit을 에러가 아닌 정상 AI 응답으로 처리
        const rateLimitMessage = `안녕하세요! 😊<br>오늘 질문 한도에 도달하셨습니다.<br><br>📝 로그인하면 추가 질문이 가능합니다.<br>혹은 <a href="/chat?mode=help" style="color: #000000; text-decoration: underline;">도움말 센터</a>에서 정보를 찾아보실 수 있습니다.<br><br>🔗 <a href="https://studymini.com/inquiry" target="_blank" style="color: #000000; text-decoration: underline;">일대일 문의하기</a><br>1:1 문의 게시판을 통해 문의해 주시면 최대한 빠르게 답변드리겠습니다.<br><br>양해 부탁드립니다. 감사합니다! 🙏`;
        
        // 정상적인 스트림 응답으로 반환
        const stream = createUIMessageStream({
          execute: ({ writer: dataStream }) => {
            // 즉시 완료된 메시지 작성
            const messageId = generateUUID();
            dataStream.write({
              type: 'data-appendMessage',
              data: JSON.stringify({
                id: messageId,
                role: 'assistant',
                parts: [{
                  type: 'text',
                  text: rateLimitMessage
                }],
                createdAt: new Date().toISOString(),
              }),
            });
            
            // 스트림 완료 신호
            dataStream.write({
              type: 'data-finish',
              data: JSON.stringify({
                messages: [{
                  id: messageId,
                  role: 'assistant',
                  parts: [{
                    type: 'text',
                    text: rateLimitMessage
                  }],
                  createdAt: new Date().toISOString(),
                }]
              }),
            });
          },
          generateId: generateUUID,
          onFinish: async ({ messages }) => {
            await saveMessages({
              messages: messages.map((message) => ({
                id: message.id,
                role: message.role,
                parts: message.parts,
                createdAt: new Date(),
                attachments: [],
                chatId: id,
              })),
            });
          },
        });

        return new Response(stream.pipeThrough(new JsonToSseTransformStream()));
      }
    }

    const chat = await getChatById({ id });

    let chatTitle = 'New Chat'; // 기본 제목
    
    if (!chat) {
      // 🚀 성능 최적화: 기본 제목으로 채팅 먼저 생성, AI 제목 생성은 백그라운드에서
      await saveChat({
        id,
        userId: session.user.id,
        title: chatTitle,
        visibility: selectedVisibilityType,
      });

      // 백그라운드에서 AI 제목 생성 (응답 속도에 영향 없음)
      after(async () => {
        try {
          const aiTitle = await generateTitleFromUserMessage({ message });
          // 제목 업데이트 (실패해도 기본 제목으로 유지)
          await updateChatTitleById({ chatId: id, title: aiTitle });
          console.log(`✅ AI 제목 업데이트 완료: "${aiTitle}"`);
        } catch (error) {
          console.warn('❌ AI 제목 생성 실패:', error);
        }
      });
    } else {
      if (chat.userId !== session.user.id) {
        return new ChatSDKError('forbidden:chat').toResponse();
      }
    }

    // 🚀 성능 최적화: 병렬 처리로 DB 작업 최적화
    const [messagesFromDb] = await Promise.all([
      getMessagesByChatId({ id, limit: 20 }), // 최근 20개 메시지만 로드
      // 사용자 메시지 저장을 병렬로 처리
      saveMessages({
        messages: [
          {
            chatId: id,
            id: message.id,
            role: 'user',
            parts: message.parts,
            attachments: [],
            createdAt: new Date(),
          },
        ],
      })
    ]);

    // 🚀 연속 스팸 방지: 동일 텍스트 연속 작성 제한 (관리자 제외)
    if (!isAdmin && messagesFromDb.length > 0) {
      const recentUserMessages = messagesFromDb
        .filter(msg => msg.role === 'user')
        .slice(-2); // 최근 2개 사용자 메시지

      if (recentUserMessages.length > 0) {
        const currentMessageText = message.parts
          .filter(part => part.type === 'text')
          .map(part => part.text)
          .join(' ')
          .trim();

        const lastMessage = recentUserMessages[recentUserMessages.length - 1];
        const lastUserMessageText = lastMessage?.parts
          ? (lastMessage.parts as any[])
              .filter((part: any) => part.type === 'text')
              .map((part: any) => part.text)
              .join(' ')
              .trim()
          : '';

        // 동일한 텍스트 연속 작성 방지
        if (currentMessageText === lastUserMessageText && currentMessageText.length > 0) {
          return Response.json(
            { 
              error: '동일한 질문을 연속으로 작성하실 수 없습니다. 다른 질문을 해주세요.' 
            }, 
            { status: 400 }
          );
        }
      }
    }

    const uiMessages = [...convertToUIMessages(messagesFromDb), message];

    const { longitude, latitude, city, country } = geolocation(request);

    const requestHints: RequestHints = {
      longitude,
      latitude,
      city,
      country,
    };

    // 🚀 성능 최적화: 스트림 ID 생성을 백그라운드로 이동
    const streamId = generateUUID();
    after(async () => {
      try {
        await createStreamId({ streamId, chatId: id });
      } catch (error) {
        console.warn('스트림 ID 저장 실패:', error);
      }
    });

    const stream = createUIMessageStream({
      execute: ({ writer: dataStream }) => {
        const result = streamText({
          model: myProvider.languageModel(selectedChatModel),
          system: consultantSystemPrompt,
          messages: convertToModelMessages(uiMessages),
          stopWhen: stepCountIs(5),
          experimental_activeTools:
            selectedChatModel === 'chat-model-reasoning'
              ? []
              : [
                  'searchFAQTool',
                  'requestSuggestions',
                ],
          experimental_transform: smoothStream({ chunking: 'word', delayInMs: 5 }),
          tools: {
            searchFAQTool,
            requestSuggestions: requestSuggestions({
              session,
              dataStream,
            }),
          },
          experimental_telemetry: {
            isEnabled: isProductionEnvironment,
            functionId: 'stream-text',
          },
        });

        result.consumeStream();

        dataStream.merge(
          result.toUIMessageStream({
            sendReasoning: false, // 🚀 성능 최적화: reasoning 비활성화로 더 빠른 응답
          }),
        );
      },
      generateId: generateUUID,
      onFinish: async ({ messages }) => {
        await saveMessages({
          messages: messages.map((message) => ({
            id: message.id,
            role: message.role,
            parts: message.parts,
            createdAt: new Date(),
            attachments: [],
            chatId: id,
          })),
        });
      },
      onError: () => {
        return 'Oops, an error occurred!';
      },
    });

    const streamContext = getStreamContext();

    if (streamContext) {
      return new Response(
        await streamContext.resumableStream(streamId, () =>
          stream.pipeThrough(new JsonToSseTransformStream()),
        ),
      );
    } else {
      return new Response(stream.pipeThrough(new JsonToSseTransformStream()));
    }
  } catch (error) {
    if (error instanceof ChatSDKError) {
      return error.toResponse();
    }
  }
}

export async function DELETE(request: Request) {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get('id');

  if (!id) {
    return new ChatSDKError('bad_request:api').toResponse();
  }

  const session = await auth();

  if (!session?.user) {
    return new ChatSDKError('unauthorized:chat').toResponse();
  }

  const chat = await getChatById({ id });

  if (chat.userId !== session.user.id) {
    return new ChatSDKError('forbidden:chat').toResponse();
  }

  const deletedChat = await deleteChatById({ id });

  return Response.json(deletedChat, { status: 200 });
}
