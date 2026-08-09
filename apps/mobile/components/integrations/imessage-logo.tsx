import Svg, { Defs, G, LinearGradient, Path, Rect, Stop } from 'react-native-svg';

type LogoProps = {
  width?: number;
  height?: number;
};

/**
 * Official Apple iMessage icon (visual only).
 * Source: Apple / Wikimedia Commons — IMessage_logo.svg
 * https://commons.wikimedia.org/wiki/File:IMessage_logo.svg
 *
 * Used as the SMS integration mark — product copy always says SMS.
 */
export function IMessageLogo({ width = 22, height }: LogoProps) {
  const size = height ?? width;
  return (
    <Svg
      width={size}
      height={size}
      viewBox='0 0 66.145836 66.145836'
      accessibilityRole='image'
      accessibilityLabel='SMS'
    >
      <Defs>
        <LinearGradient
          id='imessageGreen'
          x1={-25.272568}
          y1={207.52057}
          x2={-25.272568}
          y2={152.9982}
          gradientUnits='userSpaceOnUse'
          gradientTransform='matrix(0.98209275,0,0,0.98209275,-1.0651782,3.7961838)'
        >
          <Stop
            offset='0'
            stopColor='#0CBD2A'
          />
          <Stop
            offset='1'
            stopColor='#5BF675'
          />
        </LinearGradient>
      </Defs>
      <G transform='translate(59.483067,-145.8456)'>
        <Rect
          x={-59.483067}
          y={145.8456}
          width={66.145836}
          height={66.145836}
          rx={14.567832}
          ry={14.567832}
          fill='url(#imessageGreen)'
        />
        <Path
          fill='#FFFFFF'
          d='m -26.410149,157.29606 a 24.278298,20.222157 0 0 0 -24.278105,20.22202 24.278298,20.222157 0 0 0 11.79463,17.31574 27.365264,20.222157 0 0 1 -4.245218,5.94228 23.85735,20.222157 0 0 0 9.86038,-3.87367 24.278298,20.222157 0 0 0 6.868313,0.83768 24.278298,20.222157 0 0 0 24.2781059,-20.22203 24.278298,20.222157 0 0 0 -24.2781059,-20.22202 z'
        />
      </G>
    </Svg>
  );
}
