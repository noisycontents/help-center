import { z } from 'zod';
import { searchFAQ, getFAQByTag } from '@/lib/db/queries';
import { tool } from 'ai';

export const searchFAQTool = tool({
  description: '미니학습지 관련 FAQ를 검색합니다. 사용자의 질문과 관련된 정보를 찾아 답변에 활용하세요.',
  inputSchema: z.object({
    query: z.string().describe('검색할 질문이나 키워드'),
  }),
  execute: async ({ query }) => {
    try {
      // 일반 검색
      const results = await searchFAQ(query);

      if (results.length === 0) {
        return {
          success: false,
          message: '관련된 FAQ를 찾을 수 없습니다.',
          results: [],
        };
      }

      // 검색 결과를 관련도 순으로 정렬 (간단한 점수 계산)
      const scoredResults = results.map(faq => {
        let score = 0;
        const queryLower = query.toLowerCase();
        const questionLower = faq.question.toLowerCase();
        const contentLower = faq.content.toLowerCase();
        
        // 질문에 검색어가 포함되면 높은 점수
        if (questionLower.includes(queryLower)) score += 10;
        
        // 검색어 단어들이 질문에 포함되면 점수 추가
        const queryWords = queryLower.split(/\s+/);
        queryWords.forEach((word: string) => {
          if (questionLower.includes(word)) score += 3;
          if (contentLower.includes(word)) score += 1;
        });
        
        return { ...faq, score };
      });

      // 점수순으로 정렬하여 상위 5개만 반환
      const topResults = scoredResults
        .sort((a, b) => b.score - a.score)
        .slice(0, 5);

      return {
        success: true,
        message: `${topResults.length}개의 관련 FAQ를 찾았습니다.`,
        results: topResults.map(faq => ({
          id: faq.id,
          brand: faq.brand,
          tag: faq.tag,
          question: faq.question,
          content: faq.content,
          score: faq.score,
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
