import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useAuth } from '../../contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Badge } from '../../components/ui/badge';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '../../components/ui/table';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from '../../components/ui/dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '../../components/ui/select';
import {
  Building2, Users, Plus, Loader2, Eye, Power, Crown, LogIn, ChevronRight
} from 'lucide-react';
import { toast } from 'sonner';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const PLAN_BADGE = {
  free_trial: 'bg-slate-100 text-slate-700 dark:bg-slate-700 dark:text-slate-300',
  starter: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400',
  professional: 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400',
  enterprise: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400',
};

export default function TenantsPage() {
  const { refreshUser } = useAuth();
  const [tenants, setTenants] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [showDetail, setShowDetail] = useState(null);
  const [detailData, setDetailData] = useState(null);
  const [creating, setCreating] = useState(false);
  const [changingPlan, setChangingPlan] = useState(null);

  const [form, setForm] = useState({
    company_name: '', domain: '', industry: '',
    admin_name: '', admin_email: '', admin_password: '',
    plan: 'free_trial'
  });

  useEffect(() => { fetchAll(); }, []);

  const fetchAll = async () => {
    try {
      const [tenantsRes, statsRes] = await Promise.all([
        axios.get(`${API}/admin/tenants`, { withCredentials: true }),
        axios.get(`${API}/admin/stats`, { withCredentials: true })
      ]);
      setTenants(tenantsRes.data);
      setStats(statsRes.data);
    } catch (err) {
      console.error('Failed to fetch tenants:', err);
    }
    setLoading(false);
  };

  const handleCreate = async (e) => {
    e.preventDefault();
    setCreating(true);
    try {
      await axios.post(`${API}/admin/tenants`, form, { withCredentials: true });
      toast.success(`Tenant "${form.company_name}" created!`);
      setShowCreate(false);
      setForm({ company_name: '', domain: '', industry: '', admin_name: '', admin_email: '', admin_password: '', plan: 'free_trial' });
      fetchAll();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to create tenant');
    }
    setCreating(false);
  };

  const handleToggleStatus = async (orgId) => {
    try {
      const { data } = await axios.put(`${API}/admin/tenants/${orgId}/status`, {}, { withCredentials: true });
      toast.success(data.message);
      fetchAll();
    } catch (err) {
      toast.error('Failed to update status');
    }
  };

  const handleChangePlan = async (orgId, plan) => {
    setChangingPlan(orgId);
    try {
      await axios.put(`${API}/admin/tenants/${orgId}/plan`, { plan }, { withCredentials: true });
      toast.success(`Plan updated to ${plan}`);
      fetchAll();
      if (showDetail === orgId) viewDetail(orgId);
    } catch (err) {
      toast.error('Failed to update plan');
    }
    setChangingPlan(null);
  };

  const viewDetail = async (orgId) => {
    setShowDetail(orgId);
    try {
      const { data } = await axios.get(`${API}/admin/tenants/${orgId}`, { withCredentials: true });
      setDetailData(data);
    } catch (err) {
      toast.error('Failed to fetch details');
    }
  };

  const handleImpersonate = async (orgId) => {
    try {
      const { data } = await axios.post(`${API}/admin/impersonate/${orgId}`, {}, { withCredentials: true });
      toast.success(data.message);
      // Refresh user context then redirect
      if (refreshUser) await refreshUser();
      window.location.href = '/dashboard';
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to impersonate');
    }
  };

  return (
    <div className="animate-fade-in space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-[#0F172A] dark:text-white font-['Chivo']">Tenant Management</h1>
          <p className="text-slate-500 dark:text-slate-400 mt-1">Manage all organizations on the platform</p>
        </div>
        <Dialog open={showCreate} onOpenChange={setShowCreate}>
          <DialogTrigger asChild>
            <Button className="bg-[#002FA7] hover:bg-[#00227A]" data-testid="create-tenant-btn">
              <Plus className="h-4 w-4 mr-2" /> Create Company
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[520px] dark:bg-slate-800 dark:border-slate-700">
            <DialogHeader>
              <DialogTitle className="font-['Chivo'] dark:text-white">Create New Company</DialogTitle>
              <DialogDescription className="dark:text-slate-400">Set up a new organization with its admin account</DialogDescription>
            </DialogHeader>
            <form onSubmit={handleCreate}>
              <div className="grid gap-4 py-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label className="dark:text-slate-200">Company Name *</Label>
                    <Input value={form.company_name} onChange={(e) => setForm({ ...form, company_name: e.target.value })} required data-testid="input-company-name" className="dark:bg-slate-700 dark:border-slate-600" />
                  </div>
                  <div className="space-y-2">
                    <Label className="dark:text-slate-200">Domain</Label>
                    <Input value={form.domain} onChange={(e) => setForm({ ...form, domain: e.target.value })} placeholder="company.com" data-testid="input-domain" className="dark:bg-slate-700 dark:border-slate-600" />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label className="dark:text-slate-200">Industry</Label>
                    <Input value={form.industry} onChange={(e) => setForm({ ...form, industry: e.target.value })} data-testid="input-industry" className="dark:bg-slate-700 dark:border-slate-600" />
                  </div>
                  <div className="space-y-2">
                    <Label className="dark:text-slate-200">Plan</Label>
                    <Select value={form.plan} onValueChange={(v) => setForm({ ...form, plan: v })}>
                      <SelectTrigger data-testid="select-plan"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="free_trial">Free Trial</SelectItem>
                        <SelectItem value="starter">Starter ($49/mo)</SelectItem>
                        <SelectItem value="professional">Professional ($99/mo)</SelectItem>
                        <SelectItem value="enterprise">Enterprise ($199/mo)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="border-t border-slate-200 dark:border-slate-700 pt-4">
                  <p className="text-sm font-medium text-slate-600 dark:text-slate-400 mb-3">Admin Account</p>
                  <div className="grid gap-4">
                    <div className="space-y-2">
                      <Label className="dark:text-slate-200">Admin Name *</Label>
                      <Input value={form.admin_name} onChange={(e) => setForm({ ...form, admin_name: e.target.value })} required data-testid="input-admin-name" className="dark:bg-slate-700 dark:border-slate-600" />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label className="dark:text-slate-200">Admin Email *</Label>
                        <Input type="email" value={form.admin_email} onChange={(e) => setForm({ ...form, admin_email: e.target.value })} required data-testid="input-admin-email" className="dark:bg-slate-700 dark:border-slate-600" />
                      </div>
                      <div className="space-y-2">
                        <Label className="dark:text-slate-200">Password *</Label>
                        <Input type="password" value={form.admin_password} onChange={(e) => setForm({ ...form, admin_password: e.target.value })} required minLength={6} data-testid="input-admin-password" className="dark:bg-slate-700 dark:border-slate-600" />
                      </div>
                    </div>
                  </div>
                </div>
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setShowCreate(false)}>Cancel</Button>
                <Button type="submit" disabled={creating} className="bg-[#002FA7] hover:bg-[#00227A]" data-testid="submit-create-tenant">
                  {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Create Company'}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Platform Stats */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <StatCard title="Total Companies" value={stats.total_orgs} icon={Building2} testId="stat-orgs" />
          <StatCard title="Active Companies" value={stats.active_orgs} icon={Power} testId="stat-active" />
          <StatCard title="Total Users" value={stats.total_users} icon={Users} testId="stat-users" />
          <StatCard title="Total Employees" value={stats.total_employees} icon={Users} testId="stat-employees" />
        </div>
      )}

      {/* Plan Distribution */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {Object.entries(stats.plan_distribution).map(([plan, count]) => (
            <Card key={plan} className="border dark:border-slate-700 dark:bg-slate-800">
              <CardContent className="p-4 flex items-center justify-between">
                <div>
                  <p className="text-sm text-slate-500 dark:text-slate-400 capitalize">{plan.replace('_', ' ')}</p>
                  <p className="text-xl font-bold text-[#0F172A] dark:text-white">{count}</p>
                </div>
                <Badge className={PLAN_BADGE[plan]}>{plan === 'free_trial' ? '$0' : plan === 'starter' ? '$49' : plan === 'professional' ? '$99' : '$199'}</Badge>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Tenants Table */}
      <Card className="border border-slate-200 dark:border-slate-700 dark:bg-slate-800">
        <CardHeader className="border-b border-slate-200 dark:border-slate-700">
          <CardTitle className="text-lg font-['Chivo'] dark:text-white flex items-center gap-2">
            <Building2 className="h-5 w-5" /> All Companies ({tenants.length})
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <div className="p-8 text-center"><Loader2 className="h-8 w-8 animate-spin mx-auto text-[#002FA7]" /></div>
          ) : tenants.length === 0 ? (
            <div className="p-8 text-center text-slate-500 dark:text-slate-400">No companies yet</div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-slate-50 dark:bg-slate-700/50">
                    <TableHead className="font-semibold">Company</TableHead>
                    <TableHead className="font-semibold">Admin</TableHead>
                    <TableHead className="font-semibold">Plan</TableHead>
                    <TableHead className="font-semibold text-center">Employees</TableHead>
                    <TableHead className="font-semibold">Status</TableHead>
                    <TableHead className="font-semibold">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {tenants.map((t) => (
                    <TableRow key={t.id} data-testid={`tenant-row-${t.id}`}>
                      <TableCell>
                        <div>
                          <p className="font-medium dark:text-white">{t.name}</p>
                          <p className="text-xs text-slate-400">{t.domain || t.industry || '-'}</p>
                        </div>
                      </TableCell>
                      <TableCell className="dark:text-slate-300">{t.admin_email || <span className="text-slate-400">No admin</span>}</TableCell>
                      <TableCell>
                        <Select defaultValue={t.subscription_plan} onValueChange={(v) => handleChangePlan(t.id, v)} disabled={changingPlan === t.id}>
                          <SelectTrigger className="w-[140px] h-8 text-xs" data-testid={`plan-select-${t.id}`}>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="free_trial">Free Trial</SelectItem>
                            <SelectItem value="starter">Starter</SelectItem>
                            <SelectItem value="professional">Professional</SelectItem>
                            <SelectItem value="enterprise">Enterprise</SelectItem>
                          </SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell className="text-center dark:text-slate-200">{t.employee_count} / {t.user_count} users</TableCell>
                      <TableCell>
                        <Badge className={t.is_active !== false ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400' : 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400'}>
                          {t.is_active !== false ? 'Active' : 'Suspended'}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          <Button size="sm" variant="outline" onClick={() => viewDetail(t.id)} data-testid={`view-${t.id}`} className="h-8 px-2 dark:border-slate-600">
                            <Eye className="h-3.5 w-3.5" />
                          </Button>
                          <Button size="sm" variant="outline" onClick={() => handleToggleStatus(t.id)} data-testid={`toggle-${t.id}`}
                            className={`h-8 px-2 ${t.is_active !== false ? 'text-red-600 hover:bg-red-50' : 'text-green-600 hover:bg-green-50'} dark:border-slate-600`}>
                            <Power className="h-3.5 w-3.5" />
                          </Button>
                          {t.admin_email && (
                            <Button size="sm" variant="outline" onClick={() => handleImpersonate(t.id)} data-testid={`impersonate-${t.id}`}
                              className="h-8 px-2 text-[#002FA7] hover:bg-blue-50 dark:border-slate-600">
                              <LogIn className="h-3.5 w-3.5" />
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Detail Modal */}
      <Dialog open={!!showDetail} onOpenChange={() => { setShowDetail(null); setDetailData(null); }}>
        <DialogContent className="sm:max-w-[600px] dark:bg-slate-800 dark:border-slate-700">
          <DialogHeader>
            <DialogTitle className="font-['Chivo'] dark:text-white">
              {detailData?.organization?.name || 'Company Details'}
            </DialogTitle>
          </DialogHeader>
          {detailData ? (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <InfoItem label="Domain" value={detailData.organization.domain || '-'} />
                <InfoItem label="Industry" value={detailData.organization.industry || '-'} />
                <InfoItem label="Plan" value={detailData.plan_info.plan.replace('_', ' ')} />
                <InfoItem label="Max Employees" value={detailData.plan_info.max_employees === 999999 ? 'Unlimited' : detailData.plan_info.max_employees} />
                <InfoItem label="Current Employees" value={detailData.employee_count} />
                <InfoItem label="Payroll Records" value={detailData.payroll_count} />
                <InfoItem label="Leave Requests" value={detailData.leave_count} />
                <InfoItem label="Open Jobs" value={detailData.job_count} />
              </div>
              {detailData.users.length > 0 && (
                <div>
                  <p className="text-sm font-medium text-slate-600 dark:text-slate-400 mb-2">Users ({detailData.users.length})</p>
                  <div className="space-y-2 max-h-40 overflow-y-auto">
                    {detailData.users.map(u => (
                      <div key={u.id} className="flex items-center justify-between p-2 bg-slate-50 dark:bg-slate-700/50 rounded text-sm">
                        <div>
                          <span className="font-medium dark:text-white">{u.name}</span>
                          <span className="text-slate-500 dark:text-slate-400 ml-2">{u.email}</span>
                        </div>
                        <Badge variant="outline" className="capitalize text-xs dark:border-slate-600 dark:text-slate-300">{u.role}</Badge>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              <div>
                <p className="text-sm font-medium text-slate-600 dark:text-slate-400 mb-2">Enabled Features</p>
                <div className="flex flex-wrap gap-1">
                  {detailData.plan_info.features.map(f => (
                    <Badge key={f} variant="outline" className="text-xs capitalize dark:border-slate-600 dark:text-slate-300">{f}</Badge>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <div className="p-4 text-center"><Loader2 className="h-6 w-6 animate-spin mx-auto" /></div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function StatCard({ title, value, icon: Icon, testId }) {
  return (
    <Card className="border dark:border-slate-700 dark:bg-slate-800" data-testid={testId}>
      <CardContent className="p-4 sm:p-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-slate-500 dark:text-slate-400">{title}</p>
            <p className="text-2xl sm:text-3xl font-bold text-[#0F172A] dark:text-white font-['Chivo']">{value}</p>
          </div>
          <div className="p-3 bg-slate-100 dark:bg-slate-700 rounded-lg">
            <Icon className="h-6 w-6 text-slate-500 dark:text-slate-400" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function InfoItem({ label, value }) {
  return (
    <div>
      <p className="text-xs text-slate-500 dark:text-slate-400">{label}</p>
      <p className="font-medium text-[#0F172A] dark:text-white capitalize">{String(value)}</p>
    </div>
  );
}
