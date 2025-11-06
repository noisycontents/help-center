import { z } from 'zod';
import {
  searchFAQ,
  searchFAQChunks,
  getFAQByIds,
  getFAQInternalByIds,
} from '@/lib/db/queries';
import { tool } from 'ai';

type FAQResultItem = {
  id: string;
  kind: 'public' | 'internal';
  brand: string;
  tag?: string | null;
  question: string;
  content: string;
  score: number;
  isInternal: boolean;
};

const VECTOR_MODEL = 'text-embedding-3-small';

// 내부 FAQ 검색 함수 - DB 연결 재사용으로 성능 최적화
async function searchInternalFAQ(query: string) {
  const { or, like, desc } = require('drizzle-orm');
  const { drizzle } = require('drizzle-orm/postgres-js');
  const postgres = require('postgres');
  const { faqInternal } = require('@/lib/db/schema');

  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error('DATABASE_URL이 설정되지 않았습니다.');
  }

  const client = postgres(connectionString, { max: 10, idle_timeout: 20 });
  const db = drizzle(client);

  try {
    const results = await db
      .select()
      .from(faqInternal)
      .where(
        or(
          like(faqInternal.question, `%${query}%`),
          like(faqInternal.content, `%${query}%`),
          like(faqInternal.tag, `%${query}%`),
        ),
      )
      .orderBy(desc(faqInternal.updatedAt))
      .limit(10)
      .execute();

    return results;
  } catch (error) {
    console.error('Internal FAQ 검색 오류:', error);
    throw error;
  } finally {
    await client.end();
  }
}

async function generateQueryEmbedding(query: string): Promise<number[] | null> {
  const apiKey = process.env.OPENAI_API_KEY;

  if (!apiKey) {
    console.warn('OPENAI_API_KEY가 설정되지 않아 벡터 검색을 건너뜁니다.');
    return null;
  }

  try {
    const response = await fetch('https://api.openai.com/v1/embeddings', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: VECTOR_MODEL,
        input: query.slice(0, 7500),
        encoding_format: 'float',
      }),
    });

    if (!response.ok) {
      console.warn('임베딩 생성 실패:', response.status, response.statusText);
      return null;
    }

    const data: any = await response.json();
    const embedding = data?.data?.[0]?.embedding;
    if (!Array.isArray(embedding)) {
      console.warn('임베딩 응답 형식이 올바르지 않습니다.');
      return null;
    }

    return embedding as number[];
  } catch (error) {
    console.warn('임베딩 생성 중 오류:', error);
    return null;
  }
}

function normalizeScoreFromDistance(distance?: number): number {
  if (typeof distance !== 'number' || Number.isNaN(distance)) {
    return 0.7;
  }

  const similarity = 1 / (1 + Math.max(distance, 0));
  return Math.min(0.99, Math.max(0.4, similarity));
}

async function runKeywordSearch(
  query: string,
  limit: number,
): Promise<FAQResultItem[]> {
  const [publicResults, internalResults] = await Promise.all([
    searchFAQ(query).then((results) =>
      results.map((faq: any) => ({
        id: faq.id,
        kind: 'public' as const,
        brand: faq.brand,
        tag: faq.tag,
        question: faq.question,
        content: faq.content,
        baseScore: 0.6,
      })),
    ),
    searchInternalFAQ(query)
      .then((results) =>
        results.map((faq: any) => ({
          id: faq.id,
          kind: 'internal' as const,
          brand: faq.brand,
          tag: faq.tag ?? null,
          question: faq.question,
          content: faq.content,
          baseScore: 0.9,
        })),
      )
      .catch(() => []),
  ]);

  const queryLower = query.toLowerCase();
  const queryWords = queryLower.split(/\s+/).filter((word) => word.length > 1);

  return [...publicResults, ...internalResults]
    .map((faq) => {
      const questionLower = faq.question.toLowerCase();
      const contentLower = faq.content.toLowerCase();

      let score = faq.baseScore;

      if (questionLower.includes(queryLower)) {
        score += 0.4;
      }

      for (const word of queryWords) {
        if (questionLower.includes(word)) {
          score += 0.2;
        }
        if (contentLower.includes(word)) {
          score += 0.1;
        }
      }

      return {
        id: faq.id,
        kind: faq.kind,
        brand: faq.brand,
        tag: faq.tag,
        question: faq.question,
        content: faq.content,
        score,
        isInternal: faq.kind === 'internal',
      } satisfies FAQResultItem;
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}

async function runVectorSearch(
  query: string,
  limit: number,
): Promise<FAQResultItem[]> {
  const embedding = await generateQueryEmbedding(query);
  if (!embedding) {
    return [];
  }

  try {
    const chunkResults = await searchFAQChunks({
      embedding,
      limit: limit * 3,
      includeInternal: true,
    });

    if (chunkResults.length === 0) {
      return [];
    }

    type Aggregated = {
      kind: 'public' | 'internal';
      distance?: number;
    };

    const bestBySource = new Map<string, Aggregated>();

    for (const chunk of chunkResults) {
      const key = chunk.sourceId;
      const distance =
        typeof chunk.distance === 'number'
          ? chunk.distance
          : chunk.distance !== undefined
            ? Number(chunk.distance)
            : undefined;

      const current = bestBySource.get(key);
      if (!current || (distance ?? Number.POSITIVE_INFINITY) < (current.distance ?? Number.POSITIVE_INFINITY)) {
        bestBySource.set(key, { kind: chunk.kind, distance });
      }
    }

    const publicIds: string[] = [];
    const internalIds: string[] = [];

    for (const [sourceId, aggregated] of bestBySource.entries()) {
      if (aggregated.kind === 'public') {
        publicIds.push(sourceId);
      } else {
        internalIds.push(sourceId);
      }
    }

    const [publicFaqs, internalFaqs] = await Promise.all([
      getFAQByIds(publicIds),
      getFAQInternalByIds(internalIds),
    ]);

    const faqMap = new Map<string, any>();
    for (const faq of publicFaqs) {
      faqMap.set(faq.id, { ...faq, kind: 'public' as const });
    }
    for (const faq of internalFaqs) {
      faqMap.set(faq.id, { ...faq, kind: 'internal' as const });
    }

    const items: FAQResultItem[] = [];

    for (const [sourceId, aggregated] of bestBySource.entries()) {
      const faq = faqMap.get(sourceId);
      if (!faq) continue;

      const score = normalizeScoreFromDistance(aggregated.distance);

      items.push({
        id: faq.id,
        kind: aggregated.kind,
        brand: faq.brand,
        tag: faq.tag ?? null,
        question: faq.question,
        content: faq.content,
        score,
        isInternal: aggregated.kind === 'internal',
      });
    }

    return items.sort((a, b) => b.score - a.score).slice(0, limit);
  } catch (error) {
    console.warn('벡터 FAQ 검색 실패, 키워드 검색으로 폴백합니다:', error);
    return [];
  }
}

export type FAQSearchResult = Awaited<ReturnType<typeof searchFAQForQuery>>;
export async function searchFAQForQuery(
  query: string,
  {
    useVectorSearch = true,
    limit = 5,
  }: {
    useVectorSearch?: boolean;
    limit?: number;
  } = {},
) {
  const normalizedQuery = query.trim();
  if (!normalizedQuery) {
    return {
      success: false,
      message: '검색어가 비어 있습니다.',
      results: [],
      searchMethod: 'none' as const,
    };
  }

  const normalizedLimit = Math.max(1, limit);
  const seenIds = new Set<string>();
  const results: FAQResultItem[] = [];

  let usedVector = false;
  let usedKeyword = false;

  if (useVectorSearch) {
    const vectorResults = await runVectorSearch(normalizedQuery, normalizedLimit);
    if (vectorResults.length > 0) {
      usedVector = true;
      for (const item of vectorResults) {
        if (results.length >= normalizedLimit) break;
        if (seenIds.has(item.id)) continue;
        seenIds.add(item.id);
        results.push(item);
      }
    }
  }

  if (results.length < normalizedLimit) {
    const keywordResults = await runKeywordSearch(
      normalizedQuery,
      normalizedLimit,
    );
    if (keywordResults.length > 0) {
      usedKeyword = true;
      for (const item of keywordResults) {
        if (results.length >= normalizedLimit) break;
        if (seenIds.has(item.id)) continue;
        seenIds.add(item.id);
        results.push(item);
      }
    }
  }

  if (results.length === 0) {
    return {
      success: false,
      message: '관련된 FAQ를 찾을 수 없습니다.',
      results: [],
      searchMethod: useVectorSearch ? 'vector' : 'keyword',
    };
  }

  const method =
    usedVector && usedKeyword
      ? 'hybrid'
      : usedVector
        ? 'vector'
        : 'keyword';

  return {
    success: true,
    message: `${results.length}개의 관련 FAQ를 찾았습니다.`,
    results: results.slice(0, normalizedLimit),
    searchMethod: method as 'vector' | 'keyword' | 'hybrid',
  };
}

export const searchFAQTool = tool({
  description:
    '미니학습지 관련 FAQ를 하이브리드 검색(키워드 + 벡터)으로 찾습니다. 사용자의 질문과 관련된 정보를 찾아 답변에 활용하세요.',
  inputSchema: z.object({
    query: z.string().describe('검색할 질문이나 키워드'),
    useVectorSearch: z.boolean().default(true).describe('벡터 검색 사용 여부'),
  }),
  execute: async ({ query, useVectorSearch = true }) => {
    try {
      return await searchFAQForQuery(query, { useVectorSearch, limit: 5 });
    } catch (error) {
      console.error('FAQ 검색 도구 오류:', error);
      return {
        success: false,
        message: 'FAQ 검색 중 오류가 발생했습니다.',
        results: [],
        searchMethod: 'error' as const,
      };
    }
  },
});
