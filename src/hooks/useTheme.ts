import { useColorScheme } from "react-native";

import { darkTheme, lightTheme, type ThemeColors } from "@/constants/theme";

export function useTheme() {
  const scheme = useColorScheme();
  const isDark = scheme === "dark";
  return { isDark, colors: (isDark ? darkTheme : lightTheme) as ThemeColors };
}
