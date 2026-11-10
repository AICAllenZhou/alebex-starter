import { Suspense } from 'react';
import CallPage from '@/components/call/CallPage';

export const metadata = {
  title: '语音通话测试 — Alebex Demo Studio',
  description: '开始和结束一次语音通话。',
};

export default function Page() {
  return (
    <Suspense fallback={
      <main className="mx-auto flex min-h-screen max-w-xl items-center justify-center px-6">
        <p className="text-stone-600">正在加载…</p>
      </main>
    }>
      <CallPage />
    </Suspense>
  );
}
