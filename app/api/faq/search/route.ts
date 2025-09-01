import { NextResponse } from 'next/server';
import { searchFAQ } from '@/lib/db/queries';

export async function POST(request: Request) {
  try {
    const { query } = await request.json();

    if (!query || typeof query !== 'string') {
      return NextResponse.json(
        { success: false, message: '검색어를 입력해주세요.', results: [] },
        { status: 400 }
      );
    }

    const results = await searchFAQ(query.trim());

    // 검색 결과를 관련도 순으로 정렬
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

    // 점수순으로 정렬하여 상위 8개만 반환
    const topResults = scoredResults
      .sort((a, b) => b.score - a.score)
      .slice(0, 8)
      .map(({ score, ...faq }) => faq); // score 필드 제거

    return NextResponse.json({
      success: true,
      message: `${topResults.length}개의 관련 FAQ를 찾았습니다.`,
      results: topResults,
    });
  } catch (error) {
    console.error('FAQ 검색 API 오류:', error);
    return NextResponse.json(
      { success: false, message: 'FAQ 검색 중 오류가 발생했습니다.', results: [] },
      { status: 500 }
    );
  }
}
