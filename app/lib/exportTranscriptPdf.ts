export type PdfTranscriptMessage = {
  role: "agent" | "user";
  text: string;
};

export type TranscriptPdfPayload = {
  conversationTitle: string;
  personaName: string;
  researchType?: string;
  timestampLabel: string;
  messages: PdfTranscriptMessage[];
  fallbackText: string;
};

const sanitizeFilename = (value: string): string =>
  value
    .replace(/[\\/:*?"<>|]+/g, "-")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 120) || "conversation";

export async function exportTranscriptToPdf(payload: TranscriptPdfPayload) {
  const { jsPDF } = await import("jspdf");
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 16;
  const usableWidth = pageWidth - margin * 2;
  const lineHeight = 7;
  let y = margin;

  const ensurePageSpace = (requiredHeight: number) => {
    if (y + requiredHeight > pageHeight - margin) {
      doc.addPage();
      y = margin;
    }
  };

  const bannerHeight = 18;
  doc.setFillColor("#073a70");
  doc.rect(0, 0, pageWidth, bannerHeight, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  const bannerTitle = `${payload.personaName} - ${payload.timestampLabel} - ${payload.researchType || "Transcript"}`;
  const bannerLines = doc.splitTextToSize(bannerTitle, pageWidth - margin * 2);
  let bannerY = bannerHeight / 2 + (bannerLines.length > 1 ? (lineHeight - 3) / 2 : 2);
  bannerLines.forEach((line: string) => {
    doc.text(line, pageWidth / 2, bannerY, { align: "center" });
    bannerY += lineHeight - 3;
  });
  doc.setTextColor(0, 0, 0);
  y = bannerHeight + margin;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(18);
  doc.text("Conversation Transcript", margin, y);
  y += lineHeight + 2;

  doc.setFontSize(12);
  doc.setFont("helvetica", "bold");
  ensurePageSpace(lineHeight * 3);
  doc.text("Persona:", margin, y);
  doc.setFont("helvetica", "normal");
  doc.text(payload.personaName || "Unknown persona", margin + 26, y);
  y += lineHeight;

  doc.setFont("helvetica", "bold");
  doc.text("Date:", margin, y);
  doc.setFont("helvetica", "normal");
  doc.text(payload.timestampLabel, margin + 26, y);
  y += lineHeight;

  if (payload.researchType) {
    doc.setFont("helvetica", "bold");
    doc.text("Research type:", margin, y);
    doc.setFont("helvetica", "normal");
    doc.text(payload.researchType, margin + 36, y);
    y += lineHeight;
  }

  if (payload.conversationTitle) {
    doc.setFont("helvetica", "bold");
    doc.text("Title:", margin, y);
    doc.setFont("helvetica", "normal");
    const titleLines = doc.splitTextToSize(payload.conversationTitle, usableWidth - 22);
    const valueX = margin + 22;
    titleLines.forEach((line: string) => {
      ensurePageSpace(lineHeight);
      doc.text(line, valueX, y);
      y += lineHeight;
    });
  }

  y += 4;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.text("Transcript", margin, y);
  y += lineHeight;
  doc.setFontSize(12);
  doc.setFont("helvetica", "normal");

  const addMessage = (message: PdfTranscriptMessage) => {
    const label = message.role === "user" ? "You" : payload.personaName || "Agent";
    const isUserMessage = message.role === "user";
    const bubblePaddingX = 6;
    const bubblePaddingY = 5;
    const bubbleMaxWidth = usableWidth * 0.82;
    const bubbleLines = doc.splitTextToSize(message.text, bubbleMaxWidth - bubblePaddingX * 2);
    const lineWidths = bubbleLines.map((line: string) => doc.getTextWidth(line));
    const contentWidth = lineWidths.length > 0 ? Math.max(...lineWidths) : 0;
    const bubbleWidth = Math.min(bubbleMaxWidth, Math.max(contentWidth + bubblePaddingX * 2, 24));
    const bubbleHeight = bubbleLines.length * lineHeight + bubblePaddingY * 2;
    const labelHeight = lineHeight;

    ensurePageSpace(labelHeight + bubbleHeight + 2);

    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    const labelX = isUserMessage ? margin + usableWidth : margin;
    doc.text(`${label}:`, labelX, y, { align: isUserMessage ? "right" : "left" });
    y += labelHeight;

    const bubbleX = isUserMessage ? margin + usableWidth - bubbleWidth : margin;
    const bubbleY = y;
    if (isUserMessage) {
      doc.setFillColor("#073a70");
      doc.setTextColor(255, 255, 255);
    } else {
      doc.setFillColor(232, 236, 244);
      doc.setTextColor(15, 23, 42);
    }
    doc.roundedRect(bubbleX, bubbleY, bubbleWidth, bubbleHeight, 3, 3, "F");

    doc.setFont("helvetica", "normal");
    doc.setFontSize(11);
    let textY = bubbleY + bubblePaddingY + lineHeight - 2;
    bubbleLines.forEach((line: string) => {
      doc.text(line, bubbleX + bubblePaddingX, textY);
      textY += lineHeight;
    });

    y += bubbleHeight + 3;
    doc.setTextColor(0, 0, 0);
  };

  if (payload.messages.length > 0) {
    payload.messages.forEach(addMessage);
  } else if (payload.fallbackText.trim().length > 0) {
    const fallbackLines = doc.splitTextToSize(payload.fallbackText, usableWidth);
    fallbackLines.forEach((line: string) => {
      ensurePageSpace(lineHeight);
      doc.text(line, margin, y);
      y += lineHeight;
    });
  } else {
    ensurePageSpace(lineHeight);
    doc.text("Transcript not available.", margin, y);
  }

  const filename = sanitizeFilename(
    `${payload.personaName} - ${payload.timestampLabel} - ${payload.researchType || "Transcript"}`,
  );
  doc.save(`${filename}.pdf`);
}
