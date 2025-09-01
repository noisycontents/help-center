'use client';

import type { ComponentProps } from 'react';
import Link from 'next/link';

import { type SidebarTrigger, useSidebar } from '@/components/ui/sidebar';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';

import { SidebarLeftIcon } from './icons';
import { Button } from './ui/button';
import { MessageCircle, HelpCircle } from 'lucide-react';

export function SidebarToggle({
  className,
}: ComponentProps<typeof SidebarTrigger>) {
  const { toggleSidebar } = useSidebar();

  return (
    <div className="flex items-center justify-between w-full">
      <div className="flex items-center gap-2">
        {/* 모바일에서만 토글 버튼 표시 */}
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              data-testid="sidebar-toggle-button"
              onClick={toggleSidebar}
              variant="outline"
              className="md:hidden px-2 h-fit"
            >
              <SidebarLeftIcon size={16} />
            </Button>
          </TooltipTrigger>
          <TooltipContent align="start">메뉴</TooltipContent>
        </Tooltip>

        {/* 모바일에서만 도움말 버튼 표시 */}
        <div className="md:hidden">
          <Link href="/help">
            <Button variant="ghost" size="sm" className="text-sm">
              도움말
            </Button>
          </Link>
        </div>
      </div>

      {/* 모바일에서만 채팅 버튼을 오른쪽 끝에 표시 */}
      <div className="md:hidden">
        <Link href="/chat">
          <Button variant="ghost" size="sm">
            <MessageCircle size={16} />
          </Button>
        </Link>
      </div>
    </div>
  );
}
