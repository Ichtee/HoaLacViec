import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { GoogleOAuthProvider } from '@react-oauth/google';
import './index.css';
import App from './App.jsx';
import { AuthProvider } from '@/hooks/useAuth.jsx';

const googleClientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;

const appElement = (
  <AuthProvider>
    <App />
  </AuthProvider>
);

createRoot(document.getElementById('root')).render(
  <StrictMode>
    {googleClientId ? (
      <GoogleOAuthProvider clientId={googleClientId}>
        {appElement}
      </GoogleOAuthProvider>
    ) : (
      appElement
    )}
  </StrictMode>,
);
