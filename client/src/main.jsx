import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { GoogleOAuthProvider } from '@react-oauth/google';
import './index.css';
import App from './App.jsx';
import { AuthProvider } from '@/hooks/useAuth.jsx';
import { LocationProvider } from '@/context/LocationContext.jsx';

const googleClientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;

const appElement = (
  <AuthProvider>
    <LocationProvider>
      <App />
    </LocationProvider>
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
