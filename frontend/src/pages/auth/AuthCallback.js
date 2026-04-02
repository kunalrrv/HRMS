import React, { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

export default function AuthCallback() {
  const navigate = useNavigate();
  const hasProcessed = useRef(false);

  useEffect(() => {
    // Prevent double processing in StrictMode
    if (hasProcessed.current) return;
    hasProcessed.current = true;

    const processOAuthCallback = async () => {
      try {
        // Extract session_id from URL hash
        const hash = window.location.hash;
        const sessionIdMatch = hash.match(/session_id=([^&]+)/);
        
        if (!sessionIdMatch) {
          toast.error('No session ID found');
          navigate('/login');
          return;
        }

        const sessionId = sessionIdMatch[1];

        // Exchange session_id for user data via backend
        const response = await axios.post(
          `${API}/auth/google/callback`,
          { session_id: sessionId },
          { withCredentials: true }
        );

        if (response.data && response.data.id) {
          toast.success('Signed in with Google!');
          
          // Check if user needs to set up organization
          if (!response.data.org_id) {
            navigate('/onboarding', { state: { user: response.data } });
          } else {
            navigate('/dashboard', { state: { user: response.data } });
          }
        } else {
          throw new Error('Invalid response from server');
        }
      } catch (error) {
        console.error('OAuth callback error:', error);
        toast.error(error.response?.data?.detail || 'Authentication failed');
        navigate('/login');
      }
    };

    processOAuthCallback();
  }, [navigate]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#F9FAFB]">
      <div className="text-center">
        <Loader2 className="h-10 w-10 animate-spin text-[#002FA7] mx-auto" />
        <p className="mt-4 text-slate-600">Completing sign in...</p>
      </div>
    </div>
  );
}
