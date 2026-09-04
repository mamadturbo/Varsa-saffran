import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { setAuthTokenGetter } from '@workspace/api-client-react';
import App from './App.tsx';
import './index.css';

setAuthTokenGetter(() => sessionStorage.getItem('varsa_admin_token_v1'));

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>
);
