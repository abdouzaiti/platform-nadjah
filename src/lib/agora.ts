import AgoraRTC, { IAgoraRTCClient, ICameraVideoTrack, IMicrophoneAudioTrack } from "agora-rtc-sdk-ng";

const APP_ID = (import.meta as any).env.VITE_AGORA_APP_ID || "YOUR_APP_ID";

export const createAgoraClient = () => {
  return AgoraRTC.createClient({ mode: "live", codec: "vp8" });
};

export const joinChannel = async (
  client: IAgoraRTCClient,
  channelName: string,
  uid: string | number | null = null,
  role: "host" | "audience" = "audience"
) => {
  if (role === "host") {
    await client.setClientRole("host");
  } else {
    await client.setClientRole("audience");
  }

  // Tokens are optional for development if not enabled in Agora console
  // In production, you must use a token server
  await client.join(APP_ID, channelName, null, uid);
  
  return client;
};

export const createTracks = async () => {
  const [audioTrack, videoTrack] = await AgoraRTC.createMicrophoneAndCameraTracks();
  return { audioTrack, videoTrack };
};

export const leaveChannel = async (
  client: IAgoraRTCClient,
  tracks?: { audioTrack?: IMicrophoneAudioTrack; videoTrack?: ICameraVideoTrack }
) => {
  if (tracks?.audioTrack) {
    tracks.audioTrack.stop();
    tracks.audioTrack.close();
  }
  if (tracks?.videoTrack) {
    tracks.videoTrack.stop();
    tracks.videoTrack.close();
  }
  await client.leave();
};
