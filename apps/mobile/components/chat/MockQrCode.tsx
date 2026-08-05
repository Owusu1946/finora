import { View } from 'react-native';
import QRCode from 'react-native-qrcode-svg';

type Props = {
  value: string;
  size?: number;
  color?: string;
  backgroundColor?: string;
};

/** Real QR encoding of `value` so cameras can scan receive / payment-request payloads. */
export function MockQrCode({
  value,
  size = 168,
  color = '#18181b',
  backgroundColor = '#ffffff',
}: Props) {
  return (
    <View
      style={{
        width: size,
        height: size,
        backgroundColor,
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'hidden',
      }}
    >
      <QRCode
        value={value || 'finora'}
        size={size}
        color={color}
        backgroundColor={backgroundColor}
        ecl='M'
      />
    </View>
  );
}
