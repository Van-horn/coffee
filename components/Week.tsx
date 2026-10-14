import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import type { ReactNode } from 'react';
import AccentHeading, { Accent } from './AccentHeading';
import Eyebrow from './Eyebrow';
import FlameIcon from './icons/FlameIcon';
import PinIcon from './icons/PinIcon';
import TruckIcon from './icons/TruckIcon';
import NextRoast from './NextRoast';
import Section, { wide } from './Section';
import { CONTACT } from '@/lib/contact';
import { colors, radius } from '@/theme/tokens';

type TileKind = 'dim' | 'roast' | 'yolk' | 'outline';

interface Day {
  short: string;
  full: string;
  kind: TileKind;
  label: string;
}

const DAYS: readonly Day[] = [
  { short: 'ПН', full: 'Понедельник', kind: 'dim', label: 'заказы' },
  { short: 'ВТ', full: 'Вторник', kind: 'dim', label: 'заказы' },
  { short: 'СР', full: 'Среда', kind: 'dim', label: 'заказы до 20:00' },
  { short: 'ЧТ', full: 'Четверг', kind: 'roast', label: 'обжарка' },
  { short: 'ПТ', full: 'Пятница', kind: 'yolk', label: 'доставка' },
  { short: 'СБ', full: 'Суббота', kind: 'outline', label: 'самовывоз' },
  { short: 'ВС', full: 'Воскресенье', kind: 'outline', label: 'самовывоз' },
];

const tileStyle: Record<TileKind, { bg: string; color: string; border: string }> = {
  dim: { bg: colors.ink2, color: colors.paperDim, border: 'transparent' },
  roast: { bg: colors.roast, color: colors.white, border: 'transparent' },
  yolk: { bg: colors.yolk, color: colors.ink, border: 'transparent' },
  outline: { bg: 'transparent', color: colors.paper, border: colors.paper },
};

// Labels need about 78px per tile to fit "самовывоз" without breaking mid-word; below that the tiles show icon and day only.
const LABELS_FROM = '@media (min-width:700px)';

const visuallyHidden = {
  position: 'absolute',
  width: '1px',
  height: '1px',
  p: 0,
  m: '-1px',
  overflow: 'hidden',
  clip: 'rect(0 0 0 0)',
  whiteSpace: 'nowrap',
  border: 0,
} as const;

function tileIcon(kind: TileKind, size: number): ReactNode {
  if (kind === 'roast') return <FlameIcon size={size} />;
  if (kind === 'yolk') return <TruckIcon size={size} />;
  if (kind === 'outline') return <PinIcon size={size} />;
  return (
    <Box
      aria-hidden="true"
      sx={{ width: 5, height: 5, borderRadius: '50%', border: '1.5px solid currentColor', boxSizing: 'border-box' }}
    />
  );
}

function DayTile({ day }: { day: Day }) {
  const s = tileStyle[day.kind];
  return (
    <Box
      component="li"
      sx={{
        position: 'relative',
        listStyle: 'none',
        minWidth: 0,
        bgcolor: s.bg,
        color: s.color,
        border: `1px solid ${s.border}`,
        borderRadius: { xs: '8px', sm: `${radius.md}px` },
        boxSizing: 'border-box',
        minHeight: 64,
        [LABELS_FROM]: { minHeight: 92 },
        '@media (min-width:1441px)': { minHeight: wide(92, 0.04, 120) },
        px: { xs: 0, sm: '4px', md: '8px' },
        overflow: 'hidden',
        py: { xs: '12px', sm: '10px' },
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'space-between',
        textAlign: 'center',
      }}
    >
      <Box aria-hidden="true" sx={{ display: 'contents' }}>
        <Typography variant="eyebrow" component="span" sx={{ color: 'inherit', textTransform: 'uppercase' }}>
          {day.short}
        </Typography>
        <Box sx={{ display: 'flex', height: 20, alignItems: 'center', justifyContent: 'center' }}>
          {tileIcon(day.kind, 20)}
        </Box>
        <Typography
          variant="bodyS"
          component="span"
          sx={{
            color: 'inherit',
            display: 'none',
            [LABELS_FROM]: { display: 'block' },
            maxWidth: '100%',
            overflowWrap: 'anywhere',
            fontSize: { sm: 12, md: 13 },
            lineHeight: '18px',
            fontWeight: day.kind === 'dim' ? 400 : 500,
          }}
        >
          {day.label}
        </Typography>
      </Box>
      <Box component="span" sx={visuallyHidden}>
        {day.full} — {day.label}
      </Box>
    </Box>
  );
}

interface LegendItem {
  title: string;
  text: string;
  circle: string;
  color: string;
  icon: ReactNode;
}

const LEGEND: readonly LegendItem[] = [
  {
    title: 'Чт — обжарка',
    text: 'Жарим партиями по 5 кг. Заявки на эту неделю принимаем до среды 20:00.',
    circle: colors.roast,
    color: colors.white,
    icon: <FlameIcon size={20} />,
  },
  {
    title: 'Пт — доставка',
    text: 'Развозим по Минску. От 50 BYN доставка бесплатная.',
    circle: colors.yolk,
    color: colors.ink,
    icon: <TruckIcon size={20} />,
  },
  {
    title: 'Сб–Вс — самовывоз',
    text: `${CONTACT.address}. Сб–вс с 10:00 до 18:00.`,
    circle: colors.ink2,
    color: colors.paper,
    icon: <PinIcon size={20} />,
  },
];

export default function Week() {
  return (
    <Section id="week" tone="ink" labelledBy="week-title">
      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: { xs: 'minmax(0, 1fr)', md: 'minmax(0, 3fr) minmax(0, 2fr)' },
          columnGap: { xs: '80px', md: wide(80, 0.08, 160) },
          rowGap: { xs: '16px', md: 0 },
          alignItems: 'start',
        }}
      >
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <Eyebrow tone="onInk">01 · свежесть</Eyebrow>
          <AccentHeading id="week-title" tone="onInk">
            Мы не держим склад. Жарим то, что <Accent>заказали за неделю</Accent>
          </AccentHeading>
        </Box>
        <Typography
          variant="bodyL"
          sx={{ color: colors.paperDim, m: 0, pt: { md: '28px' }, maxWidth: { md: wide(640, 0.07, 760) } }}
        >
          Через месяц после обжарки аромат кофе тускнеет. Поэтому мы жарим раз в неделю, по четвергам, и развозим
          сразу. К вам зерно приходит на{' '}
          <span style={{ whiteSpace: 'nowrap' }}>1–3-й день</span>, пока оно пахнет ярче всего.
        </Typography>
      </Box>

      <Box
        component="ul"
        aria-label="Неделя Кварты"
        sx={{
          listStyle: 'none',
          m: 0,
          p: 0,
          mt: { xs: '32px', md: '48px' },
          display: 'grid',
          gridTemplateColumns: 'repeat(7, minmax(0, 1fr))',
          gap: { xs: '8px', sm: '12px' },
        }}
      >
        {DAYS.map((d) => (
          <DayTile key={d.short} day={d} />
        ))}
      </Box>

      <Box
        component="ul"
        sx={{
          listStyle: 'none',
          m: 0,
          p: 0,
          mt: { xs: '32px', md: '48px' },
          display: 'grid',
          gridTemplateColumns: { xs: 'minmax(0, 1fr)', sm: 'repeat(3, minmax(0, 1fr))' },
          columnGap: { sm: '24px', md: wide(48, 0.05, 96) },
          rowGap: '20px',
        }}
      >
        {LEGEND.map((item) => (
          <Box key={item.title} component="li" sx={{ display: 'flex', gap: '12px', alignItems: 'flex-start' }}>
            <Box
              aria-hidden="true"
              sx={{
                width: 40,
                height: 40,
                flexShrink: 0,
                borderRadius: '50%',
                bgcolor: item.circle,
                color: item.color,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              {item.icon}
            </Box>
            <Box sx={{ minWidth: 0 }}>
              <Typography variant="body1" component="h3" sx={{ color: colors.paper, fontWeight: 500, m: 0 }}>
                {item.title}
              </Typography>
              <Typography variant="bodyS" sx={{ color: colors.paperDim, m: 0, mt: '4px' }}>
                {item.text}
              </Typography>
            </Box>
          </Box>
        ))}
      </Box>

      <Box sx={{ mt: { xs: '32px', md: '48px' } }}>
        <NextRoast />
      </Box>
    </Section>
  );
}
