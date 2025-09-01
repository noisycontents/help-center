'use client';

import { motion } from 'framer-motion';
import Link from 'next/link';
import { 
  BookOpen, 
  AlertCircle, 
  CreditCard, 
  Package, 
  RotateCcw, 
  Smartphone, 
  Award,
  HelpCircle
} from 'lucide-react';
import { FAQSearch } from './faq-search';
import { FAQModal } from './faq-modal';

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
];

export const FAQCategories = () => {
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
                href={`/help/${category.id}`}
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
