import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useAuth } from '../../contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Badge } from '../../components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../../components/ui/tabs';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '../../components/ui/table';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '../../components/ui/select';
import { Avatar, AvatarFallback } from '../../components/ui/avatar';
import {
  User, Phone, MapPin, Shield, Save, Loader2, Clock, Calendar,
  DollarSign, Download, Edit2, X, Building2
} from 'lucide-react';
import { toast } from 'sonner';
import { jsPDF } from 'jspdf';
import 'jspdf-autotable';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const US_STATES = [
  { code: 'AL', name: 'Alabama' }, { code: 'AK', name: 'Alaska' }, { code: 'AZ', name: 'Arizona' },
  { code: 'AR', name: 'Arkansas' }, { code: 'CA', name: 'California' }, { code: 'CO', name: 'Colorado' },
  { code: 'CT', name: 'Connecticut' }, { code: 'DE', name: 'Delaware' }, { code: 'FL', name: 'Florida' },
  { code: 'GA', name: 'Georgia' }, { code: 'HI', name: 'Hawaii' }, { code: 'ID', name: 'Idaho' },
  { code: 'IL', name: 'Illinois' }, { code: 'IN', name: 'Indiana' }, { code: 'IA', name: 'Iowa' },
  { code: 'KS', name: 'Kansas' }, { code: 'KY', name: 'Kentucky' }, { code: 'LA', name: 'Louisiana' },
  { code: 'ME', name: 'Maine' }, { code: 'MD', name: 'Maryland' }, { code: 'MA', name: 'Massachusetts' },
  { code: 'MI', name: 'Michigan' }, { code: 'MN', name: 'Minnesota' }, { code: 'MS', name: 'Mississippi' },
  { code: 'MO', name: 'Missouri' }, { code: 'MT', name: 'Montana' }, { code: 'NE', name: 'Nebraska' },
  { code: 'NV', name: 'Nevada' }, { code: 'NH', name: 'New Hampshire' }, { code: 'NJ', name: 'New Jersey' },
  { code: 'NM', name: 'New Mexico' }, { code: 'NY', name: 'New York' }, { code: 'NC', name: 'North Carolina' },
  { code: 'ND', name: 'North Dakota' }, { code: 'OH', name: 'Ohio' }, { code: 'OK', name: 'Oklahoma' },
  { code: 'OR', name: 'Oregon' }, { code: 'PA', name: 'Pennsylvania' }, { code: 'RI', name: 'Rhode Island' },
  { code: 'SC', name: 'South Carolina' }, { code: 'SD', name: 'South Dakota' }, { code: 'TN', name: 'Tennessee' },
  { code: 'TX', name: 'Texas' }, { code: 'UT', name: 'Utah' }, { code: 'VT', name: 'Vermont' },
  { code: 'VA', name: 'Virginia' }, { code: 'WA', name: 'Washington' }, { code: 'WV', name: 'West Virginia' },
  { code: 'WI', name: 'Wisconsin' }, { code: 'WY', name: 'Wyoming' }, { code: 'DC', name: 'District of Columbia' },
];

export default function ProfilePage() {
  const { user } = useAuth();
  const [profile, setProfile] = useState(null);
  const [history, setHistory] = useState({ attendance: [], leaves: [], payrolls: [] });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({ phone: '', address: '', emergency_contact: '', state_code: '' });

  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

  useEffect(() => { fetchAll(); }, []);

  const fetchAll = async () => {
    try {
      const [profileRes, historyRes] = await Promise.all([
        axios.get(`${API}/profile`, { withCredentials: true }),
        axios.get(`${API}/profile/history`, { withCredentials: true })
      ]);
      setProfile(profileRes.data);
      setForm({
        phone: profileRes.data.phone || '',
        address: profileRes.data.address || '',
        emergency_contact: profileRes.data.emergency_contact || '',
        state_code: profileRes.data.state_code || 'CA'
      });
      setHistory(historyRes.data);
    } catch (err) {
      console.error('Failed to fetch profile:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await axios.put(`${API}/profile`, form, { withCredentials: true });
      toast.success('Profile updated!');
      setEditing(false);
      fetchAll();
    } catch (err) {
      toast.error('Failed to update profile');
    }
    setSaving(false);
  };

  const fmt = (v) => `$${(v || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  const downloadPaystub = (p) => {
    const doc = new jsPDF();
    doc.setFillColor(0, 47, 167);
    doc.rect(0, 0, 210, 40, 'F');
    doc.setTextColor(255); doc.setFontSize(24); doc.setFont('helvetica', 'bold');
    doc.text('TalentOps', 20, 25);
    doc.setFontSize(12); doc.setFont('helvetica', 'normal');
    doc.text('Pay Stub', 170, 25);
    doc.setTextColor(0); doc.setFontSize(11);
    doc.text(`Name: ${p.employee_name}`, 20, 55);
    doc.text(`Period: ${months[p.month - 1]} ${p.year}`, 20, 63);
    doc.text(`State: ${p.state_code || 'N/A'}`, 20, 71);

    doc.autoTable({
      startY: 80,
      head: [['Earnings', 'USD']],
      body: [['Base', fmt(p.basic)], ['Housing', fmt(p.hra)], ['Allowances', fmt(p.allowances)], ['Gross', fmt(p.gross_salary)]],
      theme: 'striped', headStyles: { fillColor: [0, 47, 167] }, margin: { left: 20, right: 20 }
    });
    doc.autoTable({
      startY: doc.lastAutoTable.finalY + 10,
      head: [['Deductions', 'USD']],
      body: [
        ['Federal Tax', fmt(p.federal_tax)], [`State Tax (${p.state_code})`, fmt(p.state_tax)],
        ['Social Security', fmt(p.social_security_employee)], ['Medicare', fmt(p.medicare_employee)],
        ['Total', fmt(p.total_deductions)]
      ],
      theme: 'striped', headStyles: { fillColor: [220, 38, 38] }, margin: { left: 20, right: 20 }
    });
    const ny = doc.lastAutoTable.finalY + 10;
    doc.setFillColor(240, 253, 244); doc.rect(20, ny, 170, 20, 'F');
    doc.setFontSize(16); doc.setFont('helvetica', 'bold'); doc.setTextColor(22, 163, 74);
    doc.text('Net Pay', 30, ny + 13); doc.text(fmt(p.net_salary), 140, ny + 13);
    doc.save(`PayStub_${months[p.month - 1]}_${p.year}.pdf`);
    toast.success('Pay stub downloaded!');
  };

  const getInitials = (n) => n ? n.split(' ').map(x => x[0]).join('').toUpperCase().slice(0, 2) : 'U';

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-[#002FA7]" />
      </div>
    );
  }

  return (
    <div className="animate-fade-in space-y-6">
      {/* Header Card */}
      <Card className="border border-slate-200 dark:border-slate-700 dark:bg-slate-800 overflow-hidden">
        <div className="bg-gradient-to-r from-[#002FA7] to-[#00227A] h-24 sm:h-32" />
        <CardContent className="relative px-4 sm:px-6 pb-6 -mt-12 sm:-mt-14">
          <div className="flex flex-col sm:flex-row sm:items-end gap-4">
            <Avatar className="h-20 w-20 sm:h-24 sm:w-24 border-4 border-white dark:border-slate-800 shadow-lg">
              <AvatarFallback className="bg-[#002FA7] text-white text-xl sm:text-2xl">{getInitials(user?.name)}</AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              <h1 className="text-xl sm:text-2xl font-bold text-[#0F172A] dark:text-white font-['Chivo'] truncate">{user?.name}</h1>
              <p className="text-slate-500 dark:text-slate-400 text-sm truncate">{profile?.designation} &middot; {profile?.department}</p>
              <div className="flex flex-wrap gap-2 mt-2">
                <Badge variant="outline" className="text-xs dark:border-slate-600 dark:text-slate-300">{profile?.employee_code}</Badge>
                <Badge className="bg-blue-100 text-[#002FA7] dark:bg-blue-900/30 dark:text-blue-400 text-xs">{profile?.state_code || 'N/A'}</Badge>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Tabs */}
      <Tabs defaultValue="profile" className="space-y-4">
        <TabsList className="w-full sm:w-auto grid grid-cols-4 sm:flex">
          <TabsTrigger value="profile" data-testid="tab-profile" className="text-xs sm:text-sm"><User className="h-4 w-4 mr-1 hidden sm:inline" /> Profile</TabsTrigger>
          <TabsTrigger value="attendance" data-testid="tab-attendance" className="text-xs sm:text-sm"><Clock className="h-4 w-4 mr-1 hidden sm:inline" /> Attendance</TabsTrigger>
          <TabsTrigger value="leaves" data-testid="tab-leaves" className="text-xs sm:text-sm"><Calendar className="h-4 w-4 mr-1 hidden sm:inline" /> Leaves</TabsTrigger>
          <TabsTrigger value="payroll" data-testid="tab-payroll" className="text-xs sm:text-sm"><DollarSign className="h-4 w-4 mr-1 hidden sm:inline" /> Payroll</TabsTrigger>
        </TabsList>

        {/* Profile Tab */}
        <TabsContent value="profile">
          <Card className="border border-slate-200 dark:border-slate-700 dark:bg-slate-800">
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-lg font-['Chivo'] dark:text-white">Personal Information</CardTitle>
              {!editing ? (
                <Button variant="outline" size="sm" onClick={() => setEditing(true)} data-testid="edit-profile-btn" className="dark:border-slate-600 dark:text-slate-200">
                  <Edit2 className="h-4 w-4 mr-1" /> Edit
                </Button>
              ) : (
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={() => { setEditing(false); setForm({ phone: profile?.phone || '', address: profile?.address || '', emergency_contact: profile?.emergency_contact || '', state_code: profile?.state_code || 'CA' }); }}>
                    <X className="h-4 w-4 mr-1" /> Cancel
                  </Button>
                  <Button size="sm" onClick={handleSave} disabled={saving} className="bg-[#002FA7] hover:bg-[#00227A]" data-testid="save-profile-btn">
                    {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Save className="h-4 w-4 mr-1" /> Save</>}
                  </Button>
                </div>
              )}
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <InfoField icon={Phone} label="Phone" editing={editing}
                  value={editing ? form.phone : (profile?.phone || 'Not provided')}
                  onChange={(v) => setForm({ ...form, phone: v })} testId="profile-phone" />
                <InfoField icon={MapPin} label="Address" editing={editing}
                  value={editing ? form.address : (profile?.address || 'Not provided')}
                  onChange={(v) => setForm({ ...form, address: v })} testId="profile-address" />
                <InfoField icon={Shield} label="Emergency Contact" editing={editing}
                  value={editing ? form.emergency_contact : (profile?.emergency_contact || 'Not provided')}
                  onChange={(v) => setForm({ ...form, emergency_contact: v })} testId="profile-emergency" />
                <div className="space-y-1">
                  <div className="flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400">
                    <Building2 className="h-4 w-4" /> State (Tax)
                  </div>
                  {editing ? (
                    <Select value={form.state_code} onValueChange={(v) => setForm({ ...form, state_code: v })}>
                      <SelectTrigger data-testid="profile-state"><SelectValue /></SelectTrigger>
                      <SelectContent className="max-h-60">
                        {US_STATES.map(s => <SelectItem key={s.code} value={s.code}>{s.name} ({s.code})</SelectItem>)}
                      </SelectContent>
                    </Select>
                  ) : (
                    <p className="font-medium text-[#0F172A] dark:text-white">{US_STATES.find(s => s.code === profile?.state_code)?.name || profile?.state_code || 'Not set'}</p>
                  )}
                </div>
              </div>

              {/* Read-only info */}
              <div className="mt-6 pt-6 border-t border-slate-200 dark:border-slate-700 grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <p className="text-xs text-slate-500 dark:text-slate-400">Email</p>
                  <p className="font-medium text-sm text-[#0F172A] dark:text-white truncate">{user?.email}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-500 dark:text-slate-400">Department</p>
                  <p className="font-medium text-sm text-[#0F172A] dark:text-white">{profile?.department}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-500 dark:text-slate-400">Date of Joining</p>
                  <p className="font-medium text-sm text-[#0F172A] dark:text-white">
                    {profile?.date_of_joining ? new Date(profile.date_of_joining).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }) : '-'}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Attendance Tab */}
        <TabsContent value="attendance">
          <Card className="border border-slate-200 dark:border-slate-700 dark:bg-slate-800">
            <CardHeader>
              <CardTitle className="text-lg font-['Chivo'] dark:text-white flex items-center gap-2">
                <Clock className="h-5 w-5" /> Attendance History
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {history.attendance.length === 0 ? (
                <div className="p-8 text-center text-slate-500 dark:text-slate-400">No attendance records</div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-slate-50 dark:bg-slate-700/50">
                        <TableHead>Date</TableHead>
                        <TableHead>Clock In</TableHead>
                        <TableHead>Clock Out</TableHead>
                        <TableHead className="text-right">Hours</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {history.attendance.map((a) => (
                        <TableRow key={a.id}>
                          <TableCell className="font-medium dark:text-slate-200">
                            {new Date(a.date + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
                          </TableCell>
                          <TableCell className="dark:text-slate-300">{a.clock_in ? new Date(a.clock_in).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }) : '-'}</TableCell>
                          <TableCell className="dark:text-slate-300">{a.clock_out ? new Date(a.clock_out).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }) : '-'}</TableCell>
                          <TableCell className="text-right dark:text-slate-200">{a.total_hours ? `${a.total_hours.toFixed(1)}h` : '-'}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Leaves Tab */}
        <TabsContent value="leaves">
          {history.leave_balance && (
            <div className="grid grid-cols-3 gap-3 sm:gap-4 mb-4">
              {[
                { label: 'Casual', value: history.leave_balance.casual_leave, color: 'blue' },
                { label: 'Sick', value: history.leave_balance.sick_leave, color: 'green' },
                { label: 'Privilege', value: history.leave_balance.privilege_leave, color: 'amber' },
              ].map((b) => (
                <Card key={b.label} className="border dark:border-slate-700 dark:bg-slate-800">
                  <CardContent className="p-3 sm:p-4 text-center">
                    <p className={`text-2xl sm:text-3xl font-bold text-${b.color}-600 dark:text-${b.color}-400`}>{b.value}</p>
                    <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400">{b.label}</p>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
          <Card className="border border-slate-200 dark:border-slate-700 dark:bg-slate-800">
            <CardHeader>
              <CardTitle className="text-lg font-['Chivo'] dark:text-white flex items-center gap-2">
                <Calendar className="h-5 w-5" /> Leave History
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {history.leaves.length === 0 ? (
                <div className="p-8 text-center text-slate-500 dark:text-slate-400">No leave records</div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-slate-50 dark:bg-slate-700/50">
                        <TableHead>Type</TableHead>
                        <TableHead>From</TableHead>
                        <TableHead>To</TableHead>
                        <TableHead>Reason</TableHead>
                        <TableHead>Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {history.leaves.map((l) => (
                        <TableRow key={l.id}>
                          <TableCell><Badge variant="outline" className="dark:border-slate-600 dark:text-slate-300">{l.leave_type}</Badge></TableCell>
                          <TableCell className="dark:text-slate-300">{l.start_date}</TableCell>
                          <TableCell className="dark:text-slate-300">{l.end_date}</TableCell>
                          <TableCell className="dark:text-slate-300 max-w-[200px] truncate">{l.reason}</TableCell>
                          <TableCell>
                            <Badge className={
                              l.status === 'approved' ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400' :
                              l.status === 'rejected' ? 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400' :
                              'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400'
                            }>{l.status}</Badge>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Payroll Tab */}
        <TabsContent value="payroll">
          <Card className="border border-slate-200 dark:border-slate-700 dark:bg-slate-800">
            <CardHeader>
              <CardTitle className="text-lg font-['Chivo'] dark:text-white flex items-center gap-2">
                <DollarSign className="h-5 w-5" /> Pay Stubs
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {history.payrolls.length === 0 ? (
                <div className="p-8 text-center text-slate-500 dark:text-slate-400">No pay stubs available</div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-slate-50 dark:bg-slate-700/50">
                        <TableHead>Period</TableHead>
                        <TableHead className="text-right">Gross</TableHead>
                        <TableHead className="text-right">Deductions</TableHead>
                        <TableHead className="text-right">Net Pay</TableHead>
                        <TableHead>Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {history.payrolls.map((p) => (
                        <TableRow key={p.id}>
                          <TableCell className="font-medium dark:text-slate-200">{months[p.month - 1]} {p.year}</TableCell>
                          <TableCell className="text-right dark:text-slate-300">{fmt(p.gross_salary)}</TableCell>
                          <TableCell className="text-right text-red-600 dark:text-red-400">{fmt(p.total_deductions)}</TableCell>
                          <TableCell className="text-right font-semibold text-green-600 dark:text-green-400">{fmt(p.net_salary)}</TableCell>
                          <TableCell>
                            <Button size="sm" variant="outline" onClick={() => downloadPaystub(p)} data-testid={`download-${p.id}`} className="dark:border-slate-600 dark:text-slate-200">
                              <Download className="h-4 w-4 mr-1" /> PDF
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function InfoField({ icon: Icon, label, value, editing, onChange, testId }) {
  return (
    <div className="space-y-1">
      <div className="flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400">
        <Icon className="h-4 w-4" /> {label}
      </div>
      {editing ? (
        <Input value={value} onChange={(e) => onChange(e.target.value)} data-testid={testId} className="dark:bg-slate-700 dark:border-slate-600 dark:text-white" />
      ) : (
        <p className="font-medium text-[#0F172A] dark:text-white">{value}</p>
      )}
    </div>
  );
}
