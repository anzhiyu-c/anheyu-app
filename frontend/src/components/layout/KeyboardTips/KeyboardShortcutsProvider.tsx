"use client";

import { useKeyboardShortcuts } from "@/hooks/use-keyboard-shortcuts";
import { KeyboardTips } from "./index";

export function KeyboardShortcutsProvider() {
  const { showShortcutsPanel, shortcuts } = useKeyboardShortcuts();

  return <KeyboardTips visible={showShortcutsPanel} shortcuts={shortcuts} />;
}
