'use client';

import type { User } from 'next-auth';
import type { UserType } from '@/app/(auth)/auth';
import { useRouter } from 'next/navigation';

import { PlusIcon } from '@/components/icons';
import { SidebarHistory } from '@/components/sidebar-history';
import { SidebarUserNav } from '@/components/sidebar-user-nav';
import { Button } from '@/components/ui/button';
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  useSidebar,
} from '@/components/ui/sidebar';
import Link from 'next/link';
import { Tooltip, TooltipContent, TooltipTrigger } from './ui/tooltip';

export function AppSidebar({ user }: { user: User | undefined }) {
  const router = useRouter();
  const { setOpenMobile } = useSidebar();

  return (
    <Sidebar className="group-data-[side=left]:border-r-0">
      <SidebarHeader>
        <SidebarMenu>
          <div className="flex flex-row justify-between items-center">
            <Link
              href="/"
              onClick={() => {
                setOpenMobile(false);
              }}
              className="flex flex-row gap-3 items-center"
            >
              <span className="text-lg font-semibold px-2 hover:bg-muted rounded-md cursor-pointer">
                미니학습지
              </span>
            </Link>
            {/* New Chat button removed for consultation service */}
          </div>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
        <div className="px-2 py-2 space-y-1">
          <Link
            href="/help"
            onClick={() => setOpenMobile(false)}
            className="flex items-center gap-3 px-3 py-2 text-sm text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-md transition-colors"
          >
            <span>📚</span>
            <span className="font-semibold">도움말 센터</span>
          </Link>
          <Link
            href="/chat"
            onClick={() => setOpenMobile(false)}
            className="flex items-center gap-3 px-3 py-2 text-sm text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-md transition-colors"
          >
            <span>💬</span>
            <span className="font-semibold">무엇이든 물어보세요</span>
          </Link>
        </div>
        <SidebarHistory user={user} />
      </SidebarContent>
      <SidebarFooter>
        <SidebarUserNav user={user || { id: '', email: '', name: 'Guest', type: 'guest' }} />
      </SidebarFooter>
    </Sidebar>
  );
}
