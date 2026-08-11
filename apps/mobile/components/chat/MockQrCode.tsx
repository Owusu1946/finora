import type { ReactNode } from 'react';

import QRCodeLib from 'qrcode';
import { useMemo } from 'react';
import { View } from 'react-native';
import Svg, { Circle, G, Rect } from 'react-native-svg';

type Props = {
  value: string;
  size?: number;
  color?: string;
  backgroundColor?: string;
  /** Circular brand / token mark centered on the QR (WeWire-style). */
  centerLogo?: ReactNode;
  centerLogoSize?: number;
};

type Matrix = {
  size: number;
  isDark: (row: number, col: number) => boolean;
};

function buildMatrix(value: string, ecl: 'L' | 'M' | 'Q' | 'H'): Matrix {
  const qr = QRCodeLib.create(value || 'finora', { errorCorrectionLevel: ecl });
  const { data, size } = qr.modules;

  return {
    size,
    isDark: (row, col) => Boolean(data[row * size + col]),
  };
}

function isFinderCell(row: number, col: number, matrixSize: number) {
  if (row < 7 && col < 7) return true;
  if (row < 7 && col >= matrixSize - 7) return true;
  if (row >= matrixSize - 7 && col < 7) return true;
  return false;
}

function isLogoCell(row: number, col: number, matrixSize: number, logoCells: number) {
  const center = (matrixSize - 1) / 2;
  const half = logoCells / 2;
  return (
    row >= center - half && row <= center + half && col >= center - half && col <= center + half
  );
}

function FinderPattern({
  x,
  y,
  cellSize,
  color,
  backgroundColor,
}: {
  x: number;
  y: number;
  cellSize: number;
  color: string;
  backgroundColor: string;
}) {
  const outer = cellSize * 7;
  const middle = cellSize * 5;
  const inner = cellSize * 3;
  const inset = cellSize;
  const inset2 = cellSize * 2;

  return (
    <G>
      <Rect
        x={x}
        y={y}
        width={outer}
        height={outer}
        rx={cellSize * 1.35}
        fill={color}
      />
      <Rect
        x={x + inset}
        y={y + inset}
        width={middle}
        height={middle}
        rx={cellSize * 1.05}
        fill={backgroundColor}
      />
      <Rect
        x={x + inset2}
        y={y + inset2}
        width={inner}
        height={inner}
        rx={cellSize * 0.85}
        fill={color}
      />
    </G>
  );
}

/** Real QR encoding with WeWire-style rounded modules and finder patterns. */
export function MockQrCode({
  value,
  size = 168,
  color = '#18181b',
  backgroundColor = '#ffffff',
  centerLogo,
  centerLogoSize,
}: Props) {
  const ecl = centerLogo ? 'H' : 'M';
  const logoSize = centerLogoSize ?? Math.round(size * 0.22);

  const matrix = useMemo(() => buildMatrix(value, ecl), [value, ecl]);
  const cellSize = size / matrix.size;
  const dotRadius = cellSize * 0.41;
  const logoCells = Math.ceil((logoSize + 12) / cellSize);

  const finderOrigins = useMemo(
    () => [
      { row: 0, col: 0 },
      { row: 0, col: matrix.size - 7 },
      { row: matrix.size - 7, col: 0 },
    ],
    [matrix.size],
  );

  const dots = useMemo(() => {
    const nodes: ReactNode[] = [];

    for (let row = 0; row < matrix.size; row += 1) {
      for (let col = 0; col < matrix.size; col += 1) {
        if (!matrix.isDark(row, col)) continue;
        if (isFinderCell(row, col, matrix.size)) continue;
        if (centerLogo && isLogoCell(row, col, matrix.size, logoCells)) continue;

        nodes.push(
          <Circle
            key={`${row}-${col}`}
            cx={col * cellSize + cellSize / 2}
            cy={row * cellSize + cellSize / 2}
            r={dotRadius}
            fill={color}
          />,
        );
      }
    }

    return nodes;
  }, [cellSize, centerLogo, color, dotRadius, logoCells, matrix]);

  return (
    <View
      style={{
        width: size,
        height: size,
        backgroundColor,
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'hidden',
        borderRadius: 16,
      }}
    >
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
        {finderOrigins.map(({ row, col }) => (
          <FinderPattern
            key={`${row}-${col}`}
            x={col * cellSize}
            y={row * cellSize}
            cellSize={cellSize}
            color={color}
            backgroundColor={backgroundColor}
          />
        ))}
        {dots}
      </Svg>

      {centerLogo ? (
        <View
          pointerEvents='none'
          style={{
            position: 'absolute',
            width: logoSize + 10,
            height: logoSize + 10,
            borderRadius: (logoSize + 10) / 2,
            backgroundColor,
            alignItems: 'center',
            justifyContent: 'center',
            shadowColor: '#000',
            shadowOpacity: 0.08,
            shadowRadius: 4,
            shadowOffset: { width: 0, height: 1 },
            elevation: 2,
          }}
        >
          <View
            style={{
              width: logoSize,
              height: logoSize,
              borderRadius: logoSize / 2,
              overflow: 'hidden',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            {centerLogo}
          </View>
        </View>
      ) : null}
    </View>
  );
}
