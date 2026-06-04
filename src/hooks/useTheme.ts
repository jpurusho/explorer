import { useEffect } from "react";
import { useSettingsStore } from "../stores/settingsStore";
import { getSystemTheme, applyTheme } from "../lib/themes";

export function useTheme() {
  const settings = useSettingsStore((s) => s.settings);
  const setTheme = useSettingsStore((s) => s.setTheme);
  const resolvedTheme = useSettingsStore((s) => s.resolvedTheme);

  useEffect(() => {
    if (settings.theme !== "system") return;

    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
    const handler = () => {
      const systemTheme = getSystemTheme();
      applyTheme(systemTheme);
    };
    mediaQuery.addEventListener("change", handler);
    return () => mediaQuery.removeEventListener("change", handler);
  }, [settings.theme]);

  return { theme: settings.theme, resolvedTheme, setTheme };
}
