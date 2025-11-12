"use client";

import Sidebar from "../Sidebar";
import Topbar from "@/components/Topbar";
import { RealtimeChat } from "@/components/realtime-chat";
import { TOPBAR_HEIGHT } from "@/components/topbarHeight";

export default function LiveChatPage() {
  const contentHeight = `calc(100vh - ${TOPBAR_HEIGHT}px)`;

  return (
    <>
      <Sidebar />
      <Topbar
        title="Support"
        hideCadenceControls
        hideProfileAvatar
        rightSlot={<></>}
        offsetLeft="var(--sidebar-width)"
      />
      <main
        style={{
          minHeight: contentHeight,
          height: contentHeight,
          display: "flex",
          flexDirection: "column",
          marginLeft: "var(--sidebar-width)",
          background: "var(--bg, #f4f8ff)",
          paddingTop: TOPBAR_HEIGHT,
          overflow: "hidden",
        }}
      >
        <div
          style={{
            flex: 1,
            display: "flex",
            flexDirection: "column",
            height: "100%",
            minHeight: 0,
          }}
        >
          <div
            style={{
              flex: 1,
              display: "flex",
              justifyContent: "center",
              padding: "0 64px",
              boxSizing: "border-box",
              minHeight: 0,
            }}
          >
            <div
              style={{
                flex: 1,
                maxWidth: 720,
                width: "100%",
                display: "flex",
              }}
            >
              <RealtimeChat roomName="default-room" username="Guest" />
            </div>
          </div>
        </div>
      </main>
    </>
  );
}
