import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import AccentHeading, { Accent } from '@/components/AccentHeading';
import Eyebrow from '@/components/Eyebrow';
import LeadForm from '@/components/LeadForm';
import Section from '@/components/Section';
import CheckIcon from '@/components/icons/CheckIcon';
import { colors, radius } from '@/theme/tokens';

const CHECKLIST = [
  'Ответим в рабочее время: пн–пт 8–20, сб–вс 10–18',
  'Платить на сайте не нужно',
  'Данные нужны только для связи по заявке',
];

const STEPS = [
  'Вы отправляете заявку',
  'Менеджер перезвонит и уточнит помол и адрес',
  'Жарим в четверг, привозим в пятницу',
];

export default function OrderSection() {
  return (
    <Section id="order" tone="ink" labelledBy="order-title">
      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: { xs: 'minmax(0, 1fr)', md: 'minmax(0, 8fr) minmax(0, 11fr)' },
          columnGap: { md: 6, lg: 10 },
          rowGap: { xs: 5, sm: 6 },
          alignItems: 'start',
        }}
      >
        <Box sx={{ minWidth: 0 }}>
          <Eyebrow tone="onInk">06 · заявка</Eyebrow>
          <Box sx={{ mt: 2 }}>
            <AccentHeading id="order-title" tone="onInk">
              Оставьте заявку, <Accent>мы перезвоним</Accent>
            </AccentHeading>
          </Box>
          <Typography variant="bodyL" sx={{ color: colors.paperDim, mt: 3, mb: 0 }}>
            Укажите телефон. Менеджер перезвонит в рабочее время и всё оформит: подписку или разовый заказ.
          </Typography>

          <Box component="ul" sx={{ listStyle: 'none', m: 0, mt: 4, p: 0, display: 'grid', gap: 1.5 }}>
            {CHECKLIST.map((item) => (
              <Box key={item} component="li" sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                <Box
                  component="span"
                  sx={{
                    width: 24,
                    height: 24,
                    flexShrink: 0,
                    borderRadius: '50%',
                    bgcolor: colors.ink2,
                    color: colors.yolk,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <CheckIcon size={16} />
                </Box>
                <Typography variant="body1" sx={{ color: colors.paper, m: 0 }}>
                  {item}
                </Typography>
              </Box>
            ))}
          </Box>

          <Box sx={{ bgcolor: colors.ink2, borderRadius: `${radius.lg}px`, p: { xs: 2.5, sm: 3 }, mt: 5 }}>
            <Eyebrow tone="onInk">что будет дальше</Eyebrow>
            <Box component="ol" sx={{ listStyle: 'none', m: 0, mt: 2, p: 0, display: 'grid', gap: 2 }}>
              {STEPS.map((step, index) => (
                <Box key={step} component="li" sx={{ display: 'flex', alignItems: 'flex-start', gap: 1.5 }}>
                  <Box
                    component="span"
                    aria-hidden="true"
                    sx={{
                      width: 28,
                      height: 28,
                      flexShrink: 0,
                      borderRadius: '50%',
                      bgcolor: colors.yolk,
                      color: colors.ink,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: 14,
                      fontWeight: 500,
                    }}
                  >
                    {index + 1}
                  </Box>
                  <Typography variant="body1" sx={{ color: colors.paper, m: 0, pt: '1px' }}>
                    {step}
                  </Typography>
                </Box>
              ))}
            </Box>
          </Box>
        </Box>

        <LeadForm />
      </Box>
    </Section>
  );
}
