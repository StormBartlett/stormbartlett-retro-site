"use client";

import { createContext } from "react";

// Context for passing cursor update callback to deeply nested ExperienceEditor
export const CursorUpdateContext = createContext<{
  onCursorUpdate?: (data: { x: number; y: number; width: number; height: number; visible: boolean } | null) => void;
}>({});
