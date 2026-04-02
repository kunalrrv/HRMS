import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { useAuth } from '../contexts/AuthContext';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Building2, Loader2, ArrowRight, CheckCircle } from 'lucide-react';
import { toast } from 'sonner';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

export default function OnboardingPage() {
  const { user, refreshUser } = useAuth();
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [orgData, setOrgData] = useState({
    name: '',
    domain: '',
    industry: ''
  });

  useEffect(() => {
    if (user?.org_id) {
      navigate('/dashboard');
    }
  }, [user, navigate]);

  const industries = [
    'Technology',
    'Healthcare',
    'Finance',
    'Education',
    'Manufacturing',
    'Retail',
    'Consulting',
    'Other'
  ];

  const handleCreateOrg = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      await axios.post(`${API}/organizations`, orgData, { withCredentials: true });
      await refreshUser();
      setStep(2);
      toast.success('Organization created successfully!');
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to create organization');
    }

    setLoading(false);
  };

  const handleComplete = () => {
    navigate('/dashboard');
  };

  return (
    <div className="min-h-screen bg-[#F9FAFB] flex items-center justify-center p-8">
      <div className="w-full max-w-lg animate-fade-in">
        {/* Header */}
        <div className="flex items-center gap-3 mb-8 justify-center">
          <div className="w-12 h-12 bg-[#002FA7] rounded-xl flex items-center justify-center">
            <Building2 className="h-7 w-7 text-white" />
          </div>
          <div>
            <h1 className="font-bold text-2xl text-[#0F172A] font-['Chivo']">TalentOps</h1>
            <p className="text-sm text-slate-500">HRMS Platform</p>
          </div>
        </div>

        {/* Progress */}
        <div className="flex items-center justify-center gap-2 mb-8">
          <div className={`w-3 h-3 rounded-full ${step >= 1 ? 'bg-[#002FA7]' : 'bg-slate-200'}`} />
          <div className={`w-16 h-1 ${step >= 2 ? 'bg-[#002FA7]' : 'bg-slate-200'}`} />
          <div className={`w-3 h-3 rounded-full ${step >= 2 ? 'bg-[#002FA7]' : 'bg-slate-200'}`} />
        </div>

        {step === 1 && (
          <Card className="border border-slate-200 shadow-none">
            <CardHeader className="text-center pb-4">
              <CardTitle className="text-2xl font-['Chivo']">Set up your organization</CardTitle>
              <CardDescription>Tell us about your company to get started</CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleCreateOrg} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="orgName">Organization Name *</Label>
                  <Input
                    id="orgName"
                    type="text"
                    placeholder="Acme Corp"
                    value={orgData.name}
                    onChange={(e) => setOrgData({ ...orgData, name: e.target.value })}
                    required
                    data-testid="org-name"
                    className="h-11"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="domain">Company Domain</Label>
                  <Input
                    id="domain"
                    type="text"
                    placeholder="acme.com"
                    value={orgData.domain}
                    onChange={(e) => setOrgData({ ...orgData, domain: e.target.value })}
                    data-testid="org-domain"
                    className="h-11"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="industry">Industry</Label>
                  <Select
                    value={orgData.industry}
                    onValueChange={(value) => setOrgData({ ...orgData, industry: value })}
                  >
                    <SelectTrigger className="h-11" data-testid="org-industry">
                      <SelectValue placeholder="Select industry" />
                    </SelectTrigger>
                    <SelectContent>
                      {industries.map((ind) => (
                        <SelectItem key={ind} value={ind}>{ind}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <Button
                  type="submit"
                  className="w-full h-11 bg-[#002FA7] hover:bg-[#00227A] text-white mt-6"
                  disabled={loading || !orgData.name}
                  data-testid="create-org-submit"
                >
                  {loading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Creating...
                    </>
                  ) : (
                    <>
                      Continue
                      <ArrowRight className="ml-2 h-4 w-4" />
                    </>
                  )}
                </Button>
              </form>
            </CardContent>
          </Card>
        )}

        {step === 2 && (
          <Card className="border border-slate-200 shadow-none">
            <CardHeader className="text-center pb-4">
              <div className="mx-auto w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mb-4">
                <CheckCircle className="h-8 w-8 text-green-600" />
              </div>
              <CardTitle className="text-2xl font-['Chivo']">You're all set!</CardTitle>
              <CardDescription>Your organization has been created successfully</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="bg-slate-50 rounded-lg p-4 space-y-2">
                <p className="text-sm text-slate-600">
                  <strong>Organization:</strong> {orgData.name}
                </p>
                <p className="text-sm text-slate-600">
                  <strong>Trial Period:</strong> 14 days free
                </p>
                <p className="text-sm text-slate-600">
                  <strong>Plan:</strong> Free Trial (up to 10 employees)
                </p>
              </div>
              
              <div className="text-sm text-slate-600 space-y-2">
                <p className="font-medium">What's next?</p>
                <ul className="list-disc list-inside space-y-1 text-slate-500">
                  <li>Add your employees</li>
                  <li>Set up attendance tracking</li>
                  <li>Configure leave policies</li>
                  <li>Start processing payroll</li>
                </ul>
              </div>

              <Button
                onClick={handleComplete}
                className="w-full h-11 bg-[#002FA7] hover:bg-[#00227A] text-white"
                data-testid="go-to-dashboard"
              >
                Go to Dashboard
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
