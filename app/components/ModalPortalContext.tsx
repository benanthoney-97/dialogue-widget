"use client";

import React from "react";

export const ModalPortalContext = React.createContext<HTMLElement | null>(null);

export function useModalPortal() {
  return React.useContext(ModalPortalContext);
}

export default ModalPortalContext;
