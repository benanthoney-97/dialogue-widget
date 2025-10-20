"use client";
import React, { useRef, useState } from "react";
import { v4 as uuidv4 } from 'uuid';
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
      setNotification(null); // Clear notification on new file selection
    }
  }

  function handleRemoveFile(idx: number) {
    setFiles((prev) => {
      const updated = prev.filter((_, i) => i !== idx);
      if (updated.length === 0) {
        setNotification(null); // Clear notification if all files removed
      }
      return updated;
    });
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
        let client_id: number | null = null;
        // Query clients table for client_id using clientSlug (field is 'name')
        if (clientSlug) {
          const { data: clientData, error: clientError } = await supabase
            .from('clients')
            .select('id')
            .eq('name', clientSlug)
            .single();
          if (clientError || !clientData) {
            setNotification({ type: 'error', message: 'Client not found.' });
            setSubmitted(false);
            return;
          }
          client_id = clientData.id;
        }
        if (uploadMode === 'upload' && files.length > 0 && clientSlug && client_id) {
      for (const file of files) {
        const storagePath = `clients/${clientSlug}/${file.name}`;
        const { data: uploadData, error: uploadError } = await supabase.storage
          .from('docs')
          .upload(storagePath, file, { upsert: true });

        if (!uploadError) {
          // Try to get a public URL for the uploaded object
          const { data: urlData } = await supabase.storage.from('docs').getPublicUrl(storagePath);
          // supabase client may return publicUrl or publicURL depending on version
          const publicURL = (urlData as any)?.publicUrl ?? (urlData as any)?.publicURL ?? null;

          // Fallback: construct expected public object URL (works if bucket is public)
          const fallbackUrl =
            (process.env.NEXT_PUBLIC_SUPABASE_URL ?? "").replace(/\/$/, "") +
            `/storage/v1/object/public/docs/${encodeURIComponent(storagePath)}`;

          const documentUrl = publicURL || fallbackUrl;

          // Insert placeholder row into agent_map with document_url set
          const agent_id = uuidv4();
          const { error: insertError } = await supabase
            .from('agent_map')
            .insert([
              {
                agent_id,
                client_id,
                agent_name: file.name,
                status: 'Pending',
                created_at: new Date().toISOString(),
                key: file.name,
                document_url: documentUrl,
              },
            ]);
          if (insertError) {
            allSuccess = false;
            if (!firstError) firstError = insertError.message;
          }
        } else {
          allSuccess = false;
          if (!firstError) firstError = uploadError.message;
        }
      }
      if (allSuccess) {
        setNotification({ type: 'success', message: 'Upload successful!' });
      } else {
        setNotification({ type: 'error', message: `Upload failed: ${firstError}` });
      }
    }
    // (You can add logic for fileUrl mode here if needed)
    setSubmitted(false);
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
            {/* ...existing code... */}
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
                    accept=".pdf,.docx,.txt,.html"
                    onChange={handleFileChange}
                    style={{ display: 'none' }}
                  />
                  {files.length === 0 ? (
                    <>
                      <div style={{ marginBottom: 8 }}>Drag & drop files here</div>
                      <div style={{ fontSize: 15, color: '#7ea0e6', fontWeight: 400 }}>or <span style={{ textDecoration: 'underline', color: '#7ea0e6', cursor: 'pointer' }}>click to select from computer</span></div>
                      <div style={{ display: 'flex', gap: 8, marginTop: 10, justifyContent: 'center' }}>
                        {['PDF', 'TXT', 'DOCX', 'HTML'].map(type => (
                          <span
                            key={type}
                            style={{
                              background: '#22325a',
                              color: '#7ea0e6',
                              border: '1px solid #2d406b',
                              borderRadius: 8,
                              padding: '2px 10px',
                              fontSize: 13,
                              fontWeight: 600,
                              letterSpacing: 0.5,
                              textTransform: 'uppercase',
                            }}
                          >
                            {type}
                          </span>
                        ))}
                      </div>
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
                    onChange={e => {
                      setFileUrl(e.target.value);
                      setNotification(null); // Clear notification on new URL
                    }}
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
              {/* Uploading message and notification below the button */}
              {submitted && !notification && (
                <div style={{
                  marginTop: 18,
                  color: '#fff',
                  background: '#22325a',
                  border: '2px solid #fff',
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
                  Do not leave this page while your document is uploading.
                </div>
              )}
              {notification && (
                <div style={{
                  marginTop: 18,
                  marginBottom: 0,
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
                  flexDirection: notification.type === 'success' ? 'row' : 'column',
                  alignItems: 'center',
                  gap: notification.type === 'success' ? 16 : 10,
                  justifyContent: notification.type === 'success' ? 'center' : 'initial',
                }}>
                  <span>{notification.message}</span>
                  {notification.type === 'success' && (
                    <button
                      style={{
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