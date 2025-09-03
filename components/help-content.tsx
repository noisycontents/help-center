'use client';

import { FAQCategories } from './faq-categories';

interface HelpContentProps {
  category?: string;
}

export const HelpContent = ({ category }: HelpContentProps) => {
  return (
    <div className="flex flex-1 flex-col h-full">
      {/* FAQ 카테고리만 표시 - 헤더나 탭 없이 */}
      <div className="flex-1 overflow-y-auto">
        <FAQCategories 
          selectedCategory={category}
        />
      </div>
    </div>
  );
};
