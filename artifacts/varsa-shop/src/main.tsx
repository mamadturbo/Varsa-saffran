import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import './index.css';

// Retire credentials left by older releases. Session identifiers are HttpOnly.
try { sessionStorage.removeItem('varsa_admin_token_v1'); } catch { /* storage disabled */ }

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>
);
