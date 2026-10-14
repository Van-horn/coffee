import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Link from '@mui/material/Link';
import Typography from '@mui/material/Typography';
import AccentHeading, { Accent } from './AccentHeading';
import Eyebrow from './Eyebrow';
import MapTile from './MapTile';
import OpenNow, { TodayChip } from './OpenNow';
import Section from './Section';
import TruckIcon from './icons/TruckIcon';
import { FREE_DELIVERY_FROM_BYN } from '@/lib/catalog';
import { CONTACT } from '@/lib/contact';
import { colors, radius } from '@/theme/tokens';

const focusRing = { outline: `3px solid ${colors.ink}`, outlineOffset: '3px' };

const cardSx = {
  bgcolor: colors.card,
  borderRadius: `${radius.xl}px`,
  overflow: 'hidden',
  display: 'flex',
  flexDirection: 'column',
} as const;

const HOURS = [
  { group: 'weekdays', days: 'Пн–Пт', time: '08:00–20:00' },
  { group: 'weekend', days: 'Сб–Вс', time: '10:00–18:00' },
] as const;

export default function Delivery() {
  return (
    <Section id="delivery" tone="paper" labelledBy="delivery-title">
      <Eyebrow>04 · доставка и самовывоз</Eyebrow>
      <Box sx={{ mt: '12px' }}>
        <AccentHeading id="delivery-title">
          Привезём <Accent>в пятницу</Accent> или ждём в мастерской
        </AccentHeading>
      </Box>
      <Box
        sx={{
          mt: { xs: '32px', md: '48px' },
          display: 'grid',
          gridTemplateColumns: { xs: 'minmax(0, 1fr)', md: 'repeat(2, minmax(0, 1fr))' },
          gap: { xs: '20px', md: '24px' },
          alignItems: 'stretch',
        }}
      >
        <Box sx={{ ...cardSx, p: { xs: '20px', sm: '32px' }, gap: '16px' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <Box
              aria-hidden="true"
              sx={{
                width: 42,
                height: 42,
                borderRadius: '50%',
                bgcolor: colors.yolk,
                color: colors.ink,
                display: 'grid',
                placeItems: 'center',
                flexShrink: 0,
              }}
            >
              <TruckIcon size={20} />
            </Box>
            <Typography variant="eyebrow" sx={{ color: colors.inkSoft, textTransform: 'none' }}>
              Доставка по Минску
            </Typography>
          </Box>
          <Typography variant="h3" component="h3" sx={{ m: 0 }}>
            По пятницам
          </Typography>
          <Typography variant="body1" sx={{ m: 0, color: colors.inkSoft }}>
            В четверг обжариваем, в пятницу развозим. Вы получаете свежее зерно на следующий день.
          </Typography>
          <Box sx={{ bgcolor: colors.paper2, borderRadius: `${radius.lg}px`, p: '16px' }}>
            <Typography variant="price" sx={{ m: 0, color: colors.ink }}>
              от {FREE_DELIVERY_FROM_BYN} BYN
            </Typography>
            <Typography variant="body2" sx={{ m: 0, mt: '4px', fontWeight: 500, color: colors.inkSoft }}>
              доставка бесплатно
            </Typography>
          </Box>
          <Typography variant="body2" sx={{ m: 0, color: colors.inkSoft }}>
            Меньше {FREE_DELIVERY_FROM_BYN} BYN: стоимость назовёт менеджер при звонке.
          </Typography>
          <Typography variant="body2" sx={{ m: 0, color: colors.inkSoft }}>
            Заявки на пятничную доставку принимаем до среды, 20:00.
          </Typography>
        </Box>

        <Box sx={cardSx}>
          <MapTile />
          <Box sx={{ p: { xs: '20px', sm: '32px' }, display: 'flex', flexDirection: 'column', gap: '12px', flexGrow: 1 }}>
            <Typography variant="eyebrow" sx={{ color: colors.inkSoft, textTransform: 'none' }}>
              Самовывоз
            </Typography>
            <Typography variant="h3" component="h3" sx={{ m: 0 }}>
              {CONTACT.address}
            </Typography>
            <OpenNow />
            <Box component="dl" sx={{ m: 0, mt: '4px', borderTop: `1px solid ${colors.line}` }}>
              {HOURS.map((row) => (
                <Box
                  key={row.group}
                  sx={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    gap: '12px',
                    minHeight: 52,
                    borderBottom: `1px solid ${colors.line}`,
                  }}
                >
                  <Box component="dt" sx={{ display: 'flex', alignItems: 'center' }}>
                    <Typography variant="body1" component="span" sx={{ fontWeight: 500 }}>
                      {row.days}
                    </Typography>
                    <TodayChip group={row.group} />
                  </Box>
                  <Typography variant="body2" component="dd" sx={{ m: 0, color: colors.ink }}>
                    {row.time}
                  </Typography>
                </Box>
              ))}
            </Box>
            <Box
              sx={{
                mt: '8px',
                display: 'flex',
                flexDirection: { xs: 'column', sm: 'row' },
                flexWrap: 'wrap',
                alignItems: { xs: 'stretch', sm: 'center' },
                columnGap: '24px',
                rowGap: '8px',
              }}
            >
              <Button
                variant="outlined"
                href={CONTACT.mapUrl}
                target="_blank"
                rel="noopener noreferrer"
                sx={{
                  minHeight: 48,
                  whiteSpace: 'nowrap',
                  color: colors.ink,
                  borderColor: colors.ink,
                  '&:focus-visible': focusRing,
                }}
              >
                Построить маршрут
                <Box component="span" sx={visuallyHidden}>
                  {' '}
                  (откроется в новой вкладке)
                </Box>
              </Button>
              <Link
                href={CONTACT.phoneHref}
                underline="always"
                sx={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: { xs: 'center', sm: 'flex-start' },
                  minHeight: 44,
                  whiteSpace: 'nowrap',
                  color: colors.ink,
                  fontWeight: 500,
                  '&:focus-visible': focusRing,
                }}
              >
                Позвонить: {CONTACT.phoneDisplay}
              </Link>
            </Box>
          </Box>
        </Box>
      </Box>
    </Section>
  );
}

const visuallyHidden = {
  position: 'absolute',
  width: 1,
  height: 1,
  p: 0,
  m: '-1px',
  overflow: 'hidden',
  clip: 'rect(0 0 0 0)',
  whiteSpace: 'nowrap',
  border: 0,
} as const;
