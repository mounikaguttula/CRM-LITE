import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';

// Global error handler to catch 3rd-party script timeouts (e.g. Google reCAPTCHA) and prevent app runtime crashes
if (typeof window !== 'undefined') {
  window.addEventListener('error', (event) => {
    const msg = String(event?.message || event?.error?.message || '');
    const filename = String(event?.filename || '');
    if (
      msg.includes('reCAPTCHA') ||
      msg.includes('recaptcha') ||
      filename.includes('gstatic.com') ||
      filename.includes('recaptcha')
    ) {
      console.warn('[Production Resilience] Suppressed 3rd-party reCAPTCHA timeout error:', msg);
      event.preventDefault();
      event.stopImmediatePropagation();
    }
  });

  window.addEventListener('unhandledrejection', (event) => {
    const reason = String(event?.reason?.message || event?.reason || '');
    if (reason.includes('reCAPTCHA') || reason.includes('recaptcha')) {
      console.warn('[Production Resilience] Suppressed 3rd-party reCAPTCHA promise rejection:', reason);
      event.preventDefault();
    }
  });
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <App />
);
