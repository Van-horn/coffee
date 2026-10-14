import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Typography from '@mui/material/Typography';
import AccentHeading, { Accent } from './AccentHeading';
import Eyebrow from './Eyebrow';
import Section from './Section';
import CoffeeBeanIcon from './icons/CoffeeBeanIcon';
import DripBagIcon from './icons/DripBagIcon';
import { COFFEES, DRIP_BAGS, type Coffee } from '@/lib/catalog';
import { colors, radius } from '@/theme/tokens';

const ORDER_HREF = '/?interest=order#order';
const focusRing = { outline: `3px solid ${colors.ink}`, outlineOffset: '3px' };

// Band colors: text must reach 4.5:1 (ink on bergamot and apple, paper on cocoa).
const TONES: Record<Coffee['tone'], { band: string; text: string; bean: string; groove: string }> = {
  bergamot: { band: colors.toneBergamot, text: colors.ink, bean: colors.toneCocoa, groove: colors.toneBergamot },
  apple: { band: colors.toneApple, text: colors.ink, bean: colors.toneCocoa, groove: colors.toneApple },
  cocoa: { band: colors.toneCocoa, text: colors.paper, bean: colors.ink, groove: colors.kraftDeep },
};

function RoastDots({ level, label }: { level: number; label: string }) {
  return (
    <Box
      role="img"
      aria-label={`обжарка ${level} из 5, ${label}`}
      sx={{ display: 'inline-flex', gap: '4px', alignItems: 'center' }}
    >
      {[1, 2, 3, 4, 5].map((n) => (
        <Box
          key={n}
          aria-hidden="true"
          sx={{
            width: 10,
            height: 10,
            borderRadius: '50%',
            boxSizing: 'border-box',
            border: `1.5px solid ${colors.ink}`,
            bgcolor: n <= level ? colors.ink : 'transparent',
          }}
        />
      ))}
    </Box>
  );
}

function OrderButton({ label }: { label: string }) {
  return (
    <Button
      variant="outlined"
      href={ORDER_HREF}
      aria-label={label}
      sx={{ minHeight: 44, minWidth: 0, px: '20px', flexShrink: 0, whiteSpace: 'nowrap', '&:focus-visible': focusRing }}
    >
      В заявку
    </Button>
  );
}

function CoffeeCard({ coffee }: { coffee: Coffee }) {
  const tone = TONES[coffee.tone];
  const titleId = `coffee-${coffee.id}`;
  return (
    <Box component="li" sx={{ listStyle: 'none', m: 0, p: 0, display: 'flex' }}>
      <Box
        component="article"
        aria-labelledby={titleId}
        sx={{
          width: '100%',
          display: 'flex',
          flexDirection: 'column',
          bgcolor: colors.card,
          borderRadius: `${radius.lg}px`,
          overflow: 'hidden',
        }}
      >
        <Box
          sx={{
            position: 'relative',
            bgcolor: tone.band,
            color: tone.text,
            minHeight: 132,
            p: '20px',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
          }}
        >
          <Typography variant="eyebrow" sx={{ color: 'inherit', textTransform: 'none' }}>
            № {String(coffee.number).padStart(2, '0')} · {coffee.country}
          </Typography>
          <Typography variant="h3" component="h3" id={titleId} sx={{ color: 'inherit', m: 0 }}>
            {coffee.name}
          </Typography>
          <Box sx={{ position: 'absolute', top: 20, right: 20 }}>
            <CoffeeBeanIcon size={52} body={tone.bean} groove={tone.groove} />
          </Box>
        </Box>
        <Box sx={{ p: '20px', display: 'flex', flexDirection: 'column', gap: '16px', flexGrow: 1 }}>
          <Box
            component="ul"
            sx={{ m: 0, p: 0, listStyle: 'none', display: 'flex', flexWrap: 'wrap', columnGap: '16px', rowGap: '4px' }}
          >
            {coffee.notes.map((note) => (
              <Typography key={note} component="li" variant="body2" sx={{ fontWeight: 500, color: colors.inkSoft }}>
                {note}
              </Typography>
            ))}
          </Box>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Typography variant="eyebrow" sx={{ color: colors.inkSoft, textTransform: 'none' }}>
              обжарка
            </Typography>
            <RoastDots level={coffee.roastLevel} label={coffee.roastLabel} />
            <Typography variant="body2" sx={{ color: colors.ink }}>
              {coffee.roastLabel}
            </Typography>
          </Box>
          <Box
            sx={{
              mt: 'auto',
              display: 'flex',
              flexWrap: 'wrap',
              alignItems: 'center',
              justifyContent: 'space-between',
              columnGap: '8px',
              rowGap: '12px',
            }}
          >
            <Box sx={{ display: 'flex', alignItems: 'baseline', gap: '8px' }}>
              <Typography variant="price" sx={{ color: colors.ink }}>
                {coffee.priceBYN} BYN
              </Typography>
              <Typography variant="body2" sx={{ color: colors.inkSoft }}>
                {coffee.weightG} г
              </Typography>
            </Box>
            <OrderButton label={`В заявку: ${coffee.name}`} />
          </Box>
        </Box>
      </Box>
    </Box>
  );
}

function DripRow() {
  return (
    <Box
      component="li"
      sx={{
        listStyle: 'none',
        m: 0,
        bgcolor: colors.paper2,
        borderRadius: `${radius.lg}px`,
        p: { xs: '20px', md: '24px' },
        gridColumn: { xs: '1 / -1', sm: 'auto', md: '1 / -1' },
        display: 'grid',
        columnGap: '16px',
        rowGap: '16px',
        alignItems: 'center',
        gridTemplateColumns: { xs: 'auto minmax(0, 1fr)', md: 'auto minmax(0, 1fr) auto auto' },
        gridTemplateRows: { xs: 'auto 1fr', md: 'auto' },
        gridTemplateAreas: {
          xs: '"icon text" "price action"',
          md: '"icon text price action"',
        },
      }}
    >
      <Box sx={{ gridArea: 'icon', display: 'flex' }}>
        <DripBagIcon size={56} />
      </Box>
      <Box sx={{ gridArea: 'text' }}>
        <Typography variant="h3" component="h3" sx={{ m: 0, fontSize: { xs: 20, md: 22 }, lineHeight: '28px' }}>
          {DRIP_BAGS.name}
        </Typography>
        <Typography variant="body2" sx={{ mt: '2px', color: colors.inkSoft }}>
          {DRIP_BAGS.pieces} штук · {DRIP_BAGS.hint}
        </Typography>
      </Box>
      <Typography
        variant="price"
        sx={{ gridArea: 'price', color: colors.ink, alignSelf: { xs: 'end', md: 'center' }, pr: { md: '8px' } }}
      >
        {DRIP_BAGS.priceBYN} BYN
      </Typography>
      <Box sx={{ gridArea: 'action', justifySelf: 'end', alignSelf: { xs: 'end', md: 'center' } }}>
        <OrderButton label={`В заявку: ${DRIP_BAGS.name}`} />
      </Box>
    </Box>
  );
}

export default function Range() {
  return (
    <Section id="range" tone="paper" labelledBy="range-title">
      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: { xs: 'minmax(0, 1fr)', md: 'minmax(0, 1fr) minmax(0, 480px)' },
          columnGap: '48px',
          rowGap: '16px',
          alignItems: 'end',
        }}
      >
        <Box>
          <Eyebrow>02 · кофе</Eyebrow>
          <Box sx={{ mt: '12px' }}>
            <AccentHeading id="range-title">
              Три кофе <Accent>на выбор</Accent>
            </AccentHeading>
          </Box>
        </Box>
        <Typography variant="bodyM" sx={{ m: 0, color: colors.inkSoft, pb: { md: '4px' } }}>
          Цены за пачку 250 г в белорусских рублях. Помол уточнит менеджер, когда перезвонит.
        </Typography>
      </Box>
      <Box
        component="ul"
        sx={{
          m: 0,
          mt: { xs: '24px', sm: '32px', md: '40px' },
          p: 0,
          listStyle: 'none',
          display: 'grid',
          gridTemplateColumns: { xs: 'minmax(0, 1fr)', sm: 'repeat(2, minmax(0, 1fr))', md: 'repeat(3, minmax(0, 1fr))' },
          gap: { xs: '24px', sm: '24px', md: '24px' },
        }}
      >
        {COFFEES.map((coffee) => (
          <CoffeeCard key={coffee.id} coffee={coffee} />
        ))}
        <DripRow />
      </Box>
    </Section>
  );
}
