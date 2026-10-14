import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Logo from './Logo';
import { HEADER_HEIGHT } from './Section';
import { colors } from '@/theme/tokens';

const NAV = [
  { label: 'Кофе', href: '#range' },
  { label: 'Подписка', href: '#subscription' },
  { label: 'Доставка', href: '#delivery' },
  { label: 'О нас', href: '#about' },
  { label: 'Контакты', href: '#contacts' },
] as const;

const focusRing = {
  outline: `3px solid ${colors.ink}`,
  outlineOffset: '2px',
};

export default function Header() {
  return (
    <Box
      component="header"
      sx={{
        position: 'sticky',
        top: 0,
        zIndex: 1100,
        bgcolor: colors.paper,
        borderBottom: `1px solid ${colors.line}`,
        height: { xs: HEADER_HEIGHT.mobile, md: HEADER_HEIGHT.desktop },
        boxSizing: 'border-box',
      }}
    >
      <Box
        sx={{
          maxWidth: 1440,
          mx: 'auto',
          height: '100%',
          px: { xs: '20px', sm: '40px', md: '120px' },
          display: 'grid',
          gridTemplateColumns: { xs: '1fr auto', md: '1fr auto 1fr' },
          alignItems: 'center',
          columnGap: '24px',
        }}
      >
        <Box sx={{ justifySelf: 'start' }}>
          <Logo />
        </Box>
        <Box
          component="nav"
          aria-label="Основная навигация"
          sx={{ display: { xs: 'none', md: 'block' } }}
        >
          <Box
            component="ul"
            sx={{ display: 'flex', gap: '4px', m: 0, p: 0, listStyle: 'none' }}
          >
            {NAV.map((item) => (
              <li key={item.href}>
                <Box
                  component="a"
                  href={item.href}
                  sx={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    minHeight: 44,
                    px: '16px',
                    borderRadius: '6px',
                    fontSize: 16,
                    lineHeight: '24px',
                    fontWeight: 500,
                    color: colors.ink,
                    textDecoration: 'none',
                    transition: 'background-color 0.15s',
                    '&:hover': { bgcolor: 'rgba(35, 26, 20, 0.06)' },
                    '&:focus-visible': focusRing,
                  }}
                >
                  {item.label}
                </Box>
              </li>
            ))}
          </Box>
        </Box>
        <Box sx={{ justifySelf: 'end' }}>
          <Button
            variant="outlined"
            href="#order"
            sx={{ '&.Mui-focusVisible, &:focus-visible': focusRing }}
          >
            <Box component="span" sx={{ display: { xs: 'inline', md: 'none' } }}>
              Заявка
            </Box>
            <Box component="span" sx={{ display: { xs: 'none', md: 'inline' } }}>
              Оставить заявку
            </Box>
          </Button>
        </Box>
      </Box>
    </Box>
  );
}
