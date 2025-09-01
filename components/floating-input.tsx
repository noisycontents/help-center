'use client';

import { useState, useRef } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { 
  PromptInput, 
  PromptInputTextarea, 
  PromptInputToolbar, 
  PromptInputSubmit 
} from './elements/prompt-input';

interface FloatingInputProps {
  context?: {
    category?: string;
    path?: string;
  };
}

export const FloatingInput = ({ context }: FloatingInputProps) => {
  const [input, setInput] = useState('');
  const [isMultiline, setIsMultiline] = useState(false);
  const router = useRouter();
  const pathname = usePathname();
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim()) return;

    // 현재 도움말 맥락 정보 추가
    let finalQuestion = input.trim();
    
    if (context?.category) {
      finalQuestion = `[${context.category} 관련 문의] ${finalQuestion}`;
    } else if (pathname.includes('/help/')) {
      // URL에서 카테고리 추출
      const categoryMap: Record<string, string> = {
        'error': '오류 해결',
        'course': '수강 안내',
        'app': '더노트 앱',
        'purchase': '구매 문의',
        'refund': '환불 안내',
        'shipping': '배송 문의',
        'certificate': '수강증명서',
        'payment': '결제 문의',
      };
      
      const category = pathname.split('/help/')[1];
      if (category && categoryMap[category]) {
        finalQuestion = `[${categoryMap[category]} 관련 문의] ${finalQuestion}`;
      }
    }

    // 질문을 URL 파라미터로 전달하여 새로운 채팅 페이지로 이동
    const encodedQuestion = encodeURIComponent(finalQuestion);
    router.push(`/chat?q=${encodedQuestion}`);
  };

  const handleInput = (event: React.ChangeEvent<HTMLTextAreaElement>) => {
    const value = event.target.value;
    setInput(value);
    
    // 줄바꿈이 있거나 텍스트가 길면 멀티라인으로 처리
    const lineCount = value.split('\n').length;
    setIsMultiline(lineCount > 1);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 bg-white md:left-64">
      <div className="max-w-3xl mx-auto p-4">
        <PromptInput 
          className="border border-transparent transition-all duration-200 hover:border-primary/20 focus-within:border-primary/30"
          onSubmit={handleSubmit}
        >
          <PromptInputTextarea
            ref={textareaRef}
            placeholder="무엇이든 물어보세요..."
            value={input}
            onChange={handleInput}
            onKeyDown={handleKeyDown}
            minHeight={48}
            maxHeight={200}
            disableAutoResize={false}
            className="text-sm [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]"
            rows={1}
          />
          <PromptInputToolbar className={isMultiline ? "items-end" : "items-center"}>
            <PromptInputSubmit
              disabled={!input.trim()}
              className="bg-primary hover:bg-primary/90 text-primary-foreground size-8"
              size="sm"
            />
          </PromptInputToolbar>
        </PromptInput>
      </div>
    </div>
  );
};
