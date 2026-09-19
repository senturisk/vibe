export interface ParticipantInfo {
  id: string;
  name: string;
  isAudioMuted: boolean;
  isVideoMuted: boolean;
  isScreenSharing: boolean;
  isScreenAudioActive?: boolean;
  isSpeaking?: boolean;
  volumeLevel?: number; // 0 - 100
}

export interface RemotePeer {
  id: string;
  name: string;
  stream?: MediaStream;
  isAudioMuted: boolean;
  isVideoMuted: boolean;
  isScreenSharing: boolean;
  isScreenAudioActive?: boolean;
  volumeLevel: number;
  isSpeaking: boolean;
}

export interface ChatMessage {
  id: string;
  senderId: string;
  senderName: string;
  text: string;
  timestamp: number;
  isSystem?: boolean;
}

export type LayoutMode = 'grid' | 'spotlight';

export interface DeviceSettings {
  audioInputId: string;
  videoInputId: string;
  audioOutputId: string;
  videoResolution: '720p' | '1080p' | '480p';
  isMirrorMode: boolean;
  theme: 'light' | 'dark';
}

export type ConnectionStatus = 'disconnected' | 'connecting' | 'connected' | 'reconnecting' | 'error';
