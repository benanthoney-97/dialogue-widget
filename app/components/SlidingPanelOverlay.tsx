"use client";

import React, { useEffect, useId, useRef, useState } from "react";
import { BODY_FONT_STACK, HEADING_FONT_STACK } from "@/app/lib/fontStacks";

const OVERLAY_ANIMATION_MS = 420;

type SlidingPanelOverlayProps = {
  open: boolean;
  title: React.ReactNode;
  children: React.ReactNode;
  onRequestClose: () => void;
  description?: React.ReactNode;
  descriptionId?: string;
  titleId?: string;
  actions?: React.ReactNode;
  width?: string;
  className?: string;
  bodyClassName?: string;
  onAfterClose?: () => void;
};

export default function SlidingPanelOverlay({
  open,
  title,
  children,
  onRequestClose,
  description,
  titleId,
  descriptionId,
  actions,
  width = "clamp(320px, calc(100vw - var(--stage-topbar-offset, 0px) - 164px), 100vw)",
  className = "",
  bodyClassName = "",
}: SlidingPanelOverlayProps) {
  const [isMounted, setIsMounted] = useState(open);
  const [isClosing, setIsClosing] = useState(false);
  const closeTimeoutRef = useRef<number | null>(null);
  const generatedTitleId = useId();
  const generatedDescriptionId = useId();
  const resolvedTitleId = titleId ?? generatedTitleId;
  const resolvedDescriptionId = descriptionId ?? generatedDescriptionId;

  useEffect(() => {
    if (open) {
      if (closeTimeoutRef.current !== null) {
        window.clearTimeout(closeTimeoutRef.current);
        closeTimeoutRef.current = null;
      }
      setIsMounted(true);
      setIsClosing(false);
      return;
    }

    if (!isMounted) return;
    setIsClosing(true);
    closeTimeoutRef.current = window.setTimeout(() => {
      setIsMounted(false);
      setIsClosing(false);
      closeTimeoutRef.current = null;
      onAfterClose?.();
    }, OVERLAY_ANIMATION_MS);

    return () => {
      if (closeTimeoutRef.current !== null) {
        window.clearTimeout(closeTimeoutRef.current);
        closeTimeoutRef.current = null;
      }
    };
  }, [open, isMounted]);

  useEffect(() => {
    return () => {
      if (closeTimeoutRef.current !== null) {
        window.clearTimeout(closeTimeoutRef.current);
      }
    };
  }, []);

  const handleBackdropClick = () => {
    if (isClosing) return;
    onRequestClose();
  };

  const handleCloseClick = () => {
    if (isClosing) return;
    onRequestClose();
  };

  if (!isMounted) return null;

  return (
    <>
      <button
        type="button"
        aria-hidden="true"
        onClick={handleBackdropClick}
        className={`sliding-panel-overlay__backdrop${isClosing ? " sliding-panel-overlay__backdrop--closing" : ""}`}
        tabIndex={-1}
      />
      <aside
        role="dialog"
        aria-modal="true"
        aria-labelledby={resolvedTitleId}
        aria-describedby={resolvedDescriptionId}
        className={`sliding-panel-overlay${isClosing ? " sliding-panel-overlay--closing" : ""} ${className}`}
        style={{ width }}
      >
        <header className="sliding-panel-overlay__header">
          <h2 id={resolvedTitleId} className="sliding-panel-overlay__title">
            {title}
          </h2>
          <button type="button" className="sliding-panel-overlay__close" onClick={handleCloseClick} aria-label="Close detail panel">
            Close
          </button>
        </header>
        {description ? (
          <p className="sliding-panel-overlay__description" id={resolvedDescriptionId}>
            {description}
          </p>
        ) : (
          <div id={resolvedDescriptionId} />
        )}
        <div className="sliding-panel-overlay__content">
          <div className={`sliding-panel-overlay__body ${bodyClassName}`}>{children}</div>
          {actions ? <div className="sliding-panel-overlay__actions">{actions}</div> : null}
        </div>
      </aside>
      <style>{`
        .sliding-panel-overlay__backdrop {
          position: fixed;
          inset: 0;
          background: rgba(15, 23, 42, 0.45);
          opacity: 1;
          transition: opacity 220ms ease;
          z-index: 280;
          border: none;
          margin: 0;
          padding: 0;
          backdrop-filter: blur(2px);
          cursor: pointer;
        }
        .sliding-panel-overlay__backdrop--closing {
          opacity: 0;
          pointer-events: none;
        }
        .sliding-panel-overlay {
          position: fixed;
          top: 0;
          right: 0;
          height: 100vh;
          bottom: 0;
          background: rgba(246, 247, 249, 0.98);
          border-radius: 0;
          border: 1px solid rgba(59, 130, 246, 0.24);
          box-shadow: 0 32px 80px rgba(15, 23, 42, 0.32);
          padding: 24px;
          display: flex;
          flex-direction: column;
          gap: 20px;
          z-index: 300;
          transform: translateX(0);
          animation: slidingPanelOverlayEnter ${OVERLAY_ANIMATION_MS}ms cubic-bezier(0.22, 1, 0.36, 1);
        }
        .sliding-panel-overlay--closing {
          animation: slidingPanelOverlayExit ${OVERLAY_ANIMATION_MS}ms cubic-bezier(0.65, 0, 0.35, 1) forwards;
        }
        .sliding-panel-overlay__header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
        }
        .sliding-panel-overlay__title {
          margin: 0;
          font-size: 18px;
          font-weight: 700;
          color: #052033;
          font-family: ${HEADING_FONT_STACK};
        }
        .sliding-panel-overlay__close {
          border: none;
          background: transparent;
          color: #0f172a;
          font-weight: 600;
          cursor: pointer;
        }
        .sliding-panel-overlay__description {
          margin: 0;
          font-size: 13px;
          color: rgba(15, 23, 42, 0.68);
        }
        .sliding-panel-overlay__content {
          display: flex;
          gap: 20px;
          flex: 1;
          align-items: stretch;
          min-height: 0;
        }
        .sliding-panel-overlay__body {
          display: flex;
          flex-direction: column;
          gap: 12px;
          flex: 1;
          min-height: 0;
          font-family: ${BODY_FONT_STACK};
          overflow-y: auto;
        }
        .sliding-panel-overlay__actions {
          flex: 0 0 220px;
          display: flex;
          flex-direction: column;
          gap: 12px;
          font-size: 12px;
          overflow-y: auto;
          max-height: calc(100vh - 120px);
          padding-right: 4px;
        }
        @keyframes slidingPanelOverlayEnter {
          0% {
            transform: translateX(120px);
            opacity: 0;
          }
          60% {
            transform: translateX(-8px);
            opacity: 1;
          }
          100% {
            transform: translateX(0);
            opacity: 1;
          }
        }
        @keyframes slidingPanelOverlayExit {
          0% {
            transform: translateX(0);
            opacity: 1;
          }
          40% {
            transform: translateX(18px);
          }
          100% {
            transform: translateX(132px);
            opacity: 0;
          }
        }
        @media (max-width: 960px) {
          .sliding-panel-overlay {
            width: 100vw;
          }
          .sliding-panel-overlay__content {
            flex-direction: column;
          }
          .sliding-panel-overlay__actions {
            min-width: auto;
            width: 100%;
          }
        }
      `}</style>
    </>
  );
}
