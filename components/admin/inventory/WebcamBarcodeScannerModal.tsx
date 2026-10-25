// components/admin/inventory/WebcamBarcodeScannerModal.tsx
// Camera / Phone / Webcam Barcode Scanner with BarcodeDetector API and Manual Fallback

'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Camera, X, RefreshCw, Zap, ScanLine, AlertCircle, Check } from 'lucide-react';
import { playScanSound } from '@/lib/barcode/audio';
import { detectBarcodeFormat } from '@/lib/barcode/engine';

interface WebcamBarcodeScannerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onScan: (code: string, format: string) => void;
  title?: string;
}

export const WebcamBarcodeScannerModal: React.FC<WebcamBarcodeScannerModalProps> = ({
  isOpen,
  onClose,
  onScan,
  title = 'Live Camera Barcode Scanner',
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const animFrameRef = useRef<number | null>(null);

  const [hasCamera, setHasCamera] = useState(true);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [torchOn, setTorchOn] = useState(false);
  const [manualCode, setManualCode] = useState('');
  const [isScanning, setIsScanning] = useState(false);

  useEffect(() => {
    if (!isOpen) {
      stopCamera();
      return;
    }

    startCamera();

    return () => {
      stopCamera();
    };
  }, [isOpen]);

  const startCamera = async () => {
    setCameraError(null);
    setIsScanning(true);

    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        setHasCamera(false);
        setCameraError('Camera API is not supported in this browser environment.');
        return;
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: 'environment' },
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
        audio: false,
      });

      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play();
        startDetectionLoop();
      }
    } catch (err: any) {
      console.warn('Camera stream failed:', err);
      setHasCamera(false);
      setCameraError(err.message || 'Unable to access camera. Please allow camera permissions.');
    }
  };

  const stopCamera = () => {
    setIsScanning(false);
    if (animFrameRef.current) {
      cancelAnimationFrame(animFrameRef.current);
      animFrameRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
  };

  const toggleTorch = async () => {
    if (!streamRef.current) return;
    const track = streamRef.current.getVideoTracks()[0];
    if (track && (track.getCapabilities as any)?.torch) {
      try {
        await (track as any).applyConstraints({
          advanced: [{ torch: !torchOn }],
        });
        setTorchOn(!torchOn);
      } catch (e) {
        console.warn('Torch toggle error:', e);
      }
    }
  };

  const startDetectionLoop = () => {
    // Check if window.BarcodeDetector exists (Native in Chrome, Edge, Android Chrome, Safari 17+)
    const BarcodeDetectorClass = (window as any).BarcodeDetector;

    let detector: any = null;
    if (BarcodeDetectorClass) {
      try {
        detector = new BarcodeDetectorClass({
          formats: ['ean_13', 'upc_a', 'code_128', 'code_39', 'qr_code', 'data_matrix'],
        });
      } catch (e) {
        console.warn('BarcodeDetector format init failed:', e);
      }
    }

    const scanFrame = async () => {
      if (!videoRef.current || videoRef.current.readyState < 2) {
        animFrameRef.current = requestAnimationFrame(scanFrame);
        return;
      }

      if (detector) {
        try {
          const barcodes = await detector.detect(videoRef.current);
          if (barcodes && barcodes.length > 0) {
            const rawValue = barcodes[0].rawValue;
            if (rawValue) {
              handleFoundCode(rawValue);
              return;
            }
          }
        } catch (err) {
          // Frame drop or detection skip
        }
      }

      animFrameRef.current = requestAnimationFrame(scanFrame);
    };

    animFrameRef.current = requestAnimationFrame(scanFrame);
  };

  const handleFoundCode = (code: string) => {
    const clean = code.trim();
    if (!clean) return;

    playScanSound('success');
    const format = detectBarcodeFormat(clean);
    stopCamera();
    onScan(clean, format);
    onClose();
  };

  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualCode.trim()) return;
    handleFoundCode(manualCode);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-fadeIn">
      <div className="bg-slate-900 border border-slate-700/80 rounded-2xl w-full max-w-lg overflow-hidden shadow-2xl flex flex-col">
        {/* Header */}
        <div className="p-4 border-b border-slate-800 flex items-center justify-between bg-slate-950/60">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
              <Camera className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-sm text-white">{title}</h3>
              <p className="text-[11px] text-slate-400">Aim camera at EAN-13, Code-128, or QR barcode</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Camera Viewport */}
        <div className="relative bg-black aspect-video flex items-center justify-center overflow-hidden">
          <video
            ref={videoRef}
            playsInline
            muted
            className="w-full h-full object-cover"
          />
          <canvas ref={canvasRef} className="hidden" />

          {/* Scanning Target Overlay */}
          <div className="absolute inset-0 pointer-events-none flex items-center justify-center p-8">
            <div className="relative w-64 h-40 border-2 border-emerald-400/80 rounded-xl shadow-[0_0_25px_rgba(16,185,129,0.3)] flex items-center justify-center">
              {/* Animated Laser Line */}
              <div className="absolute inset-x-0 h-0.5 bg-gradient-to-r from-transparent via-emerald-400 to-transparent shadow-[0_0_8px_#34d399] animate-pulse" />
              <div className="text-[10px] font-mono text-emerald-300 bg-slate-950/80 px-2 py-0.5 rounded border border-emerald-500/30">
                ALIGN BARCODE HERE
              </div>
            </div>
          </div>

          {/* Camera Controls Overlay */}
          <div className="absolute top-3 right-3 flex items-center gap-2">
            <button
              onClick={toggleTorch}
              className={`p-2 rounded-lg backdrop-blur-md border text-xs font-semibold flex items-center gap-1.5 transition-all ${
                torchOn
                  ? 'bg-amber-500 text-slate-950 border-amber-300 shadow-lg'
                  : 'bg-slate-900/80 text-white border-slate-700 hover:bg-slate-800'
              }`}
              title="Toggle Flash / Torch"
            >
              <Zap className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={startCamera}
              className="p-2 rounded-lg bg-slate-900/80 text-white border border-slate-700 hover:bg-slate-800 backdrop-blur-md transition-all"
              title="Restart Camera"
            >
              <RefreshCw className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Camera Error / No Device Warning */}
          {cameraError && (
            <div className="absolute inset-0 bg-slate-950/90 flex flex-col items-center justify-center p-6 text-center">
              <AlertCircle className="w-8 h-8 text-amber-400 mb-2" />
              <div className="text-xs text-slate-200 font-semibold mb-1">Camera Stream Unavailable</div>
              <div className="text-[11px] text-slate-400 max-w-xs">{cameraError}</div>
              <div className="text-[10px] text-emerald-400 mt-3 font-mono">Use USB scanner or manual entry below</div>
            </div>
          )}
        </div>

        {/* Manual Keyboard / Wedge Input Fallback */}
        <div className="p-4 bg-slate-950/90 border-t border-slate-800">
          <form onSubmit={handleManualSubmit} className="flex gap-2">
            <div className="relative flex-1">
              <ScanLine className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Or type/paste Barcode / SKU / S/N..."
                value={manualCode}
                onChange={(e) => setManualCode(e.target.value)}
                autoFocus
                className="w-full bg-slate-900 border border-slate-700 rounded-xl pl-9 pr-3 py-2 text-xs text-white placeholder:text-slate-500 focus:outline-none focus:border-emerald-500"
              />
            </div>
            <button
              type="submit"
              disabled={!manualCode.trim()}
              className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-xs font-bold transition-all flex items-center gap-1.5"
            >
              <Check className="w-3.5 h-3.5" />
              <span>Submit</span>
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};
