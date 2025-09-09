'use client';

import { motion } from 'framer-motion';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState, useEffect } from 'react';
import { 
  BookOpen, 
  AlertCircle, 
  CreditCard, 
  Package, 
  RotateCcw, 
  Smartphone, 
  Award,
  HelpCircle,
  MessageCircle,
  ArrowLeft,
  User,
  ChevronDown,
  ChevronRight
} from 'lucide-react';
import { FAQSearch } from './faq-search';
import { FAQModal } from './faq-modal';
import { Button } from './ui/button';
import type { FAQ } from '@/lib/db/schema';
import { createSafeHTML } from '@/lib/html-utils';
import { HTMLContent } from './html-content';

const categories = [
  {
    id: 'error',
    name: '오류 해결',
    tag: '오류',
    description: '앱 오류, 동영상 재생 문제, 로그인 문제 등',
    icon: AlertCircle,
    color: 'bg-red-50 text-red-600 border-red-200',
  },
  {
    id: 'course',
    name: '수강 안내',
    tag: '수강',
    description: '강의 수강법, 학습 순서, 진도 관리 등',
    icon: BookOpen,
    color: 'bg-blue-50 text-blue-600 border-blue-200',
  },
  {
    id: 'app',
    name: '더노트 앱',
    tag: '더노트앱',
    description: '앱 사용법, 기능 안내, 설정 방법 등',
    icon: Smartphone,
    color: 'bg-green-50 text-green-600 border-green-200',
  },
  {
    id: 'purchase',
    name: '구매 문의',
    tag: '구매',
    description: '상품 구성, 가격, 패키지 선택 등',
    icon: CreditCard,
    color: 'bg-purple-50 text-purple-600 border-purple-200',
  },
  {
    id: 'refund',
    name: '환불 안내',
    tag: '환불',
    description: '환불 규정, 취소 방법, 환불 절차 등',
    icon: RotateCcw,
    color: 'bg-orange-50 text-orange-600 border-orange-200',
  },
  {
    id: 'shipping',
    name: '배송 문의',
    tag: '배송',
    description: '배송 일정, 주소 변경, 해외 배송 등',
    icon: Package,
    color: 'bg-teal-50 text-teal-600 border-teal-200',
  },
  {
    id: 'certificate',
    name: '수강증명서',
    tag: '증명서',
    description: '수강확인증, 출석확인서 발급 등',
    icon: Award,
    color: 'bg-indigo-50 text-indigo-600 border-indigo-200',
  },
  {
    id: 'payment',
    name: '결제 문의',
    tag: '결제',
    description: '결제 방법, 할부, 영수증 발급 등',
    icon: CreditCard,
    color: 'bg-yellow-50 text-yellow-600 border-yellow-200',
  },
  {
    id: 'account',
    name: '계정 관리',
    tag: '계정',
    description: '로그인, 회원가입, 비밀번호 변경 등',
    icon: User,
    color: 'bg-gray-50 text-gray-600 border-gray-200',
  },
];

interface FAQCategoriesProps {
  selectedCategory?: string;
}

export const FAQCategories = ({ selectedCategory }: FAQCategoriesProps) => {
  const router = useRouter();
  const [categoryFAQs, setCategoryFAQs] = useState<FAQ[]>([]);
  const [loading, setLoading] = useState(false);
  const [expandedFAQs, setExpandedFAQs] = useState<Set<string>>(new Set());

  // FAQ 펼치기/접기 토글
  const toggleFAQ = (faqId: string) => {
    setExpandedFAQs(prev => {
      const newSet = new Set(prev);
      if (newSet.has(faqId)) {
        newSet.delete(faqId);
      } else {
        newSet.add(faqId);
      }
      return newSet;
    });
  };

  // 선택된 카테고리의 FAQ 로드
  useEffect(() => {
    if (selectedCategory) {
      const category = categories.find(cat => cat.id === selectedCategory);
      if (category) {
        setLoading(true);
        fetch(`/api/faq/category/${encodeURIComponent(category.tag)}`)
          .then(res => res.json())
          .then(data => {
            if (data.success) {
              setCategoryFAQs(data.results);
            }
          })
          .catch(error => {
            console.error('카테고리 FAQ 로드 오류:', error);
          })
          .finally(() => {
            setLoading(false);
          });
      }
    } else {
      setCategoryFAQs([]);
    }
  }, [selectedCategory]);

  // 카테고리별 FAQ 표시
  if (selectedCategory) {
    const category = categories.find(cat => cat.id === selectedCategory);
    
    return (
      <>
        <FAQModal />
        <div className="w-full max-w-3xl mx-auto px-6 py-8">
          {/* 뒤로가기 및 카테고리 제목 */}
          <div className="flex items-center gap-4 mb-8">
            <Button
              variant="outline"
              size="sm"
              onClick={() => router.push('/chat?mode=help')}
              className="flex items-center gap-2"
            >
              <ArrowLeft className="w-4 h-4" />
              뒤로가기
            </Button>
            <div className="flex items-center gap-3">
              {category && (
                <>
                  <category.icon className="w-6 h-6 text-blue-600" />
                  <h1 className="text-2xl font-bold text-gray-900">{category.name}</h1>
                </>
              )}
            </div>
          </div>

          {/* FAQ 목록 */}
          {loading ? (
            <div className="text-center py-12">
              <p className="text-gray-500">FAQ를 불러오는 중...</p>
            </div>
          ) : !loading && categoryFAQs.length > 0 ? (
            <div className="space-y-2">
              {categoryFAQs.map((faq, index) => {
                const isExpanded = expandedFAQs.has(faq.id);
                return (
                  <motion.div
                    key={faq.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.05 }}
                    className="bg-white border border-gray-200 rounded-lg overflow-hidden"
                  >
                    {/* 질문 헤더 (클릭 가능) */}
                    <button
                      onClick={() => toggleFAQ(faq.id)}
                      className="w-full px-6 py-4 text-left flex items-center justify-between hover:bg-gray-50 transition-colors"
                    >
                      <h3 className="text-lg font-semibold text-gray-900 flex-1">
                        {faq.question}
                      </h3>
                      {isExpanded ? (
                        <ChevronDown className="w-5 h-5 text-gray-500 flex-shrink-0 ml-3" />
                      ) : (
                        <ChevronRight className="w-5 h-5 text-gray-500 flex-shrink-0 ml-3" />
                      )}
                    </button>
                    
                    {/* 답변 내용 (조건부 렌더링) */}
                    {isExpanded && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.2 }}
                        className="border-t border-gray-100"
                      >
                        <div className="px-6 py-4">
                          <HTMLContent 
                            content={faq.content}
                            className="text-gray-700 prose prose-sm max-w-none [&>p]:mb-3 [&>ol]:mb-3 [&>ul]:mb-3 [&>li]:mb-1"
                          />
                        </div>
                      </motion.div>
                    )}
                  </motion.div>
                );
              })}
            </div>
          ) : !loading ? (
            <div className="text-center py-12">
              <p className="text-gray-500 mb-4">이 카테고리에 등록된 FAQ가 없습니다.</p>
              <Button
                onClick={() => router.push('/chat')}
                className="flex items-center gap-2"
              >
                <MessageCircle className="w-4 h-4" />
                AI 상담사에게 문의하기
              </Button>
            </div>
          ) : null}
        </div>
      </>
    );
  }

  return (
    <>
      <FAQModal />
      <div className="w-full max-w-3xl mx-auto px-6 py-12 pb-32">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-center mb-12"
      >
        <h1 className="text-4xl font-bold text-gray-900 mb-4">
          미니학습지 도움말 센터
        </h1>
        <p className="text-xl text-gray-600 mb-8">
          궁금한 내용을 빠르게 찾아보세요
        </p>
        
        {/* 검색창 */}
        <FAQSearch />
      </motion.div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-12">
        {categories.map((category, index) => {
          const IconComponent = category.icon;
          return (
            <motion.div
              key={category.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.1 }}
            >
              <Link
                href={`/chat?mode=help&category=${category.id}`}
                className={`block p-6 rounded-xl border-2 hover:shadow-lg transition-all duration-200 ${category.color} hover:scale-105`}
              >
                <div className="flex items-start space-x-4">
                  <div className="flex-shrink-0">
                    <IconComponent className="w-8 h-8" />
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold mb-2">
                      {category.name}
                    </h3>
                    <p className="text-sm opacity-80">
                      {category.description}
                    </p>
                  </div>
                </div>
              </Link>
            </motion.div>
          );
        })}
      </div>

      </div>
    </>
  );
};
