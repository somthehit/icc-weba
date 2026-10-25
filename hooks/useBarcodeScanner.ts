// hooks/useBarcodeScanner.ts
// Global USB/Bluetooth Keyboard-Wedge Barcode Scanner Hook with Fast-Keystroke Detection and Context Dispatch

import { useEffect, useRef, useState, useCallback } from 'react';
import { playScanSound } from '@/lib/barcode/audio';
import { detectBarcodeFormat, offlineScanQueue } from '@/lib/barcode/engine';

interface UseBarcodeScannerOptions {
  onScan?: (code: string, format: string) => void;
  debounceMs?: number;
  minChars?: number;
  maxIntervalMs?: number; // max milliseconds between keystrokes to be considered a scanner
  enabled?: boolean;
  context?: string;
}

export function useBarcodeScanner({
  onScan,
  debounceMs = 600,
  minChars = 3,
  maxIntervalMs = 60,
  enabled = true,
  context = 'general',
}: UseBarcodeScannerOptions = {}) {
  const [lastScannedCode, setLastScannedCode] = useState<string | null>(null);
  const [scanHistory, setScanHistory] = useState<Array<{ code: string; timestamp: number; format: string }>>([]);
  const [isOfflineQueued, setIsOfflineQueued] = useState(false);

  const bufferRef = useRef<string>('');
  const lastKeyTimeRef = useRef<number>(0);
  const lastScanTimeRef = useRef<number>(0);
  const lastScannedCodeRef = useRef<string>('');

  const processScan = useCallback(
    (scannedString: string) => {
      const cleanCode = scannedString.trim();
      if (!cleanCode || cleanCode.length < minChars) return;

      const now = Date.now();
      // Duplicate scan prevention
      if (cleanCode === lastScannedCodeRef.current && now - lastScanTimeRef.current < debounceMs) {
        playScanSound('duplicate');
        return;
      }

      lastScanTimeRef.current = now;
      lastScannedCodeRef.current = cleanCode;
      setLastScannedCode(cleanCode);

      const format = detectBarcodeFormat(cleanCode);

      // Play success audio & haptic feedback
      playScanSound('success');

      // Update history
      setScanHistory((prev) => [{ code: cleanCode, timestamp: now, format }, ...prev.slice(0, 49)]);

      // Check online connectivity; if offline, add to queue
      if (typeof navigator !== 'undefined' && !navigator.onLine) {
        offlineScanQueue.add(cleanCode, context);
        setIsOfflineQueued(true);
      }

      // Invoke callback
      if (onScan) {
        onScan(cleanCode, format);
      }
    },
    [onScan, debounceMs, minChars, context]
  );

  useEffect(() => {
    if (!enabled) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore when user is actively typing inside standard textarea or input, UNLESS it is tagged with data-barcode-scanner="true"
      const target = e.target as HTMLElement | null;
      const isInput =
        target &&
        (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable);
      const isScannerTrap = target?.getAttribute('data-barcode-scanner') === 'true';

      const now = Date.now();
      const timeDiff = now - lastKeyTimeRef.current;
      lastKeyTimeRef.current = now;

      // Enter key: finalize buffered code
      if (e.key === 'Enter') {
        if (bufferRef.current.length >= minChars) {
          // If scanner generated this (fast interval) or inside a scanner trap, prevent default submit
          const candidate = bufferRef.current;
          bufferRef.current = '';
          if (!isInput || isScannerTrap) {
            e.preventDefault();
            e.stopPropagation();
          }
          processScan(candidate);
        } else if (isScannerTrap && target && 'value' in target) {
          const val = (target as HTMLInputElement).value;
          if (val && val.length >= minChars) {
            processScan(val);
            (target as HTMLInputElement).value = '';
          }
        }
        return;
      }

      // Only printable characters
      if (e.key.length === 1 && !e.ctrlKey && !e.altKey && !e.metaKey) {
        // If keystrokes are coming too slowly and user is in a regular text field, reset buffer
        if (timeDiff > maxIntervalMs && isInput && !isScannerTrap) {
          bufferRef.current = '';
        } else {
          // If interval is slow and outside input, start a new buffer
          if (timeDiff > maxIntervalMs) {
            bufferRef.current = e.key;
          } else {
            bufferRef.current += e.key;
          }
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown, true);
    return () => {
      window.removeEventListener('keydown', handleKeyDown, true);
    };
  }, [enabled, minChars, maxIntervalMs, processScan]);

  return {
    lastScannedCode,
    scanHistory,
    isOfflineQueued,
    triggerManualScan: processScan,
    clearHistory: () => setScanHistory([]),
  };
}
