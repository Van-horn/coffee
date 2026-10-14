import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Typography from '@mui/material/Typography';
import AccentHeading, { Accent } from './AccentHeading';
import Eyebrow from './Eyebrow';
import Section from './Section';
import CheckIcon from './icons/CheckIcon';
import { SUBSCRIPTION } from '@/lib/catalog';
import { colors, radius } from '@/theme/tokens';

const focusRing = { outline: `3px solid ${colors.ink}`, outlineOffset: '3px' };

const CHECKLIST = [
  `${SUBSCRIPTION.bagsPerMonth} пачки по ${SUBSCRIPTION.weightG} г раз в месяц`,
  'Доставка по Минску бесплатно',
  'Вкусы выбираем вместе, можно менять',
] as const;

const PRICE_ROWS = [
  { label: `${SUBSCRIPTION.bagsPerMonth} пачки`, value: `${SUBSCRIPTION.bagsPerMonth} × ${SUBSCRIPTION.weightG} г` },
  { label: 'доставка', value: `${SUBSCRIPTION.deliveryBYN} BYN` },
  { label: 'обжарка', value: 'по четвергам' },
] as const;

export default function Subscription() {
  return (
    <Section id="subscription" tone="paper2" labelledBy="subscription-title">
      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: { xs: 'minmax(0, 1fr)', md: 'minmax(0, 1fr) minmax(0, 420px)' },
          columnGap: { md: '64px' },
          rowGap: { xs: '32px', sm: '40px' },
          alignItems: { xs: 'stretch', md: 'center' },
          // Tablet design (768) puts the card beside the text; 640-767 stays stacked.
          '@media (min-width: 768px) and (max-width: 1023.95px)': {
            gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 300px)',
            columnGap: '40px',
            alignItems: 'start',
          },
        }}
      >
        <Box sx={{ maxWidth: { md: 640 } }}>
          <Eyebrow>03 · подписка</Eyebrow>
          <Box sx={{ mt: '12px' }}>
            <AccentHeading id="subscription-title" tone="onPaper2">
              Кофе <Accent>приезжает сам</Accent>
            </AccentHeading>
          </Box>
          <Typography variant="bodyL" sx={{ mt: '24px', mb: 0, color: colors.ink }}>
            Раз в месяц к вам едут две пачки свежего кофе, доставка бесплатная. Какие зёрна взять, решаем вместе с
            менеджером по телефону.
          </Typography>
          <Box component="ul" sx={{ m: 0, mt: '24px', p: 0, listStyle: 'none', display: 'grid', gap: '14px' }}>
            {CHECKLIST.map((item) => (
              <Box key={item} component="li" sx={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <Box
                  aria-hidden="true"
                  sx={{
                    width: 24,
                    height: 24,
                    borderRadius: '50%',
                    bgcolor: colors.ink,
                    color: colors.paper,
                    display: 'grid',
                    placeItems: 'center',
                    flexShrink: 0,
                  }}
                >
                  <CheckIcon size={16} />
                </Box>
                <Typography variant="body1" sx={{ fontWeight: 500, color: colors.ink }}>
                  {item}
                </Typography>
              </Box>
            ))}
          </Box>
          <Button
            variant="contained"
            href="/?interest=subscription#order"
            sx={{
              mt: '28px',
              minHeight: 56,
              px: '24px',
              width: { xs: '100%', md: 'auto' },
              bgcolor: colors.ink,
              color: colors.paper,
              '&:hover': { bgcolor: colors.ink2 },
              '&:focus-visible': focusRing,
            }}
          >
            Оформить подписку
          </Button>
          <Typography variant="body2" sx={{ mt: '20px', mb: 0, color: colors.inkSoft }}>
            Паузы и отмену подписки менеджер объяснит по телефону.
          </Typography>
        </Box>
        <Box
          sx={{
            bgcolor: colors.card,
            borderRadius: `${radius.xl}px`,
            p: { xs: '20px', sm: '24px', md: '28px' },
            boxShadow: '0 1px 2px rgba(35, 26, 20, 0.06)',
            width: '100%',
            justifySelf: { md: 'end' },
          }}
        >
          <Box sx={{ display: 'flex', justifyContent: 'space-between', gap: '12px' }}>
            <Typography variant="eyebrow" sx={{ color: colors.inkSoft, textTransform: 'none' }}>
              подписка · месяц
            </Typography>
            <Typography variant="eyebrow" sx={{ color: colors.roastDeep, textTransform: 'none' }}>
              № 001
            </Typography>
          </Box>
          <Box sx={{ mt: '16px', display: 'flex', alignItems: 'baseline', gap: '8px' }}>
            <Typography variant="priceXL" sx={{ color: colors.ink }}>
              {SUBSCRIPTION.priceBYN} BYN
            </Typography>
            <Typography variant="body2" sx={{ fontWeight: 500, color: colors.inkSoft }}>
              / мес
            </Typography>
          </Box>
          <Box
            component="dl"
            sx={{ m: 0, mt: '20px', pt: '8px', borderTop: `1px solid ${colors.line}` }}
          >
            {PRICE_ROWS.map((row) => (
              <Box
                key={row.label}
                sx={{ display: 'flex', justifyContent: 'space-between', gap: '12px', py: '10px' }}
              >
                <Typography component="dt" variant="body1" sx={{ color: colors.inkSoft }}>
                  {row.label}
                </Typography>
                <Typography component="dd" variant="body1" sx={{ m: 0, fontWeight: 500, color: colors.ink }}>
                  {row.value}
                </Typography>
              </Box>
            ))}
          </Box>
        </Box>
      </Box>
    </Section>
  );
}
