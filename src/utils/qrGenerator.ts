import QRCode from 'qrcode';

export async function generateQrCodeDataUrl(text: string): Promise<string> {
  try {
    const url = await QRCode.toDataURL(text, {
      width: 320,
      margin: 2,
      color: {
        dark: '#4A148C', // Deep purple matching Sen Vibe palette
        light: '#FFFFFF',
      },
      errorCorrectionLevel: 'M',
    });
    return url;
  } catch (err) {
    console.error('Failed to generate QR code:', err);
    return '';
  }
}
