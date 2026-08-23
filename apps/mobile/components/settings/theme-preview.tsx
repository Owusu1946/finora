import Svg, { Circle, ClipPath, Defs, G, Path, Rect } from 'react-native-svg';

export type ThemePreviewMode = 'system' | 'light' | 'dark';

interface Palette {
  ground: string;
  surface: string;
  mark: string;
  line: string;
}

const PALETTE: Record<'light' | 'dark', Palette> = {
  light: { ground: '#e5e5e5', surface: '#ffffff', mark: '#d4d4d4', line: '#d4d4d4' },
  dark: { ground: '#171717', surface: '#262626', mark: '#525252', line: '#404040' },
};

const ACCENT = '#c1704f';
const VIEW_BOX = { width: 88, height: 70 };
const DIAGONAL = `M${VIEW_BOX.width} 0V${VIEW_BOX.height}H0Z`;
const CARD_FRAME = { x: 0, y: 0, width: 88, height: 70, rx: 16 } as const;
const CARD_SURFACE = { x: 8, y: 8, width: 72, height: 54, rx: 10 } as const;

/** Draws a miniature app screen for the given theme mode. */
export function ThemePreview({ mode, width }: { mode: ThemePreviewMode; width: number }) {
  const height = Math.round((width / VIEW_BOX.width) * VIEW_BOX.height);
  const clip = `theme-preview-${mode}`;

  return (
    <Svg
      accessibilityRole='image'
      accessibilityLabel={`${mode} theme preview`}
      width={width}
      height={height}
      viewBox='0 0 88 70'
    >
      <Rect
        {...CARD_FRAME}
        fill={PALETTE[mode === 'dark' ? 'dark' : 'light'].ground}
      />
      <Rect
        {...CARD_SURFACE}
        fill={PALETTE[mode === 'dark' ? 'dark' : 'light'].surface}
      />
      <Rect
        x={17}
        y={18}
        width={34}
        height={4}
        rx={2}
        fill={PALETTE[mode === 'dark' ? 'dark' : 'light'].line}
      />
      <Rect
        x={17}
        y={26}
        width={23}
        height={4}
        rx={2}
        fill={PALETTE[mode === 'dark' ? 'dark' : 'light'].line}
      />

      {mode === 'system' ? (
        <>
          <Defs>
            <ClipPath id={`${clip}-frame`}>
              <Rect {...CARD_FRAME} />
            </ClipPath>
            <ClipPath id={`${clip}-card`}>
              <Rect {...CARD_SURFACE} />
            </ClipPath>
          </Defs>
          <G clipPath={`url(#${clip}-frame)`}>
            <Path
              d={DIAGONAL}
              fill={PALETTE.dark.ground}
            />
          </G>
          <G clipPath={`url(#${clip}-card)`}>
            <Path
              d={DIAGONAL}
              fill={PALETTE.dark.surface}
            />
          </G>
        </>
      ) : null}

      <Circle
        cx={64}
        cy={47}
        r={8}
        fill={ACCENT}
      />
    </Svg>
  );
}
