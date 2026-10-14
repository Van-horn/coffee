import Box from '@mui/material/Box';
import { colors } from '@/theme/tokens';

interface LogoProps {
  tone?: 'onLight' | 'onInk';
}

export default function Logo({ tone = 'onLight' }: LogoProps) {
  const onInk = tone === 'onInk';
  return (
    <Box
      component="a"
      href="/"
      aria-label="Кварта, на главную"
      sx={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '12px',
        minHeight: 44,
        color: onInk ? colors.paper : colors.ink,
        textDecoration: 'none',
        borderRadius: '6px',
        '&:focus-visible': {
          outline: `3px solid ${onInk ? colors.yolk : colors.ink}`,
          outlineOffset: '3px',
        },
      }}
    >
      <svg width="24" height="24" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
        <path d="M0 24V0A24 24 0 0 1 24 24Z" fill={colors.roast} />
      </svg>
      <Box component="span" sx={{ display: 'flex', flexDirection: 'column' }}>
        <Box
          component="span"
          sx={{ fontSize: 24, lineHeight: '28px', fontWeight: 500, letterSpacing: '0.005em' }}
        >
          Кварта
        </Box>
        <Box
          component="span"
          sx={{
            fontSize: 12,
            lineHeight: '16px',
            fontWeight: 500,
            color: onInk ? colors.paperDim : colors.inkSoft,
          }}
        >
          обжарка · Минск
        </Box>
      </Box>
    </Box>
  );
}
