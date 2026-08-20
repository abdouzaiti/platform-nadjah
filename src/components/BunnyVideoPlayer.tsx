import React from "react";
import { Play, Maximize2, ExternalLink, Film, AlertCircle } from "lucide-react";

interface BunnyVideoPlayerProps {
  url: string;
  title?: string;
  className?: string;
  autoPlay?: boolean;
}

export default function BunnyVideoPlayer({
  url,
  title,
  className = "",
  autoPlay = false
}: BunnyVideoPlayerProps) {
  if (!url) {
    return (
      <div className={`aspect-video bg-slate-900 rounded-2xl flex flex-col items-center justify-center text-slate-500 p-6 ${className}`}>
        <Film className="h-10 w-10 mb-2 opacity-40" />
        <p className="text-xs font-bold uppercase tracking-wider">No Video URL Provided</p>
      </div>
    );
  }

  // Helper to extract iframe src if user pasted an entire <iframe> code
  const getCleanUrl = (input: string): string => {
    let clean = input.trim();
    if (clean.includes("<iframe") && clean.includes('src=')) {
      const match = clean.match(/src=["']([^"']+)["']/i);
      if (match && match[1]) {
        clean = match[1];
      }
    }
    
    // Convert Bunny Stream play link if pased as play instead of embed
    if (clean.includes("iframe.mediadelivery.net/play/")) {
      clean = clean.replace("/play/", "/embed/");
    }

    return clean;
  };

  const finalUrl = getCleanUrl(url);

  // Check if URL is an iframe embed (Bunny Stream, Youtube, Vimeo, etc.)
  const isEmbed = 
    finalUrl.includes("iframe.mediadelivery.net") ||
    finalUrl.includes("b-cdn.net/embed") ||
    finalUrl.includes("bunnycdn.com") ||
    finalUrl.includes("youtube.com/embed") ||
    finalUrl.includes("vimeo.com") ||
    finalUrl.includes("player.");

  return (
    <div className={`relative aspect-video w-full bg-slate-950 rounded-2xl overflow-hidden shadow-2xl border border-slate-800 flex flex-col group ${className}`}>
      {isEmbed ? (
        <iframe
          src={`${finalUrl}${finalUrl.includes('?') ? '&' : '?'}autoplay=${autoPlay ? 'true' : 'false'}&loop=false&muted=false&preload=true&responsive=true`}
          title={title || "Bunny Stream Video"}
          className="w-full h-full border-0 rounded-2xl"
          loading="lazy"
          allow="accelerometer; gyroscope; autoplay; encrypted-media; picture-in-picture; fullscreen"
          allowFullScreen
        />
      ) : (
        <video
          src={finalUrl}
          controls
          autoPlay={autoPlay}
          controlsList="nodownload"
          playsInline
          className="w-full h-full object-contain rounded-2xl"
          poster=""
        >
          Your browser does not support HTML5 video playback.
        </video>
      )}

      {title && (
        <div className="absolute top-0 inset-x-0 p-3 bg-gradient-to-b from-black/80 to-transparent opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none flex items-center justify-between">
          <span className="text-white text-xs font-black uppercase tracking-wider truncate px-2">
            {title}
          </span>
          <span className="bg-orange-500/90 text-white text-[9px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-full shrink-0">
            Bunny.net Stream
          </span>
        </div>
      )}
    </div>
  );
}
