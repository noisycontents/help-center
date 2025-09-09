'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Search, X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import Link from 'next/link';
import { stripHTML } from '@/lib/html-utils';

interface FAQ {
  id: string;
  brand: string;
  tag: string;
  question: string;
  content: string;
}

interface SearchResult {
  success: boolean;
  message: string;
  results: FAQ[];
}

interface FAQSearchProps {}

export const FAQSearch = ({}: FAQSearchProps) => {
  const router = useRouter();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<FAQ[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isOpen, setIsOpen] = useState(false);

  const searchFAQ = async (searchQuery: string) => {
    if (!searchQuery.trim()) {
      setResults([]);
      return;
    }

    setIsLoading(true);
    try {
      const response = await fetch('/api/faq/search', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ query: searchQuery }),
      });

      const data: SearchResult = await response.json();
      if (data.success) {
        setResults(data.results);
      } else {
        setResults([]);
      }
    } catch (error) {
      console.error('검색 오류:', error);
      setResults([]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSearch = (value: string) => {
    setQuery(value);
    setIsOpen(true);
    
    // 디바운싱
    const timeoutId = setTimeout(() => {
      searchFAQ(value);
    }, 300);

    return () => clearTimeout(timeoutId);
  };

  const clearSearch = () => {
    setQuery('');
    setResults([]);
    setIsOpen(false);
  };

  return (
    <div className="relative max-w-2xl mx-auto mb-8">
      <div className="relative">
        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
          <Search className="h-5 w-5 text-gray-400" />
        </div>
        <input
          type="text"
          value={query}
          onChange={(e) => handleSearch(e.target.value)}
          onFocus={() => setIsOpen(true)}
          placeholder="궁금한 내용을 검색해보세요..."
          className="block w-full pl-10 pr-12 py-4 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent text-lg"
        />
        {query && (
          <button
            onClick={clearSearch}
            className="absolute inset-y-0 right-0 pr-3 flex items-center"
          >
            <X className="h-5 w-5 text-gray-400 hover:text-gray-600" />
          </button>
        )}
      </div>

      <AnimatePresence>
        {isOpen && query && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="absolute top-full left-0 right-0 mt-2 bg-white border border-gray-200 rounded-xl shadow-lg z-50 max-h-96 overflow-y-auto"
          >
            {isLoading ? (
              <div className="p-4 text-center text-gray-500">
                검색 중...
              </div>
            ) : results.length > 0 ? (
              <div className="py-2">
                {results.map((faq, index) => (
                  <motion.div
                    key={faq.id}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: index * 0.05 }}
                    className="px-4 py-3 hover:bg-gray-50 cursor-pointer border-b border-gray-100 last:border-b-0"
                    onClick={() => {
                      // 검색창 닫기
                      setIsOpen(false);
                      setQuery('');
                      
                      // FAQ 내용을 모달이나 확장된 형태로 표시
                      const event = new CustomEvent('showFAQ', { 
                        detail: { faq } 
                      });
                      window.dispatchEvent(event);
                    }}
                  >
                    <div className="flex items-start space-x-3">
                      <div className="flex-shrink-0">
                        <span className="inline-flex items-center px-2 py-1 rounded-md text-xs font-medium bg-blue-100 text-blue-800">
                          {faq.tag}
                        </span>
                      </div>
                      <div className="flex-grow min-w-0">
                        <p className="text-sm font-medium text-gray-900 truncate">
                          {faq.question}
                        </p>
                        <p className="text-xs text-gray-500 mt-1 line-clamp-2">
                          {stripHTML(faq.content).substring(0, 100)}...
                        </p>
                      </div>
                    </div>
                  </motion.div>
                ))}
                <div className="p-4 bg-gray-50 text-center">
                  <button
                    onClick={() => {
                      console.log('FAQ 검색에서 AI 상담사 연결:', query);
                      setIsOpen(false);
                      setQuery('');
                      router.push(`/chat?q=${encodeURIComponent(query)}`);
                    }}
                    className="inline-flex items-center justify-center px-4 py-2 text-sm font-medium text-blue-600 bg-blue-50 hover:bg-blue-100 hover:text-blue-700 rounded-lg transition-colors"
                  >
                    AI 상담사에게 &quot;{query}&quot; 질문하기 →
                  </button>
                </div>
              </div>
            ) : query.length > 0 ? (
              <div className="p-4 text-center">
                <p className="text-gray-500 mb-3">검색 결과가 없습니다</p>
                <button
                  onClick={() => {
                    console.log('FAQ 검색 결과 없음 - AI 상담사 연결:', query);
                    setIsOpen(false);
                    setQuery('');
                    router.push(`/chat?q=${encodeURIComponent(query)}`);
                  }}
                  className="inline-flex items-center justify-center px-4 py-2 text-sm font-medium text-blue-600 bg-blue-50 hover:bg-blue-100 hover:text-blue-700 rounded-lg transition-colors"
                >
                  AI 상담사에게 &quot;{query}&quot; 질문하기 →
                </button>
              </div>
            ) : null}
          </motion.div>
        )}
      </AnimatePresence>

      {/* 배경 클릭 시 검색창 닫기 */}
      {isOpen && (
        <div
          className="fixed inset-0 z-40"
          onClick={() => setIsOpen(false)}
        />
      )}
    </div>
  );
};
