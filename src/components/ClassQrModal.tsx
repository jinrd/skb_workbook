"use client";

import { useRef } from "react";
import { QRCodeCanvas } from "qrcode.react";

interface ClassQrModalProps {
  className: string;
  url: string;
  onClose: () => void;
}

export function ClassQrModal({ className, url, onClose }: ClassQrModalProps) {
  const qrCanvasRef = useRef<HTMLCanvasElement>(null);

  const handleCopyUrl = async () => {
    try {
      await navigator.clipboard.writeText(url);
      alert("학생 접속 주소를 복사했습니다.");
    } catch (error) {
      console.error("Copy QR URL error:", error);
      alert("주소를 복사하지 못했습니다.");
    }
  };

  const handleDownloadQr = () => {
    if (!qrCanvasRef.current) {
      return;
    }

    const safeClassName = className.replace(/[\\/:*?"<>|]/g, "_");

    const downloadLink = document.createElement("a");

    downloadLink.download = `${safeClassName}_학생접속_QR.png`;

    downloadLink.href = qrCanvasRef.current.toDataURL("image/png");

    downloadLink.click();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/55 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="class-qr-title"
    >
      <div className="w-full max-w-sm space-y-4 rounded-lg border border-slate-200 bg-white p-6 shadow-2xl">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 id="class-qr-title" className="text-base font-bold text-slate-950">
              {className}
            </h2>

            <p className="mt-1 text-xs text-slate-500">학생 접속 QR 코드</p>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="QR 코드 창 닫기"
            title="닫기"
            className="flex h-8 w-8 items-center justify-center rounded-md text-lg text-slate-500 hover:bg-slate-100 hover:text-slate-900"
          >
            ×
          </button>
        </div>

        <div className="flex justify-center rounded-lg border border-slate-200 bg-white p-4">
          <QRCodeCanvas
            ref={qrCanvasRef}
            value={url}
            size={220}
            level="H"
            marginSize={2}
            title={`${className} 학생 접속 QR 코드`}
          />
        </div>

        <p className="break-all rounded-lg border border-slate-200 bg-slate-50 p-3 font-mono text-[11px] leading-5 text-slate-700">
          {url}
        </p>

        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={handleCopyUrl}
            className="h-10 rounded-md border border-slate-200 bg-white text-xs font-semibold text-slate-700 hover:bg-slate-50"
          >
            주소 복사
          </button>

          <button
            type="button"
            onClick={handleDownloadQr}
            className="h-10 rounded-md bg-blue-600 text-xs font-semibold text-white hover:bg-blue-500"
          >
            QR 다운로드
          </button>
        </div>
      </div>
    </div>
  );
}
