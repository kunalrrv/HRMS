import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { useAuth } from '../../contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Badge } from '../../components/ui/badge';
import {
  Users, Clock, Calendar, Briefcase, ArrowRight, TrendingUp, TrendingDown,
  Play, Square, AlertCircle, DollarSign, BarChart3
} from 'lucide-react';
import { toast } from 'sonner';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, LineChart, Line, Legend
} from 'recharts';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;
const CHART_COLORS = ['#002FA7', '#22C55E', '#F59E0B', '#EF4444', '#8B5CF6'];

export default function DashboardPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [stats, setStats] = useState(null);
  const [employeeStats, setEmployeeStats] = useState(null);
  const [attendanceStatus, setAttendanceStatus] = useState(null);
  const [analytics, setAnalytics] = useState(null);
  const [loading, setLoading] = useState(true);
  const [clockingIn, setClockingIn] = useState(false);

  const isAdmin = ['super_admin', 'admin', 'hr'].includes(user?.role);

  useEffect(() => { fetchData(); }, []);

  const fetchData = async () => {
    try {
      if (isAdmin) {
        const [statsRes, attendanceRes, analyticsRes] = await Promise.all([
          axios.get(`${API}/dashboard/stats`, { withCredentials: true }),
          axios.get(`${API}/attendance/today`, { withCredentials: true }),
          axios.get(`${API}/dashboard/analytics`, { withCredentials: true }).catch(() => ({ data: null }))
        ]);
        setStats(statsRes.data);
        setAttendanceStatus(attendanceRes.data);
        setAnalytics(analyticsRes.data);
      } else {
        const [empStatsRes, attendanceRes] = await Promise.all([
          axios.get(`${API}/dashboard/employee-stats`, { withCredentials: true }),
          axios.get(`${API}/attendance/today`, { withCredentials: true })
        ]);
        setEmployeeStats(empStatsRes.data);
        setAttendanceStatus(attendanceRes.data);
      }
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleClockAction = async (action) => {
    setClockingIn(true);
    try {
      await axios.post(`${API}/attendance`, { action }, { withCredentials: true });
      toast.success(action === 'clock_in' ? 'Clocked in successfully!' : 'Clocked out successfully!');
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to record attendance');
    }
    setClockingIn(false);
  };

  const formatTime = (isoString) => {
    if (!isoString) return '--:--';
    return new Date(isoString).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
  };

  if (!user?.org_id && user?.role !== 'super_admin') {
    return (
      <div className="animate-fade-in">
        <Card className="border border-slate-200 dark:border-slate-700 bg-amber-50 dark:bg-amber-900/20">
          <CardContent className="flex flex-col sm:flex-row items-start sm:items-center gap-4 p-6">
            <AlertCircle className="h-8 w-8 text-amber-600 flex-shrink-0" />
            <div className="flex-1">
              <h3 className="font-semibold text-amber-900 dark:text-amber-200">No Organization Found</h3>
              <p className="text-sm text-amber-700 dark:text-amber-400">Please set up your organization to continue.</p>
            </div>
            <Button onClick={() => navigate('/onboarding')} className="bg-amber-600 hover:bg-amber-700 w-full sm:w-auto" data-testid="setup-org-btn">
              Set Up Organization
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="animate-pulse space-y-6">
        <div className="h-8 w-48 bg-slate-200 dark:bg-slate-700 rounded" />
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => <div key={i} className="h-32 bg-slate-200 dark:bg-slate-700 rounded-lg" />)}
        </div>
      </div>
    );
  }

  return (
    <div className="animate-fade-in space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-[#0F172A] dark:text-white font-['Chivo']">
            Welcome back, {user?.name?.split(' ')[0]}!
          </h1>
          <p className="text-slate-500 dark:text-slate-400 mt-1">
            {new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
          </p>
        </div>
      </div>

      {/* Clock In/Out */}
      <Card className="border border-slate-200 dark:border-slate-700 bg-gradient-to-r from-[#002FA7] to-[#00227A] text-white">
        <CardContent className="p-6">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <h3 className="text-lg font-semibold mb-1">Attendance</h3>
              <div className="flex items-center gap-4 text-sm text-blue-100">
                <span>Clock In: {formatTime(attendanceStatus?.clock_in)}</span>
                <span>Clock Out: {formatTime(attendanceStatus?.clock_out)}</span>
                {attendanceStatus?.total_hours && <span>Total: {attendanceStatus.total_hours.toFixed(2)} hrs</span>}
              </div>
            </div>
            <div className="flex gap-3">
              {!attendanceStatus?.clocked_in ? (
                <Button onClick={() => handleClockAction('clock_in')} disabled={clockingIn} className="bg-white text-[#002FA7] hover:bg-blue-50" data-testid="clock-in-btn">
                  <Play className="h-4 w-4 mr-2" /> Clock In
                </Button>
              ) : !attendanceStatus?.clocked_out ? (
                <Button onClick={() => handleClockAction('clock_out')} disabled={clockingIn} className="bg-white text-[#002FA7] hover:bg-blue-50" data-testid="clock-out-btn">
                  <Square className="h-4 w-4 mr-2" /> Clock Out
                </Button>
              ) : (
                <Badge className="bg-green-500 text-white px-4 py-2">Completed for today</Badge>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Admin Dashboard */}
      {isAdmin && stats && (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard title="Total Employees" value={stats.total_employees} icon={Users}
              onClick={() => navigate('/employees')} testId="stat-employees" />
            <StatCard title="Present Today" value={stats.present_today} icon={Clock}
              trend={stats.total_employees > 0 ? Math.round((stats.present_today / stats.total_employees) * 100) : 0}
              trendLabel="% attendance" onClick={() => navigate('/attendance')} testId="stat-present" />
            <StatCard title="Pending Leaves" value={stats.pending_leaves} icon={Calendar}
              alert={stats.pending_leaves > 0} onClick={() => navigate('/leaves')} testId="stat-leaves" />
            <StatCard title="Open Positions" value={stats.open_positions} icon={Briefcase}
              onClick={() => navigate('/recruitment')} testId="stat-positions" />
          </div>

          {/* Analytics Charts */}
          {analytics && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Attendance Trend */}
              <Card className="border border-slate-200 dark:border-slate-700 dark:bg-slate-800" data-testid="chart-attendance">
                <CardHeader className="pb-2">
                  <CardTitle className="text-base font-['Chivo'] dark:text-white flex items-center gap-2">
                    <Clock className="h-4 w-4" /> Attendance (Last 7 Days)
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={220}>
                    <BarChart data={analytics.attendance_trend}>
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--chart-grid, #e2e8f0)" />
                      <XAxis dataKey="day" tick={{ fontSize: 12 }} />
                      <YAxis tick={{ fontSize: 12 }} />
                      <Tooltip contentStyle={{ borderRadius: 8, fontSize: 13 }} />
                      <Bar dataKey="present" name="Present" fill="#002FA7" radius={[4, 4, 0, 0]} />
                      <Bar dataKey="absent" name="Absent" fill="#EF4444" radius={[4, 4, 0, 0]} opacity={0.6} />
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              {/* Leave Distribution */}
              <Card className="border border-slate-200 dark:border-slate-700 dark:bg-slate-800" data-testid="chart-leaves">
                <CardHeader className="pb-2">
                  <CardTitle className="text-base font-['Chivo'] dark:text-white flex items-center gap-2">
                    <Calendar className="h-4 w-4" /> Leave Distribution
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {analytics.leave_distribution.some(l => l.total > 0) ? (
                    <ResponsiveContainer width="100%" height={220}>
                      <PieChart>
                        <Pie
                          data={analytics.leave_distribution.filter(l => l.total > 0)}
                          dataKey="total"
                          nameKey="type"
                          cx="50%" cy="50%"
                          outerRadius={80}
                          innerRadius={40}
                          label={({ type, total }) => `${type}: ${total}`}
                        >
                          {analytics.leave_distribution.map((_, i) => (
                            <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip />
                      </PieChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="h-[220px] flex items-center justify-center text-slate-400 dark:text-slate-500">
                      <p>No leave data available</p>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Payroll Cost Trend */}
              <Card className="border border-slate-200 dark:border-slate-700 dark:bg-slate-800" data-testid="chart-payroll">
                <CardHeader className="pb-2">
                  <CardTitle className="text-base font-['Chivo'] dark:text-white flex items-center gap-2">
                    <DollarSign className="h-4 w-4" /> Payroll Cost (Last 6 Months)
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {analytics.payroll_trend.some(p => p.gross > 0) ? (
                    <ResponsiveContainer width="100%" height={220}>
                      <LineChart data={analytics.payroll_trend}>
                        <CartesianGrid strokeDasharray="3 3" stroke="var(--chart-grid, #e2e8f0)" />
                        <XAxis dataKey="month" tick={{ fontSize: 12 }} />
                        <YAxis tick={{ fontSize: 12 }} tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`} />
                        <Tooltip formatter={(v) => `$${v.toLocaleString()}`} contentStyle={{ borderRadius: 8, fontSize: 13 }} />
                        <Legend />
                        <Line type="monotone" dataKey="gross" name="Gross" stroke="#002FA7" strokeWidth={2} dot={{ r: 4 }} />
                        <Line type="monotone" dataKey="net" name="Net" stroke="#22C55E" strokeWidth={2} dot={{ r: 4 }} />
                      </LineChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="h-[220px] flex items-center justify-center text-slate-400 dark:text-slate-500">
                      <p>No payroll data available</p>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Recruitment Pipeline */}
              <Card className="border border-slate-200 dark:border-slate-700 dark:bg-slate-800" data-testid="chart-recruitment">
                <CardHeader className="pb-2">
                  <CardTitle className="text-base font-['Chivo'] dark:text-white flex items-center gap-2">
                    <Briefcase className="h-4 w-4" /> Recruitment Pipeline
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {analytics.recruitment_pipeline.some(r => r.count > 0) ? (
                    <ResponsiveContainer width="100%" height={220}>
                      <BarChart data={analytics.recruitment_pipeline} layout="vertical">
                        <CartesianGrid strokeDasharray="3 3" stroke="var(--chart-grid, #e2e8f0)" />
                        <XAxis type="number" tick={{ fontSize: 12 }} />
                        <YAxis dataKey="stage" type="category" tick={{ fontSize: 12 }} width={80} />
                        <Tooltip contentStyle={{ borderRadius: 8, fontSize: 13 }} />
                        <Bar dataKey="count" name="Candidates" radius={[0, 4, 4, 0]}>
                          {analytics.recruitment_pipeline.map((_, i) => (
                            <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="h-[220px] flex items-center justify-center text-slate-400 dark:text-slate-500">
                      <p>No recruitment data available</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          )}

          {/* Quick Actions */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <QuickActionCard title="Add Employee" description="Onboard a new team member"
              onClick={() => navigate('/employees/new')} testId="quick-add-employee" />
            <QuickActionCard title="Review Leaves" description={`${stats.pending_leaves} pending approvals`}
              onClick={() => navigate('/leaves')} alert={stats.pending_leaves > 0} testId="quick-review-leaves" />
            <QuickActionCard title="Post a Job" description="Create a new job opening"
              onClick={() => navigate('/recruitment')} testId="quick-post-job" />
          </div>
        </>
      )}

      {/* Employee Dashboard */}
      {!isAdmin && employeeStats && (
        <>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <StatCard title="Days Present" value={employeeStats.attendance_this_month || 0} icon={Clock}
              subtitle="This month" testId="stat-days-present" />
            <StatCard title="Leave Balance"
              value={(employeeStats.leave_balance?.casual_leave || 0) + (employeeStats.leave_balance?.sick_leave || 0) + (employeeStats.leave_balance?.privilege_leave || 0)}
              icon={Calendar} subtitle="Total days" onClick={() => navigate('/leaves')} testId="stat-leave-balance" />
            <StatCard title="Pending Leaves" value={employeeStats.pending_leaves || 0} icon={Calendar}
              alert={employeeStats.pending_leaves > 0} onClick={() => navigate('/leaves')} testId="stat-pending-leaves" />
          </div>
          {employeeStats.leave_balance && (
            <Card className="border border-slate-200 dark:border-slate-700 dark:bg-slate-800">
              <CardHeader><CardTitle className="text-lg font-['Chivo'] dark:text-white">Leave Balance</CardTitle></CardHeader>
              <CardContent>
                <div className="grid grid-cols-3 gap-4">
                  <div className="text-center p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                    <p className="text-2xl font-bold text-[#002FA7] dark:text-blue-400">{employeeStats.leave_balance.casual_leave}</p>
                    <p className="text-sm text-slate-600 dark:text-slate-400">Casual Leave</p>
                  </div>
                  <div className="text-center p-4 bg-green-50 dark:bg-green-900/20 rounded-lg">
                    <p className="text-2xl font-bold text-green-600 dark:text-green-400">{employeeStats.leave_balance.sick_leave}</p>
                    <p className="text-sm text-slate-600 dark:text-slate-400">Sick Leave</p>
                  </div>
                  <div className="text-center p-4 bg-amber-50 dark:bg-amber-900/20 rounded-lg">
                    <p className="text-2xl font-bold text-amber-600 dark:text-amber-400">{employeeStats.leave_balance.privilege_leave}</p>
                    <p className="text-sm text-slate-600 dark:text-slate-400">Privilege Leave</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <QuickActionCard title="Apply for Leave" description="Request time off"
              onClick={() => navigate('/leaves')} testId="quick-apply-leave" />
            <QuickActionCard title="View Pay Stubs" description="Check your salary details"
              onClick={() => navigate('/payroll')} testId="quick-view-payslips" />
          </div>
        </>
      )}
    </div>
  );
}

function StatCard({ title, value, icon: Icon, trend, trendLabel, subtitle, alert, onClick, testId }) {
  return (
    <Card
      className={`border border-slate-200 dark:border-slate-700 dark:bg-slate-800 cursor-pointer card-hover ${alert ? 'border-amber-300 bg-amber-50 dark:border-amber-600 dark:bg-amber-900/20' : ''}`}
      onClick={onClick} data-testid={testId}
    >
      <CardContent className="p-6">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-sm text-slate-500 dark:text-slate-400 mb-1">{title}</p>
            <p className="text-3xl font-bold text-[#0F172A] dark:text-white font-['Chivo']">{value}</p>
            {subtitle && <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">{subtitle}</p>}
            {trend !== null && trend !== undefined && (
              <div className="flex items-center gap-1 mt-2">
                {trend >= 50 ? <TrendingUp className="h-4 w-4 text-green-600" /> : <TrendingDown className="h-4 w-4 text-amber-600" />}
                <span className={`text-sm ${trend >= 50 ? 'text-green-600' : 'text-amber-600'}`}>{trend}{trendLabel}</span>
              </div>
            )}
          </div>
          <div className={`p-3 rounded-lg ${alert ? 'bg-amber-200 dark:bg-amber-800' : 'bg-slate-100 dark:bg-slate-700'}`}>
            <Icon className={`h-6 w-6 ${alert ? 'text-amber-700 dark:text-amber-300' : 'text-slate-600 dark:text-slate-400'}`} />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function QuickActionCard({ title, description, onClick, alert, testId }) {
  return (
    <Card
      className={`border border-slate-200 dark:border-slate-700 dark:bg-slate-800 cursor-pointer card-hover ${alert ? 'border-amber-300 dark:border-amber-600' : ''}`}
      onClick={onClick} data-testid={testId}
    >
      <CardContent className="p-6 flex items-center justify-between">
        <div>
          <h3 className="font-semibold text-[#0F172A] dark:text-white">{title}</h3>
          <p className="text-sm text-slate-500 dark:text-slate-400">{description}</p>
        </div>
        <ArrowRight className="h-5 w-5 text-slate-400 dark:text-slate-500" />
      </CardContent>
    </Card>
  );
}
