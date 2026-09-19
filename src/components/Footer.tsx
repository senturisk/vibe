import React from 'react';
import { Shield, Sparkles } from 'lucide-react';

export const Footer: React.FC = () => {
  return (
    <footer className="w-full py-4 px-6 border-t border-[#EADDFF]/60 bg-[#FEF7FF]/80 text-[#49454F] text-xs transition-colors">
      <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3 text-center sm:text-left">
        <div className="flex items-center gap-2">
          <span className="font-medium text-[#21005D]">Sen Vibe</span>
          <span className="text-[#79747E]">•</span>
          <span>© 2026 Sen Vibe by Senturisk. All rights reserved.</span>
        </div>

        <div className="flex items-center gap-4 text-[11px] text-[#49454F]">
          <span className="flex items-center gap-1">
            <Shield className="w-3 h-3 text-[#6750A4]" />
            PeerJS P2P Direct
          </span>
          <span className="flex items-center gap-1">
            <Sparkles className="w-3 h-3 text-[#6750A4]" />
            Material You 3 UX
          </span>
        </div>
      </div>
    </footer>
  );
};
