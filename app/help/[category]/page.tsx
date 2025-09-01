'use client';

import { notFound } from 'next/navigation';
import Link from 'next/link';
import { ChevronLeft, Search } from 'lucide-react';
import { motion } from 'framer-motion';
import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';

const categoryInfo: Record<string, { name: string; description: string }> = {
  error: { name: '오류 해결', description: '앱 오류, 동영상 재생 문제, 로그인 문제 등' },
  course: { name: '수강 안내', description: '강의 수강법, 학습 순서, 진도 관리 등' },
  app: { name: '더노트 앱', description: '앱 사용법, 기능 안내, 설정 방법 등' },
  purchase: { name: '구매 문의', description: '상품 구성, 가격, 패키지 선택 등' },
  refund: { name: '환불 안내', description: '환불 규정, 취소 방법, 환불 절차 등' },
  shipping: { name: '배송 문의', description: '배송 일정, 주소 변경, 해외 배송 등' },
  certificate: { name: '수강증명서', description: '수강확인증, 출석확인서 발급 등' },
  payment: { name: '결제 문의', description: '결제 방법, 할부, 영수증 발급 등' },
};

const tagMapping: Record<string, string> = {
  error: '오류',
  course: '수강',
  app: '더노트앱',
  purchase: '구매',
  refund: '환불',
  shipping: '배송',
  certificate: '증명서',
  payment: '결제',
};

interface FAQ {
  id: string;
  brand: string;
  tag: string;
  question: string;
  content: string;
}

export default function CategoryPage() {
  const params = useParams();
  const category = params.category as string;
  const [faqs, setFaqs] = useState<FAQ[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // 콘텐츠를 풍부하게 렌더링하는 함수
  const renderRichContent = (content: string) => {
    // 1. YouTube 비디오 확인
    const youtubeMatch = content.match(/https?:\/\/(?:www\.)?(?:youtube\.com\/watch\?v=|youtu\.be\/)([a-zA-Z0-9_-]+)/);
    if (youtubeMatch) {
      const videoId = youtubeMatch[1];
      const beforeVideo = content.substring(0, youtubeMatch.index);
      const afterVideo = content.substring((youtubeMatch.index || 0) + youtubeMatch[0].length);
      
      return (
        <>
          {beforeVideo && <div className="mb-4">{renderTextContent(beforeVideo)}</div>}
          <div className="my-4 relative w-full" style={{ paddingBottom: '56.25%' }}>
            <iframe
              src={`https://www.youtube.com/embed/${videoId}`}
              className="absolute top-0 left-0 w-full h-full rounded-lg"
              frameBorder="0"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
            />
          </div>
          {afterVideo && <div className="mt-4">{renderTextContent(afterVideo)}</div>}
        </>
      );
    }
    
    // 2. Vimeo 비디오 확인
    const vimeoMatch = content.match(/https?:\/\/(?:www\.)?vimeo\.com\/(\d+)/);
    if (vimeoMatch) {
      const videoId = vimeoMatch[1];
      const beforeVideo = content.substring(0, vimeoMatch.index);
      const afterVideo = content.substring((vimeoMatch.index || 0) + vimeoMatch[0].length);
      
      return (
        <>
          {beforeVideo && <div className="mb-4">{renderTextContent(beforeVideo)}</div>}
          <div className="my-4 relative w-full" style={{ paddingBottom: '56.25%' }}>
            <iframe
              src={`https://player.vimeo.com/video/${videoId}`}
              className="absolute top-0 left-0 w-full h-full rounded-lg"
              frameBorder="0"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
            />
          </div>
          {afterVideo && <div className="mt-4">{renderTextContent(afterVideo)}</div>}
        </>
      );
    }
    
    // 3. 이미지 확인 (jpg, png, gif, webp) - 더 넓은 패턴으로 수정
    const imageMatch = content.match(/https?:\/\/[^\s<>"']+\.(jpg|jpeg|png|gif|webp)(\?[^\s<>"']*)?/i);

    if (imageMatch) {
      const imageUrl = imageMatch[0];
      const beforeImage = content.substring(0, imageMatch.index);
      const afterImage = content.substring((imageMatch.index || 0) + imageMatch[0].length);
      
      return (
        <>
          {beforeImage && <div className="mb-4">{renderTextContent(beforeImage)}</div>}
          <div className="my-4 text-center">
            <img
              src={imageUrl}
              alt="FAQ 이미지"
              className="max-w-full h-auto rounded-lg shadow-sm border border-gray-200 mx-auto"
              style={{ maxHeight: '500px', objectFit: 'contain' }}
              onError={(e) => {
                console.error('이미지 로드 실패:', imageUrl);
                // 이미지 로드 실패 시 링크로 대체
                const parent = e.currentTarget.parentElement;
                if (parent) {
                  parent.innerHTML = `
                    <div class="p-4 bg-gray-100 rounded-lg border border-gray-300">
                      <p class="text-gray-600 mb-2">이미지를 불러올 수 없습니다.</p>
                      <a href="${imageUrl}" target="_blank" rel="noopener noreferrer" 
                         class="text-blue-600 hover:text-blue-800 underline">
                        원본 이미지 보기: ${imageUrl}
                      </a>
                    </div>
                  `;
                }
              }}
            />
          </div>
          {afterImage && <div className="mt-4">{renderTextContent(afterImage)}</div>}
        </>
      );
    }
    
    // 4. 비디오나 이미지가 없으면 텍스트만 렌더링
    return renderTextContent(content);
  };

  // 텍스트 콘텐츠 렌더링 함수
  const renderTextContent = (text: string) => {
    // HTML 태그가 있으면 HTML로 렌더링 (a 태그 포함)
    if (text.includes('<') && text.includes('>')) {
      return (
        <span 
          dangerouslySetInnerHTML={{ __html: text }}
          className="[&>b]:font-bold [&>i]:italic [&>strong]:font-bold [&>em]:italic [&>u]:underline [&>a]:text-blue-600 [&>a]:hover:text-blue-800 [&>a]:hover:underline"
        />
      );
    }
    
    // 일반 URL 링크 처리 (이미지 제외)
    const urlRegex = /(https?:\/\/[^\s]+)/g;
    const parts = text.split(urlRegex);
    
    return parts.map((part, index) => {
      if (urlRegex.test(part)) {
        // 이미지 URL은 링크로 만들지 않음 (이미 이미지로 처리됨)
        if (part.match(/\.(jpg|jpeg|png|gif|webp)(\?[^\s<>"']*)?$/i)) {
          return <span key={index} style={{ display: 'none' }}>{part}</span>; // 이미지 URL 숨김
        }
        
        return (
          <a
            key={index}
            href={part}
            target="_blank"
            rel="noopener noreferrer"
            className="text-blue-600 hover:text-blue-800 underline"
          >
            {part}
          </a>
        );
      }
      return part;
    });
  };
  
  const categoryTag = tagMapping[category];
  const info = categoryInfo[category];

  useEffect(() => {
    if (!categoryTag || !info) {
      notFound();
      return;
    }

    const loadFAQs = async () => {
      setIsLoading(true);
      try {
        const response = await fetch(`/api/faq/category/${encodeURIComponent(categoryTag)}`);
        const data = await response.json();
        
        if (data.success) {
          setFaqs(data.results);
        } else {
          setFaqs([]);
        }
      } catch (error) {
        console.error('FAQ 로드 오류:', error);
        setFaqs([]);
      } finally {
        setIsLoading(false);
      }
    };

    loadFAQs();
  }, [category, categoryTag, info]);

  if (!categoryTag || !info) {
    return null;
  }

  return (
    <div className="w-full max-w-3xl mx-auto px-6 py-8 pb-32">
      {/* 헤더 */}
      <div className="mb-8">
        <Link
          href="/help"
          className="inline-flex items-center text-blue-600 hover:text-blue-700 mb-4"
        >
          <ChevronLeft className="w-4 h-4 mr-1" />
          도움말 센터로 돌아가기
        </Link>
        
        <h1 className="text-3xl font-bold text-gray-900 mb-2">
          {info.name}
        </h1>
        <p className="text-lg text-gray-600">
          {info.description}
        </p>
      </div>

      {/* AI 상담사 안내 제거 - 플로팅 채팅으로 대체 */}

      {/* FAQ 목록 */}
      <div className="space-y-4 w-full">
        
        {isLoading ? (
          <div className="text-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
            <p className="mt-4 text-gray-500">FAQ를 불러오는 중...</p>
          </div>
        ) : faqs.length === 0 ? (
          <div className="text-center py-12 text-gray-500">
            <p>해당 카테고리의 FAQ가 아직 없습니다.</p>
            <Link
              href="/chat"
              className="mt-4 inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              AI 상담사에게 문의하기
            </Link>
          </div>
        ) : (
          faqs.map((faq, index) => (
            <motion.div
              key={faq.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.05 }}
              className="bg-white rounded-lg border border-gray-200 hover:border-gray-300 transition-colors h-auto w-full max-w-full block"
            >
              <details className="group w-full">
                <summary className="flex items-center justify-between p-6 cursor-pointer list-none min-h-[80px] w-full box-border">
                  <h3 className="text-lg font-medium text-gray-900 pr-4 flex-1">
                    {faq.question}
                  </h3>
                  <div className="flex-shrink-0">
                    <div className="w-6 h-6 rounded-full bg-gray-100 flex items-center justify-center group-open:bg-blue-100 transition-colors">
                      <span className="text-gray-600 group-open:text-blue-600 group-open:rotate-45 transition-transform">
                        +
                      </span>
                    </div>
                  </div>
                </summary>
                <div className="px-6 pb-6 pt-0">
                  <div className="prose max-w-none text-gray-700 faq-content">
                    <div className="whitespace-pre-line">
                      {renderRichContent(faq.content)}
                    </div>
                  </div>
                </div>
              </details>
            </motion.div>
          ))
        )}
      </div>

      {/* 플로팅 채팅은 레이아웃에서 처리 */}
    </div>
  );
}


