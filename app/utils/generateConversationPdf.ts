import { docMap } from "@/app/lib/docMap";

export async function generateConversationPdf(row: any) {
  const jsPDF = (await import('jspdf')).jsPDF;
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 15;
  const usableWidth = pageWidth - margin * 2;
  const lineHeight = 8;
  let y = margin;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(18);
    const briefingTitle = 'Briefing Note';
    const centerX = pageWidth / 2;
    doc.text(briefingTitle, centerX, y, { align: 'center' });
  y += lineHeight + 2;

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

  const keyReplacements: Record<string, string> = {
    'received_at': 'Dialogue Date',
    'transcript_summary': 'Dialogue Summary',
    'call_summary_title': 'Dialogue Title',
    'sourceDocument': 'Source Document',
  'intent': 'Pipeline Intent',
    'pipeline_intent_reasoning': 'Pipeline Intent Reasoning',
  };
  function formatDate(dateStr: string) {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    return d.toLocaleString('en-GB', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false
    });
  }

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

  const briefingKeys = ['briefing_transcript', 'briefing_transcript_summary', 'briefing_summaries'];
  const myBriefings = filtered.filter(([key]) => briefingKeys.includes(key));
  const dateEntry = filtered.find(([key]) => key === 'received_at');
    let rest = filtered.filter(([key]) => !briefingKeys.includes(key) && key !== 'received_at');
  // Move 'intent' above 'pipeline_intent_reasoning' if both exist
  const intentIdx = rest.findIndex(([key]) => key === 'intent');
  const pipelineIdx = rest.findIndex(([key]) => key === 'pipeline_intent_reasoning');
  if (intentIdx !== -1 && pipelineIdx !== -1 && intentIdx > pipelineIdx) {
    // Remove intent and re-insert above pipeline_intent_reasoning
    const [intentEntry] = rest.splice(intentIdx, 1);
    rest.splice(pipelineIdx, 0, intentEntry);
  }

  if (dateEntry) {
    const [key, value] = dateEntry;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    const keyLabel = keyReplacements[key] || key.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
    const keyText = `${keyLabel}:`;
    doc.text(keyText, margin, y);
    doc.setFont('helvetica', 'normal');
    const valueText = typeof value === 'string' ? formatDate(value) : '';
    const keyWidth = doc.getTextWidth(keyText);
    doc.text(valueText, margin + keyWidth + 4, y);
    y += lineHeight;
    y += 4;
  }

  if (myBriefings.length > 0) {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(14);
    const heading = 'My Briefings';
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
          y += lineHeight * 2;
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
          y += lineHeight;
        }
      });
    }
    y += 6;
  }

  const transcriptKey = 'transcript';
  const transcriptIdx = rest.findIndex(([key]) => key === transcriptKey);
  if (transcriptIdx !== -1) {
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
      } else if (key.toLowerCase().includes('date') && typeof value === 'string') {
        valueText = formatDate(value);
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
        y += lineHeight * 2;
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
        y += lineHeight;
      }
    }
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(13);
    const userDetailsHeader = 'User Conversation Details';
    const centerX = pageWidth / 2;
    doc.text(userDetailsHeader, centerX, y, { align: 'center' });
    y += lineHeight;
    doc.setFontSize(11);
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
      y += lineHeight * 2;
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
      y += lineHeight;
    }
    for (let i = transcriptIdx + 1; i < rest.length; i++) {
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
      doc.setFontSize(11);
      const keyWidth = doc.getTextWidth(keyText);
      if (keyWidth + 4 + doc.getTextWidth(valueText) < usableWidth) {
        doc.text(keyText, margin, y);
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(11);
        doc.text(valueText, margin + keyWidth + 4, y);
        y += lineHeight * 2;
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
        y += lineHeight;
      }
    }
  } else {
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
      doc.setFontSize(11);
      const keyWidth = doc.getTextWidth(keyText);
      if (keyWidth + 4 + doc.getTextWidth(valueText) < usableWidth) {
        doc.text(keyText, margin, y);
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(11);
        doc.text(valueText, margin + keyWidth + 4, y);
        y += lineHeight * 2;
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
        y += lineHeight;
      }
    });
  }
  doc.save('Briefing Note.pdf');
}
