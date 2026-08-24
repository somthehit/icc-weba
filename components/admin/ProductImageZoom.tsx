'use client';

import React, { useState, useRef, useCallback } from 'react';
import { 
  ZoomIn, 
  ZoomOut, 
  Maximize2, 
  X, 
  RotateCcw, 
  Move, 
  ChevronLeft, 
  ChevronRight, 
  Eye 
} from 'lucide-react';

interface ProductImageZoomProps {
  images: string[];
  selectedImageIndex: number;
  onSelectImage: (index: number) => void;
  productName: string;
  discountPercent?: number;
}

export const ProductImageZoom: React.FC<ProductImageZoomProps> = ({
  images,
  selectedImageIndex,
  onSelectImage,
  productName,
  discountPercent,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [isHovered, setIsHovered] = useState(false);
  const [zoomPos, setZoomPos] = useState({ x: 50, y: 50 });
  const [zoomLevel, setZoomLevel] = useState<number>(2.5);
  const [isLightboxOpen, setIsLightboxOpen] = useState(false);
  const [isTouchZoomActive, setIsTouchZoomActive] = useState(false);

  // Lightbox Pan & Zoom State
  const [lightboxZoom, setLightboxZoom] = useState<number>(2);
  const [lightboxPos, setLightboxPos] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const dragStartRef = useRef({ startX: 0, startY: 0, posX: 0, posY: 0 });

  const currentImage = images[selectedImageIndex] || images[0] || '';

  // Desktop Mouse Move handler for smooth hardware component inspection
  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const x = Math.max(0, Math.min(100, ((e.clientX - rect.left) / rect.width) * 100));
    const y = Math.max(0, Math.min(100, ((e.clientY - rect.top) / rect.height) * 100));
    setZoomPos({ x, y });
  }, []);

  const handleMouseEnter = () => {
    setIsHovered(true);
  };

  const handleMouseLeave = () => {
    setIsHovered(false);
    setZoomPos({ x: 50, y: 50 });
  };

  // Touch handlers for mobile users
  const handleTouchMove = (e: React.TouchEvent<HTMLDivElement>) => {
    if (!isTouchZoomActive || !containerRef.current || e.touches.length !== 1) return;
    const touch = e.touches[0];
    const rect = containerRef.current.getBoundingClientRect();
    const x = Math.max(0, Math.min(100, ((touch.clientX - rect.left) / rect.width) * 100));
    const y = Math.max(0, Math.min(100, ((touch.clientY - rect.top) / rect.height) * 100));
    setZoomPos({ x, y });
  };

  // Lightbox Pan handlers
  const handleLightboxMouseDown = (e: React.MouseEvent) => {
    if (lightboxZoom <= 1) return;
    setIsDragging(true);
    dragStartRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      posX: lightboxPos.x,
      posY: lightboxPos.y,
    };
  };

  const handleLightboxMouseMove = (e: React.MouseEvent) => {
    if (!isDragging) return;
    const deltaX = e.clientX - dragStartRef.current.startX;
    const deltaY = e.clientY - dragStartRef.current.startY;
    setLightboxPos({
      x: dragStartRef.current.posX + deltaX,
      y: dragStartRef.current.posY + deltaY,
    });
  };

  const handleLightboxMouseUp = () => {
    setIsDragging(false);
  };

  const resetLightbox = () => {
    setLightboxZoom(1.5);
    setLightboxPos({ x: 0, y: 0 });
  };

  return (
    <div className="space-y-4 select-none">
      {/* Main Showcase Container with Hover-To-Zoom */}
      <div className="relative group">
        <div
          ref={containerRef}
          id="product-main-image-viewer"
          onMouseMove={handleMouseMove}
          onMouseEnter={handleMouseEnter}
          onMouseLeave={handleMouseLeave}
          onTouchMove={handleTouchMove}
          onClick={() => {
            if (typeof window !== 'undefined' && window.matchMedia('(pointer: coarse)').matches) {
              setIsTouchZoomActive(!isTouchZoomActive);
            }
          }}
          className={`relative bg-slate-50/80 border border-slate-200 rounded-2xl p-6 md:p-8 flex items-center justify-center min-h-[360px] md:min-h-[420px] overflow-hidden transition-shadow ${
            isHovered || isTouchZoomActive ? 'cursor-crosshair shadow-md ring-1 ring-blue-500/30' : 'cursor-zoom-in'
          }`}
        >
          {/* Discount Badge */}
          {(discountPercent ?? 0) > 0 && (
            <span className="absolute top-4 left-4 z-20 bg-red-600 text-white font-black text-xs px-3 py-1 rounded-full shadow-md pointer-events-none">
              -{discountPercent}% OFF
            </span>
          )}

          {/* Top-Right Quick Action: Fullscreen Lightbox */}
          <div className="absolute top-4 right-4 z-20 flex items-center gap-1.5">
            <button
              onClick={(e) => {
                e.stopPropagation();
                resetLightbox();
                setIsLightboxOpen(true);
              }}
              className="bg-white/90 hover:bg-white text-slate-700 hover:text-blue-600 p-2 rounded-xl border border-slate-200/80 shadow-xs backdrop-blur-xs transition-all flex items-center gap-1 text-xs font-semibold"
              title="Open Fullscreen Hardware Inspector"
            >
              <Maximize2 className="w-4 h-4" />
              <span className="hidden sm:inline">Inspect Fullscreen</span>
            </button>
          </div>

          {/* Interactive Zoom Image */}
          <div className="w-full h-full flex items-center justify-center relative">
            <img
              src={currentImage}
              alt={productName}
              style={{
                transform: (isHovered || isTouchZoomActive) ? `scale(${zoomLevel})` : 'scale(1)',
                transformOrigin: `${zoomPos.x}% ${zoomPos.y}%`,
                transition: (isHovered || isTouchZoomActive) ? 'transform 60ms ease-out' : 'transform 250ms ease-out',
              }}
              className="max-h-[300px] md:max-h-[360px] w-auto object-contain pointer-events-none will-change-transform"
            />
          </div>

          {/* Active Zoom Reticle / Lens Focus Indicator */}
          {(isHovered || isTouchZoomActive) && (
            <div 
              className="absolute pointer-events-none border border-blue-500/40 bg-blue-500/5 rounded-full w-24 h-24 -translate-x-1/2 -translate-y-1/2 shadow-inner hidden md:block"
              style={{
                left: `${zoomPos.x}%`,
                top: `${zoomPos.y}%`,
              }}
            >
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="w-1.5 h-1.5 bg-blue-600/80 rounded-full" />
              </div>
            </div>
          )}

          {/* Bottom Zoom Status & Magnification Mode Indicator */}
          <div className="absolute bottom-3 left-3 right-3 z-20 flex flex-wrap items-center justify-between gap-2 pointer-events-none">
            {/* Status Pill */}
            <div className="bg-slate-900/85 backdrop-blur-xs text-white text-[11px] font-medium px-3 py-1.5 rounded-xl flex items-center gap-1.5 shadow-sm transition-all">
              {(isHovered || isTouchZoomActive) ? (
                <>
                  <Eye className="w-3.5 h-3.5 text-emerald-400 animate-pulse" />
                  <span className="font-bold text-emerald-300">Zoom {zoomLevel}x</span>
                  <span className="text-slate-300 hidden sm:inline">| Move cursor to inspect components</span>
                </>
              ) : (
                <>
                  <ZoomIn className="w-3.5 h-3.5 text-blue-400" />
                  <span>Hover to zoom &amp; inspect fine details</span>
                </>
              )}
            </div>

            {/* Zoom Factor Buttons (Interactive) */}
            <div className="pointer-events-auto flex items-center bg-white/95 backdrop-blur-xs border border-slate-200 rounded-xl p-1 shadow-sm gap-1">
              <span className="text-[10px] font-extrabold text-slate-400 uppercase px-1.5 hidden sm:inline">
                Zoom:
              </span>
              {[2, 2.5, 3.5].map((lvl) => (
                <button
                  key={lvl}
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setZoomLevel(lvl);
                  }}
                  className={`text-[11px] font-extrabold px-2 py-0.5 rounded-lg transition-colors ${
                    zoomLevel === lvl
                      ? 'bg-blue-600 text-white shadow-xs'
                      : 'text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  {lvl}x
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Mobile touch toggle helper */}
        <div className="mt-1.5 flex md:hidden justify-between items-center text-[11px] text-slate-500 px-1">
          <span>Tap image to {isTouchZoomActive ? 'lock/disable' : 'enable'} touch zoom</span>
          <button
            onClick={() => {
              resetLightbox();
              setIsLightboxOpen(true);
            }}
            className="text-blue-600 font-bold flex items-center gap-1"
          >
            <Maximize2 className="w-3 h-3" />
            <span>Open HD Inspector</span>
          </button>
        </div>
      </div>

      {/* Thumbnails Row */}
      {images.length > 1 && (
        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-xs text-slate-500 px-1">
            <span className="font-semibold">Hardware Views ({images.length})</span>
            <span className="text-[11px]">Click thumbnail to inspect</span>
          </div>
          <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-thin">
            {images.map((img, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => onSelectImage(idx)}
                className={`relative w-20 h-20 rounded-xl bg-slate-50 border p-2 flex-shrink-0 transition-all ${
                  idx === selectedImageIndex
                    ? 'border-blue-600 ring-2 ring-blue-600/30 bg-blue-50/20'
                    : 'border-slate-200 hover:border-slate-300'
                }`}
              >
                <img src={img} alt={`View ${idx + 1}`} className="w-full h-full object-contain" />
                {idx === selectedImageIndex && (
                  <span className="absolute bottom-1 right-1 w-2 h-2 bg-blue-600 rounded-full" />
                )}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Fullscreen Hardware Inspector Lightbox Modal */}
      {isLightboxOpen && (
        <div 
          className="fixed inset-0 z-50 bg-slate-950/90 backdrop-blur-md flex flex-col justify-between p-4 md:p-6"
          onClick={() => setIsLightboxOpen(false)}
        >
          {/* Top Bar */}
          <div 
            className="flex items-center justify-between text-white z-10"
            onClick={(e) => e.stopPropagation()}
          >
            <div>
              <div className="flex items-center gap-2">
                <span className="bg-blue-600 text-white font-extrabold text-[10px] px-2 py-0.5 rounded uppercase">
                  Hardware Inspector
                </span>
                <span className="text-xs text-slate-300">
                  Image {selectedImageIndex + 1} of {images.length}
                </span>
              </div>
              <h3 className="text-sm md:text-base font-bold text-white mt-0.5 line-clamp-1">
                {productName}
              </h3>
            </div>

            {/* Controls */}
            <div className="flex items-center gap-2">
              <div className="bg-slate-800/80 rounded-xl p-1 border border-slate-700 flex items-center gap-1 text-xs">
                <button
                  onClick={() => setLightboxZoom((z) => Math.max(1, +(z - 0.5).toFixed(1)))}
                  disabled={lightboxZoom <= 1}
                  className="p-1.5 hover:bg-slate-700 rounded-lg text-slate-200 disabled:opacity-30"
                  title="Zoom Out"
                >
                  <ZoomOut className="w-4 h-4" />
                </button>
                <span className="px-2 font-mono font-bold text-slate-100 min-w-[48px] text-center">
                  {lightboxZoom}x
                </span>
                <button
                  onClick={() => setLightboxZoom((z) => Math.min(5, +(z + 0.5).toFixed(1)))}
                  disabled={lightboxZoom >= 5}
                  className="p-1.5 hover:bg-slate-700 rounded-lg text-slate-200 disabled:opacity-30"
                  title="Zoom In"
                >
                  <ZoomIn className="w-4 h-4" />
                </button>
                <button
                  onClick={resetLightbox}
                  className="p-1.5 hover:bg-slate-700 rounded-lg text-slate-200 border-l border-slate-700 ml-1"
                  title="Reset Zoom & Pan"
                >
                  <RotateCcw className="w-4 h-4" />
                </button>
              </div>

              <button
                onClick={() => setIsLightboxOpen(false)}
                className="p-2 bg-slate-800/80 hover:bg-slate-700 text-white rounded-xl border border-slate-700 transition-colors"
                title="Close Inspector"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Main Lightbox Viewport with Drag-To-Pan */}
          <div 
            className="flex-1 flex items-center justify-center overflow-hidden relative my-4 cursor-grab active:cursor-grabbing"
            onClick={(e) => e.stopPropagation()}
            onMouseDown={handleLightboxMouseDown}
            onMouseMove={handleLightboxMouseMove}
            onMouseUp={handleLightboxMouseUp}
            onMouseLeave={handleLightboxMouseUp}
          >
            {/* Previous Image Button */}
            {images.length > 1 && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onSelectImage((selectedImageIndex - 1 + images.length) % images.length);
                  resetLightbox();
                }}
                className="absolute left-2 md:left-6 z-20 p-3 rounded-full bg-slate-900/70 hover:bg-slate-800 text-white border border-slate-700 backdrop-blur-xs transition-colors"
                title="Previous Image"
              >
                <ChevronLeft className="w-5 h-5" />
              </button>
            )}

            {/* Next Image Button */}
            {images.length > 1 && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onSelectImage((selectedImageIndex + 1) % images.length);
                  resetLightbox();
                }}
                className="absolute right-2 md:right-6 z-20 p-3 rounded-full bg-slate-900/70 hover:bg-slate-800 text-white border border-slate-700 backdrop-blur-xs transition-colors"
                title="Next Image"
              >
                <ChevronRight className="w-5 h-5" />
              </button>
            )}

            {/* Image Canvas */}
            <div 
              style={{
                transform: `translate(${lightboxPos.x}px, ${lightboxPos.y}px) scale(${lightboxZoom})`,
                transition: isDragging ? 'none' : 'transform 150ms ease-out',
              }}
              className="max-w-[85vw] max-h-[70vh] flex items-center justify-center select-none"
            >
              <img
                src={currentImage}
                alt={productName}
                className="max-w-full max-h-[70vh] object-contain rounded-lg shadow-2xl pointer-events-none"
              />
            </div>

            {/* Drag Hint */}
            {lightboxZoom > 1 && (
              <div className="absolute bottom-4 bg-slate-900/80 backdrop-blur-xs text-slate-300 text-xs px-3 py-1.5 rounded-full flex items-center gap-1.5 border border-slate-700 pointer-events-none">
                <Move className="w-3.5 h-3.5 text-blue-400" />
                <span>Click &amp; drag to pan hardware components</span>
              </div>
            )}
          </div>

          {/* Bottom Thumbnails */}
          {images.length > 1 && (
            <div 
              className="flex justify-center gap-2 overflow-x-auto py-2 z-10"
              onClick={(e) => e.stopPropagation()}
            >
              {images.map((img, idx) => (
                <button
                  key={idx}
                  onClick={() => {
                    onSelectImage(idx);
                    resetLightbox();
                  }}
                  className={`w-14 h-14 rounded-xl bg-slate-900 border p-1.5 flex-shrink-0 transition-all ${
                    idx === selectedImageIndex
                      ? 'border-blue-500 ring-2 ring-blue-500/50'
                      : 'border-slate-800 opacity-60 hover:opacity-100'
                  }`}
                >
                  <img src={img} alt={`Thumb ${idx + 1}`} className="w-full h-full object-contain" />
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
