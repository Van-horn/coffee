import type { Metadata } from 'next';
import { Roboto } from 'next/font/google';
import ThemeRegistry from '@/theme/registry';

const roboto = Roboto({
  variable: '--font-roboto',
  subsets: ['cyrillic', 'latin'],
  weight: ['400', '500'],
  style: ['normal', 'italic'],
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'Кварта',
  description: 'Обжарочная Кварта: свежий кофе, обжарка по четвергам.',
};

export default function RootLayout({ children }: LayoutProps<'/'>) {
  return (
    <html
      lang="ru"
      className={roboto.variable}
    >
      <body>
        <ThemeRegistry>{children}</ThemeRegistry>
      </body>
    </html>
  );
}
