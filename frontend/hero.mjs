import { heroui } from "@heroui/react";

export default heroui({
  themes: {
    light: {
      colors: {
        primary: {
          DEFAULT: "#163bf2",
          foreground: "#ffffff",
        },
        focus: "#163bf2",
      },
    },
    dark: {
      colors: {
        primary: {
          DEFAULT: "#dfa621",
          foreground: "#000000",
        },
        focus: "#dfa621",
      },
    },
  },
});
