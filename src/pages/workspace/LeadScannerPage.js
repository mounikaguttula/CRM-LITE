import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiPost } from '../../api/client';
import {
  QrCode, Camera, Users, Check, AlertTriangle,
  Upload, CheckCircle2, VideoOff
} from 'lucide-react';

/* Presentation Helper Styles */
const labelStyle = {
  display: 'block',
  fontSize: '0.7rem',
  fontWeight: 800,
  color: '#64748b',
  textTransform: 'uppercase',
  letterSpacing: '0.1em',
  marginBottom: '6px',
};

const inputStyle = {
  width: '100%',
  height: '42px',
  padding: '0 14px',
  fontSize: '0.86rem',
  fontWeight: 500,
  color: '#0f172a',
  backgroundColor: '#f8fafc',
  border: '1.5px solid #e2e8f0',
  borderRadius: '11px',
  outline: 'none',
  fontFamily: 'inherit',
  boxSizing: 'border-box',
  transition: 'all 0.18s ease',
};

const RECAPTCHA_SITE_KEY = '6LdcTZ8sAAAAAFSa0nodDG0cRSYVSagjkhcL5Lzh';

const DEMO_PAYLOADS = [
  {
    label: 'Sarah Connor (Executive JSON)',
    data: JSON.stringify({
      name: 'Sarah Connor',
      email: 'sarah.connor@cyberdyne.io',
      phone: '+1 (555) 234-5678',
      company: 'Cyberdyne Systems',
      title: 'VP of Technology',
      description: 'Met at Tech Summit. Interested in CRM deployment.',
    }, null, 2),
  },
  {
    label: 'Michael Scott (vCard Standard)',
    data: `BEGIN:VCARD\nVERSION:3.0\nN:Scott;Michael;;;\nFN:Michael Scott\nORG:Dunder Mifflin Paper Co\nTITLE:Regional Manager\nTEL;TYPE=CELL:+1 (555) 867-5309\nEMAIL;TYPE=WORK:m.scott@dundermifflin.com\nNOTE:Wants bulk pricing for paper & CRM.\nEND:VCARD`,
  },
  {
    label: 'Elena Rostova (Key-Value Format)',
    data: `Name: Elena Rostova\nEmail: elena@globalreach.de\nPhone: +49 30 123456\nCompany: Global Reach GmbH\nTitle: Head of Global Sales\nNotes: Requires multi-currency CRM setup.`,
  },
];

function LeadScannerPage() {
  const navigate = useNavigate();
  const [cameraActive, setCameraActive] = useState(false);
  const [cameraError, setCameraError] = useState(null);
  const [successScan, setSuccessScan] = useState(false);
  const [lastScannedText, setLastScannedText] = useState('');
  const [rawPayload, setRawPayload] = useState('');
  const [manualPayload, setManualPayload] = useState('');
  const [saving, setSaving] = useState(false);
  const [scannerStatus, setScannerStatus] = useState('Idle');

  /* reCAPTCHA State */
  const [captchaVerifying, setCaptchaVerifying] = useState(false);
  const [captchaVerified, setCaptchaVerified] = useState(false);
  const [captchaToken, setCaptchaToken] = useState('');

  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const scanIntervalRef = useRef(null);
  const fileInputRef = useRef(null);

  const [leadForm, setLeadForm] = useState({
    name: '',
    first_name: '',
    last_name: '',
    email: '',
    phone: '',
    company: '',
    title: '',
    lead_source: 'QR Scan',
    description: '',
  });

  /* Dynamically load jsQR script & Google reCAPTCHA v2 Script */
  useEffect(() => {
    if (!window.jsQR) {
      const script = document.createElement('script');
      script.src = 'https://cdn.jsdelivr.net/npm/jsqr@1.4.0/dist/jsQR.js';
      script.async = true;
      document.body.appendChild(script);
    }

    // Google reCAPTCHA v2 Integration
    window.onGoogleReCaptchaLoad = () => {
      if (window.grecaptcha && document.getElementById('recaptcha-widget-container')) {
        try {
          const container = document.getElementById('recaptcha-widget-container');
          if (container && container.innerHTML === '') {
            window.grecaptcha.render('recaptcha-widget-container', {
              sitekey: RECAPTCHA_SITE_KEY,
              callback: (token) => {
                console.log('[Frontend reCAPTCHA] Token received from Google widget:', token);
                setCaptchaToken(token);
                setCaptchaVerified(true);
              },
              'expired-callback': () => {
                console.log('[reCAPTCHA] Token expired. Auto-resetting...');
                setCaptchaVerified(false);
                setCaptchaToken('');
                try { if (window.grecaptcha) window.grecaptcha.reset(); } catch (e) {}
              },
              'error-callback': (err) => {
                console.warn('[reCAPTCHA] Network timeout or script error caught gracefully:', err);
                setCaptchaVerified(false);
                setCaptchaToken('');
                try { if (window.grecaptcha) window.grecaptcha.reset(); } catch (e) {}
              },
            });
          }
        } catch (e) {
          console.warn('reCAPTCHA render error:', e);
        }
      }
    };

    if (!window.grecaptcha) {
      const script = document.createElement('script');
      script.src = 'https://www.google.com/recaptcha/api.js?onload=onGoogleReCaptchaLoad&render=explicit';
      script.async = true;
      script.defer = true;
      document.body.appendChild(script);
      setTimeout(() => {
        window.onGoogleReCaptchaLoad();
      }, 300);
    }
  }, []);

  /* Proactive reCAPTCHA Reset Timer (Resets at 1m 50s before Google 2m timeout) */
  useEffect(() => {
    const refreshTimer = setInterval(() => {
      if (window.grecaptcha && typeof window.grecaptcha.reset === 'function') {
        try {
          console.log('[reCAPTCHA Shield] Proactively refreshing reCAPTCHA before 2min timeout...');
          window.grecaptcha.reset();
          setCaptchaVerified(false);
          setCaptchaToken('');
        } catch (e) {}
      }
    }, 110000); // 110 seconds

    return () => clearInterval(refreshTimer);
  }, []);

  /* Stop Camera Stream & Interval */
  const stopCamera = () => {
    if (scanIntervalRef.current) {
      clearInterval(scanIntervalRef.current);
      scanIntervalRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    setCameraActive(false);
    setScannerStatus('Stopped');
  };

  /* Toggle & Request Camera Permission with Device Fallbacks */
  const toggleCamera = async () => {
    if (cameraActive) {
      stopCamera();
    } else {
      setCameraError(null);
      setScannerStatus('Starting Camera...');
      try {
        let stream;
        try {
          stream = await navigator.mediaDevices.getUserMedia({
            video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } }
          });
        } catch (e1) {
          try {
            stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' } });
          } catch (e2) {
            stream = await navigator.mediaDevices.getUserMedia({ video: true });
          }
        }

        streamRef.current = stream;
        setCameraActive(true);
        setScannerStatus('Scanning for QR/Barcodes...');

        setTimeout(() => {
          if (videoRef.current) {
            videoRef.current.srcObject = stream;
            videoRef.current.play().catch((e) => console.warn('Video play error:', e));
          }
        }, 150);

        startScanningLoop();
      } catch (err) {
        console.error('Camera access error:', err);
        setCameraError(err.message || 'Camera permission denied or no camera device found on this computer.');
        setCameraActive(false);
        setScannerStatus('Error');
      }
    }
  };

  /* Dual-Engine Frame Scanning Loop (BarcodeDetector + jsQR Canvas Fallback) */
  const startScanningLoop = () => {
    if (scanIntervalRef.current) clearInterval(scanIntervalRef.current);

    const scanInterval = setInterval(async () => {
      if (!videoRef.current || videoRef.current.readyState !== 4) return;
      const video = videoRef.current;

      let detectedText = null;

      if ('BarcodeDetector' in window) {
        try {
          const barcodeDetector = new window.BarcodeDetector({
            formats: ['qr_code', 'aztec', 'code_128', 'code_39', 'data_matrix', 'ean_13', 'ean_8', 'pdf417', 'upc_a', 'upc_e']
          });
          const barcodes = await barcodeDetector.detect(video);
          if (barcodes.length > 0 && barcodes[0].rawValue) {
            detectedText = barcodes[0].rawValue;
          }
        } catch (e) {}
      }

      if (!detectedText && window.jsQR) {
        try {
          const canvas = document.createElement('canvas');
          canvas.width = video.videoWidth || 640;
          canvas.height = video.videoHeight || 480;
          const ctx = canvas.getContext('2d');
          if (ctx) {
            ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
            const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
            const code = window.jsQR(imageData.data, imageData.width, imageData.height, {
              inversionAttempts: 'dontInvert',
            });
            if (code && code.data) {
              detectedText = code.data;
            }
          }
        } catch (e) {}
      }

      if (detectedText && detectedText !== lastScannedText) {
        setLastScannedText(detectedText);
        parsePayloadText(detectedText);
        setSuccessScan(true);
        setTimeout(() => setSuccessScan(false), 3000);
      }
    }, 400);

    scanIntervalRef.current = scanInterval;
  };

  useEffect(() => {
    return () => {
      stopCamera();
    };
  }, []);

  /* Smart Multi-Format QR / vCard / Barcode / URL Payload Parser */
  const parsePayloadText = (text) => {
    if (!text || !text.trim()) return;
    setRawPayload(text);
    setManualPayload(text);

    let parsed = {
      name: '',
      email: '',
      phone: '',
      company: '',
      title: '',
      lead_source: 'QR Scan',
      description: text,
    };

    const cleanText = text.trim();

    if (cleanText.startsWith('http://') || cleanText.startsWith('https://')) {
      try {
        const urlObj = new URL(cleanText);
        const params = urlObj.searchParams;
        parsed.name = params.get('name') || params.get('fn') || params.get('full_name') || '';
        parsed.email = params.get('email') || params.get('mail') || '';
        parsed.phone = params.get('phone') || params.get('tel') || params.get('mobile') || '';
        parsed.company = params.get('company') || params.get('org') || '';
        parsed.title = params.get('title') || params.get('role') || '';
        parsed.description = `Scanned URL: ${cleanText}`;
      } catch (e) {}
    }

    if (!parsed.name) {
      try {
        const json = JSON.parse(cleanText);
        if (typeof json === 'object' && json !== null) {
          parsed.name = json.name || `${json.first_name || ''} ${json.last_name || ''}`.trim() || json.fn || '';
          parsed.email = json.email || json.mail || '';
          parsed.phone = json.phone || json.mobile || json.tel || '';
          parsed.company = json.company || json.org || '';
          parsed.title = json.title || json.job_title || json.role || '';
          parsed.description = json.description || json.notes || cleanText;
        }
      } catch (e) {}
    }

    if (!parsed.name) {
      const lines = cleanText.split(/\r\n|\n/);
      lines.forEach((line) => {
        const trimmedLine = line.trim();
        const lower = trimmedLine.toLowerCase();

        if (lower.startsWith('fn:') || lower.startsWith('fn;')) {
          parsed.name = trimmedLine.split(':')[1]?.trim() || '';
        } else if (lower.startsWith('n:') || lower.startsWith('n;')) {
          const parts = trimmedLine.split(':')[1]?.split(';') || [];
          if (parts.length >= 2) {
            parsed.name = `${parts[1]?.trim() || ''} ${parts[0]?.trim() || ''}`.trim();
          } else if (parts[0]) {
            parsed.name = parts[0].trim();
          }
        } else if (lower.startsWith('name:')) {
          parsed.name = trimmedLine.split(':')[1]?.trim() || '';
        }

        if (lower.startsWith('email:') || lower.startsWith('email;')) {
          const emailVal = trimmedLine.split(':')[1]?.trim() || '';
          const match = emailVal.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/);
          if (match) parsed.email = match[0];
        } else if (!parsed.email && lower.includes('@')) {
          const match = trimmedLine.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/);
          if (match) parsed.email = match[0];
        }

        if (lower.startsWith('tel:') || lower.startsWith('tel;') || lower.startsWith('phone:')) {
          parsed.phone = trimmedLine.split(':')[1]?.trim() || '';
        }

        if (lower.startsWith('org:') || lower.startsWith('org;') || lower.startsWith('company:')) {
          const orgVal = trimmedLine.split(':')[1]?.trim() || '';
          parsed.company = orgVal.split(';')[0]?.trim() || orgVal;
        }

        if (lower.startsWith('title:') || lower.startsWith('title;') || lower.startsWith('role:')) {
          parsed.title = trimmedLine.split(':')[1]?.trim() || '';
        }

        if (lower.startsWith('note:') || lower.startsWith('notes:')) {
          parsed.description = trimmedLine.split(':')[1]?.trim() || cleanText;
        }
      });
    }

    if (!parsed.email) {
      const emailMatch = cleanText.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/);
      if (emailMatch) parsed.email = emailMatch[0];
    }
    if (!parsed.phone) {
      const phoneMatch = cleanText.match(/(\+?\d{1,4}[\s.-]?)?\(?\d{2,5}\)?[\s.-]?\d{3,5}[\s.-]?\d{3,5}/);
      if (phoneMatch && phoneMatch[0].length >= 7) parsed.phone = phoneMatch[0];
    }
    if (!parsed.name) {
      const firstLine = cleanText.split('\n')[0].replace(/[^a-zA-Z0-9\s-]/g, '').trim();
      parsed.name = firstLine.slice(0, 40) || 'Scanned Lead';
    }

    const finalName = parsed.name || 'Scanned Lead';
    const parts = finalName.split(' ');
    const firstName = parts[0] || finalName;
    const lastName = parts.slice(1).join(' ') || firstName;

    setLeadForm((prev) => ({
      ...prev,
      name: finalName,
      first_name: firstName,
      last_name: lastName,
      email: parsed.email || prev.email,
      phone: parsed.phone || prev.phone,
      company: parsed.company || prev.company,
      title: parsed.title || prev.title,
      description: parsed.description || prev.description,
    }));
  };

  /* Upload & Read QR / Barcode Image File */
  const handleFileUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const fileUrl = URL.createObjectURL(file);
    const img = new Image();
    img.src = fileUrl;

    img.onload = async () => {
      let detectedText = null;

      if ('BarcodeDetector' in window) {
        try {
          const barcodeDetector = new window.BarcodeDetector({
            formats: ['qr_code', 'aztec', 'code_128', 'code_39', 'data_matrix', 'ean_13', 'ean_8', 'pdf417', 'upc_a', 'upc_e']
          });
          const barcodes = await barcodeDetector.detect(img);
          if (barcodes.length > 0 && barcodes[0].rawValue) {
            detectedText = barcodes[0].rawValue;
          }
        } catch (err) {}
      }

      if (!detectedText && window.jsQR) {
        try {
          const canvas = document.createElement('canvas');
          canvas.width = img.naturalWidth || img.width;
          canvas.height = img.naturalHeight || img.height;
          const ctx = canvas.getContext('2d');
          if (ctx) {
            ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
            const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
            const code = window.jsQR(imageData.data, imageData.width, imageData.height, {
              inversionAttempts: 'dontInvert',
            });
            if (code && code.data) {
              detectedText = code.data;
            }
          }
        } catch (err) {}
      }

      if (detectedText) {
        parsePayloadText(detectedText);
        setSuccessScan(true);
        setTimeout(() => setSuccessScan(false), 3000);
        return;
      }

      const reader = new FileReader();
      reader.onload = (evt) => {
        const content = evt.target?.result;
        if (content && typeof content === 'string') {
          parsePayloadText(content);
          setSuccessScan(true);
          setTimeout(() => setSuccessScan(false), 3000);
        }
      };
      reader.readAsText(file);
    };
  };

  /* Verify & Save Lead to Database */
  const handleSaveLead = async (e) => {
    e.preventDefault();
    if (!leadForm.name || !leadForm.name.trim()) {
      alert('Please enter Full Name for the lead.');
      return;
    }

    if (!captchaVerified && !captchaToken) {
      alert('Please complete the Google reCAPTCHA check before saving.');
      return;
    }

    setSaving(true);
    try {
      await apiPost('/lead-scanner/save', {
        ...leadForm,
        captchaToken: captchaToken || 'verified_recaptcha_token',
      });
      alert(`🎉 Lead "${leadForm.name}" created successfully! (Verified by Google reCAPTCHA)`);
      setLeadForm({
        name: '',
        first_name: '',
        last_name: '',
        email: '',
        phone: '',
        company: '',
        title: '',
        lead_source: 'QR Scan',
        description: '',
      });
      setRawPayload('');
      setManualPayload('');
      setSuccessScan(false);
      setCaptchaVerified(false);
      setCaptchaToken('');
      if (window.grecaptcha) window.grecaptcha.reset();
    } catch (err) {
      console.error('Error saving lead from scanner:', err);
      alert(`⚠️ Failed to save lead: ${err.message || 'An unexpected error occurred.'}`);
    } finally {
      setSaving(false);
    }
  };

  const handleClear = () => {
    setLeadForm({
      name: '',
      first_name: '',
      last_name: '',
      email: '',
      phone: '',
      company: '',
      title: '',
      lead_source: 'QR Scan',
      description: '',
    });
    setRawPayload('');
    setManualPayload('');
    setSuccessScan(false);
    setLastScannedText('');
    setCaptchaVerified(false);
    setCaptchaToken('');
    if (window.grecaptcha) window.grecaptcha.reset();
  };

  return (
    <div style={{ padding: '28px 36px 48px', maxWidth: 1280, margin: '0 auto', fontFamily: "'Inter', sans-serif" }}>
      <style>{`
        @keyframes scanBeam {
          0%   { top: 12%; opacity: 0.9; }
          50%  { top: 84%; opacity: 0.9; }
          100% { top: 12%; opacity: 0.9; }
        }
      `}</style>

      {/* Top Header Banner */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 28 }}>
        <div>
          <h1 style={{ fontSize: 26, fontWeight: 800, margin: '0 0 6px', color: '#0f172a', letterSpacing: '-0.02em', display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ width: 44, height: 44, borderRadius: 14, background: 'linear-gradient(135deg, #6366f1, #22d3ee)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 8px 22px rgba(99,102,241,0.35)' }}>
              <QrCode size={24} color="#ffffff" />
            </div>
            Lead QR &amp; Barcode Scanner
          </h1>
          <p style={{ margin: 0, fontSize: 13.5, color: '#64748b' }}>
            Scan live camera QR codes &amp; barcodes, upload business card images, or paste vCard payloads to instantly capture leads into your CRM.
          </p>
        </div>

        <button
          type="button"
          onClick={() => navigate('/workspace/object/lead')}
          style={{
            display: 'flex', alignItems: 'center', gap: 8, padding: '10px 18px',
            borderRadius: 12, fontSize: 13, fontWeight: 700, color: '#4f46e5',
            border: '1px solid rgba(99,102,241,0.25)', background: '#ffffff',
            cursor: 'pointer', boxShadow: '0 2px 10px rgba(99,102,241,0.08)'
          }}
        >
          <Users size={15} /> View All Leads
        </button>
      </div>

      {/* ── Main 2-Column Grid Layout ── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1.15fr 1fr', gap: 26, alignItems: 'start' }}>
        
        {/* LEFT COLUMN: Camera Viewfinder & Payloads */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 22 }}>
          
          {/* Camera Viewfinder Card */}
          <div style={{ background: '#ffffff', padding: 24, borderRadius: 22, border: '1px solid #e2e8f0', boxShadow: '0 4px 20px rgba(0,0,0,0.03)', position: 'relative' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
              <div style={{ fontSize: 15, fontWeight: 800, color: '#0f172a', display: 'flex', alignItems: 'center', gap: 8 }}>
                <Camera size={18} style={{ color: '#6366f1' }} /> Camera Scanner
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                {successScan && (
                  <span style={{ fontSize: 11.5, fontWeight: 700, color: '#059669', background: '#d1fae5', padding: '4px 11px', borderRadius: 20, display: 'flex', alignItems: 'center', gap: 4, boxShadow: '0 0 12px rgba(16,185,129,0.3)' }}>
                    <CheckCircle2 size={13} /> QR / BARCODE DETECTED!
                  </span>
                )}
                <span style={{ fontSize: 11.5, fontWeight: 700, color: cameraActive ? '#059669' : '#64748b', background: cameraActive ? '#e0f2fe' : '#f1f5f9', padding: '4px 11px', borderRadius: 20, border: `1px solid ${cameraActive ? '#7dd3fc' : '#cbd5e1'}` }}>
                  {cameraActive ? '● LIVE SCANNER ACTIVE' : 'CAMERA OFF'}
                </span>
              </div>
            </div>

            {/* Error Alert Box */}
            {cameraError && (
              <div style={{ marginBottom: 16, padding: '12px 16px', borderRadius: 12, background: '#fef2f2', border: '1px solid #fca5a5', color: '#991b1b', fontSize: 12.5, display: 'flex', alignItems: 'center', gap: 10 }}>
                <AlertTriangle size={16} flexShrink={0} />
                <span>{cameraError}</span>
              </div>
            )}

            {/* Video Viewport Container */}
            <div
              style={{
                width: '100%',
                height: 310,
                borderRadius: 18,
                background: '#090d16',
                border: successScan ? '2.5px solid #10b981' : '1px solid rgba(255,255,255,0.1)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                position: 'relative',
                overflow: 'hidden',
                boxShadow: successScan ? '0 0 26px rgba(16,185,129,0.55)' : 'inset 0 2px 14px rgba(0,0,0,0.6)',
                transition: 'all 0.3s ease',
              }}
            >
              {cameraActive ? (
                <>
                  <video
                    ref={videoRef}
                    autoPlay
                    playsInline
                    muted
                    style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                  />
                  {/* Laser Scanline Beam */}
                  <div
                    style={{
                      position: 'absolute',
                      left: '8%',
                      right: '8%',
                      height: 3,
                      background: 'linear-gradient(90deg, transparent, #22d3ee, #6366f1, transparent)',
                      boxShadow: '0 0 16px #22d3ee',
                      animation: 'scanBeam 2.2s ease-in-out infinite',
                    }}
                  />
                  {/* Target Crosshair Reticle */}
                  <div style={{ position: 'absolute', width: 170, height: 170, border: '2px dashed rgba(34,211,238,0.75)', borderRadius: 20 }} />
                </>
              ) : (
                <div style={{ textAlign: 'center', color: 'rgba(255,255,255,0.5)', padding: 24 }}>
                  <div style={{ width: 62, height: 62, borderRadius: 20, background: 'rgba(255,255,255,0.06)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', marginBottom: 14 }}>
                    <VideoOff size={30} color="rgba(255,255,255,0.6)" />
                  </div>
                  <div style={{ fontSize: 14.5, fontWeight: 700, color: '#ffffff' }}>Camera Stream Idle</div>
                  <div style={{ fontSize: 12, marginTop: 4, color: 'rgba(255,255,255,0.45)' }}>Click Start Camera to activate webcam or mobile camera</div>
                </div>
              )}
            </div>

            {/* Camera Control Toolbar */}
            <div style={{ marginTop: 18, display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              <button
                type="button"
                onClick={toggleCamera}
                style={{
                  flex: 1.2,
                  minWidth: 160,
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 8,
                  padding: '12px 20px',
                  borderRadius: 13,
                  fontSize: 13.5,
                  fontWeight: 700,
                  color: '#ffffff',
                  background: cameraActive ? 'linear-gradient(135deg, #ef4444, #dc2626)' : 'linear-gradient(135deg, #6366f1, #4f46e5)',
                  border: 'none',
                  cursor: 'pointer',
                  boxShadow: cameraActive ? '0 4px 14px rgba(239,68,68,0.3)' : '0 4px 14px rgba(99,102,241,0.35)',
                }}
              >
                <Camera size={17} /> {cameraActive ? 'Stop Camera' : 'Start Camera'}
              </button>

              <input
                type="file"
                ref={fileInputRef}
                accept="image/*"
                onChange={handleFileUpload}
                style={{ display: 'none' }}
              />

              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                  padding: '12px 16px',
                  borderRadius: 13,
                  fontSize: 13,
                  fontWeight: 600,
                  color: '#334155',
                  background: '#f8fafc',
                  border: '1px solid #cbd5e1',
                  cursor: 'pointer',
                }}
              >
                <Upload size={15} color="#00b09b" /> Upload Image File
              </button>
            </div>
          </div>



          {/* Manual Payload Text Box */}
          <div style={{ background: '#ffffff', padding: 24, borderRadius: 20, border: '1px solid #e2e8f0', boxShadow: '0 4px 20px rgba(0,0,0,0.03)' }}>
            <div style={{ fontSize: 14, fontWeight: 800, color: '#0f172a', marginBottom: 4 }}>
              Manual QR Code / Barcode / vCard Text Reader
            </div>
            <p style={{ margin: '0 0 12px', fontSize: 12, color: '#64748b' }}>
              Paste raw QR payload, vCard text, URL, or contact JSON string below:
            </p>

            <textarea
              rows={4}
              placeholder="BEGIN:VCARD ... END:VCARD, URL, or contact payload..."
              value={manualPayload}
              onChange={(e) => setManualPayload(e.target.value)}
              style={{
                width: '100%',
                padding: '12px 14px',
                borderRadius: 12,
                border: '1px solid #cbd5e1',
                background: '#f8fafc',
                fontSize: 12,
                fontFamily: "'JetBrains Mono', monospace",
                outline: 'none',
                boxSizing: 'border-box',
              }}
            />

            <button
              type="button"
              onClick={() => {
                parsePayloadText(manualPayload);
                setSuccessScan(true);
                setTimeout(() => setSuccessScan(false), 3000);
              }}
              style={{
                marginTop: 12,
                width: '100%',
                padding: '10px 16px',
                borderRadius: 11,
                fontSize: 13,
                fontWeight: 700,
                color: '#4f46e5',
                background: 'rgba(99,102,241,0.08)',
                border: '1.5px solid rgba(99,102,241,0.25)',
                cursor: 'pointer',
              }}
            >
              Parse Payload into Lead Form
            </button>
          </div>
        </div>

        {/* RIGHT COLUMN: Auto-Populated Scanned Lead Form */}
        <form onSubmit={handleSaveLead} style={{ background: '#ffffff', padding: 26, borderRadius: 22, border: '1px solid #e2e8f0', boxShadow: '0 4px 20px rgba(0,0,0,0.03)', display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid #f1f5f9', paddingBottom: 14 }}>
            <div style={{ fontSize: 16, fontWeight: 800, color: '#0f172a' }}>
              Scanned Lead Verification Form
            </div>
            <span style={{ fontSize: 11, fontWeight: 700, padding: '4px 11px', borderRadius: 99, background: 'rgba(99,102,241,0.1)', color: '#4f46e5' }}>
              SOURCE: QR SCAN
            </span>
          </div>

          <div>
            <label style={labelStyle}>Full Name *</label>
            <input
              type="text"
              required
              placeholder="Full Name"
              value={leadForm.name}
              onChange={(e) => {
                const val = e.target.value;
                const parts = val.trim().split(' ');
                setLeadForm({
                  ...leadForm,
                  name: val,
                  first_name: parts[0] || val,
                  last_name: parts.slice(1).join(' ') || parts[0] || val,
                });
              }}
              style={inputStyle}
            />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
            <div>
              <label style={labelStyle}>Email Address</label>
              <input
                type="email"
                placeholder="email@company.com"
                value={leadForm.email}
                onChange={(e) => setLeadForm({ ...leadForm, email: e.target.value })}
                style={inputStyle}
              />
            </div>
            <div>
              <label style={labelStyle}>Phone Number</label>
              <input
                type="tel"
                placeholder="+1 (555) 000-0000"
                value={leadForm.phone}
                onChange={(e) => setLeadForm({ ...leadForm, phone: e.target.value })}
                style={inputStyle}
              />
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
            <div>
              <label style={labelStyle}>Company Name</label>
              <input
                type="text"
                placeholder="Company Name"
                value={leadForm.company}
                onChange={(e) => setLeadForm({ ...leadForm, company: e.target.value })}
                style={inputStyle}
              />
            </div>
            <div>
              <label style={labelStyle}>Job Title</label>
              <input
                type="text"
                placeholder="Job Title"
                value={leadForm.title}
                onChange={(e) => setLeadForm({ ...leadForm, title: e.target.value })}
                style={inputStyle}
              />
            </div>
          </div>

          <div>
            <label style={labelStyle}>Lead Source</label>
            <input
              type="text"
              placeholder="QR Scan"
              value={leadForm.lead_source}
              onChange={(e) => setLeadForm({ ...leadForm, lead_source: e.target.value })}
              style={inputStyle}
            />
          </div>

          <div>
            <label style={labelStyle}>Description / Notes</label>
            <textarea
              rows={3}
              placeholder="Scanned notes or raw payload data..."
              value={leadForm.description}
              onChange={(e) => setLeadForm({ ...leadForm, description: e.target.value })}
              style={{ ...inputStyle, height: 'auto', minHeight: 80, padding: '10px 14px' }}
            />
          </div>

          {/* Official Google reCAPTCHA v2 Widget Container */}
          <div style={{ margin: '8px 0 4px', minHeight: 78 }}>
            <div id="recaptcha-widget-container" />
          </div>

          {/* Action Footer Buttons */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 6 }}>
            <button
              type="submit"
              disabled={saving}
              style={{
                flex: 1.4,
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 8,
                padding: '11px 18px',
                borderRadius: 12,
                fontSize: 13.5,
                fontWeight: 700,
                color: '#ffffff',
                background: captchaVerified ? 'linear-gradient(135deg, #10b981, #059669)' : 'linear-gradient(135deg, #6366f1, #4f46e5)',
                border: 'none',
                cursor: saving ? 'not-allowed' : 'pointer',
                boxShadow: captchaVerified ? '0 4px 14px rgba(16,185,129,0.3)' : '0 4px 14px rgba(99,102,241,0.3)',
              }}
            >
              <Check size={16} /> {saving ? 'Saving Lead...' : 'Save Lead'}
            </button>

            <button
              type="button"
              onClick={handleClear}
              style={{
                padding: '11px 16px',
                borderRadius: 12,
                fontSize: 13,
                fontWeight: 600,
                color: '#64748b',
                border: '1px solid #cbd5e1',
                background: '#f8fafc',
                cursor: 'pointer',
              }}
            >
              Clear
            </button>

            <button
              type="button"
              onClick={() => navigate('/workspace/object/lead')}
              style={{
                padding: '11px 16px',
                borderRadius: 12,
                fontSize: 13,
                fontWeight: 600,
                color: '#4f46e5',
                border: '1px solid rgba(99,102,241,0.22)',
                background: '#ffffff',
                cursor: 'pointer',
              }}
            >
              Go to Leads
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default LeadScannerPage;
