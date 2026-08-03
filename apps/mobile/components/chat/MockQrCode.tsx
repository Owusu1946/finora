import { useMemo } from 'react';
import Svg, { Rect } from 'react-native-svg';

/** Visual QR stand-in from payload hash — mock UI only (not scanner-valid). */
export function MockQrCode({
  value,
  size = 168,
  color = '#18181b',
  backgroundColor = '#ffffff',
}: {
  value: string;
  size?: number;
  color?: string;
  backgroundColor?: string;
}) {
  const modules = useMemo(() => buildModules(value, 25), [value]);
  const n = modules.length;
  const cell = size / n;

  return (
    <Svg
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
    >
      <Rect
        x={0}
        y={0}
        width={size}
        height={size}
        fill={backgroundColor}
      />
      {modules.map((row, y) =>
        row.map((on, x) =>
          on ? (
            <Rect
              key={`${x}-${y}`}
              x={x * cell}
              y={y * cell}
              width={cell}
              height={cell}
              fill={color}
            />
          ) : null,
        ),
      )}
    </Svg>
  );
}

function buildModules(seed: string, size: number): boolean[][] {
  const grid = Array.from({ length: size }, () => Array.from({ length: size }, () => false));

  const paintFinder = (ox: number, oy: number) => {
    for (let y = 0; y < 7; y++) {
      for (let x = 0; x < 7; x++) {
        const edge = x === 0 || y === 0 || x === 6 || y === 6;
        const core = x >= 2 && x <= 4 && y >= 2 && y <= 4;
        grid[oy + y]![ox + x] = edge || core;
      }
    }
  };

  paintFinder(0, 0);
  paintFinder(size - 7, 0);
  paintFinder(0, size - 7);

  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      if (inFinder(x, y, size)) continue;
      h = Math.imul(h ^ (x * 374761393 + y * 668265263), 2246822519);
      grid[y]![x] = (h >>> 0) % 3 !== 0;
    }
  }

  return grid;
}

function inFinder(x: number, y: number, size: number) {
  const inBox = (ox: number, oy: number) => x >= ox && x < ox + 8 && y >= oy && y < oy + 8;
  return inBox(0, 0) || inBox(size - 8, 0) || inBox(0, size - 8);
}
