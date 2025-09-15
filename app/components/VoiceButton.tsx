// app/components/VoiceButton.tsx
"use client";
import { useEffect, useRef, useState } from "react";

export default function VoiceButton({ onFinal }: { onFinal: (text: string)=>void }) {
  const [listening, setListening] = useState(false);
  const recRef = useRef<any>(null);

  useEffect(() => {
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) return;
    const rec = new SR();
    rec.continuous = false;
    rec.interimResults = true;
    rec.lang = "en-GB"; // set language as needed (see MDN lang property)
    rec.onresult = (e: any) => {
      let final = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        if (e.results[i].isFinal) final += e.results[i][0].transcript;
      }
      if (final.trim()) onFinal(final.trim());
    };
    rec.onend = () => setListening(false);
    recRef.current = rec;
  }, [onFinal]);

  function toggle() {
    if (!recRef.current) return;
    if (!listening) { recRef.current.start(); setListening(true); }
    else { recRef.current.stop(); }
  }

  return (
    <button onClick={toggle} style={{ padding:"10px 14px", borderRadius:8 }}>
      {listening ? "Stop Listening" : "Ask by Voice"}
    </button>
  );
}