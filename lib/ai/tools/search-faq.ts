import { z } from 'zod';
import { searchFAQ, getFAQByTag } from '@/lib/db/queries';
import { tool } from 'ai';

// 내부 FAQ 검색 함수 - DB 연결 재사용으로 성능 최적화
async function searchInternalFAQ(query: string) {
  const { eq, or, like, desc } = require('drizzle-orm');
  const { drizzle } = require('drizzle-orm/postgres-js');
  const postgres = require('postgres');
  const { faqInternal } = require('@/lib/db/schema');
  
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error('DATABASE_URL이 설정되지 않았습니다.');
  }

  // 기존 연결 재사용 (연결 풀링)
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
          like(faqInternal.tag, `%${query}%`)
        )
      )
      .orderBy(desc(faqInternal.updatedAt))
      .limit(10)
      .execute();
    
    return results;
  } catch (error) {
    console.error('Internal FAQ 검색 오류:', error);
    throw error;
  }
}

// 벡터 검색 함수 (내부 FAQ 포함) - 성능 최적화
async function executeVectorSearch(query: string, includeInternal: boolean = false, limit: number = 5) {
  try {
    // 병렬로 검색 실행하여 속도 향상
    const searchPromises = [];
    
    // 공개 FAQ 검색 (항상 실행)
    searchPromises.push(
      searchFAQ(query).then(results => 
        results.slice(0, Math.ceil(limit / 2)).map(faq => ({
          ...faq,
          kind: 'public',
          isInternal: false,
          score: 0.6,
        }))
      )
    );
    
    // 내부 FAQ 검색 (조건부 실행)
    if (includeInternal) {
      searchPromises.push(
        searchInternalFAQ(query).then(results => 
          results.slice(0, Math.ceil(limit * 0.6)).map((faq: any) => ({
            ...faq,
            kind: 'internal',
            isInternal: true,
            score: 0.95,
          }))
        )
      );
    }
    
    // 병렬 검색 결과 대기
    const searchResults = await Promise.all(searchPromises);
    const allResults = searchResults.flat();

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
      // 🚀 성능 최적화: 단일 검색 방식으로 중복 제거
      let searchResults: any[] = [];
      
      if (useVectorSearch) {
        // 벡터 검색 우선 실행 (내부 FAQ 포함)
        try {
          const vectorSearchResult = await executeVectorSearch(query, true, 5);
          if (vectorSearchResult.success && vectorSearchResult.results.length > 0) {
            searchResults = vectorSearchResult.results;
          }
        } catch (vectorError) {
          console.warn('벡터 검색 실패, 키워드 검색으로 대체:', vectorError);
          useVectorSearch = false; // 키워드 검색으로 폴백
        }
      }
      
      // 벡터 검색 실패 또는 결과가 없는 경우 키워드 검색 실행
      if (!useVectorSearch || searchResults.length === 0) {
        // 병렬 검색: Public FAQ + Internal FAQ
        const [publicResults, internalResults] = await Promise.all([
          searchFAQ(query).then(results => 
            results.map(faq => ({ ...faq, kind: 'public', isInternal: false, score: 0.6 }))
          ),
          searchInternalFAQ(query).then(results => 
            results.map(faq => ({ ...faq, kind: 'internal', isInternal: true, score: 0.9 }))
          ).catch(() => []) // Internal FAQ 검색 실패시 빈 배열 반환
        ]);

        // 키워드 검색 결과 점수 계산 및 통합
        const allKeywordResults = [...publicResults, ...internalResults];
        searchResults = allKeywordResults
          .map(faq => {
            let score = faq.score || 0.6; // 기본 점수
            const queryLower = query.toLowerCase();
            const questionLower = faq.question.toLowerCase();
            const contentLower = faq.content.toLowerCase();
            
            // 점수 가중치 계산
            if (questionLower.includes(queryLower)) score += 0.4;
            
            const queryWords = queryLower.split(/\s+/);
            queryWords.forEach((word: string) => {
              if (word.length > 1) { // 단일 문자 제외
                if (questionLower.includes(word)) score += 0.2;
                if (contentLower.includes(word)) score += 0.1;
              }
            });
            
            return { ...faq, score };
          })
          .sort((a, b) => b.score - a.score)
          .slice(0, 5);
      }

      if (searchResults.length === 0) {
        return {
          success: false,
          message: '관련된 FAQ를 찾을 수 없습니다.',
          results: [],
        };
      }

      return {
        success: true,
        message: `${searchResults.length}개의 관련 FAQ를 찾았습니다.`,
        results: searchResults.map(faq => ({
          id: faq.id,
          kind: faq.kind || 'public',
          brand: faq.brand,
          tag: faq.tag,
          question: faq.question,
          content: faq.content,
          score: faq.score || 0,
          isInternal: faq.isInternal || false,
          searchMethod: useVectorSearch ? 'vector' : 'keyword',
        })),
      };
    } catch (error) {
      console.error('FAQ 검색 도구 오류:', error);
      return {
        success: false,
        message: 'FAQ 검색 중 오류가 발생했습니다.',
        results: [],
      };
    }
  },
});
