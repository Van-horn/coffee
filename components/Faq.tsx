import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import AccentHeading, { Accent } from '@/components/AccentHeading';
import Eyebrow from '@/components/Eyebrow';
import Section, { wide } from '@/components/Section';
import { colors } from '@/theme/tokens';

const ITEMS = [
  {
    q: 'Какой помол выбрать?',
    a: 'Продаём зерном и можем смолоть. Скажите менеджеру, на чём заваривайте: турка, воронка, френч-пресс, капельная кофеварка или эспрессо-машина. Подберём помол и отметим в заявке.',
  },
  {
    q: 'Как хранить зерно?',
    a: 'В закрытой упаковке или банке, в тёмном сухом месте, не в холодильнике. Лучше всего зерно раскрывается в первые 3–4 недели после обжарки.',
  },
  {
    q: 'Как вы измеряете свежесть?',
    a: 'Мы не обещаем её, а показываем: на каждой пачке стоит дата обжарки. Жарим по четвергам, привозим в пятницу, так что к вам зерно приходит на 1–3-й день.',
  },
  {
    q: 'Как отменить или поставить подписку на паузу?',
    a: 'Позвоните или напишите менеджеру до среды, 20:00: на ближайшую обжарку вас не включим. Платить заранее не нужно, штрафов нет.',
  },
] as const;

export default function Faq() {
  return (
    <Section id="faq" tone="paper" labelledBy="faq-title">
      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: { xs: '1fr', md: '4fr 7fr' },
          columnGap: { xs: 8, md: wide(64, 0.06, 128) },
          rowGap: { xs: 4, md: 0 },
          alignItems: 'start',
        }}
      >
        <Box>
          <Eyebrow>вопросы</Eyebrow>
          <Box sx={{ mt: 2 }}>
            <AccentHeading id="faq-title">
              Что обычно <Accent>спрашивают</Accent>
            </AccentHeading>
          </Box>
        </Box>
        <Box sx={{ borderBottom: `1px solid ${colors.line}` }}>
          {ITEMS.map((item, i) => (
            <Box
              component="details"
              key={item.q}
              sx={{
                borderTop: `1px solid ${colors.line}`,
                '& > summary': {
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: 2,
                  minHeight: 56,
                  py: 1,
                  cursor: 'pointer',
                  listStyle: 'none',
                  fontSize: 18,
                  lineHeight: '26px',
                  fontWeight: 500,
                  color: colors.ink,
                  '&::-webkit-details-marker': { display: 'none' },
                  '&::marker': { content: '""' },
                  '&::after': {
                    content: '"+"',
                    flex: 'none',
                    width: 24,
                    textAlign: 'center',
                    fontSize: 24,
                    lineHeight: '24px',
                    fontWeight: 400,
                    color: colors.roastDeep,
                  },
                  '&:focus-visible': { outline: `3px solid ${colors.ink}`, outlineOffset: '-3px' },
                  '&:hover': { color: colors.roastDeep },
                },
                '&[open] > summary::after': { content: '"\\2212"' },
                '@media (prefers-reduced-motion: no-preference)': {
                  '&[open] > .faq-answer': { animation: 'faqIn 200ms ease-out' },
                  '@keyframes faqIn': {
                    from: { opacity: 0, transform: 'translateY(-4px)' },
                    to: { opacity: 1, transform: 'none' },
                  },
                },
              }}
            >
              <summary id={`faq-q-${i + 1}`}>{item.q}</summary>
              <Box
                className="faq-answer"
                role="region"
                aria-labelledby={`faq-q-${i + 1}`}
                sx={{ pb: 3, pr: { md: 5 } }}
              >
                <Typography variant="body1" sx={{ color: colors.inkSoft, maxWidth: { xs: 640, md: wide(640, 0.07, 760) } }}>
                  {item.a}
                </Typography>
              </Box>
            </Box>
          ))}
        </Box>
      </Box>
    </Section>
  );
}
