import { z } from 'zod';
import { searchFAQ, getFAQByTag } from '@/lib/db/queries';
import { tool } from 'ai';

// 내부 FAQ 검색 함수
async function searchInternalFAQ(query: string) {
  const { drizzle } = require('drizzle-orm/postgres-js');
  const postgres = require('postgres');
  
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error('DATABASE_URL이 설정되지 않았습니다.');
  }

  const client = postgres(connectionString);
  
  try {
    const results = await client`
      SELECT id, brand, tag, question, content, "createdAt", "updatedAt"
      FROM "FAQ_Internal"
      WHERE question ILIKE ${'%' + query + '%'} OR content ILIKE ${'%' + query + '%'}
      ORDER BY "updatedAt" DESC
      LIMIT 10
    `;
    
    await client.end();
    return results;
  } catch (error) {
    await client.end();
    throw error;
  }
}

// 벡터 검색 함수 (내부 FAQ 포함)
async function executeVectorSearch(query: string, includeInternal: boolean = false, limit: number = 5) {
  try {
    let allResults = [];
    
    // 공개 FAQ 검색
    const publicResults = await searchFAQ(query);
    const publicMapped = publicResults.slice(0, Math.ceil(limit / 2)).map(faq => ({
      ...faq,
      kind: 'public',
      isInternal: false,
      score: 0.6, // 공개 FAQ는 중간 점수
    }));
    allResults.push(...publicMapped);

    // 내부 FAQ 검색 (includeInternal이 true일 때) - 우선 처리
    if (includeInternal) {
      const internalResults = await searchInternalFAQ(query);
      const internalMapped = internalResults.slice(0, Math.ceil(limit * 0.6)).map((faq: any) => ({
        ...faq,
        kind: 'internal',
        isInternal: true,
        score: 0.95, // 내부 FAQ는 매우 높은 점수 (더 상세한 정보)
      }));
      // 내부 FAQ를 앞에 배치
      allResults.unshift(...internalMapped);
    }

    return {
      success: allResults.length > 0,
      message: `${allResults.length}개의 FAQ를 찾았습니다.`,
      results: allResults.slice(0, limit)
    };
  } catch (error) {
    console.error('벡터 검색 오류:', error);
    return {
      success: false,
      message: '검색 중 오류가 발생했습니다.',
      results: []
    };
  }
}

export const searchFAQTool = tool({
  description: '미니학습지 관련 FAQ를 하이브리드 검색(키워드 + 벡터)으로 찾습니다. 사용자의 질문과 관련된 정보를 찾아 답변에 활용하세요.',
  inputSchema: z.object({
    query: z.string().describe('검색할 질문이나 키워드'),
    useVectorSearch: z.boolean().default(true).describe('벡터 검색 사용 여부'),
  }),
  execute: async ({ query, useVectorSearch = true }) => {
    try {
      let vectorResults: any[] = [];
      let keywordResults: any[] = [];

      // 벡터 검색 실행 (우선)
      if (useVectorSearch) {
        try {
          // 벡터 검색 함수 직접 호출
          const vectorSearchResult = await executeVectorSearch(query, true, 3);
          
          if (vectorSearchResult.success && vectorSearchResult.results) {
            vectorResults = vectorSearchResult.results;
          }
        } catch (vectorError) {
          console.warn('벡터 검색 실패, 키워드 검색으로 대체:', vectorError);
        }
      }

      // 키워드 검색 (보완용)
      const keywordSearchResults = await searchFAQ(query);
      if (keywordSearchResults.length > 0) {
        // 키워드 검색 결과 점수 계산
        const scoredKeywordResults = keywordSearchResults.map(faq => {
          let score = 0;
          const queryLower = query.toLowerCase();
          const questionLower = faq.question.toLowerCase();
          const contentLower = faq.content.toLowerCase();
          
          if (questionLower.includes(queryLower)) score += 10;
          
          const queryWords = queryLower.split(/\s+/);
          queryWords.forEach((word: string) => {
            if (questionLower.includes(word)) score += 3;
            if (contentLower.includes(word)) score += 1;
          });
          
          return { 
            ...faq, 
            score: score * 0.1, // 벡터 검색보다 낮은 가중치
            kind: 'public',
            isInternal: false 
          };
        });

        keywordResults = scoredKeywordResults.slice(0, 2);
      }

      // 결과 통합 및 중복 제거
      const allResults = [...vectorResults, ...keywordResults];
      const uniqueResults = new Map();
      
      for (const result of allResults) {
        const key = result.id;
        if (!uniqueResults.has(key) || (uniqueResults.get(key).score < result.score)) {
          uniqueResults.set(key, result);
        }
      }

      const finalResults = Array.from(uniqueResults.values())
        .sort((a, b) => (b.score || 0) - (a.score || 0))
        .slice(0, 5);

      if (finalResults.length === 0) {
        return {
          success: false,
          message: '관련된 FAQ를 찾을 수 없습니다.',
          results: [],
        };
      }

      return {
        success: true,
        message: `${finalResults.length}개의 관련 FAQ를 찾았습니다.`,
        results: finalResults.map(faq => ({
          id: faq.id,
          kind: faq.kind || 'public',
          brand: faq.brand,
          tag: faq.tag,
          question: faq.question,
          content: faq.content,
          score: faq.score || 0,
          isInternal: faq.isInternal || false,
          searchMethod: faq.chunks ? 'vector' : 'keyword',
        })),
      };
    } catch (error) {
      console.error('하이브리드 FAQ 검색 도구 오류:', error);
      return {
        success: false,
        message: 'FAQ 검색 중 오류가 발생했습니다.',
        results: [],
      };
    }
  },
});
