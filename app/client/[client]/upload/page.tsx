"use client";
import React, { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { usePathname } from "next/navigation";
import { supabase } from "../../../lib/supabaseClient";
import Sidebar from "../Sidebar";

export default function UploadPage() {
  const router = useRouter();
  const [notification, setNotification] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [uploadMode, setUploadMode] = useState<'upload' | 'url'>('upload');
  const [fileUrl, setFileUrl] = useState('');
  const [files, setFiles] = useState<File[]>([]);
  const [submitted, setSubmitted] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    if (e.target.files) {
      setFiles(Array.from(e.target.files));
    }
  }

  function handleRemoveFile(idx: number) {
    setFiles((prev) => prev.filter((_, i) => i !== idx));
  }


  const pathname = usePathname();
  // Get client slug from URL
  function getClientSlug(pathname: string | null): string {
    if (!pathname) return "";
    const match = pathname.match(/^\/client\/([^\/]+)/);
    return match ? match[1] : "";
  }
  const clientSlug = getClientSlug(pathname);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitted(true);
    let allSuccess = true;
    let firstError = null;
    if (uploadMode === 'upload' && files.length > 0 && clientSlug) {
      for (const file of files) {
        const { error } = await supabase.storage
          .from('docs')
          .upload(`clients/${clientSlug}/${file.name}`, file, { upsert: true });
        if (error) {
          allSuccess = false;
          if (!firstError) firstError = error.message;
        }
      }
      if (allSuccess) {
        setNotification({ type: 'success', message: 'Upload successful!' });
      } else {
        setNotification({ type: 'error', message: `Upload failed: ${firstError}` });
      }
    }
    // (You can add logic for fileUrl mode here if needed)
    setTimeout(() => {
      setFiles([]);
      setSubmitted(false);
      setNotification(null);
    }, 4000);
  }

  return (
    <>
      <main style={{ minHeight: "100dvh", background: "#0a1628", padding: 0, fontFamily: "'CooperBT', Cooper, 'Cooper Light BT', serif", display: 'flex', flexDirection: 'row' }}>
        <div style={{ width: 180, flexShrink: 0 }}>
          <Sidebar />
        </div>
        <div style={{
          flex: 1,
          background: "#16213a",
          borderRadius: 16,
          boxShadow: "0 8px 32px rgba(10,22,40,0.45)",
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontFamily: "inherit",
          position: 'relative',
          minHeight: '100dvh',
          overflow: 'auto',
        }}>
          <div style={{
            width: 420,
            background: '#192447',
            borderRadius: 18,
            boxShadow: '0 4px 24px rgba(10,22,40,0.18)',
            padding: '48px 36px 36px 36px',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
          }}>
            {/* Notification */}
            {notification && (
              <div style={{
                marginBottom: 18,
                color: notification.type === 'success' ? '#22c55e' : '#ef4444',
                background: notification.type === 'success' ? 'rgba(34,197,94,0.08)' : 'rgba(239,68,68,0.08)',
                border: `1.5px solid ${notification.type === 'success' ? '#22c55e' : '#ef4444'}`,
                borderRadius: 8,
                padding: '10px 18px',
                fontWeight: 700,
                fontSize: 15,
                textAlign: 'center',
                width: '100%',
                letterSpacing: 0.1,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: 10,
              }}>
                <span>{notification.message}</span>
                {notification.type === 'success' && (
                  <button
                    style={{
                      marginTop: 4,
                      background: '#22c55e',
                      color: '#fff',
                      border: 'none',
                      borderRadius: 6,
                      padding: '7px 18px',
                      fontWeight: 700,
                      fontSize: 15,
                      cursor: 'pointer',
                      boxShadow: '0 2px 8px #22c55e33',
                      transition: 'background 0.18s',
                    }}
                    onClick={() => router.push(`/client/${clientSlug}/documents`)}
                  >
                    Track Progress
                  </button>
                )}
              </div>
            )}
            {/* Document Icon */}
            <div style={{ marginBottom: 18 }}>
              <svg width="54" height="54" viewBox="0 0 54 54" fill="none" xmlns="http://www.w3.org/2000/svg">
                <rect x="10" y="6" width="34" height="42" rx="5" fill="#22325a" stroke="#7ea0e6" strokeWidth="2.2"/>
                <rect x="17" y="16" width="20" height="3" rx="1.5" fill="#7ea0e6"/>
                <rect x="17" y="25" width="20" height="3" rx="1.5" fill="#7ea0e6"/>
                <rect x="17" y="34" width="12" height="3" rx="1.5" fill="#7ea0e6"/>
              </svg>
            </div>
            {/* Heading */}
            <h2 style={{ fontSize: 22, fontWeight: 800, marginBottom: 18, color: "#e6eaff", fontFamily: "inherit", letterSpacing: 0.5 }}>Add a file for processing</h2>
            {/* Chips for Upload/File URL */}
            <div style={{ display: 'flex', gap: 12, marginBottom: 12, alignSelf: 'center', justifyContent: 'center', width: '80%' }}>
              <button
                type="button"
                onClick={() => setUploadMode('upload')}
                style={{
                  width: '50%',
                  padding: '10px 0',
                  borderRadius: 999,
                  background: uploadMode === 'upload' ? '#2d406b' : '#22325a',
                  color: uploadMode === 'upload' ? '#fff' : '#a3c0ff',
                  fontWeight: 700,
                  fontSize: 15,
                  border: uploadMode === 'upload' ? '2px solid #7ea0e6' : '1px solid #2d406b',
                  cursor: 'pointer',
                  boxShadow: uploadMode === 'upload' ? '0 2px 12px #22325a' : '0 2px 8px rgba(10,22,40,0.13)',
                  transition: 'background 0.18s, color 0.18s, border 0.18s',
                }}
              >
                Upload
              </button>
              <button
                type="button"
                onClick={() => setUploadMode('url')}
                style={{
                  width: '50%',
                  padding: '10px 0',
                  borderRadius: 999,
                  background: uploadMode === 'url' ? '#2d406b' : '#22325a',
                  color: uploadMode === 'url' ? '#fff' : '#a3c0ff',
                  fontWeight: 700,
                  fontSize: 15,
                  border: uploadMode === 'url' ? '2px solid #7ea0e6' : '1px solid #2d406b',
                  cursor: 'pointer',
                  boxShadow: uploadMode === 'url' ? '0 2px 12px #22325a' : '0 2px 8px rgba(10,22,40,0.13)',
                  transition: 'background 0.18s, color 0.18s, border 0.18s',
                }}
              >
                File URL
              </button>
            </div>
            {/* Upload form */}
            <form onSubmit={handleSubmit} style={{ width: '100%' }}>
              {uploadMode === 'upload' ? (
                <label
                  htmlFor="file-upload"
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    border: '2px dashed #2d406b',
                    background: '#22325a',
                    borderRadius: 12,
                    padding: '36px 0',
                    marginBottom: 22,
                    color: '#a3c0ff',
                    fontSize: 16,
                    fontWeight: 600,
                    transition: 'border 0.18s',
                    minHeight: 120,
                    width: '100%',
                    textAlign: 'center',
                    cursor: 'pointer',
                  }}
                  onDragOver={e => { e.preventDefault(); e.stopPropagation(); }}
                  onDrop={e => {
                    e.preventDefault();
                    e.stopPropagation();
                    if (e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files.length > 0) {
                      setFiles(Array.from(e.dataTransfer.files));
                    }
                  }}
                >
                  <input
                    id="file-upload"
                    ref={fileInputRef}
                    type="file"
                    multiple
                    onChange={handleFileChange}
                    style={{ display: 'none' }}
                  />
                  {files.length === 0 ? (
                    <>
                      <div style={{ marginBottom: 8 }}>Drag & drop files here</div>
                      <div style={{ fontSize: 15, color: '#7ea0e6', fontWeight: 400 }}>or <span style={{ textDecoration: 'underline', color: '#7ea0e6', cursor: 'pointer' }}>click to select from computer</span></div>
                    </>
                  ) : (
                    <ul style={{ color: '#a3c0ff', fontSize: 15, paddingLeft: 0, margin: 0, width: '100%' }}>
                      {files.map((file, idx) => (
                        <li key={idx} style={{ marginBottom: 6, display: 'flex', alignItems: 'center', gap: 10, justifyContent: 'space-between', width: '100%' }}>
                          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 220 }}>{file.name}</span>
                          <button type="button" onClick={() => handleRemoveFile(idx)} style={{ color: '#ef4444', background: 'none', border: 'none', cursor: 'pointer', fontSize: 15 }}>Remove</button>
                        </li>
                      ))}
                    </ul>
                  )}
                </label>
              ) : (
                <div
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    border: '2px dashed #2d406b',
                    background: '#22325a',
                    borderRadius: 12,
                    padding: '36px 0',
                    marginBottom: 22,
                    color: '#a3c0ff',
                    fontSize: 16,
                    fontWeight: 600,
                    minHeight: 120,
                    width: '100%',
                    textAlign: 'center',
                  }}
                >
                  <input
                    type="url"
                    value={fileUrl}
                    onChange={e => setFileUrl(e.target.value)}
                    placeholder="Paste file URL here..."
                    style={{
                      width: '80%',
                      padding: '12px 14px',
                      borderRadius: 8,
                      border: '1px solid #2d406b',
                      fontSize: 15,
                      color: '#a3c0ff',
                      background: '#192447',
                      marginBottom: 0,
                    }}
                  />
                </div>
              )}
              <button
                type="submit"
                disabled={
                  (uploadMode === 'upload' && (files.length === 0 || submitted)) ||
                  (uploadMode === 'url' && (fileUrl.trim() === '' || submitted))
                }
                style={{
                  background:
                    (uploadMode === 'upload' && files.length > 0 && !submitted) ||
                    (uploadMode === 'url' && fileUrl.trim() && !submitted)
                      ? '#525fe1'
                      : '#2d406b',
                  color: '#fff',
                  border: 'none',
                  borderRadius: 10,
                  padding: '12px 28px',
                  fontWeight: 700,
                  fontSize: 16,
                  cursor:
                    (uploadMode === 'upload' && files.length > 0 && !submitted) ||
                    (uploadMode === 'url' && fileUrl.trim() && !submitted)
                      ? 'pointer'
                      : 'not-allowed',
                  marginTop: 18,
                  width: '100%',
                  boxShadow:
                    (uploadMode === 'upload' && files.length > 0 && !submitted) ||
                    (uploadMode === 'url' && fileUrl.trim() && !submitted)
                      ? '0 2px 8px #525fe1'
                      : 'none',
                  transition: 'background 0.18s, box-shadow 0.18s',
                }}
              >
                {submitted ? 'Uploading...' : 'Submit'}
              </button>
            </form>
          </div>
        </div>
        <style>{`
          @font-face {
            font-family: 'CooperBT';
            src: url('/fonts/CooperBT/Cooper Light BT.ttf') format('truetype');
            font-weight: normal;
            font-style: normal;
            font-display: swap;
          }
        `}</style>
      </main>
    </>
  );
}