import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { handleOAuthCallback } from '../api/googleClassroom';

/**
 * Dedicated Google OAuth callback page.
 * Lives at /gc-callback — outside RoleGuard so token can be saved freely.
 * Reads the return path from sessionStorage (set by initiateGoogleAuth).
 */
export default function GoogleCallback() {
  const navigate = useNavigate();
  const [status, setStatus] = useState('Connecting to Google…');

  useEffect(() => {
    const returnPath = sessionStorage.getItem('gc_return_path') || '/homework';
    sessionStorage.removeItem('gc_return_path');

    try {
      const token = handleOAuthCallback();
      if (token) {
        setStatus('Connected! Redirecting…');
        setTimeout(() => navigate(returnPath, { replace: true }), 500);
      } else {
        setStatus('No token found. Redirecting…');
        setTimeout(() => navigate(returnPath, { replace: true }), 1000);
      }
    } catch (err) {
      setStatus(`Error: ${err.message}`);
      setTimeout(() => navigate(returnPath, { replace: true }), 2000);
    }
  }, [navigate]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-[var(--color-bg)]">
      <div className="text-center">
        <div className="w-12 h-12 border-2 border-[var(--color-primary)] border-t-transparent rounded-full animate-spin mx-auto mb-4" />
        <p className="text-[var(--color-text)] font-medium">{status}</p>
        <p className="text-[var(--color-text-secondary)] text-sm mt-1">Please wait…</p>
      </div>
    </div>
  );
}