import Box from '@mui/material/Box';
import { colors } from '@/theme/tokens';

// First focusable element: hidden above the viewport until it receives keyboard focus.
export default function SkipLink() {
  return (
    <Box
      component="a"
      href="#main"
      sx={{
        position: 'absolute',
        left: 8,
        top: 8,
        zIndex: 2000,
        display: 'inline-flex',
        alignItems: 'center',
        minHeight: 44,
        px: 2,
        py: 1.5,
        bgcolor: colors.paper,
        color: colors.ink,
        fontWeight: 500,
        borderRadius: '6px',
        transform: 'translateY(-200%)',
        '&:focus-visible': { transform: 'none', outline: `3px solid ${colors.ink}`, outlineOffset: '2px' },
      }}
    >
      Перейти к содержимому
    </Box>
  );
}
