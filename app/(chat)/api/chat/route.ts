import {
  convertToModelMessages,
  createUIMessageStream,
  JsonToSseTransformStream,
  smoothStream,
  stepCountIs,
  streamText,
} from 'ai';
import { auth, type UserType } from '@/app/(auth)/auth';
import { type RequestHints, consultantSystemPrompt } from '@/lib/ai/prompts';
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
import { searchFAQTool, searchFAQForQuery } from '@/lib/ai/tools/search-faq';
import { searchProductTool, getProductStatsTool } from '@/lib/ai/tools/search-product';
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

const isResumableStreamDisabled =
  process.env.RESUMABLE_STREAM_DISABLED === 'true' ||
  (!process.env.REDIS_URL && !process.env.KV_REST_API_URL && !process.env.UPSTASH_REDIS_REST_URL);

let globalStreamContext: ResumableStreamContext | null = null;

export function getStreamContext() {
  if (isResumableStreamDisabled) {
    return null;
  }

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
      globalStreamContext = null;
      return null;
    }
  }

  return globalStreamContext;
}

function createImmediateAssistantResponse({
  chatId,
  text,
}: {
  chatId: string;
  text: string;
}) {
  const stream = createUIMessageStream({
    execute: ({ writer: dataStream }) => {
      const messageId = generateUUID();
      const messagePayload = {
        id: messageId,
        role: 'assistant',
        parts: [
          {
            type: 'text' as const,
            text,
          },
        ],
        createdAt: new Date().toISOString(),
      };

      dataStream.write({
        type: 'data-appendMessage',
        data: JSON.stringify(messagePayload),
      });

      dataStream.write({
        type: 'data-finish',
        data: JSON.stringify({
          messages: [messagePayload],
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
          chatId,
        })),
      });
    },
  });

  return new Response(stream.pipeThrough(new JsonToSseTransformStream()));
}

function formatFAQContext(
  results: Awaited<ReturnType<typeof searchFAQForQuery>>['results'],
) {
  const limitedResults = results.slice(0, 3);
  const formattedEntries = limitedResults
    .map((faq, index) => {
      const safeContent =
        faq.content.length > 1200
          ? `${faq.content.slice(0, 1200)}...`
          : faq.content;
      const sourceLabel = faq.isInternal ? 'internal' : 'public';
      return `[#${index + 1} | ${sourceLabel}] 질문: ${faq.question}\n답변:\n${safeContent}`;
    })
    .join('\n\n');

  return `다음은 고객 문의와 관련된 참고 자료입니다. 아래 내용을 우선적으로 활용해 정확한 답변을 제공하세요:\n\n${formattedEntries}`;
}

export async function POST(request: Request) {
  let requestBody: PostRequestBody;

  let json: any;
  try {
    json = await request.json();
    requestBody = postRequestBodySchema.parse(json);
  } catch (error) {
    console.error('❌ 요청 본문 파싱 오류:', error);
    if (error instanceof Error) {
      console.error('❌ 에러 상세:', error.message);
    }
    if (json) {
      console.error('❌ 요청 본문:', JSON.stringify(json, null, 2));
    }
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

        return createImmediateAssistantResponse({
          chatId: id,
          text: rateLimitMessage,
        });
      }
    }

    const chat = await getChatById({ id });

    const chatTitle = 'New Chat'; // 기본 제목
    
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

    const currentMessageTextParts = message.parts
      .filter((part) => part.type === 'text')
      .map((part) => part.text);
    const currentMessageText = currentMessageTextParts.join(' ').trim();

    // 🚀 연속 스팸 방지: 동일 텍스트 연속 작성 제한 (관리자 제외)
    if (!isAdmin && messagesFromDb.length > 0) {
      const recentUserMessages = messagesFromDb
        .filter(msg => msg.role === 'user')
        .slice(-2); // 가장 최근 사용자 메시지 2개 확인

      if (recentUserMessages.length === 2) {
        const [secondLastUserMessage, lastUserMessage] = recentUserMessages;
        const extractTextFromParts = (parts: any) =>
          Array.isArray(parts)
            ? parts
                .filter((part: any) => part?.type === 'text')
                .map((part: any) => part.text)
                .join(' ')
                .trim()
            : '';

        const lastUserMessageText = extractTextFromParts(lastUserMessage?.parts);
        const secondLastUserMessageText = extractTextFromParts(
          secondLastUserMessage?.parts,
        );

        const isTripleDuplicate =
          currentMessageText.length > 0 &&
          currentMessageText === lastUserMessageText &&
          currentMessageText === secondLastUserMessageText;

        if (isTripleDuplicate) {
          return createImmediateAssistantResponse({
            chatId: id,
            text: '동일한 질문을 연속으로 작성하실 수 없습니다. 다른 질문을 해주세요.',
          });
        }
      }
    }

    const uiMessages = [...convertToUIMessages(messagesFromDb), message];

    let modelMessages = [...uiMessages];

    if (currentMessageText.length > 0) {
      try {
        const faqSearch = await searchFAQForQuery(currentMessageText, {
          limit: 3,
        });

        if (faqSearch.success && faqSearch.results.length > 0) {
          modelMessages = [
            ...modelMessages,
            {
              id: generateUUID(),
              role: 'system',
              metadata: {
                createdAt: new Date().toISOString(),
              },
              parts: [
                {
                  type: 'text' as const,
                  text: formatFAQContext(faqSearch.results),
                },
              ],
            },
          ];
        }
      } catch (error) {
        console.warn('FAQ 검색 컨텍스트 추가 실패:', error);
      }
    }

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
          messages: convertToModelMessages(modelMessages),
          stopWhen: stepCountIs(5),
          experimental_activeTools:
            selectedChatModel === 'chat-model-reasoning'
              ? []
              : [
                  'searchFAQTool',
                  'searchProductTool',
                  'getProductStatsTool',
                  'requestSuggestions',
                ],
          experimental_transform: smoothStream({ chunking: 'word', delayInMs: 5 }),
          tools: {
            searchFAQTool,
            searchProductTool,
            getProductStatsTool,
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

    console.error('❌ 채팅 요청 처리 중 오류:', error);
    if (error instanceof Error) {
      console.error('❌ 에러 메시지:', error.message);
      console.error('❌ 에러 스택:', error.stack);
    }
    return new ChatSDKError('offline:chat').toResponse();
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
