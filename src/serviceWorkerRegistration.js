// Simplified CRA service worker registration for PWA
export function registerSW() {
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('/firebase-messaging-sw.js').catch(() => {});
    });
  }
}

