import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import './styles.css';

const container = document.getElementById('root');
if (!container) throw new Error('Renderer root element is missing');

/**
 * Renderer crashes go to the main process, which decides whether to send them
 * (spec §14). The renderer never posts anything itself: it has no session
 * token, and the opt-in setting lives on the other side of the bridge, so a
 * report can only leave this machine through code that has checked it.
 */
const forward = (name: string, message: string, stack: string): void => {
  void window.vcwriter?.reportError({ name, message, stack }).catch(() => undefined);
};

window.addEventListener('error', (event) => {
  forward(event.error?.name ?? 'Error', event.error?.message ?? event.message, event.error?.stack ?? '');
});

window.addEventListener('unhandledrejection', (event) => {
  const reason = event.reason;
  forward(
    reason instanceof Error ? reason.name : 'UnhandledRejection',
    reason instanceof Error ? reason.message : String(reason ?? ''),
    reason instanceof Error ? (reason.stack ?? '') : '',
  );
});

createRoot(container).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
