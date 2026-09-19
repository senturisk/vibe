import React, { useEffect, useState } from 'react';
import { X, Copy, Check, Share2, QrCode, Sparkles } from 'lucide-react';
import { generateQrCodeDataUrl } from '../utils/qrGenerator';

interface ShareModalProps {
  roomId: string;
  isOpen: boolean;
  onClose: () => void;
}

export const ShareModal: React.FC<ShareModalProps> = ({ roomId, isOpen, onClose }) => {
  const [qrDataUrl, setQrDataUrl] = useState<string>('');
  const [copiedLink, setCopiedLink] = useState(false);
  const [copiedCode, setCopiedCode] = useState(false);

  // Generate current share URL with ?room= parameter
  const shareUrl = typeof window !== 'undefined'
    ? `${window.location.origin}${window.location.pathname}?room=${encodeURIComponent(roomId)}`
    : `https://senvibe.app/?room=${roomId}`;

  useEffect(() => {
    if (isOpen && shareUrl) {
      generateQrCodeDataUrl(shareUrl).then((url) => setQrDataUrl(url));
    }
  }, [isOpen, shareUrl]);

  if (!isOpen) return null;

  const handleCopyLink = () => {
    navigator.clipboard.writeText(shareUrl);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2500);
  };

  const handleCopyCode = () => {
    navigator.clipboard.writeText(roomId);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2500);
  };

  const handleNativeShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: 'Join my Sen Vibe Room',
          text: `Join my lagless video & screen sharing room on Sen Vibe: ${roomId}`,
          url: shareUrl,
        });
      } catch (err) {
        console.warn('Native share canceled:', err);
      }
    } else {
      handleCopyLink();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative w-full max-w-md bg-[#FEF7FF] rounded-3xl p-6 sm:p-8 shadow-2xl border border-[#EADDFF] flex flex-col items-center text-center">
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-5 right-5 p-2 rounded-full text-[#49454F] hover:bg-[#F3EDF7] transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Modal Header */}
        <div className="w-12 h-12 rounded-2xl bg-[#EADDFF] flex items-center justify-center text-[#21005D] mb-3">
          <QrCode className="w-6 h-6" />
        </div>
        <h3 className="text-xl font-bold text-[#21005D]">Share Room Invite</h3>
        <p className="text-xs text-[#49454F] mt-1 max-w-xs">
          Scan QR code on mobile or click the link to join instantly without account or setup.
        </p>

        {/* QR Code Container */}
        <div className="mt-5 p-4 rounded-2xl bg-white border border-[#EADDFF] shadow-sm flex items-center justify-center">
          {qrDataUrl ? (
            <img
              src={qrDataUrl}
              alt="Scan to join room"
              className="w-56 h-56 object-contain rounded-lg"
            />
          ) : (
            <div className="w-56 h-56 flex items-center justify-center text-[#6750A4] animate-pulse">
              Generating QR Code...
            </div>
          )}
        </div>

        {/* Room Code Badge */}
        <div className="mt-4 flex items-center gap-2">
          <span className="text-xs text-[#49454F]">Room Code:</span>
          <button
            onClick={handleCopyCode}
            className="px-3 py-1 rounded-full bg-[#F3EDF7] hover:bg-[#EADDFF] text-[#21005D] font-mono font-bold text-sm tracking-wider flex items-center gap-1.5 transition-colors"
          >
            {roomId}
            {copiedCode ? (
              <Check className="w-3.5 h-3.5 text-emerald-600" />
            ) : (
              <Copy className="w-3.5 h-3.5 text-[#6750A4]" />
            )}
          </button>
        </div>

        {/* URL Box & Copy Link */}
        <div className="mt-4 w-full flex items-center gap-2 p-1.5 pl-3 rounded-full bg-[#F3EDF7] border border-[#CAC4D0]/60 text-left">
          <span className="text-xs text-[#49454F] truncate font-mono flex-1">
            {shareUrl}
          </span>
          <button
            onClick={handleCopyLink}
            className="px-4 py-2 rounded-full bg-[#6750A4] hover:bg-[#523e85] text-white text-xs font-semibold flex items-center gap-1.5 transition-all shrink-0 active:scale-95"
          >
            {copiedLink ? (
              <>
                <Check className="w-3.5 h-3.5" />
                <span>Copied!</span>
              </>
            ) : (
              <>
                <Copy className="w-3.5 h-3.5" />
                <span>Copy Link</span>
              </>
            )}
          </button>
        </div>

        {/* Native Share button if available */}
        <div className="mt-4 w-full flex gap-2">
          <button
            onClick={handleNativeShare}
            className="w-full py-2.5 rounded-full bg-[#EADDFF] hover:bg-[#D0BCFF] text-[#21005D] text-xs font-semibold flex items-center justify-center gap-2 transition-colors active:scale-95"
          >
            <Share2 className="w-4 h-4" />
            <span>Share via Apps</span>
          </button>
        </div>
      </div>
    </div>
  );
};
