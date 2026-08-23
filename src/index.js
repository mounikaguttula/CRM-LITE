import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';

// Global error handler to catch 3rd-party script timeouts (e.g. Google reCAPTCHA) and prevent app runtime crashes
if (typeof window !== 'undefined') {
  const isRecaptchaError = (errObj, msg, filename) => {
    const str = `${String(msg || '')} ${String(filename || '')} ${String(errObj?.message || '')} ${String(errObj?.stack || '')} ${String(errObj || '')}`;
    return str.includes('reCAPTCHA') || str.includes('recaptcha') || str.includes('gstatic.com');
  };

  window.addEventListener('error', (event) => {
    if (isRecaptchaError(event?.error, event?.message, event?.filename)) {
      console.warn('[Production Resilience] Suppressed 3rd-party reCAPTCHA error:', event.message);
      event.preventDefault();
      event.stopImmediatePropagation();
    }
  }, true);

  window.addEventListener('unhandledrejection', (event) => {
    const reasonStr = String(event?.reason?.message || event?.reason?.stack || event?.reason || '');
    if (isRecaptchaError(event?.reason, reasonStr, '')) {
      console.warn('[Production Resilience] Suppressed 3rd-party reCAPTCHA promise rejection:', reasonStr);
      event.preventDefault();
      event.stopImmediatePropagation();
    }
  }, true);
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <App />
);
