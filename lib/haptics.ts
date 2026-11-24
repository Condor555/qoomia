'use client';

type HapticTone='selection'|'success'|'warning';

const patterns:Record<HapticTone,number|number[]>={selection:8,success:[10,35,14],warning:[18,45,18]};

/** Optional PWA feedback. It is a no-op on Safari/iOS and when vibration is unavailable. */
export function hapticFeedback(tone:HapticTone='selection'){
  if(typeof window==='undefined'||typeof navigator==='undefined'||typeof navigator.vibrate!=='function')return;
  if(window.matchMedia?.('(prefers-reduced-motion: reduce)').matches)return;
  try{navigator.vibrate(patterns[tone])}catch{}
}
