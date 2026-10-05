/** Tam ekran ve yön kilidi yardımcıları (Fullscreen API + iOS/PWA durumları). */

type FsDoc = Document & { webkitFullscreenElement?: Element; webkitExitFullscreen?: () => Promise<void> };
type FsEl = HTMLElement & { webkitRequestFullscreen?: () => Promise<void> };
type OrientationLock = ScreenOrientation & { lock?: (o: string) => Promise<void> };

export function isIOS(): boolean {
  return /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
}

/** Ana ekrandan (PWA) açılmış mı? Bu durumda zaten tam ekrandır. */
export function isStandalone(): boolean {
  return (
    window.matchMedia?.('(display-mode: fullscreen)').matches ||
    window.matchMedia?.('(display-mode: standalone)').matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

export function fullscreenSupported(): boolean {
  const el = document.documentElement as FsEl;
  return !!(el.requestFullscreen || el.webkitRequestFullscreen);
}

export function isFullscreen(): boolean {
  const d = document as FsDoc;
  return !!(d.fullscreenElement || d.webkitFullscreenElement) || isStandalone();
}

/** Tam ekrana geçer; dokunmatik cihazlarda yatay yönü kilitlemeyi dener. */
export async function enterFullscreen(lockLandscape = false): Promise<boolean> {
  const el = document.documentElement as FsEl;
  try {
    if (el.requestFullscreen) await el.requestFullscreen({ navigationUI: 'hide' });
    else if (el.webkitRequestFullscreen) await el.webkitRequestFullscreen();
    else return false;
  } catch {
    return false;
  }
  if (lockLandscape) {
    try {
      await (screen.orientation as OrientationLock)?.lock?.('landscape');
    } catch {
      /* bazı tarayıcılar desteklemez */
    }
  }
  return true;
}

export async function exitFullscreen(): Promise<void> {
  const d = document as FsDoc;
  try {
    if (d.exitFullscreen) await d.exitFullscreen();
    else if (d.webkitExitFullscreen) await d.webkitExitFullscreen();
  } catch {
    /* yok say */
  }
}

export async function toggleFullscreen(lockLandscape = false): Promise<boolean> {
  if (isFullscreen() && !isStandalone()) {
    await exitFullscreen();
    return false;
  }
  return enterFullscreen(lockLandscape);
}

export function onFullscreenChange(cb: () => void): void {
  document.addEventListener('fullscreenchange', cb);
  document.addEventListener('webkitfullscreenchange', cb);
}

/** Dokunmatik geri bildirim (destekleniyorsa). */
export function vibrate(pattern: number | number[]): void {
  try {
    navigator.vibrate?.(pattern);
  } catch {
    /* yok say */
  }
}
