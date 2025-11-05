import { jsPDF } from "jspdf";

export const COOPER_FONT_NAME = "CooperBT";
const COOPER_FONT_FILE = "Cooper Light BT.ttf";
const COOPER_FONT_PATH = "/fonts/CooperBT/Cooper Light BT.ttf";

let cooperFontDataPromise: Promise<string> | null = null;

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    const chunk = bytes.subarray(i, i + chunkSize);
    binary += String.fromCharCode(...chunk);
  }
  return btoa(binary);
}

async function loadCooperFontData(): Promise<string> {
  if (!cooperFontDataPromise) {
    cooperFontDataPromise = fetch(COOPER_FONT_PATH)
      .then((res) => {
        if (!res.ok) {
          throw new Error(`Failed to fetch Cooper font: ${res.status}`);
        }
        return res.arrayBuffer();
      })
      .then(arrayBufferToBase64);
  }
  return cooperFontDataPromise;
}

export async function ensureCooperFont(doc: jsPDF): Promise<boolean> {
  try {
    const fontData = await loadCooperFontData();
    doc.addFileToVFS(COOPER_FONT_FILE, fontData);
    doc.addFont(COOPER_FONT_FILE, COOPER_FONT_NAME, "normal");
    return true;
  } catch (error) {
    console.warn("[PDF] Failed to load Cooper font", error);
    return false;
  }
}
