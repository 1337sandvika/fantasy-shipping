import { useCallback, useEffect, useRef, useState } from "react";
import { useT } from "@/i18n";

const VIDEO = "/game/helm/collision-sink.mp4";
const GIF = "/game/helm/collision-sink.gif";
const POSTER = "/game/helm/collision-sink-poster.jpg";
const END = "/game/helm/collision-sink-end.jpg";
const FRAMES = [
  "/game/helm/sink-seq/01.jpg",
  "/game/helm/sink-seq/02.jpg",
  "/game/helm/sink-seq/03.jpg",
  "/game/helm/sink-seq/04.jpg",
  "/game/helm/sink-seq/05.jpg",
  "/game/helm/sink-seq/06.jpg",
  "/game/helm/sink-seq/07.jpg",
  "/game/helm/sink-seq/08.jpg",
] as const;
const DURATION_MS = 5230;

type Media = "video" | "gif" | "seq";

function isNativeWebView() {
  if (typeof window === "undefined") return false;
  try {
    const cap = (window as unknown as { Capacitor?: { isNativePlatform?: () => boolean } }).Capacitor;
    return Boolean(cap?.isNativePlatform?.());
  } catch {
    return false;
  }
}

export function SinkSequence({ playing, onDone }: { playing: boolean; onDone: () => void }) {
  const t = useT();
  const videoRef = useRef<HTMLVideoElement>(null);
  const doneRef = useRef(false);
  const [media, setMedia] = useState<Media>(() => (isNativeWebView() ? "gif" : "video"));
  const [frame, setFrame] = useState(0);
  const [skipReady, setSkipReady] = useState(false);

  const finish = useCallback(() => {
    if (doneRef.current) return;
    doneRef.current = true;
    const v = videoRef.current;
    if (v && !v.paused) v.pause();
    onDone();
  }, [onDone]);

  useEffect(() => {
    if (!playing) return;
    doneRef.current = false;
    setSkipReady(false);
    setFrame(0);
    const skipAt = window.setTimeout(() => setSkipReady(true), 900);
    const hard = window.setTimeout(finish, DURATION_MS + 280);
    return () => {
      window.clearTimeout(skipAt);
      window.clearTimeout(hard);
    };
  }, [playing, finish]);

  useEffect(() => {
    if (!playing || media !== "seq") return;
    const step = DURATION_MS / Math.max(1, FRAMES.length - 1);
    setFrame(0);
    let i = 0;
    const id = window.setInterval(() => {
      i += 1;
      if (i >= FRAMES.length - 1) {
        setFrame(FRAMES.length - 1);
        window.clearInterval(id);
        finish();
        return;
      }
      setFrame(i);
    }, step);
    return () => window.clearInterval(id);
  }, [playing, media, finish]);

  useEffect(() => {
    if (!playing || media !== "video") return;
    const v = videoRef.current;
    if (!v) return;
    try {
      v.currentTime = 0;
    } catch {
      /* ignore */
    }
    const play = v.play();
    if (play) play.catch(() => setMedia("gif"));
  }, [playing, media]);

  const still = !playing;
  const raster =
    still ? END : media === "seq" ? (FRAMES[frame] ?? POSTER) : media === "gif" ? GIF : POSTER;

  return (
    <div className="harbour-grain relative min-h-0 flex-1 overflow-hidden bg-bg">
      {media === "video" && !still ? (
        <video
          ref={videoRef}
          className="absolute inset-0 h-full w-full object-cover"
          src={VIDEO}
          poster={POSTER}
          muted
          playsInline
          preload="auto"
          onEnded={finish}
          onError={() => setMedia("gif")}
        />
      ) : (
        <img
          src={raster}
          alt=""
          className="absolute inset-0 h-full w-full object-cover"
          draggable={false}
          onError={() => {
            if (media === "gif") setMedia("seq");
          }}
        />
      )}
      <div
        className={`pointer-events-none absolute inset-0 z-10 ${playing ? "bg-linear-to-t from-bg/35 via-transparent to-bg/25" : "harbour-hero"}`}
      />
      {playing ? (
        <p className="absolute left-1/2 top-[max(2.5rem,env(safe-area-inset-top))] z-20 -translate-x-1/2 rounded-md border border-danger/70 bg-danger/85 px-5 py-2 font-display text-lg tracking-[0.35em] text-fg">
          {t("wreck.impact")}
        </p>
      ) : null}
      {playing && skipReady ? (
        <button
          type="button"
          className="absolute bottom-[max(1.25rem,env(safe-area-inset-bottom))] right-4 z-20 min-h-11 rounded-md border border-border bg-bg-elevated/90 px-4 text-sm text-muted"
          onClick={finish}
        >
          {t("wreck.skip")}
        </button>
      ) : null}
    </div>
  );
}
