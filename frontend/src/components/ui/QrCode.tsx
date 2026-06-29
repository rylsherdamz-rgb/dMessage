'use client';

import { useEffect, useRef, useState } from 'react';
import QRCodeLib from 'qrcode';
import { X } from 'lucide-react';

function isLight(): boolean {
  return document.documentElement.classList.contains('light');
}

export function QrCode({ data, size = 180 }: { data: string; size?: number }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!canvasRef.current) return;
    const dark = isLight() ? '#111111' : '#f0f0f0';
    QRCodeLib.toCanvas(canvasRef.current, data, {
      width: size,
      margin: 2,
      color: { dark, light: '#ffffff00' },
    });
  }, [data, size]);

  return (
    <>
      <canvas
        ref={canvasRef}
        width={size}
        height={size}
        className="brutal-static block cursor-pointer"
        style={{ imageRendering: 'pixelated' }}
        onClick={() => setOpen(true)}
      />
      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm"
          onClick={() => setOpen(false)}
        >
          <div
            className="relative"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={() => setOpen(false)}
              className="absolute -right-3 -top-3 z-10 flex h-8 w-8 items-center justify-center border-2 border-[var(--border-strong)] bg-[var(--bg)] text-[var(--text-muted)] transition-colors hover:text-[var(--accent)]"
            >
              <X className="h-4 w-4" strokeWidth={2} />
            </button>
            <QrCodeModal data={data} />
          </div>
        </div>
      )}
    </>
  );
}

function QrCodeModal({ data }: { data: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (!canvasRef.current) return;
    const dark = isLight() ? '#111111' : '#f0f0f0';
    QRCodeLib.toCanvas(canvasRef.current, data, {
      width: 300,
      margin: 3,
      color: { dark, light: '#ffffff00' },
    });
  }, [data]);

  return (
    <canvas
      ref={canvasRef}
      width={300}
      height={300}
      className="brutal-static block border-4"
      style={{ imageRendering: 'pixelated' }}
    />
  );
}
