import type { Metadata } from 'next';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import type { ReactNode } from 'react';
import Logo from '@/components/Logo';
import { CONTACT } from '@/lib/contact';
import { colors } from '@/theme/tokens';

export const metadata: Metadata = {
  title: 'Политика обработки данных',
  robots: { index: true },
};

const SECTIONS: { title: string; body: ReactNode }[] = [
  {
    title: 'Какие данные мы собираем',
    body: (
      <>
        Из формы заявки: имя, телефон и комментарий. Технические данные: страница и источник перехода, метки
        рекламной кампании. Заявка попадает менеджеру в закрытый Telegram-канал, куда пишет только наш бот; доступ к
        каналу есть только у сотрудников Кварты.
      </>
    ),
  },
  {
    title: 'Зачем',
    body: <>Чтобы перезвонить и оформить заказ или подписку, ответить на вопрос и оценить, какая реклама приводит заявки.</>,
  },
  { title: 'Как долго храним', body: <>До 12 месяцев, затем удаляем.</> },
  {
    title: 'Кому передаём',
    body: <>Не передаём третьим лицам. Заявки приходят менеджеру в рабочий чат.</>,
  },
  {
    title: 'Ваши права',
    body: (
      <>
        Вы можете попросить показать, исправить или удалить свои данные: напишите на {CONTACT.telegramHandle} или
        позвоните по номеру {CONTACT.phoneDisplay}.
      </>
    ),
  },
];

const linkSx = {
  display: 'inline-flex',
  alignItems: 'center',
  minHeight: 44,
  color: colors.roastDeep,
  borderRadius: '6px',
  '&:focus-visible': { outline: `3px solid ${colors.ink}`, outlineOffset: '2px' },
} as const;

export default function PrivacyPage() {
  return (
    <Box component="main" id="main" tabIndex={-1} sx={{ bgcolor: colors.paper, color: colors.ink, minHeight: '100vh', py: { xs: 3, md: 5 } }}>
      <Box sx={{ maxWidth: 680, mx: 'auto', px: { xs: 2.5, sm: 5 } }}>
        <Logo />
        <Typography variant="h2" component="h1" sx={{ mt: { xs: 5, md: 7 }, mb: 4 }}>
          Политика обработки данных
        </Typography>
        {SECTIONS.map((s, i) => (
          <Box component="section" key={s.title} aria-labelledby={`privacy-${i}`} sx={{ mb: 4 }}>
            <Typography variant="h3" component="h2" id={`privacy-${i}`} sx={{ mb: 1 }}>
              {s.title}
            </Typography>
            <Typography variant="body1" sx={{ color: colors.inkSoft, m: 0 }}>
              {s.body}
            </Typography>
          </Box>
        ))}
        <Typography variant="body2" sx={{ color: colors.inkSoft, mt: 5, mb: 3 }}>
          Редакция от 14 октября 2026. Формулировки нужно проверить на соответствие Закону Республики Беларусь № 99-З
          «О защите персональных данных» перед запуском.
        </Typography>
        <Box component="a" href="/" sx={linkSx}>
          На главную
        </Box>
      </Box>
    </Box>
  );
}
