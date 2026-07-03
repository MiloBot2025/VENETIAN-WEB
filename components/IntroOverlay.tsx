'use client';

import { useEffect, useRef, useState } from 'react';
import Image from 'next/image';
import { usePathname } from 'next/navigation';

export default function IntroOverlay() {
  const [show, setShow] = useState(false);
  const [started, setStarted] = useState(false);
  const [fadingOut, setFadingOut] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const pathname = usePathname();

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (pathname?.startsWith('/demo-glass')) return; // demo sin intro
    const SEVENTY_TWO_HS = 72 * 60 * 60 * 1000;
    const lastShown = parseInt(localStorage.getItem('intro_last_shown') || '0', 10);
    if (lastShown && Date.now() - lastShown < SEVENTY_TWO_HS) return;
    localStorage.setItem('intro_last_shown', String(Date.now()));
    setShow(true);
  }, []);

  useEffect(() => {
    if (!show) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') dismiss();
    };
    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = '';
      window.removeEventListener('keydown', onKey);
    };
  }, [show]);

  function dismiss() {
    if (fadingOut) return;
    setFadingOut(true);
    setTimeout(() => setShow(false), 600);
  }

  function handleEnter() {
    setStarted(true);
    const v = videoRef.current;
    if (!v) return;
    v.muted = false;
    v.volume = 1;

    v.currentTime = 0;
    v.play().catch(() => {
      v.muted = true;
      v.play();
    });
  }

  if (!show) return null;

  return (
    <div
      className={`fixed inset-0 z-[9999] bg-black flex items-center justify-center transition-opacity duration-500 ${
        fadingOut ? 'opacity-0' : 'opacity-100'
      }`}
    >
      {/* Pantalla inicial: logo + botón Entrar */}
      {!started && (
        <div className="flex flex-col items-center gap-10 animate-fade-in">
          <Image
            src="/logo.png"
            alt="Venetian"
            width={220}
            height={220}
            priority
            className="rounded-full"
          />
          <button
            onClick={handleEnter}
            className="rounded-lg bg-gradient-to-r from-blue-600 to-purple-600 px-12 py-4 text-base font-semibold text-white shadow-2xl shadow-blue-900/50 hover:opacity-90 hover:scale-105 transition-all sm:text-lg tracking-wider uppercase"
          >
            Entrar
          </button>
        </div>
      )}

      {/* Video — montado siempre pero oculto hasta started */}
      <video
        ref={videoRef}
        playsInline
        preload="metadata"
        onEnded={dismiss}
        className={`absolute inset-0 h-full w-full object-cover transition-opacity duration-500 ${
          started ? 'opacity-100' : 'opacity-0 pointer-events-none'
        }`}
      >
        <source src="/videos/intro.mp4" type="video/mp4" />
      </video>

      {started && (
        <button
          onClick={dismiss}
          className="absolute top-6 right-6 z-10 rounded-full bg-white/10 backdrop-blur px-4 py-2 text-xs font-semibold text-white hover:bg-white/20 transition-colors"
        >
          Saltar intro
        </button>
      )}
    </div>
  );
}
