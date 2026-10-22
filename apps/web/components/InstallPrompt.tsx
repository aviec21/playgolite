"use client";

import { useEffect, useState } from "react";

interface InstallEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

const DISMISS_KEY = "playgolite:install-dismissed";

/** Offers to install the app. Chrome and Edge show a button; iPhone and iPad get the manual steps. */
export function InstallPrompt() {
  const [event, setEvent] = useState<InstallEvent | null>(null);
  const [ios, setIos] = useState(false);
  const [hidden, setHidden] = useState(true);

  useEffect(() => {
    const standalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      (navigator as Navigator & { standalone?: boolean }).standalone === true;
    let dismissed = false;
    try {
      dismissed = localStorage.getItem(DISMISS_KEY) === "1";
    } catch {
      /* ignore */
    }
    if (standalone || dismissed) return;
    const ua = navigator.userAgent;
    const isIos = /iPad|iPhone|iPod/.test(ua) || (ua.includes("Mac") && navigator.maxTouchPoints > 1);
    setIos(isIos);
    setHidden(!isIos);
    const onPrompt = (e: Event) => {
      e.preventDefault();
      setEvent(e as InstallEvent);
      setHidden(false);
    };
    const onInstalled = () => setHidden(true);
    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  if (hidden) return null;

  const dismiss = () => {
    setHidden(true);
    try {
      localStorage.setItem(DISMISS_KEY, "1");
    } catch {
      /* ignore */
    }
  };

  return (
    <div className="card stack">
      <h2>Install PlayGoLite</h2>
      {ios && !event ? (
        <p>Tap the Share button in Safari, then Add to Home Screen. It then opens full screen and works offline.</p>
      ) : (
        <p>Add it to your device. It opens full screen and works offline.</p>
      )}
      <div className="row">
        {event && (
          <button
            className="btn primary grow"
            onClick={async () => {
              await event.prompt();
              const choice = await event.userChoice;
              if (choice.outcome === "accepted") setHidden(true);
              setEvent(null);
            }}
          >
            Install
          </button>
        )}
        <button className="btn grow" onClick={dismiss}>
          Not now
        </button>
      </div>
    </div>
  );
}
