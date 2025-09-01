import { auth } from '@/app/(auth)/auth';
import { AppSidebar } from '@/components/app-sidebar';
import { SidebarInset, SidebarProvider } from '@/components/ui/sidebar';
import { FloatingInput } from '@/components/floating-input';

export default async function HelpLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();

  return (
    <SidebarProvider>
      <AppSidebar user={session?.user} />
      <SidebarInset>
        <div className="flex flex-1 flex-col">
          {/* 모바일 헤더는 제거 - 사이드바 항상 표시 */}
          {children}
        </div>
      </SidebarInset>
      <FloatingInput />
    </SidebarProvider>
  );
}
