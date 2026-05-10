import AgoraRTC, { IAgoraRTCClient, ICameraVideoTrack, IMicrophoneAudioTrack } from "agora-rtc-sdk-ng";
import { RTM } from "agora-rtm-sdk";

const APP_ID = import.meta.env.VITE_AGORA_APP_ID || "565b28c24bb04c59bd6ee0d0ce3198bd";
const TOKEN = import.meta.env.VITE_AGORA_TOKEN || null;

export const createAgoraClient = () => {
  return AgoraRTC.createClient({ mode: "live", codec: "vp8" });
};

export const createRTMClient = (uid: string) => {
  return new RTM(APP_ID, uid);
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
    // Add a small random component to UID to prevent UID_CONFLICT errors on rapid reloads
    const suffix = Math.floor(Math.random() * 1000);
    const uniqueUid = typeof uid === 'number' ? uid + suffix : `${uid}_${suffix}`;
    
    await client.join(APP_ID, channelName, TOKEN, uniqueUid);
  } catch (err: any) {
    console.error("Agora Join Error:", err);
    if (err.message?.includes("dynamic use static key")) {
      throw new Error("Security Mismatch: Your Agora project requires a Token. Either provide VITE_AGORA_TOKEN or disable 'App Certificate' in Agora Console for testing.");
    }
    if (err.message?.includes("UID_CONFLICT")) {
      throw new Error("Connection Conflict: This account is already active in another tab or window. Please close other sessions and try again.");
    }
    throw err;
  }
  
  return client;
};

export const createTracks = async () => {
  try {
    const [audioTrack, videoTrack] = await AgoraRTC.createMicrophoneAndCameraTracks();
    return { audioTrack, videoTrack };
  } catch (err: any) {
    console.error("Agora Full Track Creation Error:", err);
    
    // Fallback: Try just microphone if camera fails (common for some setups)
    if (err.name === "NotFoundError" || err.message?.includes("DEVICE_NOT_FOUND")) {
      try {
        console.log("Attempting microphone-only fallback...");
        const audioTrack = await AgoraRTC.createMicrophoneAudioTrack();
        return { audioTrack, videoTrack: null };
      } catch (micErr) {
        console.error("Mic-only fallback failed:", micErr);
      }
    }
    
    let message = "Failed to access camera or microphone.";
    
    if (err.name === "NotAllowedError" || err.message?.includes("Permission denied")) {
      message = "Permission Denied: Please click 'Allow' when your browser asks for camera access. If you're in an app preview, try opening the app in a 'New Tab'.";
    } else if (err.name === "NotFoundError" || err.name === "DevicesNotFoundError") {
      message = "No Devices Found: We couldn't detect a camera or microphone. Please plug them in and try again.";
    } else if (err.name === "NotReadableError" || err.name === "TrackStartError") {
      message = "Hardware In Use: Your camera or microphone is being used by another application (like Zoom or Teams).";
    }
    
    throw new Error(message);
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
