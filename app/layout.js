export const metadata = {
  title: 'Alebex agent — tools',
  description: 'Custom tools and the end-of-call webhook for an Alebex voice agent.',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>
        {children}
        <style>{`
          :root { color-scheme: dark; }
          * { box-sizing: border-box; }
          body {
            margin: 0;
            padding: 48px 16px;
            background: #02080b;
            color: #f4f7fa;
            font: 16px/1.6 ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif;
          }
          main { max-width: 720px; margin: 0 auto; }
          h1 { font-size: 28px; font-weight: 500; letter-spacing: -0.02em; margin: 0 0 8px; }
          h2 { font-size: 14px; font-weight: 500; text-transform: uppercase;
               letter-spacing: 0.08em; color: rgba(244,247,250,.5); margin: 40px 0 12px; }
          p { color: rgba(244,247,250,.7); margin: 0 0 16px; }
          code { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 14px; }
          ul { list-style: none; padding: 0; margin: 0; }
          li { border: 1px solid rgba(255,255,255,.12); border-radius: 10px;
               padding: 14px 16px; margin-bottom: 10px; }
          .row { display: flex; align-items: center; justify-content: space-between; gap: 12px; flex-wrap: wrap; }
          .muted { color: rgba(244,247,250,.5); font-size: 14px; }
          .ok { color: #8edcff; }
          .missing { color: #ffb07c; }
          a { color: #8edcff; }
        `}</style>
      </body>
    </html>
  );
}
