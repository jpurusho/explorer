export type ThemeName = "light" | "dark" | "dracula" | "nord" | "solarized";

export interface ThemeOption {
  id: ThemeName;
  label: string;
  isDark: boolean;
}

export const themes: ThemeOption[] = [
  { id: "light", label: "Light", isDark: false },
  { id: "dark", label: "Dark", isDark: true },
  { id: "dracula", label: "Dracula", isDark: true },
  { id: "nord", label: "Nord", isDark: true },
  { id: "solarized", label: "Solarized", isDark: true },
];

export function applyTheme(theme: ThemeName) {
  document.documentElement.setAttribute("data-theme", theme);
}

export function getSystemTheme(): "light" | "dark" {
  return window.matchMedia("(prefers-color-scheme: dark)").matches
    ? "dark"
    : "light";
}
