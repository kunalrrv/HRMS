import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../components/ui/card';
import { Building2, Loader2, Eye, EyeOff } from 'lucide-react';
import { toast } from 'sonner';

export default function RegisterPage() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const { register } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (password !== confirmPassword) {
      toast.error('Passwords do not match');
      return;
    }
    
    if (password.length < 6) {
      toast.error('Password must be at least 6 characters');
      return;
    }
    
    setLoading(true);
    
    const result = await register(name, email, password);
    
    if (result.success) {
      toast.success('Account created successfully!');
      navigate('/onboarding');
    } else {
      toast.error(result.error);
    }
    
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-[#F9FAFB] flex">
      {/* Left Panel - Image */}
      <div className="hidden lg:flex flex-1 items-center justify-center bg-[#002FA7] p-12">
        <div className="max-w-lg text-white text-center">
          <img
            src="https://images.unsplash.com/photo-1573496130141-209d200cebd8?crop=entropy&cs=srgb&fm=jpg&ixid=M3w4NjY2NzN8MHwxfHNlYXJjaHwyfHxwcm9mZXNzaW9uYWwlMjBkaXZlcnNlJTIwb2ZmaWNlJTIwd29ya2VycyUyMHBvcnRyYWl0fGVufDB8fHx8MTc3NTEwMjU1OXww&ixlib=rb-4.1.0&q=85"
            alt="Professional team"
            className="rounded-2xl shadow-2xl mb-8 w-full object-cover max-h-80"
          />
          <h2 className="text-3xl font-bold font-['Chivo'] mb-4">
            Start Your Free Trial
          </h2>
          <p className="text-blue-100 text-lg">
            14 days free. No credit card required. Get started with up to 10 employees.
          </p>
        </div>
      </div>

      {/* Right Panel - Form */}
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
              <CardTitle className="text-2xl font-['Chivo']">Create your account</CardTitle>
              <CardDescription>Get started with your 14-day free trial</CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Full Name</Label>
                  <Input
                    id="name"
                    type="text"
                    placeholder="John Doe"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    required
                    data-testid="register-name"
                    className="h-11"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email">Work Email</Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="you@company.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    data-testid="register-email"
                    className="h-11"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="password">Password</Label>
                  <div className="relative">
                    <Input
                      id="password"
                      type={showPassword ? "text" : "password"}
                      placeholder="Create a password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                      data-testid="register-password"
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
                <div className="space-y-2">
                  <Label htmlFor="confirmPassword">Confirm Password</Label>
                  <Input
                    id="confirmPassword"
                    type="password"
                    placeholder="Confirm your password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    required
                    data-testid="register-confirm-password"
                    className="h-11"
                  />
                </div>
                <Button
                  type="submit"
                  className="w-full h-11 bg-[#002FA7] hover:bg-[#00227A] text-white"
                  disabled={loading}
                  data-testid="register-submit"
                >
                  {loading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Creating account...
                    </>
                  ) : (
                    'Create account'
                  )}
                </Button>
              </form>
              <div className="mt-6 text-center text-sm">
                <span className="text-slate-500">Already have an account?</span>{' '}
                <Link to="/login" className="text-[#002FA7] hover:underline font-medium" data-testid="goto-login">
                  Sign in
                </Link>
              </div>
            </CardContent>
          </Card>

          <p className="mt-6 text-center text-xs text-slate-400">
            By signing up, you agree to our Terms of Service and Privacy Policy.
          </p>
        </div>
      </div>
    </div>
  );
}
