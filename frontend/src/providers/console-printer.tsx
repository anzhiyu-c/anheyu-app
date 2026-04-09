"use client";

import { useEffect } from "react";
import { printConsoleWelcome } from "@/utils/console-printer";

export function ConsolePrinter() {
  useEffect(() => {
    printConsoleWelcome();
  }, []);

  return null;
}
