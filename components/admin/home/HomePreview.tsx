"use client";

import { useEffect, useRef, useState } from "react";
import { PREVIEW_MESSAGE, PREVIEW_SIZE_MESSAGE, STUDIO_SECTIONS, type StudioSectionId } from "@/lib/home-studio";
import type { HomeContent } from "@/lib/types";
import s from "./studio.module.css";

const DEVICES = { desktop: { label: "Desktop", width: 1280 }, tablet: { label: "Tablet", width: 768 }, phone: { label: "Phone", width: 390 } } as const;
type Device = keyof typeof DEVICES;

/**
 * The selected section drawn by the public homepage's own components, in an
 * iframe at a real device width — so the homepage's own stylesheet, media
 * queries included, lays it out exactly as visitors see it — then scaled to
 * fit the column. The frame (/admin/preview/home) renders what it is sent and
 * nothing else: it reads nothing from this page but the message, and writes
 * nothing anywhere.
 */
export function HomePreview({ section, content, unsaved }: { section: StudioSectionId; content: HomeContent; unsaved: boolean }) {
  // Until the editor picks one, the widest device that still reads at a useful size in this column.
  const [chosen, setDevice] = useState<Device | null>(null);
  const [open, setOpen] = useState(false);
  const [ready, setReady] = useState(false);
  const [height, setHeight] = useState(480);
  const [boxWidth, setBoxWidth] = useState(0);
  const frame = useRef<HTMLIFrameElement>(null);
  const box = useRef<HTMLDivElement>(null);
  const device: Device = chosen ?? (boxWidth >= 0.6 * DEVICES.desktop.width ? "desktop" : boxWidth >= 0.6 * DEVICES.tablet.width ? "tablet" : "phone");
  const width = DEVICES[device].width;
  const scale = boxWidth ? Math.min(1, boxWidth / width) : 0;
  const label = STUDIO_SECTIONS.find((x) => x.id === section)?.label ?? "";

  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const observer = new ResizeObserver(([entry]) => setBoxWidth(entry.contentRect.width));
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const onMessage = (event: MessageEvent) => {
      if (event.origin !== location.origin || event.source !== frame.current?.contentWindow) return;
      const data = event.data as { type?: string; height?: number };
      if (data?.type !== PREVIEW_SIZE_MESSAGE) return;
      setReady(true);
      if (typeof data.height === "number" && data.height > 0) setHeight(Math.min(Math.ceil(data.height), 8000));
    };
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, []);

  // Sent a moment after typing stops, and again whenever the frame (re)loads.
  useEffect(() => {
    if (!ready) return;
    const timer = window.setTimeout(() => {
      frame.current?.contentWindow?.postMessage({ type: PREVIEW_MESSAGE, section, content }, location.origin);
    }, 120);
    return () => window.clearTimeout(timer);
  }, [ready, section, content]);

  return (
    <aside className={s.preview} data-open={open} aria-label="Live preview">
      <div className={s.previewHead}>
        <div className={s.previewTitle}>
          <h3>Live preview</h3>
          <span>
            {label} · {unsaved ? "with your unsaved edits" : "as saved"}
          </span>
        </div>
        <button type="button" className={s.previewToggle} aria-expanded={open} aria-controls="home-preview-body" onClick={() => setOpen((o) => !o)}>
          {open ? "Hide preview" : "Show preview"}
        </button>
      </div>
      <div id="home-preview-body" className={s.previewBody}>
        <div className={s.previewTools}>
          <div className={s.segmented} role="group" aria-label="Preview width">
            {(Object.keys(DEVICES) as Device[]).map((key) => (
              <button key={key} type="button" aria-pressed={device === key} onClick={() => setDevice(key)}>
                {DEVICES[key].label}
              </button>
            ))}
          </div>
          <a className={s.linkButton} href="/" target="_blank" rel="noopener noreferrer">
            Open homepage ↗
          </a>
        </div>
        <div ref={box} className={s.frameBox} style={{ height: scale ? Math.round(height * scale) : undefined }}>
          <iframe
            ref={frame}
            src="/admin/preview/home"
            title={`Live preview of ${label}, ${DEVICES[device].label.toLowerCase()} width`}
            className={s.frame}
            style={{ width, height, transform: `scale(${scale || 1})`, visibility: scale ? "visible" : "hidden" }}
          />
        </div>
        <p className={s.note}>
          {DEVICES[device].label}, {width}px wide{scale < 1 && scale ? `, shown at ${Math.round(scale * 100)}%` : ""}. A preview only: nothing here is saved or published.
        </p>
      </div>
    </aside>
  );
}
