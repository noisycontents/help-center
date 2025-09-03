import 'server-only';

import {
  and,
  asc,
  count,
  desc,
  eq,
  gt,
  gte,
  inArray,
  lt,
  like,
  or,
  type SQL,
} from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';

import {
  user,
  chat,
  type User,
  document,
  type Suggestion,
  suggestion,
  message,
  vote,
  type DBMessage,
  type Chat,
  stream,
  faq,
  type FAQ,
  faqInternal,
  type FAQInternal,
  faqChunks,
  type FAQChunks,
} from './schema';
import type { ArtifactKind } from '@/components/artifact';
import { generateUUID } from '../utils';
import { generateHashedPassword } from './utils';
import type { VisibilityType } from '@/components/visibility-selector';
import { ChatSDKError } from '../errors';

// Optionally, if not using email/pass login, you can
// use the Drizzle adapter for Auth.js / NextAuth
// https://authjs.dev/reference/adapter/drizzle

// biome-ignore lint: Forbidden non-null assertion.
const client = postgres(process.env.POSTGRES_URL!);
const db = drizzle(client);

export async function getUser(email: string): Promise<Array<User>> {
  try {
    return await db.select().from(user).where(eq(user.email, email));
  } catch (error) {
    throw new ChatSDKError(
      'bad_request:database',
      'Failed to get user by email',
    );
  }
}

export async function createUser(email: string, password: string) {
  const hashedPassword = generateHashedPassword(password);

  try {
    return await db.insert(user).values({ email, password: hashedPassword });
  } catch (error) {
    throw new ChatSDKError('bad_request:database', 'Failed to create user');
  }
}

export async function createGuestUser() {
  const email = `guest-${Date.now()}`;
  const password = generateHashedPassword(generateUUID());

  try {
    const [newUser] = await db.insert(user).values({ email, password }).returning({
      id: user.id,
      email: user.email,
    });
    return newUser;
  } catch (error) {
    console.error('Create guest user error:', error);
    throw new ChatSDKError(
      'bad_request:database',
      'Failed to create guest user',
    );
  }
}

export async function createOrGetWordPressUser(wpUserId: string, email?: string, name?: string) {
  try {
    // WordPress 사용자 ID로 기존 사용자 확인
    const existingUsers = await db
      .select()
      .from(user)
      .where(eq(user.wpUserId, wpUserId))
      .limit(1);

    if (existingUsers.length > 0) {
      console.log('기존 WordPress 사용자 발견 (WP ID):', existingUsers[0]);
      return existingUsers[0];
    }

    // 새 WordPress 사용자 생성 (WordPress ID 기반)
    const [newUser] = await db
      .insert(user)
      .values({ 
        wpUserId: wpUserId.toString(), // WordPress 실제 사용자 ID (예: "16557")
        displayName: name || '미니학습지 사용자',
        email: null, // 이메일 불필요
        password: null // 패스워드 불필요
      })
      .returning();
    
    console.log('새 WordPress 사용자 생성:', newUser);
    return newUser;
  } catch (error) {
    console.error('WordPress 사용자 생성 오류:', error);
    throw new ChatSDKError('bad_request:database', 'Failed to create WordPress user');
  }
}

export async function saveChat({
  id,
  userId,
  title,
  visibility,
}: {
  id: string;
  userId: string;
  title: string;
  visibility: VisibilityType;
}) {
  try {
    return await db.insert(chat).values({
      id,
      createdAt: new Date(),
      userId,
      title,
      visibility,
    });
  } catch (error) {
    console.error('Save chat error:', error);
    throw new ChatSDKError('bad_request:database', 'Failed to save chat');
  }
}

export async function deleteChatById({ id }: { id: string }) {
  try {
    await db.delete(vote).where(eq(vote.chatId, id));
    await db.delete(message).where(eq(message.chatId, id));
    await db.delete(stream).where(eq(stream.chatId, id));

    const [chatsDeleted] = await db
      .delete(chat)
      .where(eq(chat.id, id))
      .returning();
    return chatsDeleted;
  } catch (error) {
    throw new ChatSDKError(
      'bad_request:database',
      'Failed to delete chat by id',
    );
  }
}

export async function getChatsByUserId({
  id,
  limit,
  startingAfter,
  endingBefore,
}: {
  id: string;
  limit: number;
  startingAfter: string | null;
  endingBefore: string | null;
}) {
  try {
    const extendedLimit = limit + 1;

    const query = (whereCondition?: SQL<any>) =>
      db
        .select()
        .from(chat)
        .where(
          whereCondition
            ? and(whereCondition, eq(chat.userId, id))
            : eq(chat.userId, id),
        )
        .orderBy(desc(chat.createdAt))
        .limit(extendedLimit);

    let filteredChats: Array<Chat> = [];

    if (startingAfter) {
      const [selectedChat] = await db
        .select()
        .from(chat)
        .where(eq(chat.id, startingAfter))
        .limit(1);

      if (!selectedChat) {
        throw new ChatSDKError(
          'not_found:database',
          `Chat with id ${startingAfter} not found`,
        );
      }

      filteredChats = await query(gt(chat.createdAt, selectedChat.createdAt));
    } else if (endingBefore) {
      const [selectedChat] = await db
        .select()
        .from(chat)
        .where(eq(chat.id, endingBefore))
        .limit(1);

      if (!selectedChat) {
        throw new ChatSDKError(
          'not_found:database',
          `Chat with id ${endingBefore} not found`,
        );
      }

      filteredChats = await query(lt(chat.createdAt, selectedChat.createdAt));
    } else {
      filteredChats = await query();
    }

    const hasMore = filteredChats.length > limit;

    return {
      chats: hasMore ? filteredChats.slice(0, limit) : filteredChats,
      hasMore,
    };
  } catch (error) {
    throw new ChatSDKError(
      'bad_request:database',
      'Failed to get chats by user id',
    );
  }
}

export async function getChatById({ id }: { id: string }) {
  try {
    const [selectedChat] = await db.select().from(chat).where(eq(chat.id, id));
    return selectedChat;
  } catch (error) {
    throw new ChatSDKError('bad_request:database', 'Failed to get chat by id');
  }
}

export async function saveMessages({
  messages,
}: {
  messages: Array<DBMessage>;
}) {
  try {
    return await db.insert(message).values(messages);
  } catch (error) {
    throw new ChatSDKError('bad_request:database', 'Failed to save messages');
  }
}

export async function getMessagesByChatId({ id }: { id: string }) {
  try {
    return await db
      .select()
      .from(message)
      .where(eq(message.chatId, id))
      .orderBy(asc(message.createdAt));
  } catch (error) {
    throw new ChatSDKError(
      'bad_request:database',
      'Failed to get messages by chat id',
    );
  }
}

export async function voteMessage({
  chatId,
  messageId,
  type,
}: {
  chatId: string;
  messageId: string;
  type: 'up' | 'down';
}) {
  try {
    const [existingVote] = await db
      .select()
      .from(vote)
      .where(and(eq(vote.messageId, messageId)));

    if (existingVote) {
      return await db
        .update(vote)
        .set({ isUpvoted: type === 'up' })
        .where(and(eq(vote.messageId, messageId), eq(vote.chatId, chatId)));
    }
    return await db.insert(vote).values({
      chatId,
      messageId,
      isUpvoted: type === 'up',
    });
  } catch (error) {
    throw new ChatSDKError('bad_request:database', 'Failed to vote message');
  }
}

export async function getVotesByChatId({ id }: { id: string }) {
  try {
    return await db.select().from(vote).where(eq(vote.chatId, id));
  } catch (error) {
    throw new ChatSDKError(
      'bad_request:database',
      'Failed to get votes by chat id',
    );
  }
}

export async function saveDocument({
  id,
  title,
  kind,
  content,
  userId,
}: {
  id: string;
  title: string;
  kind: ArtifactKind;
  content: string;
  userId: string;
}) {
  try {
    return await db
      .insert(document)
      .values({
        id,
        title,
        kind,
        content,
        userId,
        createdAt: new Date(),
      })
      .returning();
  } catch (error) {
    throw new ChatSDKError('bad_request:database', 'Failed to save document');
  }
}

export async function getDocumentsById({ id }: { id: string }) {
  try {
    const documents = await db
      .select()
      .from(document)
      .where(eq(document.id, id))
      .orderBy(asc(document.createdAt));

    return documents;
  } catch (error) {
    throw new ChatSDKError(
      'bad_request:database',
      'Failed to get documents by id',
    );
  }
}

export async function getDocumentById({ id }: { id: string }) {
  try {
    const [selectedDocument] = await db
      .select()
      .from(document)
      .where(eq(document.id, id))
      .orderBy(desc(document.createdAt));

    return selectedDocument;
  } catch (error) {
    throw new ChatSDKError(
      'bad_request:database',
      'Failed to get document by id',
    );
  }
}

export async function deleteDocumentsByIdAfterTimestamp({
  id,
  timestamp,
}: {
  id: string;
  timestamp: Date;
}) {
  try {
    await db
      .delete(suggestion)
      .where(
        and(
          eq(suggestion.documentId, id),
          gt(suggestion.documentCreatedAt, timestamp),
        ),
      );

    return await db
      .delete(document)
      .where(and(eq(document.id, id), gt(document.createdAt, timestamp)))
      .returning();
  } catch (error) {
    throw new ChatSDKError(
      'bad_request:database',
      'Failed to delete documents by id after timestamp',
    );
  }
}

export async function saveSuggestions({
  suggestions,
}: {
  suggestions: Array<Suggestion>;
}) {
  try {
    return await db.insert(suggestion).values(suggestions);
  } catch (error) {
    throw new ChatSDKError(
      'bad_request:database',
      'Failed to save suggestions',
    );
  }
}

export async function getSuggestionsByDocumentId({
  documentId,
}: {
  documentId: string;
}) {
  try {
    return await db
      .select()
      .from(suggestion)
      .where(and(eq(suggestion.documentId, documentId)));
  } catch (error) {
    throw new ChatSDKError(
      'bad_request:database',
      'Failed to get suggestions by document id',
    );
  }
}

export async function getMessageById({ id }: { id: string }) {
  try {
    return await db.select().from(message).where(eq(message.id, id));
  } catch (error) {
    throw new ChatSDKError(
      'bad_request:database',
      'Failed to get message by id',
    );
  }
}

export async function deleteMessagesByChatIdAfterTimestamp({
  chatId,
  timestamp,
}: {
  chatId: string;
  timestamp: Date;
}) {
  try {
    const messagesToDelete = await db
      .select({ id: message.id })
      .from(message)
      .where(
        and(eq(message.chatId, chatId), gte(message.createdAt, timestamp)),
      );

    const messageIds = messagesToDelete.map((message) => message.id);

    if (messageIds.length > 0) {
      await db
        .delete(vote)
        .where(
          and(eq(vote.chatId, chatId), inArray(vote.messageId, messageIds)),
        );

      return await db
        .delete(message)
        .where(
          and(eq(message.chatId, chatId), inArray(message.id, messageIds)),
        );
    }
  } catch (error) {
    throw new ChatSDKError(
      'bad_request:database',
      'Failed to delete messages by chat id after timestamp',
    );
  }
}

export async function updateChatVisiblityById({
  chatId,
  visibility,
}: {
  chatId: string;
  visibility: 'private' | 'public';
}) {
  try {
    return await db.update(chat).set({ visibility }).where(eq(chat.id, chatId));
  } catch (error) {
    throw new ChatSDKError(
      'bad_request:database',
      'Failed to update chat visibility by id',
    );
  }
}

export async function getMessageCountByUserId({
  id,
  differenceInHours,
}: { id: string; differenceInHours: number }) {
  try {
    const twentyFourHoursAgo = new Date(
      Date.now() - differenceInHours * 60 * 60 * 1000,
    );

    const [stats] = await db
      .select({ count: count(message.id) })
      .from(message)
      .innerJoin(chat, eq(message.chatId, chat.id))
      .where(
        and(
          eq(chat.userId, id),
          gte(message.createdAt, twentyFourHoursAgo),
          eq(message.role, 'user'),
        ),
      )
      .execute();

    return stats?.count ?? 0;
  } catch (error) {
    throw new ChatSDKError(
      'bad_request:database',
      'Failed to get message count by user id',
    );
  }
}

export async function createStreamId({
  streamId,
  chatId,
}: {
  streamId: string;
  chatId: string;
}) {
  try {
    await db
      .insert(stream)
      .values({ id: streamId, chatId, createdAt: new Date() });
  } catch (error) {
    throw new ChatSDKError(
      'bad_request:database',
      'Failed to create stream id',
    );
  }
}

export async function getStreamIdsByChatId({ chatId }: { chatId: string }) {
  try {
    const streamIds = await db
      .select({ id: stream.id })
      .from(stream)
      .where(eq(stream.chatId, chatId))
      .orderBy(asc(stream.createdAt))
      .execute();

    return streamIds.map(({ id }) => id);
  } catch (error) {
    throw new ChatSDKError(
      'bad_request:database',
      'Failed to get stream ids by chat id',
    );
  }
}

export async function searchFAQ(query: string): Promise<Array<FAQ>> {
  try {
    // 검색어를 공백으로 분할하여 각 단어로 검색
    const searchTerms = query.trim().split(/\s+/);
    
    if (searchTerms.length === 0) {
      return [];
    }

    // 질문과 내용에서 검색어를 찾는 조건 생성
    const searchConditions = searchTerms.map(term => 
      or(
        like(faq.question, `%${term}%`),
        like(faq.content, `%${term}%`),
        like(faq.tag, `%${term}%`)
      )
    );

    // 모든 검색 조건을 OR로 연결
    const whereClause = or(...searchConditions);

    const results = await db
      .select()
      .from(faq)
      .where(whereClause)
      .limit(10)
      .execute();

    return results;
  } catch (error) {
    console.error('FAQ 검색 중 오류 발생:', error);
    throw new ChatSDKError(
      'bad_request:database',
      'Failed to search FAQ',
    );
  }
}

export async function getFAQByTag(tag: string): Promise<Array<FAQ>> {
  try {
    const results = await db
      .select()
      .from(faq)
      .where(eq(faq.tag, tag))
      .limit(20)
      .execute();

    return results;
  } catch (error) {
    console.error('태그별 FAQ 검색 중 오류 발생:', error);
    throw new ChatSDKError(
      'bad_request:database',
      'Failed to get FAQ by tag',
    );
  }
}

// ===== FAQ Internal 관련 함수들 =====

export async function createFAQInternal({
  brand,
  tag,
  question,
  content,
}: {
  brand: string;
  tag?: string;
  question: string;
  content: string;
}): Promise<FAQInternal> {
  try {
    const [newFAQ] = await db
      .insert(faqInternal)
      .values({
        brand,
        tag,
        question,
        content,
      })
      .returning()
      .execute();

    return newFAQ;
  } catch (error) {
    console.error('내부 FAQ 생성 중 오류 발생:', error);
    throw new ChatSDKError(
      'bad_request:database',
      'Failed to create internal FAQ',
    );
  }
}

export async function getFAQInternalByBrand(brand: string): Promise<Array<FAQInternal>> {
  try {
    const results = await db
      .select()
      .from(faqInternal)
      .where(eq(faqInternal.brand, brand))
      .orderBy(desc(faqInternal.createdAt))
      .execute();

    return results;
  } catch (error) {
    console.error('브랜드별 내부 FAQ 검색 중 오류 발생:', error);
    throw new ChatSDKError(
      'bad_request:database',
      'Failed to get internal FAQ by brand',
    );
  }
}

export async function updateFAQInternal({
  id,
  brand,
  tag,
  question,
  content,
}: {
  id: string;
  brand?: string;
  tag?: string;
  question?: string;
  content?: string;
}): Promise<FAQInternal> {
  try {
    const updateData: any = { updatedAt: new Date() };
    if (brand !== undefined) updateData.brand = brand;
    if (tag !== undefined) updateData.tag = tag;
    if (question !== undefined) updateData.question = question;
    if (content !== undefined) updateData.content = content;

    const [updatedFAQ] = await db
      .update(faqInternal)
      .set(updateData)
      .where(eq(faqInternal.id, id))
      .returning()
      .execute();

    return updatedFAQ;
  } catch (error) {
    console.error('내부 FAQ 업데이트 중 오류 발생:', error);
    throw new ChatSDKError(
      'bad_request:database',
      'Failed to update internal FAQ',
    );
  }
}

// ===== FAQ Chunks 관련 함수들 =====

export async function createFAQChunks({
  kind,
  sourceId,
  brand,
  tag,
  chunks,
}: {
  kind: 'public' | 'internal';
  sourceId: string;
  brand?: string;
  tag?: string;
  chunks: Array<{ content: string; embedding: number[] }>;
}): Promise<Array<FAQChunks>> {
  try {
    // 기존 청크들 삭제
    await db
      .delete(faqChunks)
      .where(and(
        eq(faqChunks.kind, kind),
        eq(faqChunks.sourceId, sourceId)
      ))
      .execute();

    // 새 청크들 삽입
    const chunkData = chunks.map((chunk, index) => ({
      kind,
      sourceId,
      brand,
      tag,
      chunkIdx: index,
      content: chunk.content,
      embedding: chunk.embedding,
    }));

    const results = await db
      .insert(faqChunks)
      .values(chunkData)
      .returning()
      .execute();

    return results;
  } catch (error) {
    console.error('FAQ 청크 생성 중 오류 발생:', error);
    throw new ChatSDKError(
      'bad_request:database',
      'Failed to create FAQ chunks',
    );
  }
}

export async function searchFAQChunks({
  query,
  embedding,
  limit = 5,
  includeInternal = true,
}: {
  query?: string;
  embedding?: number[];
  limit?: number;
  includeInternal?: boolean;
}): Promise<Array<FAQChunks>> {
  try {
    let whereConditions: SQL[] = [];

    // kind 필터링
    if (includeInternal) {
      whereConditions.push(
        or(
          eq(faqChunks.kind, 'public'),
          eq(faqChunks.kind, 'internal')
        )!
      );
    } else {
      whereConditions.push(eq(faqChunks.kind, 'public'));
    }

    // 텍스트 검색
    if (query) {
      whereConditions.push(like(faqChunks.content, `%${query}%`));
    }

    const whereClause = whereConditions.length > 1 ? and(...whereConditions) : whereConditions[0];

    // where 조건이 있는 경우와 없는 경우를 분리해서 처리
    const dbQuery = whereClause 
      ? db.select().from(faqChunks).where(whereClause).limit(limit)
      : db.select().from(faqChunks).limit(limit);

    // 벡터 검색은 추후 구현 (임베딩이 제공된 경우)
    if (embedding) {
      // TODO: 벡터 유사도 검색 구현
      // ORDER BY embedding <-> $1 LIMIT $2
    }

    const results = await dbQuery.execute();
    return results;
  } catch (error) {
    console.error('FAQ 청크 검색 중 오류 발생:', error);
    throw new ChatSDKError(
      'bad_request:database',
      'Failed to search FAQ chunks',
    );
  }
}
