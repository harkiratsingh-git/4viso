import React, { useEffect, useRef, useState } from 'react';
import { BadgeCheck, ShieldAlert, Clock, UploadCloud } from 'lucide-react';
import { CarrierCertification, CarrierCertificationStatus } from '../types';
import { fetchVerifiedCertificationForCarrier, uploadCarrierCertification } from '../services/supabaseService';

interface CertificationGateProps {
  carrierId: string;
  carrierName: string;
  /** From carrier_certification_status — 'Not Required' | 'Verified' | 'Pending Review' | 'Missing'. */
  status: CarrierCertificationStatus['certificationStatus'];
  uploadedById: string;
  onBlockedChange?: (blocked: boolean) => void;
}

/**
 * Phase 3: auto-attaches whichever Verified certification is on file for a carrier — org-wide,
 * regardless of who uploaded it, since carrier_certifications is already readable by any
 * authenticated user. When the status is Missing, this is the gate itself: creation stays
 * blocked until a document is uploaded (it then sits Pending Review, so the gate only clears
 * once someone with review rights verifies it — uploading alone doesn't unblock).
 */
export const CertificationGate: React.FC<CertificationGateProps> = ({ carrierId, carrierName, status, uploadedById, onBlockedChange }) => {
  const [attached, setAttached] = useState<CarrierCertification | null>(null);
  const [replacing, setReplacing] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadMessage, setUploadMessage] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setAttached(null);
    setReplacing(false);
    setUploadMessage(null);
    if (status === 'Verified') {
      fetchVerifiedCertificationForCarrier(carrierId).then(setAttached);
    }
  }, [carrierId, status]);

  useEffect(() => {
    onBlockedChange?.(status === 'Missing');
  }, [status, onBlockedChange]);

  const handleFileSelected = async (file: File) => {
    setUploading(true);
    setUploadMessage(null);
    const result = await uploadCarrierCertification(carrierId, file, 'Other', uploadedById);
    setUploading(false);
    setUploadMessage(result.message);
    if (result.success) setReplacing(false);
  };

  if (status === 'Not Required') return null;

  if (status === 'Verified' && attached && !replacing) {
    const uploadedDate = attached.uploadedAt ? new Date(attached.uploadedAt).toLocaleDateString() : 'an earlier date';
    return (
      <div className="mt-1.5 p-2 rounded-lg bg-emerald-500/10 border border-emerald-500/25 flex items-start gap-1.5">
        <BadgeCheck className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0 mt-0.5" />
        <div className="text-[11px] text-slate-300 leading-relaxed min-w-0">
          <span className="font-semibold text-emerald-300">
            Using certification uploaded by {attached.uploadedByName || 'a team member'} on {uploadedDate} — Verified
          </span>
          <div className="text-slate-500">{attached.documentType} · {attached.originalFilename}</div>
          <button type="button" onClick={() => setReplacing(true)} className="mt-0.5 text-[10px] font-semibold text-emerald-400 hover:text-emerald-300 underline">
            Replace with a new upload
          </button>
        </div>
      </div>
    );
  }

  if (status === 'Pending Review') {
    return (
      <div className="mt-1.5 p-2 rounded-lg bg-amber-500/10 border border-amber-500/25 flex items-start gap-1.5">
        <Clock className="w-3.5 h-3.5 text-amber-400 flex-shrink-0 mt-0.5" />
        <div className="text-[11px] text-amber-200 leading-relaxed">
          A certification for {carrierName} is uploaded but still Pending Review — a Quality Lead or GDP Auditor needs to verify it.
        </div>
      </div>
    );
  }

  // Missing, or Verified-but-replacing: show the upload control (this is the gate itself for Missing).
  return (
    <div className={`mt-1.5 p-2 rounded-lg border flex items-start gap-1.5 ${status === 'Missing' ? 'bg-rose-500/10 border-rose-500/30' : 'bg-slate-900 border-slate-700'}`}>
      <ShieldAlert className={`w-3.5 h-3.5 flex-shrink-0 mt-0.5 ${status === 'Missing' ? 'text-rose-400' : 'text-slate-400'}`} />
      <div className="text-[11px] leading-relaxed min-w-0 flex-1">
        <span className={status === 'Missing' ? 'font-semibold text-rose-300' : 'text-slate-300'}>
          {status === 'Missing'
            ? `No certification on file for ${carrierName} — blocked until one is uploaded and verified.`
            : `Uploading a new certification for ${carrierName}.`}
        </span>
        <div className="mt-1 flex items-center gap-2">
          <input
            ref={fileInputRef}
            type="file"
            className="hidden"
            onChange={(e) => e.target.files?.[0] && handleFileSelected(e.target.files[0])}
          />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            className="text-[10px] font-bold px-2 py-1 rounded bg-rose-500/20 hover:bg-rose-500/30 text-rose-200 border border-rose-500/40 flex items-center gap-1 disabled:opacity-50"
          >
            <UploadCloud className="w-3 h-3" />
            {uploading ? 'Uploading…' : 'Upload Certificate'}
          </button>
          {replacing && (
            <button type="button" onClick={() => setReplacing(false)} className="text-[10px] text-slate-400 hover:text-slate-200 underline">
              Cancel
            </button>
          )}
        </div>
        {uploadMessage && <div className="mt-1 text-slate-400">{uploadMessage}</div>}
      </div>
    </div>
  );
};
