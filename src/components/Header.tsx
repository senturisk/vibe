import React, { useState } from 'react';
import { Copy, Check, QrCode, Settings, Users, Sun, Moon } from 'lucide-react';
import { ConnectionStatus } from '../types';

interface HeaderProps {
  roomId: string;
  peerId?: string;
  status: ConnectionStatus;
  participantCount: number;
  onOpenShare: () => void;
  onOpenSettings: () => void;
  onLeaveRoom?: () => void;
  inRoom?: boolean;
  theme?: 'light' | 'dark';
  onToggleTheme?: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  roomId,
  status,
  participantCount,
  onOpenShare,
  onOpenSettings,
  inRoom = false,
  theme = 'light',
  onToggleTheme,
}) => {
  const [copied, setCopied] = useState(false);

  const handleCopyRoom = () => {
    navigator.clipboard.writeText(roomId);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <header className="w-full bg-[#FEF7FF]/90 dark:bg-[#1D1B20]/90 backdrop-blur-md border-b border-[#EADDFF] dark:border-[#49454F]/60 sticky top-0 z-30 transition-colors">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-4">
        {/* Logo & Brand */}
        <div className="flex items-center gap-3 select-none">
          <div className="relative w-10 h-10 rounded-2xl overflow-hidden bg-[#F3EDF7] dark:bg-[#2B2831] p-1 shadow-sm border border-[#EADDFF] dark:border-[#49454F] flex items-center justify-center">
            <img
              src="/Sen_Vibe_logo.png"
              alt="Sen Vibe"
              className="w-full h-full object-contain"
            />
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <span className="text-xl font-bold tracking-tight text-[#21005D] dark:text-[#E6E0E9]">
                Sen Vibe
              </span>
              <span className="text-[10px] uppercase font-semibold px-2 py-0.5 rounded-full bg-[#EADDFF] dark:bg-[#4F378B] text-[#21005D] dark:text-[#EADDFF]">
                P2P
              </span>
            </div>
            <p className="text-[11px] text-[#49454F] dark:text-[#CAC4D0] hidden sm:block">
              Lagless Screen & Media Sharing
            </p>
          </div>
        </div>

        {/* Room Info (When inside room) */}
        {inRoom && (
          <div className="flex items-center gap-2">
            <button
              onClick={handleCopyRoom}
              title="Click to copy Room Code"
              className="flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-[#F3EDF7] dark:bg-[#2B2831] hover:bg-[#EADDFF] dark:hover:bg-[#4F378B] text-[#21005D] dark:text-[#E6E0E9] border border-[#CAC4D0]/50 dark:border-[#49454F] transition-colors text-xs font-semibold"
            >
              <span className="text-[#49454F] dark:text-[#CAC4D0] font-normal">Room:</span>
              <span className="font-mono tracking-wide uppercase">{roomId}</span>
              {copied ? (
                <Check className="w-3.5 h-3.5 text-emerald-500" />
              ) : (
                <Copy className="w-3.5 h-3.5 text-[#6750A4] dark:text-[#D0BCFF]" />
              )}
            </button>

            {/* Live indicator & participant count */}
            <div className="hidden md:flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[#E8DEF8] dark:bg-[#2B2831] text-[#1D192B] dark:text-[#E6E0E9] border border-transparent dark:border-[#49454F] text-xs font-medium">
              <Users className="w-3.5 h-3.5 text-[#6750A4] dark:text-[#D0BCFF]" />
              <span>{participantCount} {participantCount === 1 ? 'person' : 'people'}</span>
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse ml-1" />
            </div>
          </div>
        )}

        {/* Actions (Share, Theme Toggle, Settings) */}
        <div className="flex items-center gap-1.5 sm:gap-2">
          {inRoom && (
            <button
              onClick={onOpenShare}
              className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-[#6750A4] text-white hover:bg-[#523e85] dark:bg-[#7429B6] dark:hover:bg-[#62219c] text-xs font-semibold shadow-sm transition-all active:scale-95"
            >
              <QrCode className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Invite / QR</span>
            </button>
          )}

          {/* Quick Theme Switcher Button */}
          {onToggleTheme && (
            <button
              onClick={onToggleTheme}
              title={theme === 'dark' ? 'Switch to Light Theme' : 'Switch to Dark Theme'}
              className="p-2 rounded-full text-[#49454F] dark:text-[#CAC4D0] hover:bg-[#F3EDF7] dark:hover:bg-[#2B2831] hover:text-[#21005D] dark:hover:text-white transition-colors"
            >
              {theme === 'dark' ? (
                <Sun className="w-5 h-5 text-amber-300" />
              ) : (
                <Moon className="w-5 h-5 text-[#6750A4]" />
              )}
            </button>
          )}

          <button
            onClick={onOpenSettings}
            title="Settings (Devices & Theme)"
            className="p-2 rounded-full text-[#49454F] dark:text-[#CAC4D0] hover:bg-[#F3EDF7] dark:hover:bg-[#2B2831] hover:text-[#21005D] dark:hover:text-white transition-colors"
          >
            <Settings className="w-5 h-5" />
          </button>
        </div>
      </div>
    </header>
  );
};
