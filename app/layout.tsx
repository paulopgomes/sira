import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-sans',
});

export const metadata: Metadata = {
  title: 'SIRA - Sistema Integrado de Registro de Atendimentos',
  description: 'Sistema institucional para gestão e registro de atendimentos de saúde e assistência social.',
  manifest: '/manifest.json',
  themeColor: '#ed1c24',
  icons: {
    icon: '/logo.svg',
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" className={inter.variable} suppressHydrationWarning>
      <body className="bg-[#faf9fb] text-[#1a1c1d] antialiased font-sans" suppressHydrationWarning>
        {children}
      </body>
    </html>
  );
}
