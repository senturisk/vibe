import React from 'react';
import { Shield } from 'lucide-react';

export const Footer: React.FC = () => {
  return (
    <footer className="w-full py-4 px-6 border-t border-[#EADDFF]/60 dark:border-[#49454F]/50 bg-[#FEF7FF]/80 dark:bg-[#1D1B20]/80 text-[#49454F] dark:text-[#CAC4D0] text-xs transition-colors">
      <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3 text-center sm:text-left">
        <div className="flex items-center gap-2">
          <span className="font-semibold text-[#21005D] dark:text-[#E6E0E9]">Sen Vibe</span>
          <span className="text-[#79747E] dark:text-[#938F99]">•</span>
          <span>© 2026 Sen Vibe by Senturisk. All rights reserved.</span>
        </div>

        <div className="flex items-center gap-3 text-[11px] text-[#49454F] dark:text-[#CAC4D0]">
          <span className="flex items-center gap-1">
            <Shield className="w-3.5 h-3.5 text-[#6750A4] dark:text-[#D0BCFF]" />
            Direct P2P
          </span>
        </div>
      </div>
    </footer>
  );
};
