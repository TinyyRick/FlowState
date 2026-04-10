import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';

// Desktop-widget click-through:
// - When hovering over sticky notes or the right sidebar, disable click-through.
// - Otherwise enable click-through so clicks pass to the desktop.
const maybeSetIgnore = (ignore: boolean) => {
  if (window.electron && typeof window.electron.setIgnoreMouseEvents === 'function') {
    window.electron.setIgnoreMouseEvents(ignore, { forward: true });
  }
};

let lastIgnore: boolean | null = null;
const setIgnoreIfNeeded = (ignore: boolean) => {
  if (lastIgnore === ignore) return;
  lastIgnore = ignore;
  maybeSetIgnore(ignore);
};

const isHoveringWidgetUI = (clientX: number, clientY: number) => {
  const el = document.elementFromPoint(clientX, clientY) as HTMLElement | null;
  if (!el) return false;
  return !!el.closest?.('[data-electron-widget]');
};

// Use pointermove so it works with touch/trackpad and can react while click-through is enabled.
window.addEventListener(
  'pointermove',
  (e) => {
    if (e.clientX === undefined || e.clientY === undefined) return;
    const shouldIgnore = !isHoveringWidgetUI(e.clientX, e.clientY);
    setIgnoreIfNeeded(shouldIgnore);
  },
  { passive: true }
);

window.addEventListener('blur', () => setIgnoreIfNeeded(true));

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

const root = ReactDOM.createRoot(rootElement);
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);