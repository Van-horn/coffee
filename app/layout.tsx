import type { Metadata } from 'next';
import { Literata, Onest, JetBrains_Mono } from 'next/font/google';
import ThemeRegistry from '@/theme/registry';

const literata = Literata({
  variable: '--font-literata',
  subsets: ['cyrillic', 'latin'],
  display: 'swap',
});

const onest = Onest({
  variable: '--font-onest',
  subsets: ['cyrillic', 'latin'],
  display: 'swap',
});

const jetbrains = JetBrains_Mono({
  variable: '--font-jetbrains',
  subsets: ['cyrillic', 'latin'],
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
      className={`${literata.variable} ${onest.variable} ${jetbrains.variable}`}
    >
      <body>
        <ThemeRegistry>{children}</ThemeRegistry>
      </body>
    </html>
  );
}
