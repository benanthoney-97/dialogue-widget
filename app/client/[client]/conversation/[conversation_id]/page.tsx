"use client";
import React, { useEffect, useState } from "react";
import Image from "next/image";
import { useRef } from "react";
import { docMap } from "@/app/lib/docMap";
import { usePathname, useRouter } from "next/navigation";
import { supabase } from "@/app/lib/supabaseClient";
import Sidebar from "../../Sidebar";
import DialogueBar from "@/app/components/DialogueBarTalkButton";

// This page will be at /client/[client]/conversation/[conversation_id]
export default function ConversationWithBriefingPage({ params }: { params: { conversation_id: string } }) {
  const [row, setRow] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [agentBg, setAgentBg] = useState<string | null>(null);
  const pathname = usePathname();
  const router = useRouter();
  const { conversation_id } = params;
  const contentRef = useRef<HTMLPreElement | null>(null);

  // Dynamically import jsPDF only on client
  async function handlePdfClick() {
    if (!row) return;
    const jsPDF = (await import('jspdf')).jsPDF;
    const doc = new jsPDF({ unit: 'mm', format: 'a4' });
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const margin = 15;
    const usableWidth = pageWidth - margin * 2;
    const lineHeight = 8;
    let y = margin;

    // Title: Briefing Note (bold)
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(18);
    doc.text('Briefing Note', margin, y);
    y += lineHeight + 2;

    // Agent name (from docMap)
    let agentName = '';
    if (row.agent_id) {
      const docEntry = Object.values(docMap).find(entry => entry.agentId === row.agent_id);
      if (docEntry && docEntry.agentName) {
        agentName = docEntry.agentName;
      }
    }
    if (agentName) {
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(13);
      doc.text(agentName, margin, y);
      y += lineHeight;
    }

    // Data points: bold key, normal value, with replacements and heading
    const keyReplacements: Record<string, string> = {
      'received_at': 'Dialogue Date',
      'transcript_summary': 'Dialogue Summary',
      'call_summary_title': 'Dialogue Title',
    };
    // Normalise Dialogue Date
    function formatDate(dateStr: string) {
      const d = new Date(dateStr);
      if (isNaN(d.getTime())) return dateStr;
      return d.toLocaleDateString('en-GB', { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' });
    }

    // Partition fields
    const filtered = Object.entries(row).filter(
      ([key]) => ![
        'id',
        'client_id',
        'type',
        'event_timestamp',
        'agent_id',
        'conversation_id',
        'status',
        'user_id',
        'call_duration_secs',
        'body',
      ].includes(key)
    );
    // My Briefings fields
    const briefingKeys = ['briefing_transcript', 'briefing_transcript_summary', 'briefing_summaries'];
    const myBriefings = filtered.filter(([key]) => briefingKeys.includes(key));
    // Dialogue Date field
    const dateEntry = filtered.find(([key]) => key === 'received_at');
    // Rest of fields (excluding briefings and date)
    const rest = filtered.filter(([key]) => !briefingKeys.includes(key) && key !== 'received_at');

    // --- Dialogue Date ---
    if (dateEntry) {
      const [key, value] = dateEntry;
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(12);
      const keyLabel = keyReplacements[key] || key.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
      const keyText = `${keyLabel}:`;
      // Place date on same line as heading
      doc.text(keyText, margin, y);
      doc.setFont('helvetica', 'normal');
      const valueText = typeof value === 'string' ? formatDate(value) : '';
      // Calculate width of keyText to position valueText after it
      const keyWidth = doc.getTextWidth(keyText);
      doc.text(valueText, margin + keyWidth + 4, y); // 4mm gap after label
      y += lineHeight;
      // Add extra top margin before My Briefings header
      y += 4;
    }

    // --- My Briefings section ---
    if (myBriefings.length > 0) {
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(14);
      const heading = 'My Briefings';
      // Center align the heading
      const pageWidth = doc.internal.pageSize.getWidth();
      const centerX = pageWidth / 2;
      doc.text(heading, centerX, y, { align: 'center' });
      y += lineHeight;
      doc.setFontSize(12);
      const arrayFields = [
        'briefing_summaries',
        'main_topics',
        'content_gaps',
        'questions',
        'pipeline_intent_reasoning',
        'competitive_comparison_summary',
      ];
      // Check if all myBriefings values are empty
      const allEmpty = myBriefings.every(([key, value]) => {
        if (value == null) return true;
        if (typeof value === 'string' && value.trim() === '') return true;
        if (Array.isArray(value) && value.length === 0) return true;
        if (typeof value === 'object' && Object.values(value).every(v => v == null || v === '' || (Array.isArray(v) && v.length === 0))) return true;
        return false;
      });
      if (allEmpty) {
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(11);
        doc.text('Have a briefing with your Dialogue assistant to see analysis here.', margin, y);
        y += lineHeight * 2;
      } else {
        myBriefings.forEach(([key, value]) => {
          // Skip if value is null, empty string, empty array, or all object values are empty/null/empty arrays
          if (
            value == null ||
            (typeof value === 'string' && value.trim() === '') ||
            (Array.isArray(value) && value.length === 0) ||
            (typeof value === 'object' && !Array.isArray(value) && Object.values(value).every(v => v == null || v === '' || (Array.isArray(v) && v.length === 0)))
          ) {
            return;
          }
          let keyLabel = keyReplacements[key] || key.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
          const keyText = `${keyLabel}:`;
          let valueText: string;
          if (arrayFields.includes(key) && Array.isArray(value)) {
            valueText = value.join(', ');
          } else if (arrayFields.includes(key) && typeof value === 'object' && value !== null) {
            valueText = Object.values(value).join(', ');
          } else {
            valueText = typeof value === 'string' ? value : JSON.stringify(value, null, 2);
          }
          doc.setFont('helvetica', 'bold');
          doc.setFontSize(11);
          const keyWidth = doc.getTextWidth(keyText);
          if (keyWidth + 4 + doc.getTextWidth(valueText) < usableWidth) {
            doc.text(keyText, margin, y);
            doc.setFont('helvetica', 'normal');
            doc.setFontSize(11);
            doc.text(valueText, margin + keyWidth + 4, y);
            y += lineHeight * 2; // Add extra space between data points
          } else {
            doc.text(keyText, margin, y);
            doc.setFont('helvetica', 'normal');
            doc.setFontSize(11);
            const valueLines = doc.splitTextToSize(valueText, usableWidth - keyWidth - 4);
            valueLines.forEach((line: string, idx: number) => {
              if (y + lineHeight > pageHeight - margin) {
                doc.addPage();
                y = margin;
              }
              doc.text(line, margin + (idx === 0 ? keyWidth + 4 : 0), y);
              y += lineHeight;
            });
            y += lineHeight; // Add extra space after wrapped data point
          }
        });
      }
      // Add extra top margin before next section
      y += 6;
    }

    // --- Rest of fields ---
    // Insert center-aligned header above transcript field if present
    const transcriptKey = 'transcript';
    const transcriptIdx = rest.findIndex(([key]) => key === transcriptKey);
    if (transcriptIdx !== -1) {
      // Render fields before transcript
      const arrayFields = [
        'briefing_summaries',
        'main_topics',
        'content_gaps',
        'questions',
        'pipeline_intent_reasoning',
        'competitive_comparison_summary',
      ];
      for (let i = 0; i < transcriptIdx; i++) {
        const [key, value] = rest[i];
        let keyLabel = keyReplacements[key] || key.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
        const keyText = `${keyLabel}:`;
        let valueText: string;
        if (arrayFields.includes(key) && Array.isArray(value)) {
          valueText = value.join(', ');
        } else if (arrayFields.includes(key) && typeof value === 'object' && value !== null) {
          valueText = Object.values(value).join(', ');
        } else {
          valueText = typeof value === 'string' ? value : JSON.stringify(value, null, 2);
        }
        doc.setFont('helvetica', 'bold');
        const keyWidth = doc.getTextWidth(keyText);
        if (keyWidth + 4 + doc.getTextWidth(valueText) < usableWidth) {
          doc.text(keyText, margin, y);
          doc.setFont('helvetica', 'normal');
          doc.text(valueText, margin + keyWidth + 4, y);
          y += lineHeight;
        } else {
          doc.text(keyText, margin, y);
          doc.setFont('helvetica', 'normal');
          const valueLines = doc.splitTextToSize(valueText, usableWidth - keyWidth - 4);
          valueLines.forEach((line: string, idx: number) => {
            if (y + lineHeight > pageHeight - margin) {
              doc.addPage();
              y = margin;
            }
            doc.text(line, margin + (idx === 0 ? keyWidth + 4 : 0), y);
            y += lineHeight;
          });
        }
      }
      // Centered header before transcript
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  const userDetailsHeader = 'User Conversation Details';
  const pageWidth = doc.internal.pageSize.getWidth();
  const centerX = pageWidth / 2;
  doc.text(userDetailsHeader, centerX, y, { align: 'center' });
  y += lineHeight;
  doc.setFontSize(11);
      // Render transcript field
      const [transcriptKeyName, transcriptValue] = rest[transcriptIdx];
      let transcriptLabel = keyReplacements[transcriptKeyName] || transcriptKeyName.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(11);
      const transcriptText = `${transcriptLabel}:`;
      let transcriptValueText: string;
      if (arrayFields.includes(transcriptKeyName) && Array.isArray(transcriptValue)) {
        transcriptValueText = transcriptValue.join(', ');
      } else if (arrayFields.includes(transcriptKeyName) && typeof transcriptValue === 'object' && transcriptValue !== null) {
        transcriptValueText = Object.values(transcriptValue).join(', ');
      } else {
        transcriptValueText = typeof transcriptValue === 'string' ? transcriptValue : JSON.stringify(transcriptValue, null, 2);
      }
      const transcriptKeyWidth = doc.getTextWidth(transcriptText);
      if (transcriptKeyWidth + 4 + doc.getTextWidth(transcriptValueText) < usableWidth) {
        doc.text(transcriptText, margin, y);
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(11);
        doc.text(transcriptValueText, margin + transcriptKeyWidth + 4, y);
        y += lineHeight * 2; // Add extra space after transcript
      } else {
        doc.text(transcriptText, margin, y);
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(11);
        const transcriptValueLines = doc.splitTextToSize(transcriptValueText, usableWidth - transcriptKeyWidth - 4);
        transcriptValueLines.forEach((line: string, idx: number) => {
          if (y + lineHeight > pageHeight - margin) {
            doc.addPage();
            y = margin;
          }
          doc.text(line, margin + (idx === 0 ? transcriptKeyWidth + 4 : 0), y);
          y += lineHeight;
        });
        y += lineHeight; // Add extra space after wrapped transcript
      }
      // Render fields after transcript
      for (let i = transcriptIdx + 1; i < rest.length; i++) {
        const [key, value] = rest[i];
        let keyLabel = keyReplacements[key] || key.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(11);
        const keyText = `${keyLabel}:`;
        let valueText: string;
        if (arrayFields.includes(key) && Array.isArray(value)) {
          valueText = value.join(', ');
        } else if (arrayFields.includes(key) && typeof value === 'object' && value !== null) {
          valueText = Object.values(value).join(', ');
        } else {
          valueText = typeof value === 'string' ? value : JSON.stringify(value, null, 2);
        }
        const keyWidth = doc.getTextWidth(keyText);
        if (keyWidth + 4 + doc.getTextWidth(valueText) < usableWidth) {
          doc.text(keyText, margin, y);
          doc.setFont('helvetica', 'normal');
          doc.setFontSize(11);
          doc.text(valueText, margin + keyWidth + 4, y);
          y += lineHeight * 2; // Add extra space between data points
        } else {
          doc.text(keyText, margin, y);
          doc.setFont('helvetica', 'normal');
          doc.setFontSize(11);
          const valueLines = doc.splitTextToSize(valueText, usableWidth - keyWidth - 4);
          valueLines.forEach((line: string, idx: number) => {
            if (y + lineHeight > pageHeight - margin) {
              doc.addPage();
              y = margin;
            }
            doc.text(line, margin + (idx === 0 ? keyWidth + 4 : 0), y);
            y += lineHeight;
          });
          y += lineHeight; // Add extra space after wrapped data point
        }
      }
    } else {
      // No transcript field, render all as before
      const arrayFields = [
        'briefing_summaries',
        'main_topics',
        'content_gaps',
        'questions',
        'pipeline_intent_reasoning',
        'competitive_comparison_summary',
      ];
      rest.forEach(([key, value]) => {
        let keyLabel = keyReplacements[key] || key.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
        const keyText = `${keyLabel}:`;
        let valueText: string;
        if (arrayFields.includes(key) && Array.isArray(value)) {
          valueText = value.join(', ');
        } else if (arrayFields.includes(key) && typeof value === 'object' && value !== null) {
          valueText = Object.values(value).join(', ');
        } else {
          valueText = typeof value === 'string' ? value : JSON.stringify(value, null, 2);
        }
        doc.setFont('helvetica', 'bold');
        const keyWidth = doc.getTextWidth(keyText);
        if (keyWidth + 4 + doc.getTextWidth(valueText) < usableWidth) {
          doc.text(keyText, margin, y);
          doc.setFont('helvetica', 'normal');
          doc.text(valueText, margin + keyWidth + 4, y);
          y += lineHeight;
        } else {
          doc.text(keyText, margin, y);
          doc.setFont('helvetica', 'normal');
          const valueLines = doc.splitTextToSize(valueText, usableWidth - keyWidth - 4);
          valueLines.forEach((line: string, idx: number) => {
            if (y + lineHeight > pageHeight - margin) {
              doc.addPage();
              y = margin;
            }
            doc.text(line, margin + (idx === 0 ? keyWidth + 4 : 0), y);
            y += lineHeight;
          });
        }
      });
    }
  doc.save('conversation-details.pdf');
  }

  useEffect(() => {
    async function fetchRow() {
      setLoading(true);
      setError(null);
      // Fetch from the Supabase view conversation_with_briefing
      const { data, error } = await supabase
        .from('conversation_with_briefing')
        .select('*')
        .eq('conversation_id', conversation_id)
        .single();
      if (error || !data) {
        setError("Conversation not found");
        setLoading(false);
        return;
      }
      setRow(data);
      // fetch agent_map background_image for this agent (if present)
      // background_image may be a full public URL OR a Supabase storage path.
      // Set NEXT_PUBLIC_BG_BUCKET to override the bucket name (default: 'background_images').
      try {
        const agentId = data.agent_id;
        if (agentId) {
          const { data: agentData, error: agentError } = await supabase
            .from('agent_map')
            .select('background_image')
            .eq('agent_id', agentId)
            .maybeSingle();
          if (!agentError && agentData?.background_image) {
            const bgVal: string = agentData.background_image;
            let publicUrl: string | null = null;
            if (/^https?:\/\//i.test(bgVal)) {
              // already a URL
              publicUrl = bgVal;
            } else {
              // resolve via Supabase storage public URL
              const bucket = (process.env.NEXT_PUBLIC_BG_BUCKET as string) || 'background_images';
              // strip leading bucket prefix if present
              let path = bgVal.replace(/^\/+/, '');
              if (path.startsWith(bucket + '/')) {
                path = path.slice(bucket.length + 1);
              }
              try {
                // getPublicUrl is synchronous in some SDK versions and returns { data: { publicUrl } }
                // but older/newer SDKs might use publicURL casing; check both.
                // Cast to `any` so we can safely check both property casings across SDK versions.
                // @ts-ignore
                const urlResp = supabase.storage.from(bucket).getPublicUrl(path);
                const urlData = (urlResp?.data ?? urlResp) as any;
                publicUrl = urlData?.publicUrl ?? urlData?.publicURL ?? null;
              } catch (e) {
                console.error('Failed to resolve storage public URL for', bgVal, e);
                publicUrl = null;
              }
            }

            setAgentBg(publicUrl);
          } else {
            setAgentBg(null);
          }
        } else {
          setAgentBg(null);
        }
      } catch (e) {
        console.error('Failed to load agent_map background_image', e);
        setAgentBg(null);
      }
      setLoading(false);
    }
    if (conversation_id) fetchRow();
  }, [conversation_id]);

  return (
    <main style={{ minHeight: "100dvh", background: "#0a1628", padding: 0, fontFamily: "'CooperBT', Cooper, 'Cooper Light BT', serif", display: 'flex', flexDirection: 'row' }}>
      <div style={{ width: 180, flexShrink: 0 }}>
        <Sidebar />
      </div>
      <div
        style={{
          flex: 1,
          background: "#16213a",
          borderRadius: 16,
          boxShadow: "0 8px 32px rgba(10,22,40,0.45)",
          padding: 40,
          fontFamily: "inherit",
          position: 'relative',
          minHeight: '100dvh',
          overflowY: 'auto',
          overflowX: 'hidden',
          maxWidth: '100%',
        }}
      >
        {/* PDF icon in top right corner */}
        <div style={{ position: 'absolute', top: 24, right: 32, zIndex: 10 }}>
          <Image
            src="/icons/pdf-icon.png"
            alt="PDF"
            width={32}
            height={32}
            style={{ display: 'block', cursor: 'pointer' }}
            onClick={handlePdfClick}
          />
        </div>
        <h2 style={{ fontSize: 22, fontWeight: 700, marginBottom: 24, color: "#e6eaff", fontFamily: "inherit" }}>Conversation Details</h2>
        {loading ? (
          <div style={{ color: '#a3c0ff', textAlign: 'center', padding: 24 }}>Loading…</div>
        ) : error ? (
          <div style={{ color: '#ef4444', textAlign: 'center', padding: 24 }}>{error}</div>
        ) : row ? (
          <div style={{ color: '#a3c0ff', fontSize: 16 }}>
            {/* Filter out unwanted fields */}
            <pre
              ref={contentRef}
              style={{
                color: '#e6eaff',
                background: '#22325a',
                padding: 16,
                borderRadius: 8,
                fontSize: 15,
                overflowX: 'auto',
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-word',
                maxWidth: '100%',
                boxSizing: 'border-box',
              }}
            >
              {JSON.stringify(
                Object.fromEntries(
                  Object.entries(row).filter(
                    ([key]) => ![
                      'id',
                      'client_id',
                      'type',
                      'event_timestamp',
                      'agent_id',
                      'conversation_id',
                      'status',
                      'user_id',
                      'call_duration_secs',
                      'body',
                    ].includes(key)
                  )
                ),
                null,
                2
              )}
            </pre>
          </div>
        ) : null}
      </div>
    </main>
  );
}
