import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useAuth } from '../../contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Badge } from '../../components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../../components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../components/ui/select';
import { Building2, Users, Save, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

export default function SettingsPage() {
  const { user } = useAuth();
  const [organization, setOrganization] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [orgForm, setOrgForm] = useState({ name: '', domain: '', industry: '' });

  const industries = [
    'Technology', 'Healthcare', 'Finance', 'Education',
    'Manufacturing', 'Retail', 'Consulting', 'Other'
  ];

  useEffect(() => {
    fetchOrganization();
  }, []);

  const fetchOrganization = async () => {
    try {
      const { data } = await axios.get(`${API}/organizations/current`, { withCredentials: true });
      setOrganization(data);
      setOrgForm({ name: data.name, domain: data.domain || '', industry: data.industry || '' });
    } catch (error) {
      console.error('Failed to fetch organization:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveOrg = async () => {
    setSaving(true);
    try {
      await axios.put(`${API}/organizations/current`, orgForm, { withCredentials: true });
      toast.success('Organization settings saved!');
      fetchOrganization();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to save settings');
    }
    setSaving(false);
  };

  if (loading) {
    return (
      <div className="animate-pulse space-y-6">
        <div className="h-8 w-48 bg-slate-200 rounded" />
        <div className="h-64 bg-slate-200 rounded-lg" />
      </div>
    );
  }

  return (
    <div className="animate-fade-in space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-[#0F172A] font-['Chivo']">Settings</h1>
        <p className="text-slate-500 mt-1">Manage your organization settings</p>
      </div>

      <Tabs defaultValue="organization" className="space-y-4">
        <TabsList>
          <TabsTrigger value="organization" data-testid="tab-organization">Organization</TabsTrigger>
          <TabsTrigger value="team" data-testid="tab-team">Team</TabsTrigger>
        </TabsList>

        {/* Organization Tab */}
        <TabsContent value="organization">
          <Card className="border border-slate-200">
            <CardHeader>
              <CardTitle className="text-lg font-['Chivo'] flex items-center gap-2">
                <Building2 className="h-5 w-5" />
                Organization Details
              </CardTitle>
              <CardDescription>
                Update your organization information
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <Label htmlFor="orgName">Organization Name</Label>
                  <Input
                    id="orgName"
                    value={orgForm.name}
                    onChange={(e) => setOrgForm({ ...orgForm, name: e.target.value })}
                    data-testid="org-name-input"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="domain">Domain</Label>
                  <Input
                    id="domain"
                    value={orgForm.domain}
                    onChange={(e) => setOrgForm({ ...orgForm, domain: e.target.value })}
                    placeholder="yourcompany.com"
                    data-testid="org-domain-input"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="industry">Industry</Label>
                  <Select
                    value={orgForm.industry}
                    onValueChange={(value) => setOrgForm({ ...orgForm, industry: value })}
                  >
                    <SelectTrigger data-testid="org-industry-select">
                      <SelectValue placeholder="Select industry" />
                    </SelectTrigger>
                    <SelectContent>
                      {industries.map((ind) => (
                        <SelectItem key={ind} value={ind}>{ind}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Subscription Plan</Label>
                  <div className="flex items-center gap-2">
                    <Badge className="bg-[#002FA7] text-white">
                      {organization?.subscription_plan?.replace('_', ' ').toUpperCase()}
                    </Badge>
                    {organization?.trial_ends_at && (
                      <span className="text-sm text-slate-500">
                        Trial ends: {new Date(organization.trial_ends_at).toLocaleDateString()}
                      </span>
                    )}
                  </div>
                </div>
              </div>

              <div className="pt-4 border-t">
                <Button
                  onClick={handleSaveOrg}
                  disabled={saving}
                  className="bg-[#002FA7] hover:bg-[#00227A]"
                  data-testid="save-org-settings"
                >
                  {saving ? (
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  ) : (
                    <Save className="h-4 w-4 mr-2" />
                  )}
                  Save Changes
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Team Tab */}
        <TabsContent value="team">
          <Card className="border border-slate-200">
            <CardHeader>
              <CardTitle className="text-lg font-['Chivo'] flex items-center gap-2">
                <Users className="h-5 w-5" />
                Team Roles
              </CardTitle>
              <CardDescription>
                Understanding role permissions
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="p-4 bg-slate-50 rounded-lg">
                  <div className="flex items-center gap-2 mb-2">
                    <Badge className="bg-purple-100 text-purple-800">Super Admin</Badge>
                  </div>
                  <p className="text-sm text-slate-600">
                    Full access to all features including multi-tenant management. Platform-level administrator.
                  </p>
                </div>
                <div className="p-4 bg-slate-50 rounded-lg">
                  <div className="flex items-center gap-2 mb-2">
                    <Badge className="bg-blue-100 text-blue-800">Admin</Badge>
                  </div>
                  <p className="text-sm text-slate-600">
                    Full access to organization features. Can manage employees, payroll, recruitment, and settings.
                  </p>
                </div>
                <div className="p-4 bg-slate-50 rounded-lg">
                  <div className="flex items-center gap-2 mb-2">
                    <Badge className="bg-green-100 text-green-800">HR</Badge>
                  </div>
                  <p className="text-sm text-slate-600">
                    Can manage employees, attendance, leaves, payroll, and recruitment. Cannot access billing settings.
                  </p>
                </div>
                <div className="p-4 bg-slate-50 rounded-lg">
                  <div className="flex items-center gap-2 mb-2">
                    <Badge className="bg-slate-100 text-slate-800">Employee</Badge>
                  </div>
                  <p className="text-sm text-slate-600">
                    Can view own profile, clock in/out, apply for leaves, and view own payslips.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
