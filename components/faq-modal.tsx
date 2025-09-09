'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X } from 'lucide-react';
import { createSafeHTML } from '@/lib/html-utils';

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
            className="fixed inset-4 md:inset-8 lg:inset-16 xl:inset-24 w-auto max-w-4xl max-h-[85vh] mx-auto my-auto bg-white rounded-xl shadow-2xl z-50 flex flex-col"
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
            <div className="flex items-start justify-between p-6 border-b">
              <div className="flex-1 pr-4">
                <div className="flex items-center gap-2 mb-2">
                  <span className="inline-flex items-center px-2 py-1 rounded-md text-xs font-medium bg-blue-100 text-blue-800">
                    {selectedFAQ.tag}
                  </span>
                </div>
                <h2 id="faq-modal-title" className="text-xl font-semibold text-gray-900">
                  {selectedFAQ.question}
                </h2>
              </div>
              <button
                onClick={closeFAQ}
                className="flex-shrink-0 p-2 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* 내용 */}
            <div className="flex-1 overflow-y-auto p-6">
              <div 
                className="prose prose-sm max-w-none text-gray-700 leading-relaxed [&>p]:mb-3 [&>ol]:mb-3 [&>ul]:mb-3 [&>li]:mb-1"
                {...createSafeHTML(selectedFAQ.content)}
              />
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};
