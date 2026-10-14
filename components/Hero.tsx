import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Typography from '@mui/material/Typography';
import BagIllustration from './BagIllustration';
import RoastDate from './RoastDate';
import Section, { wide } from './Section';
import { colors } from '@/theme/tokens';

const STATS = [
  { value: '5 кг', label: 'партия за раз' },
  { value: 'с 2019', label: 'жарим в Минске' },
  { value: '1–3 дня', label: 'от обжарки до вас' },
] as const;

const focusRing = { outline: `3px solid ${colors.ink}`, outlineOffset: '3px' };

export default function Hero() {
  return (
    <Section
      tone="paper"
      labelledBy="hero-title"
      sx={{ pt: { xs: 5, sm: 8, md: 9 }, pb: { xs: 8, sm: 10, md: 15 } }}
    >
      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: { xs: 'minmax(0, 1fr)', md: 'minmax(0, 640fr) minmax(0, 469fr)' },
          alignItems: 'center',
          columnGap: { xs: '48px', md: wide(48, 0.05, 96) },
          rowGap: { xs: '40px', sm: '56px' },
        }}
      >
        <Box>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Box
              aria-hidden="true"
              sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: colors.roast, flexShrink: 0 }}
            />
            <Typography variant="eyebrow" sx={{ color: colors.ink }}>
              обжариваем по четвергам
            </Typography>
          </Box>
          <Typography
            variant="hero"
            component="h1"
            id="hero-title"
            sx={{ mt: { xs: '20px', md: '24px' }, mb: 0, color: colors.ink }}
          >
            Кофе, обжаренный в четверг. У вас —{' '}
            <Box component="span" sx={{ whiteSpace: 'nowrap' }}>
              <Box
                component="em"
                sx={{ fontStyle: 'italic', fontWeight: 400, color: colors.roast }}
              >
                в пятницу
              </Box>
              .
            </Box>
          </Typography>
          <Typography
            variant="bodyL"
            sx={{ mt: { xs: '24px', md: '32px' }, mb: 0, color: colors.inkSoft, maxWidth: { xs: 640, md: wide(640, 0.07, 720) } }}
          >
            Небольшая обжарка в Минске. Жарим партиями по 5 кг и привозим зерно на 1–3-й день после
            обжарки, пока оно пахнет так, как задумано.
          </Typography>
          <Box
            sx={{
              mt: '32px',
              display: 'flex',
              flexDirection: { xs: 'column', sm: 'row' },
              gap: { xs: '12px', sm: '16px' },
            }}
          >
            <Button
              variant="contained"
              href="/?interest=subscription#order"
              sx={{ minHeight: 56, px: '24px', '&:focus-visible': focusRing }}
            >
              Оформить подписку
            </Button>
            <Button
              variant="outlined"
              href="#range"
              sx={{ minHeight: 56, px: '24px', '&:focus-visible': focusRing }}
            >
              Выбрать кофе
            </Button>
          </Box>
          <Typography variant="body2" sx={{ mt: '24px', mb: 0, color: colors.inkSoft }}>
            Менеджер перезвонит и всё оформит. Платить на сайте не нужно.
          </Typography>
          <Box
            component="dl"
            sx={{
              m: 0,
              mt: { xs: '32px', md: '48px' },
              display: 'grid',
              gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
              columnGap: { xs: '12px', md: wide(32, 0.03, 56) },
            }}
          >
            {STATS.map((s) => (
              <Box key={s.value} sx={{ borderTop: `1px solid ${colors.line}`, pt: '16px' }}>
                <Box
                  component="dt"
                  sx={{ fontSize: { xs: 20, md: 22 }, lineHeight: '28px', fontWeight: 500 }}
                >
                  {s.value}
                </Box>
                <Box
                  component="dd"
                  sx={{ m: 0, mt: '4px', fontSize: { xs: 13, sm: 14 }, lineHeight: '22px', color: colors.inkSoft }}
                >
                  {s.label}
                </Box>
              </Box>
            ))}
          </Box>
        </Box>
        <Box sx={{ justifySelf: { xs: 'stretch', md: 'end' }, width: '100%', display: 'flex', justifyContent: { md: 'flex-end' } }}>
          <BagIllustration dateSlot={<RoastDate />} />
        </Box>
      </Box>
    </Section>
  );
}
