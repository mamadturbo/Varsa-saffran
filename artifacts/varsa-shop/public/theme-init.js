try {
  document.documentElement.classList.add(localStorage.getItem('varsa-theme-v2') === 'light' ? 'light' : 'dark');
} catch {
  document.documentElement.classList.add('dark');
}
