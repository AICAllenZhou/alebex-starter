import './globals.css';

export const metadata = {
  title: '语音通话测试 — Alebex Demo Studio',
  description: 'Alebex Demo Studio 云端试跑：开始和结束一次语音通话。',
};

export default function RootLayout({ children }) {
  return (
    <html lang="zh-CN">
      <body className="min-h-screen bg-[#f7f3ee] text-[#1c1917] antialiased">
        {children}
      </body>
    </html>
  );
}
