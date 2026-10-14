import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import type { ReactNode } from 'react';
import Logo from '@/components/Logo';
import Section, { HEADER_HEIGHT } from '@/components/Section';
import { CONTACT } from '@/lib/contact';
import { colors } from '@/theme/tokens';

const linkSx = {
  display: 'inline-flex',
  alignItems: 'center',
  minHeight: 44,
  color: colors.paper,
  textDecoration: 'none',
  borderRadius: '6px',
  '&:hover': { textDecoration: 'underline' },
  '&:focus-visible': { outline: `3px solid ${colors.yolk}`, outlineOffset: '2px' },
} as const;

const text = { color: colors.paper, m: 0 } as const;
const dim = { color: colors.paperDim, m: 0 } as const;

function Column({ title, children }: { title: string; children: ReactNode }) {
  return (
    <Box>
      <Typography variant="eyebrow" component="h2" sx={{ display: 'block', color: colors.yolk, mb: 1.5 }}>
        {title}
      </Typography>
      {children}
    </Box>
  );
}

export default function Footer() {
  return (
    <Box
      component="footer"
      id="contacts"
      sx={{
        display: 'flex',
        flexDirection: 'column',
        scrollMarginTop: { xs: `${HEADER_HEIGHT.mobile}px`, md: `${HEADER_HEIGHT.desktop}px` },
        // Fill the screen below the sticky header so the #contacts anchor can scroll to the block's start.
        minHeight: {
          xs: [`calc(100vh - ${HEADER_HEIGHT.mobile}px)`, `calc(100svh - ${HEADER_HEIGHT.mobile}px)`],
          md: [`calc(100vh - ${HEADER_HEIGHT.desktop}px)`, `calc(100svh - ${HEADER_HEIGHT.desktop}px)`],
        },
      }}
    >
      <Section tone="ink" fill sx={{ py: { xs: 7, sm: 8, md: 10 } }}>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5, mb: { xs: 5, md: 6 } }}>
          <Logo tone="onInk" />
          <Typography variant="body1" sx={dim}>
            Небольшая обжарка в Минске с 2019 года.
          </Typography>
        </Box>

        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)', md: 'repeat(3, 1fr)' },
            gap: { xs: 4, md: 6 },
            mb: { xs: 5, md: 7 },
          }}
        >
          <Column title="Адрес">
            <Typography variant="body1" sx={text}>
              {CONTACT.address}
              <br />
              {CONTACT.city}
            </Typography>
            <Typography variant="body2" sx={{ ...dim, mt: 1 }}>
              Самовывоз: Пн–Пт 08:00–20:00, Сб–Вс 10:00–18:00
            </Typography>
          </Column>

          <Column title="Связь">
            <Box component="ul" sx={{ listStyle: 'none', m: 0, p: 0 }}>
              <li>
                <Box component="a" href={CONTACT.phoneHref} sx={linkSx}>
                  {CONTACT.phoneDisplay}
                </Box>
              </li>
              <li>
                <Box component="a" href={CONTACT.telegramUrl} sx={linkSx}>
                  Telegram {CONTACT.telegramHandle}
                </Box>
              </li>
              <li>
                <Box component="a" href={CONTACT.instagramUrl} sx={linkSx}>
                  Instagram {CONTACT.instagramHandle}
                </Box>
              </li>
            </Box>
          </Column>

          <Column title="Доставка">
            <Typography variant="body1" sx={text}>
              Минск, по пятницам. От 50 BYN бесплатно.
            </Typography>
          </Column>
        </Box>

        <Box
          sx={{
            mt: 'auto',
            pt: 3,
            borderTop: `1px solid ${colors.ink2}`,
            display: 'flex',
            flexDirection: { xs: 'column', sm: 'row' },
            justifyContent: 'space-between',
            alignItems: { xs: 'flex-start', sm: 'center' },
            gap: 1,
          }}
        >
          <Typography variant="body2" sx={dim}>
            © 2019–2026 Кварта
          </Typography>
          <Box component="a" href="/privacy" sx={{ ...linkSx, fontSize: 14 }}>
            Политика обработки данных
          </Box>
        </Box>
        <Typography variant="body2" sx={{ ...dim, mt: 1, fontSize: 12, lineHeight: '18px' }}>
          Кварта — вымышленная обжарка, сайт сделан как учебный проект.
        </Typography>
      </Section>
    </Box>
  );
}
