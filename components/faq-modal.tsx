'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, MessageCircle } from 'lucide-react';
import { createSafeHTML } from '@/lib/html-utils';
import { useRouter } from 'next/navigation';

interface FAQ {
  id: string;
  brand: string;
  tag: string;
  question: string;
  content: string;
}

export const FAQModal = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [selectedFAQ, setSelectedFAQ] = useState<FAQ | null>(null);
  const router = useRouter();

  useEffect(() => {
    const handleShowFAQ = (event: CustomEvent) => {
      const { faq } = event.detail;
      setSelectedFAQ(faq);
      setIsOpen(true);
    };

    window.addEventListener('showFAQ', handleShowFAQ as EventListener);
    
    return () => {
      window.removeEventListener('showFAQ', handleShowFAQ as EventListener);
    };
  }, []);

  const closeFAQ = () => {
    setIsOpen(false);
    setTimeout(() => setSelectedFAQ(null), 200);
  };

  if (!selectedFAQ) return null;

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* 배경 오버레이 */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 z-50"
            onClick={closeFAQ}
          />

          {/* 모달 */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            className="fixed inset-4 md:inset-8 lg:inset-16 xl:inset-24 w-auto max-w-4xl max-h-[85vh] mx-auto my-auto bg-white dark:bg-gray-900 rounded-xl shadow-2xl z-50 flex flex-col"
            style={{
              transform: 'translate(-50%, -50%)',
              width: 'min(90vw, 48rem)',
              height: 'min(85vh, 36rem)'
            }}
            role="dialog"
            aria-labelledby="faq-modal-title"
            aria-modal="true"
          >
            {/* 헤더 */}
            <div className="flex items-start justify-between p-6 border-b border-gray-200 dark:border-gray-700">
              <div className="flex-1 pr-4">
                <div className="flex items-center gap-2 mb-2">
                  <span className="inline-flex items-center px-2 py-1 rounded-md text-xs font-medium bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200">
                    {selectedFAQ.tag}
                  </span>
                </div>
                <h2 id="faq-modal-title" className="text-xl font-semibold text-gray-900 dark:text-white">
                  {selectedFAQ.question}
                </h2>
              </div>
              <button
                onClick={closeFAQ}
                className="flex-shrink-0 p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
              >
                <X className="w-5 h-5 text-gray-500 dark:text-gray-400" />
              </button>
            </div>

            {/* 내용 */}
            <div className="flex-1 overflow-y-auto p-6">
              <div 
                className="prose prose-sm max-w-none text-gray-700 leading-relaxed [&>p]:mb-3 [&>ol]:mb-3 [&>ul]:mb-3 [&>li]:mb-1"
                {...createSafeHTML(selectedFAQ.content)}
              />
              
              {/* AI 상담사 질문하기 버튼 */}
              <div className="mt-8 pt-6 border-t border-gray-200">
                <div className="text-center">
                  <p className="text-sm text-gray-500 mb-3">추가 질문이 있으시다면</p>
                  <button
                    onClick={() => {
                      console.log('FAQ 모달에서 AI 상담사 연결');
                      closeFAQ();
                      router.push('/chat');
                    }}
                    className="inline-flex items-center justify-center px-4 py-2 text-sm font-medium text-blue-600 bg-blue-50 hover:bg-blue-100 hover:text-blue-700 rounded-lg transition-colors"
                  >
                    <MessageCircle className="w-4 h-4 mr-2" />
                    AI 상담사에게 질문하기 →
                  </button>
                </div>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};
