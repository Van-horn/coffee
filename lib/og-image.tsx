import { ImageResponse } from 'next/og';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { colors } from '@/theme/tokens';

export const OG_ALT = 'Кварта: кофе, обжаренный в четверг. У вас — в пятницу.';

const fontFile = (weight: 400 | 500) =>
  readFile(join(process.cwd(), 'node_modules/@fontsource/roboto/files', `roboto-cyrillic-${weight}-normal.woff`));

// Roboto Cyrillic from the local package (read once at module load, so the route stays static):
// the default ImageResponse font has no Cyrillic glyphs.
const [regular, medium] = await Promise.all([fontFile(400), fontFile(500)]);

export function renderOgImage() {
  const quarter = 470;
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          background: colors.paper,
          color: colors.ink,
          fontFamily: 'Roboto',
          position: 'relative',
        }}
      >
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            padding: '64px 0 64px 72px',
            width: 720,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center' }}>
            <svg width="56" height="56" viewBox="0 0 24 24">
              <path d="M0 24V0A24 24 0 0 1 24 24Z" fill={colors.roast} />
            </svg>
            <div style={{ fontSize: 56, fontWeight: 500, marginLeft: 20 }}>Кварта</div>
          </div>
          <div style={{ fontSize: 68, lineHeight: '78px', fontWeight: 400, display: 'flex' }}>
            Кофе, обжаренный в четверг. У вас — в пятницу.
          </div>
          <div style={{ fontSize: 28, fontWeight: 500, color: colors.inkSoft, display: 'flex' }}>
            обжарка · Минск · с 2019
          </div>
        </div>
        <div style={{ position: 'absolute', right: 0, bottom: 0, display: 'flex', width: quarter, height: quarter }}>
          <svg width={quarter} height={quarter} viewBox="0 0 469 469">
            <path d="M469 469H0A469 469 0 0 1 469 0Z" fill={colors.roast} />
            <path d="M64 103H362L369 393Q369 407 355 407H71Q57 407 57 393Z" fill={colors.kraft} />
            <polygon points="271,103 369,103 369,407 299,407" fill={colors.kraftDeep} opacity="0.55" />
            <polygon points="76,72 352,72 364,103 64,103" fill={colors.kraftDeep} />
            <rect x="88" y="60" width="251" height="12" rx="6" fill={colors.ink} />
            <rect x="107" y="142" width="212" height="141" rx="4" fill={colors.card} />
            <path d="M124 181V167A14 14 0 0 1 138 181Z" fill={colors.roast} />
            <rect x="146" y="165" width="90" height="12" rx="3" fill={colors.ink} />
            <rect x="124" y="196" width="120" height="8" rx="3" fill={colors.inkSoft} />
            <rect x="124" y="218" width="150" height="12" rx="3" fill={colors.ink} />
          </svg>
        </div>
      </div>
    ),
    {
      width: 1200,
      height: 630,
      fonts: [
        { name: 'Roboto', data: regular, weight: 400, style: 'normal' },
        { name: 'Roboto', data: medium, weight: 500, style: 'normal' },
      ],
    },
  );
}
