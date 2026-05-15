import { ICameraVideoTrack, IRemoteVideoTrack } from "agora-rtc-sdk-ng";
import React, { useEffect, useRef } from "react";

interface AgoraPlayerProps {
  videoTrack: ICameraVideoTrack | IRemoteVideoTrack | undefined;
  className?: string;
  mirrored?: boolean;
}

const AgoraPlayer: React.FC<AgoraPlayerProps> = ({ videoTrack, className, mirrored }) => {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (containerRef.current && videoTrack) {
      videoTrack.play(containerRef.current);
    }
    return () => {
      if (videoTrack) {
        videoTrack.stop();
      }
    };
  }, [videoTrack]);

  return (
    <div 
      ref={containerRef} 
      className={className} 
      style={{ width: "100%", height: "100%", transform: mirrored ? "scaleX(-1)" : "none" }}
    />
  );
};

export default AgoraPlayer;
