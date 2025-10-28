// src/logic/theme.js

/**
 * Applies the specified theme mode to the document and updates any visible theme switchers.
 * @param {'system' | 'light' | 'dark'} mode - The theme mode to apply.
 */
export function applyTheme(mode) {
  const htmlEl = document.documentElement;
  let effectiveTheme = mode;

  if (mode === 'system') {
    effectiveTheme = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }

  htmlEl.classList.remove('light', 'dark');

  if (effectiveTheme === 'dark') {
    htmlEl.classList.add('dark');
  } else {
    htmlEl.classList.add('light');
  }
  
  // --- FIX: Add a safety check to prevent the crash ---
  // Ensure the collection exists before trying to use it.
  if (window.HSThemeSwitch && window.HSThemeSwitch.collection) {
    window.HSThemeSwitch.collection.forEach(switcher => {
      switcher.element.el.checked = (effectiveTheme === 'dark');
    });
  }
  
  window.dispatchEvent(new CustomEvent('on-hs-appearance-change', { detail: effectiveTheme }));
  console.log(`[Theme] Applied theme: ${effectiveTheme} (from mode: ${mode})`);
}

/**
 * Initializes the theme based on localStorage and sets up a listener for OS-level changes.
 */
export function initializeTheme() {
  const storedTheme = localStorage.getItem('hs_theme') || 'system';
  applyTheme(storedTheme);

  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
    if (localStorage.getItem('hs_theme') === 'system') {
      applyTheme('system');
    }
  });
}