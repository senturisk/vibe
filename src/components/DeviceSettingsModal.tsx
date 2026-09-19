import React, { useEffect, useState } from 'react';
import { X, Mic, Video, Volume2, Sliders, Check } from 'lucide-react';
import { DeviceSettings } from '../types';

interface DeviceSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentSettings: DeviceSettings;
  onUpdateSettings: (newSettings: DeviceSettings) => void;
  currentVolume?: number;
  onSwitchCamera?: (deviceId: string) => void;
  onSwitchMicrophone?: (deviceId: string) => void;
}

export const DeviceSettingsModal: React.FC<DeviceSettingsModalProps> = ({
  isOpen,
  onClose,
  currentSettings,
  onUpdateSettings,
  currentVolume = 0,
  onSwitchCamera,
  onSwitchMicrophone,
}) => {
  const [audioInputs, setAudioInputs] = useState<MediaDeviceInfo[]>([]);
  const [videoInputs, setVideoInputs] = useState<MediaDeviceInfo[]>([]);
  const [audioOutputs, setAudioOutputs] = useState<MediaDeviceInfo[]>([]);

  useEffect(() => {
    async function getDevices() {
      try {
        const devices = await navigator.mediaDevices.enumerateDevices();
        setAudioInputs(devices.filter((d) => d.kind === 'audioinput'));
        setVideoInputs(devices.filter((d) => d.kind === 'videoinput'));
        setAudioOutputs(devices.filter((d) => d.kind === 'audiooutput'));
      } catch (err) {
        console.warn('Error reading media devices:', err);
      }
    }
    if (isOpen) {
      getDevices();
    }
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative w-full max-w-md bg-[#FEF7FF] rounded-3xl p-6 sm:p-7 shadow-2xl border border-[#EADDFF]">
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-5 right-5 p-2 rounded-full text-[#49454F] hover:bg-[#F3EDF7] transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Modal Header */}
        <div className="flex items-center gap-3 mb-5">
          <div className="w-10 h-10 rounded-2xl bg-[#EADDFF] flex items-center justify-center text-[#21005D]">
            <Sliders className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-[#21005D]">Audio & Video Settings</h3>
            <p className="text-xs text-[#49454F]">Configure devices, quality, and preview</p>
          </div>
        </div>

        <div className="space-y-4">
          {/* Microphone Selector */}
          <div>
            <label className="flex items-center gap-2 text-xs font-semibold text-[#21005D] mb-1.5">
              <Mic className="w-4 h-4 text-[#6750A4]" />
              Microphone
            </label>
            <select
              value={currentSettings.audioInputId}
              onChange={(e) => {
                const id = e.target.value;
                onUpdateSettings({ ...currentSettings, audioInputId: id });
                onSwitchMicrophone?.(id);
              }}
              className="w-full px-3.5 py-2.5 rounded-2xl bg-[#F3EDF7] border border-[#CAC4D0]/60 text-xs text-[#1D1B20] focus:outline-none focus:ring-2 focus:ring-[#6750A4]"
            >
              {audioInputs.length === 0 && <option value="">Default Microphone</option>}
              {audioInputs.map((d, idx) => (
                <option key={d.deviceId || idx} value={d.deviceId}>
                  {d.label || `Microphone ${idx + 1}`}
                </option>
              ))}
            </select>

            {/* Mic Test Volume Level Bar */}
            <div className="mt-2 flex items-center gap-2">
              <span className="text-[11px] text-[#49454F]">Mic Activity:</span>
              <div className="flex-1 h-2 bg-[#EADDFF] rounded-full overflow-hidden">
                <div
                  style={{ width: `${Math.min(100, currentVolume * 1.5)}%` }}
                  className="h-full bg-[#6750A4] transition-all duration-75 rounded-full"
                />
              </div>
            </div>
          </div>

          {/* Camera Selector */}
          <div>
            <label className="flex items-center gap-2 text-xs font-semibold text-[#21005D] mb-1.5">
              <Video className="w-4 h-4 text-[#6750A4]" />
              Camera
            </label>
            <select
              value={currentSettings.videoInputId}
              onChange={(e) => {
                const id = e.target.value;
                onUpdateSettings({ ...currentSettings, videoInputId: id });
                onSwitchCamera?.(id);
              }}
              className="w-full px-3.5 py-2.5 rounded-2xl bg-[#F3EDF7] border border-[#CAC4D0]/60 text-xs text-[#1D1B20] focus:outline-none focus:ring-2 focus:ring-[#6750A4]"
            >
              {videoInputs.length === 0 && <option value="">Default Camera</option>}
              {videoInputs.map((d, idx) => (
                <option key={d.deviceId || idx} value={d.deviceId}>
                  {d.label || `Camera ${idx + 1}`}
                </option>
              ))}
            </select>
          </div>

          {/* Audio Output Selector (if supported) */}
          {audioOutputs.length > 0 && (
            <div>
              <label className="flex items-center gap-2 text-xs font-semibold text-[#21005D] mb-1.5">
                <Volume2 className="w-4 h-4 text-[#6750A4]" />
                Speaker / Audio Output
              </label>
              <select
                value={currentSettings.audioOutputId}
                onChange={(e) => {
                  onUpdateSettings({ ...currentSettings, audioOutputId: e.target.value });
                }}
                className="w-full px-3.5 py-2.5 rounded-2xl bg-[#F3EDF7] border border-[#CAC4D0]/60 text-xs text-[#1D1B20] focus:outline-none focus:ring-2 focus:ring-[#6750A4]"
              >
                {audioOutputs.map((d, idx) => (
                  <option key={d.deviceId || idx} value={d.deviceId}>
                    {d.label || `Speaker ${idx + 1}`}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Mirror Video Toggle */}
          <div className="pt-2 border-t border-[#EADDFF]">
            <label className="flex items-center justify-between cursor-pointer py-1">
              <span className="text-xs font-medium text-[#1D1B20]">
                Mirror my camera preview
              </span>
              <input
                type="checkbox"
                checked={currentSettings.isMirrorMode}
                onChange={(e) =>
                  onUpdateSettings({ ...currentSettings, isMirrorMode: e.target.checked })
                }
                className="w-4 h-4 accent-[#6750A4] rounded cursor-pointer"
              />
            </label>
          </div>
        </div>

        {/* Done Button */}
        <div className="mt-6">
          <button
            onClick={onClose}
            className="w-full py-2.5 rounded-full bg-[#6750A4] hover:bg-[#523e85] text-white text-xs font-semibold transition-all active:scale-95"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};
