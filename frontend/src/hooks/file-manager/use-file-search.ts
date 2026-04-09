"use client";

import { useState } from "react";

export function useFileSearch() {
  const [isSearchVisible, setIsSearchVisible] = useState(false);
  const [searchOrigin, setSearchOrigin] = useState({ x: 0, y: 0 });

  const openSearchFromElement = (element: Element) => {
    const rect = element.getBoundingClientRect();
    setSearchOrigin({ x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 });
    setIsSearchVisible(true);
  };

  return {
    isSearchVisible,
    searchOrigin,
    openSearchFromElement,
    setIsSearchVisible,
  };
}
