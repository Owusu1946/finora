declare module 'qrcode' {
  type ErrorCorrectionLevel = 'L' | 'M' | 'Q' | 'H';

  type CreateOptions = {
    errorCorrectionLevel?: ErrorCorrectionLevel;
  };

  type QRModuleData = {
    size: number;
    data: Uint8Array | number[];
  };

  type QRCodeModel = {
    modules: QRModuleData;
  };

  export function create(value: string, options?: CreateOptions): QRCodeModel;
}
