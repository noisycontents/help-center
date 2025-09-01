import { NextResponse } from 'next/server';
import { getFAQByTag } from '@/lib/db/queries';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ tag: string }> }
) {
  try {
    const { tag } = await params;

    if (!tag) {
      return NextResponse.json(
        { success: false, message: '태그를 입력해주세요.', results: [] },
        { status: 400 }
      );
    }

    const results = await getFAQByTag(tag);

    return NextResponse.json({
      success: true,
      message: `${results.length}개의 FAQ를 찾았습니다.`,
      results,
    });
  } catch (error) {
    console.error('태그별 FAQ API 오류:', error);
    return NextResponse.json(
      { success: false, message: 'FAQ 조회 중 오류가 발생했습니다.', results: [] },
      { status: 500 }
    );
  }
}
