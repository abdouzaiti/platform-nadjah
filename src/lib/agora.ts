import AgoraRTC, { IAgoraRTCClient, ICameraVideoTrack, IMicrophoneAudioTrack } from "agora-rtc-sdk-ng";

const APP_ID = import.meta.env.VITE_AGORA_APP_ID || "565b28c24bb04c59bd6ee0d0ce3198bd";
const TOKEN = import.meta.env.VITE_AGORA_TOKEN || null;

export const createAgoraClient = () => {
  return AgoraRTC.createClient({ mode: "live", codec: "vp8" });
};

export const joinChannel = async (
  client: IAgoraRTCClient,
  channelName: string,
  uid: string | number | null = null,
  role: "host" | "audience" = "audience"
) => {
  if (!APP_ID) {
    throw new Error("Agora App ID is missing. Please set VITE_AGORA_APP_ID in your environment.");
  }

  if (role === "host") {
    await client.setClientRole("host");
  } else {
    await client.setClientRole("audience");
  }

  try {
    // Attempt to join with token if provided, otherwise null
    await client.join(APP_ID, channelName, TOKEN, uid);
  } catch (err: any) {
    console.error("Agora Join Error:", err);
    if (err.message?.includes("dynamic use static key")) {
      throw new Error("Security Mismatch: Your Agora project requires a Token. Either provide VITE_AGORA_TOKEN or disable 'App Certificate' in Agora Console for testing.");
    }
    throw err;
  }
  
  return client;
};

export const createTracks = async () => {
  try {
    const [audioTrack, videoTrack] = await AgoraRTC.createMicrophoneAndCameraTracks();
    return { audioTrack, videoTrack };
  } catch (err) {
    console.error("Agora Track Creation Error:", err);
    throw new Error("Failed to access camera or microphone. Please check permissions.");
  }
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
