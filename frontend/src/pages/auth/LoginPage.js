import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../components/ui/card';
import { Building2, Loader2, Eye, EyeOff } from 'lucide-react';
import { toast } from 'sonner';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
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

          <p className="mt-6 text-center text-xs text-slate-400">
            Demo: admin@talentops.com / admin123
          </p>
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
