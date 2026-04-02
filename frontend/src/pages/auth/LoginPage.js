import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../components/ui/card';
import { Building2, Loader2, Eye, EyeOff, Copy, Check } from 'lucide-react';
import { toast } from 'sonner';

// Test credentials for demo purposes
const TEST_CREDENTIALS = [
  { role: 'Super Admin', email: 'admin@talentops.com', password: 'admin123' },
  { role: 'HR Admin', email: 'hr@acmecorp.com', password: 'password123' },
];

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [copiedIndex, setCopiedIndex] = useState(null);
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    
    const result = await login(email, password);
    
    if (result.success) {
      toast.success('Login successful!');
      navigate('/dashboard');
    } else {
      toast.error(result.error);
    }
    
    setLoading(false);
  };

  const handleGoogleSignIn = () => {
    setGoogleLoading(true);
    // REMINDER: DO NOT HARDCODE THE URL, OR ADD ANY FALLBACKS OR REDIRECT URLS, THIS BREAKS THE AUTH
    const redirectUrl = window.location.origin + '/auth/callback';
    window.location.href = `https://auth.emergentagent.com/?redirect=${encodeURIComponent(redirectUrl)}`;
  };

  const handleQuickLogin = (cred) => {
    setEmail(cred.email);
    setPassword(cred.password);
    toast.success(`Credentials filled for ${cred.role}`);
  };

  const copyToClipboard = async (text, index) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedIndex(index);
      setTimeout(() => setCopiedIndex(null), 2000);
    } catch (err) {
      toast.error('Failed to copy');
    }
  };

  return (
    <div className="min-h-screen bg-[#F9FAFB] flex">
      {/* Left Panel - Form */}
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="w-full max-w-md animate-fade-in">
          <div className="flex items-center gap-3 mb-8">
            <div className="w-12 h-12 bg-[#002FA7] rounded-xl flex items-center justify-center">
              <Building2 className="h-7 w-7 text-white" />
            </div>
            <div>
              <h1 className="font-bold text-2xl text-[#0F172A] font-['Chivo']">TalentOps</h1>
              <p className="text-sm text-slate-500">HRMS Platform</p>
            </div>
          </div>

          <Card className="border border-slate-200 shadow-none">
            <CardHeader className="pb-4">
              <CardTitle className="text-2xl font-['Chivo']">Welcome back</CardTitle>
              <CardDescription>Enter your credentials to access your account</CardDescription>
            </CardHeader>
            <CardContent>
              {/* Google Sign In Button */}
              <Button
                type="button"
                variant="outline"
                className="w-full h-11 mb-4 border-slate-300 hover:bg-slate-50"
                onClick={handleGoogleSignIn}
                disabled={googleLoading}
                data-testid="google-signin-btn"
              >
                {googleLoading ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <svg className="mr-2 h-5 w-5" viewBox="0 0 24 24">
                    <path
                      fill="#4285F4"
                      d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                    />
                    <path
                      fill="#34A853"
                      d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                    />
                    <path
                      fill="#FBBC05"
                      d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                    />
                    <path
                      fill="#EA4335"
                      d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                    />
                  </svg>
                )}
                Continue with Google
              </Button>

              <div className="relative my-4">
                <div className="absolute inset-0 flex items-center">
                  <span className="w-full border-t border-slate-200" />
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                  <span className="bg-white px-2 text-slate-500">Or continue with email</span>
                </div>
              </div>

              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="you@company.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    data-testid="login-email"
                    className="h-11"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="password">Password</Label>
                  <div className="relative">
                    <Input
                      id="password"
                      type={showPassword ? "text" : "password"}
                      placeholder="Enter your password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                      data-testid="login-password"
                      className="h-11 pr-10"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>
                <Button
                  type="submit"
                  className="w-full h-11 bg-[#002FA7] hover:bg-[#00227A] text-white"
                  disabled={loading}
                  data-testid="login-submit"
                >
                  {loading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Signing in...
                    </>
                  ) : (
                    'Sign in'
                  )}
                </Button>
              </form>
              <div className="mt-6 text-center text-sm">
                <span className="text-slate-500">Don't have an account?</span>{' '}
                <Link to="/register" className="text-[#002FA7] hover:underline font-medium" data-testid="goto-register">
                  Sign up
                </Link>
              </div>
            </CardContent>
          </Card>

          {/* Test Credentials Card */}
          <Card className="mt-4 border border-slate-200 bg-slate-50">
            <CardHeader className="py-3 px-4">
              <CardTitle className="text-sm font-medium text-slate-700">Demo Accounts</CardTitle>
            </CardHeader>
            <CardContent className="px-4 pb-4 pt-0">
              <div className="space-y-2">
                {TEST_CREDENTIALS.map((cred, index) => (
                  <div 
                    key={index}
                    className="flex items-center justify-between p-2 bg-white rounded-md border border-slate-200 text-xs"
                  >
                    <div className="flex-1">
                      <span className="font-semibold text-[#002FA7]">{cred.role}</span>
                      <div className="text-slate-600 mt-0.5">
                        {cred.email} / {cred.password}
                      </div>
                    </div>
                    <div className="flex gap-1">
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-7 px-2 text-slate-500 hover:text-slate-700"
                        onClick={() => copyToClipboard(`${cred.email}`, index)}
                        data-testid={`copy-cred-${index}`}
                      >
                        {copiedIndex === index ? (
                          <Check className="h-3.5 w-3.5 text-green-600" />
                        ) : (
                          <Copy className="h-3.5 w-3.5" />
                        )}
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="h-7 px-2 text-xs"
                        onClick={() => handleQuickLogin(cred)}
                        data-testid={`quick-login-${index}`}
                      >
                        Use
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Right Panel - Image */}
      <div className="hidden lg:flex flex-1 items-center justify-center bg-[#002FA7] p-12">
        <div className="max-w-lg text-white text-center">
          <img
            src="https://images.unsplash.com/photo-1754531976828-69e42ce4e0d9?crop=entropy&cs=srgb&fm=jpg&ixid=M3w4NjY2NzN8MHwxfHNlYXJjaHw0fHxwcm9mZXNzaW9uYWwlMjBkaXZlcnNlJTIwb2ZmaWNlJTIwd29ya2VycyUyMHBvcnRyYWl0fGVufDB8fHx8MTc3NTEwMjU1OXww&ixlib=rb-4.1.0&q=85"
            alt="Team collaboration"
            className="rounded-2xl shadow-2xl mb-8 w-full object-cover max-h-80"
          />
          <h2 className="text-3xl font-bold font-['Chivo'] mb-4">
            Streamline Your HR Operations
          </h2>
          <p className="text-blue-100 text-lg">
            Manage employees, attendance, leaves, and payroll all in one place. Built for modern teams.
          </p>
        </div>
      </div>
    </div>
  );
}
