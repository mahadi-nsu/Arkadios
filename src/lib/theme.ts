export type Theme = "light" | "dark";
export const THEME_STORAGE_KEY = "arkadios-theme-v1";

// Run before the first paint so a saved dark preference never flashes light.
export const themeBootstrap = `(() => {
  let saved = null;
  try { saved = localStorage.getItem("${THEME_STORAGE_KEY}"); } catch {}
  const theme = saved === "light" || saved === "dark" ? saved : window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  document.documentElement.dataset.theme = theme;
  document.documentElement.style.colorScheme = theme;
})();`;
