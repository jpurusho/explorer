export type ThemeName = "light" | "dark" | "material" | "github" | "monokai" | "atom";

export interface ThemeOption {
  id: ThemeName;
  label: string;
  isDark: boolean;
}

export const themes: ThemeOption[] = [
  { id: "light", label: "Light", isDark: false },
  { id: "dark", label: "Dark", isDark: true },
  { id: "material", label: "Material Dark", isDark: true },
  { id: "github", label: "GitHub Dark", isDark: true },
  { id: "monokai", label: "Monokai", isDark: true },
  { id: "atom", label: "Atom One Dark", isDark: true },
];

export function applyTheme(theme: ThemeName) {
  document.documentElement.setAttribute("data-theme", theme);
}

export function getSystemTheme(): "light" | "dark" {
  return window.matchMedia("(prefers-color-scheme: dark)").matches
    ? "dark"
    : "light";
}
