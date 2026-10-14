import type { Metadata, Viewport } from 'next';
import { Roboto } from 'next/font/google';
import { AttributionCapture } from '@/components/AttributionCapture';
import SkipLink from '@/components/SkipLink';
import { SITE_URL } from '@/lib/site';
import ThemeRegistry from '@/theme/registry';
import { colors } from '@/theme/tokens';
import './globals.css';

const roboto = Roboto({
  variable: '--font-roboto',
  subsets: ['cyrillic', 'latin'],
  style: ['normal', 'italic'],
  display: 'swap',
});

const TITLE = 'Кварта — свежеобжаренный кофе в Минске';
const DESCRIPTION =
  'Обжариваем кофе партиями по 5 кг по четвергам, в пятницу привозим по Минску. Пачка 250 г от 26 BYN, заказ до среды 20:00.';

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: colors.paper,
};

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: { default: TITLE, template: '%s — Кварта' },
  description: DESCRIPTION,
  applicationName: 'Кварта',
  alternates: { canonical: '/' },
  robots: { index: true, follow: true },
  openGraph: {
    type: 'website',
    locale: 'ru_RU',
    siteName: 'Кварта',
    title: TITLE,
    description: DESCRIPTION,
    url: '/',
  },
  twitter: { card: 'summary_large_image', title: TITLE, description: DESCRIPTION },
};

export default function RootLayout({ children }: LayoutProps<'/'>) {
  return (
    <html
      lang="ru"
      className={roboto.variable}
    >
      <body>
        <ThemeRegistry>
          <SkipLink />
          {children}
        </ThemeRegistry>
        <AttributionCapture />
      </body>
    </html>
  );
}
