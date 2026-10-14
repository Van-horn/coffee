import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import AccentHeading, { Accent } from './AccentHeading';
import Eyebrow from './Eyebrow';
import RoasterPlaceholder from './RoasterPlaceholder';
import Section from './Section';
import { colors, radius } from '@/theme/tokens';

// Open item: replace RoasterPlaceholder with a licensed photo at public/images/roastery.jpg (next/image).
export default function About() {
  return (
    <Section id="about" tone="paper2" labelledBy="about-title">
      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: { xs: 'minmax(0, 1fr)', md: 'minmax(0, 520fr) minmax(0, 640fr)' },
          columnGap: { md: '80px' },
          rowGap: { xs: '32px', sm: '40px' },
          alignItems: 'center',
        }}
      >
        <Box
          sx={{
            position: 'relative',
            width: '100%',
            aspectRatio: { xs: '350 / 340', sm: '688 / 420', md: '520 / 460' },
            borderRadius: `${radius.xl}px`,
            overflow: 'hidden',
            bgcolor: colors.ink2,
          }}
        >
          <RoasterPlaceholder />
          <Box
            sx={{
              position: 'absolute',
              left: { xs: 16, sm: 16 },
              bottom: 16,
              maxWidth: 'calc(100% - 32px)',
              bgcolor: colors.card,
              borderRadius: `${radius.lg}px`,
              px: '14px',
              py: '10px',
            }}
          >
            <Typography variant="eyebrow" sx={{ display: 'block', color: colors.roastDeep }}>
              мастерская
            </Typography>
            <Typography variant="body2" sx={{ m: 0, fontWeight: 500, color: colors.ink }}>
              Обжариваем партиями по 5 кг
            </Typography>
          </Box>
        </Box>
        <Box>
          <Eyebrow>05 · о нас</Eyebrow>
          <Box sx={{ mt: '12px' }}>
            <AccentHeading id="about-title" tone="onPaper2">
              Мы — <Accent>Аня и Дмитрий</Accent>
            </AccentHeading>
          </Box>
          <Typography variant="bodyL" sx={{ mt: '24px', mb: 0, color: colors.ink }}>
            Раньше мы стояли за баром и видели, как быстро кофе стареет на полке. С 2019 года жарим сами: небольшими
            партиями по 5 кг, по четвергам.
          </Typography>
          <Typography variant="body1" sx={{ mt: '16px', mb: 0, color: colors.inkSoft }}>
            В пятницу развозим по Минску сами. Никаких складов и посредников: от обжарки до вашей кухни проходит 1–3
            дня.
          </Typography>
          <Typography
            component="p"
            sx={{ mt: '24px', mb: 0, fontSize: 24, lineHeight: '30px', fontStyle: 'italic', color: colors.roastDeep }}
          >
            Аня и Дмитрий
          </Typography>
        </Box>
      </Box>
    </Section>
  );
}
