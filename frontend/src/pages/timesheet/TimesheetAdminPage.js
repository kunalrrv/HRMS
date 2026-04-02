import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useAuth } from '../../contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Badge } from '../../components/ui/badge';
import { Textarea } from '../../components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../../components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../../components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '../../components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../../components/ui/tabs';
import { 
  CheckCircle, 
  XCircle, 
  Clock, 
  Loader2,
  Eye,
  Download,
  FileText,
  Calendar,
  Users,
  Filter
} from 'lucide-react';
import { toast } from 'sonner';
import { jsPDF } from 'jspdf';
import 'jspdf-autotable';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const DAYS = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
const DAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

export default function TimesheetAdminPage() {
  const { user } = useAuth();
  const [timesheets, setTimesheets] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('submitted');
  const [employeeFilter, setEmployeeFilter] = useState('all');
  const [selectedTimesheet, setSelectedTimesheet] = useState(null);
  const [showDetailDialog, setShowDetailDialog] = useState(false);
  const [feedback, setFeedback] = useState('');
  const [processing, setProcessing] = useState(false);

  // Report state
  const [reportStartDate, setReportStartDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 30);
    return d.toISOString().split('T')[0];
  });
  const [reportEndDate, setReportEndDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [reportData, setReportData] = useState(null);

  useEffect(() => {
    fetchData();
  }, [statusFilter, employeeFilter]);

  const fetchData = async () => {
    setLoading(true);
    try {
      let url = `${API}/timesheets?status=${statusFilter}`;
      if (employeeFilter !== 'all') {
        url += `&employee_id=${employeeFilter}`;
      }
      
      const [timesheetsRes, employeesRes, projectsRes] = await Promise.all([
        axios.get(url, { withCredentials: true }),
        axios.get(`${API}/employees`, { withCredentials: true }),
        axios.get(`${API}/projects?active_only=false`, { withCredentials: true })
      ]);
      
      setTimesheets(timesheetsRes.data);
      setEmployees(employeesRes.data);
      setProjects(projectsRes.data);
    } catch (error) {
      console.error('Failed to fetch data:', error);
      toast.error('Failed to load timesheet data');
    } finally {
      setLoading(false);
    }
  };

  const fetchReportData = async () => {
    try {
      // Fetch all timesheets for reporting (approved ones)
      const { data } = await axios.get(`${API}/timesheets?status=approved`, { withCredentials: true });
      
      // Filter by date range
      const filtered = data.filter(t => {
        const weekStart = new Date(t.week_start_date);
        return weekStart >= new Date(reportStartDate) && weekStart <= new Date(reportEndDate);
      });

      // Aggregate by employee
      const byEmployee = {};
      filtered.forEach(t => {
        if (!byEmployee[t.employee_id]) {
          byEmployee[t.employee_id] = {
            employee_id: t.employee_id,
            total_hours: 0,
            projects: {}
          };
        }
        byEmployee[t.employee_id].total_hours += t.total_hours;
        if (!byEmployee[t.employee_id].projects[t.project_name]) {
          byEmployee[t.employee_id].projects[t.project_name] = 0;
        }
        byEmployee[t.employee_id].projects[t.project_name] += t.total_hours;
      });

      // Aggregate by project
      const byProject = {};
      filtered.forEach(t => {
        if (!byProject[t.project_name]) {
          byProject[t.project_name] = { total_hours: 0, entries: 0 };
        }
        byProject[t.project_name].total_hours += t.total_hours;
        byProject[t.project_name].entries += 1;
      });

      setReportData({
        totalEntries: filtered.length,
        totalHours: filtered.reduce((sum, t) => sum + t.total_hours, 0),
        byEmployee: Object.values(byEmployee),
        byProject: byProject,
        raw: filtered
      });

      toast.success('Report generated');
    } catch (error) {
      toast.error('Failed to generate report');
    }
  };

  const handleApprove = async (timesheetId) => {
    setProcessing(true);
    try {
      await axios.put(`${API}/timesheets/${timesheetId}/status`, {
        status: 'approved',
        feedback: feedback || 'Approved'
      }, { withCredentials: true });
      
      toast.success('Timesheet approved');
      setShowDetailDialog(false);
      setFeedback('');
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to approve timesheet');
    }
    setProcessing(false);
  };

  const handleReject = async (timesheetId) => {
    if (!feedback.trim()) {
      toast.error('Please provide feedback for rejection');
      return;
    }
    
    setProcessing(true);
    try {
      await axios.put(`${API}/timesheets/${timesheetId}/status`, {
        status: 'rejected',
        feedback: feedback
      }, { withCredentials: true });
      
      toast.success('Timesheet rejected');
      setShowDetailDialog(false);
      setFeedback('');
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to reject timesheet');
    }
    setProcessing(false);
  };

  const openDetailDialog = (timesheet) => {
    setSelectedTimesheet(timesheet);
    setFeedback('');
    setShowDetailDialog(true);
  };

  const getStatusBadge = (status) => {
    const styles = {
      draft: 'bg-slate-100 text-slate-800',
      submitted: 'bg-blue-100 text-blue-800',
      approved: 'bg-green-100 text-green-800',
      rejected: 'bg-red-100 text-red-800'
    };
    return <Badge className={styles[status] || styles.draft}>{status}</Badge>;
  };

  const getEmployeeName = (employeeId) => {
    const emp = employees.find(e => e.id === employeeId);
    return emp?.user_name || 'Unknown';
  };

  const exportToCSV = () => {
    if (!reportData?.raw?.length) {
      toast.error('No data to export');
      return;
    }

    const headers = ['Employee', 'Project', 'Week Start', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun', 'Total', 'Status'];
    const rows = reportData.raw.map(t => [
      getEmployeeName(t.employee_id),
      t.project_name,
      t.week_start_date,
      t.monday_hours,
      t.tuesday_hours,
      t.wednesday_hours,
      t.thursday_hours,
      t.friday_hours,
      t.saturday_hours,
      t.sunday_hours,
      t.total_hours,
      t.status
    ]);

    const csvContent = [headers, ...rows].map(row => row.join(',')).join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `timesheet_report_${reportStartDate}_${reportEndDate}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
    
    toast.success('CSV exported');
  };

  const exportToPDF = () => {
    if (!reportData?.raw?.length) {
      toast.error('No data to export');
      return;
    }

    const doc = new jsPDF();
    
    // Header
    doc.setFillColor(0, 47, 167);
    doc.rect(0, 0, 210, 35, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(20);
    doc.setFont('helvetica', 'bold');
    doc.text('TalentOps', 20, 20);
    doc.setFontSize(12);
    doc.text('Timesheet Report', 20, 28);

    // Date range
    doc.setTextColor(0, 0, 0);
    doc.setFontSize(11);
    doc.text(`Report Period: ${reportStartDate} to ${reportEndDate}`, 20, 45);

    // Summary
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text('Summary', 20, 58);
    doc.setFontSize(11);
    doc.setFont('helvetica', 'normal');
    doc.text(`Total Entries: ${reportData.totalEntries}`, 20, 68);
    doc.text(`Total Hours: ${reportData.totalHours.toFixed(1)}`, 20, 76);

    // Project breakdown
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text('Hours by Project', 20, 92);

    const projectData = Object.entries(reportData.byProject).map(([name, data]) => [
      name, 
      data.entries.toString(), 
      data.total_hours.toFixed(1)
    ]);

    doc.autoTable({
      startY: 97,
      head: [['Project', 'Entries', 'Hours']],
      body: projectData,
      theme: 'striped',
      headStyles: { fillColor: [0, 47, 167] },
      margin: { left: 20, right: 20 }
    });

    // Detailed entries
    const detailY = doc.lastAutoTable.finalY + 15;
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text('Detailed Entries', 20, detailY);

    const detailData = reportData.raw.map(t => [
      getEmployeeName(t.employee_id),
      t.project_name,
      t.week_start_date,
      t.total_hours.toFixed(1)
    ]);

    doc.autoTable({
      startY: detailY + 5,
      head: [['Employee', 'Project', 'Week', 'Hours']],
      body: detailData,
      theme: 'striped',
      headStyles: { fillColor: [0, 47, 167] },
      margin: { left: 20, right: 20 }
    });

    // Footer
    const pageCount = doc.internal.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i);
      doc.setFontSize(9);
      doc.setTextColor(100);
      doc.text(`Generated: ${new Date().toLocaleDateString()}`, 20, 287);
      doc.text(`Page ${i} of ${pageCount}`, 180, 287);
    }

    doc.save(`timesheet_report_${reportStartDate}_${reportEndDate}.pdf`);
    toast.success('PDF exported');
  };

  return (
    <div className="animate-fade-in space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-[#0F172A] font-['Chivo']">Timesheet Management</h1>
        <p className="text-slate-500 mt-1">Review, approve, and report on team timesheets</p>
      </div>

      <Tabs defaultValue="approvals" className="space-y-4">
        <TabsList>
          <TabsTrigger value="approvals" data-testid="tab-approvals">
            <CheckCircle className="h-4 w-4 mr-2" />
            Approvals
          </TabsTrigger>
          <TabsTrigger value="history" data-testid="tab-history">
            <Clock className="h-4 w-4 mr-2" />
            History
          </TabsTrigger>
          <TabsTrigger value="reports" data-testid="tab-reports">
            <FileText className="h-4 w-4 mr-2" />
            Reports
          </TabsTrigger>
        </TabsList>

        {/* Approvals Tab */}
        <TabsContent value="approvals">
          {/* Filters */}
          <Card className="border border-slate-200">
            <CardContent className="p-4">
              <div className="flex flex-col sm:flex-row gap-4">
                <div className="flex items-center gap-2">
                  <Filter className="h-4 w-4 text-slate-400" />
                  <Select value={statusFilter} onValueChange={setStatusFilter}>
                    <SelectTrigger className="w-[150px]" data-testid="filter-status">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="submitted">Submitted</SelectItem>
                      <SelectItem value="approved">Approved</SelectItem>
                      <SelectItem value="rejected">Rejected</SelectItem>
                      <SelectItem value="draft">Draft</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <Select value={employeeFilter} onValueChange={setEmployeeFilter}>
                  <SelectTrigger className="w-[200px]" data-testid="filter-employee">
                    <SelectValue placeholder="All Employees" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Employees</SelectItem>
                    {employees.map(emp => (
                      <SelectItem key={emp.id} value={emp.id}>{emp.user_name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>

          {/* Timesheets Table */}
          <Card className="border border-slate-200">
            <CardHeader className="border-b border-slate-200">
              <CardTitle className="text-lg font-['Chivo'] flex items-center gap-2">
                <Users className="h-5 w-5" />
                Timesheet Entries ({timesheets.length})
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {loading ? (
                <div className="p-8 text-center">
                  <Loader2 className="h-8 w-8 animate-spin mx-auto text-[#002FA7]" />
                </div>
              ) : timesheets.length === 0 ? (
                <div className="p-8 text-center text-slate-500">
                  <Clock className="h-12 w-12 mx-auto mb-4 text-slate-300" />
                  <p>No timesheets found with status: {statusFilter}</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow className="bg-slate-50">
                      <TableHead className="font-semibold">Employee</TableHead>
                      <TableHead className="font-semibold">Project</TableHead>
                      <TableHead className="font-semibold">Week</TableHead>
                      <TableHead className="font-semibold text-right">Hours</TableHead>
                      <TableHead className="font-semibold">Status</TableHead>
                      <TableHead className="font-semibold">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {timesheets.map((ts) => (
                      <TableRow key={ts.id} data-testid={`timesheet-admin-row-${ts.id}`}>
                        <TableCell className="font-medium">{getEmployeeName(ts.employee_id)}</TableCell>
                        <TableCell>{ts.project_name}</TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1">
                            <Calendar className="h-3 w-3 text-slate-400" />
                            {ts.week_start_date}
                          </div>
                        </TableCell>
                        <TableCell className="text-right font-semibold text-[#002FA7]">
                          {ts.total_hours.toFixed(1)}h
                        </TableCell>
                        <TableCell>{getStatusBadge(ts.status)}</TableCell>
                        <TableCell>
                          <div className="flex gap-2">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => openDetailDialog(ts)}
                              data-testid={`view-timesheet-${ts.id}`}
                            >
                              <Eye className="h-3 w-3 mr-1" />
                              View
                            </Button>
                            {ts.status === 'submitted' && (
                              <>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="text-green-600 border-green-200 hover:bg-green-50"
                                  onClick={() => handleApprove(ts.id)}
                                  data-testid={`quick-approve-${ts.id}`}
                                >
                                  <CheckCircle className="h-3 w-3" />
                                </Button>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="text-red-600 border-red-200 hover:bg-red-50"
                                  onClick={() => openDetailDialog(ts)}
                                  data-testid={`quick-reject-${ts.id}`}
                                >
                                  <XCircle className="h-3 w-3" />
                                </Button>
                              </>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* History Tab */}
        <TabsContent value="history">
          <Card className="border border-slate-200">
            <CardHeader>
              <CardTitle className="text-lg font-['Chivo']">Timesheet History</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {/* Quick filters */}
                <div className="flex gap-2">
                  <Button
                    variant={statusFilter === 'approved' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setStatusFilter('approved')}
                    className={statusFilter === 'approved' ? 'bg-[#002FA7]' : ''}
                  >
                    Approved
                  </Button>
                  <Button
                    variant={statusFilter === 'rejected' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setStatusFilter('rejected')}
                    className={statusFilter === 'rejected' ? 'bg-[#002FA7]' : ''}
                  >
                    Rejected
                  </Button>
                  <Button
                    variant={statusFilter === 'submitted' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setStatusFilter('submitted')}
                    className={statusFilter === 'submitted' ? 'bg-[#002FA7]' : ''}
                  >
                    Pending
                  </Button>
                </div>

                {/* Same table as approvals */}
                {loading ? (
                  <div className="p-8 text-center">
                    <Loader2 className="h-8 w-8 animate-spin mx-auto text-[#002FA7]" />
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-slate-50">
                        <TableHead>Employee</TableHead>
                        <TableHead>Project</TableHead>
                        <TableHead>Week</TableHead>
                        <TableHead className="text-right">Hours</TableHead>
                        <TableHead>Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {timesheets.map((ts) => (
                        <TableRow key={ts.id}>
                          <TableCell>{getEmployeeName(ts.employee_id)}</TableCell>
                          <TableCell>{ts.project_name}</TableCell>
                          <TableCell>{ts.week_start_date}</TableCell>
                          <TableCell className="text-right">{ts.total_hours.toFixed(1)}h</TableCell>
                          <TableCell>{getStatusBadge(ts.status)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Reports Tab */}
        <TabsContent value="reports">
          <div className="space-y-6">
            {/* Report Filters */}
            <Card className="border border-slate-200">
              <CardHeader>
                <CardTitle className="text-lg font-['Chivo']">Generate Report</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-4 items-end">
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Start Date</label>
                    <Input
                      type="date"
                      value={reportStartDate}
                      onChange={(e) => setReportStartDate(e.target.value)}
                      className="w-[180px]"
                      data-testid="report-start-date"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">End Date</label>
                    <Input
                      type="date"
                      value={reportEndDate}
                      onChange={(e) => setReportEndDate(e.target.value)}
                      className="w-[180px]"
                      data-testid="report-end-date"
                    />
                  </div>
                  <Button 
                    onClick={fetchReportData}
                    className="bg-[#002FA7] hover:bg-[#00227A]"
                    data-testid="generate-report"
                  >
                    Generate Report
                  </Button>
                  {reportData && (
                    <>
                      <Button variant="outline" onClick={exportToCSV} data-testid="export-csv">
                        <Download className="h-4 w-4 mr-2" />
                        Export CSV
                      </Button>
                      <Button variant="outline" onClick={exportToPDF} data-testid="export-pdf">
                        <FileText className="h-4 w-4 mr-2" />
                        Export PDF
                      </Button>
                    </>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Report Results */}
            {reportData && (
              <>
                {/* Summary Cards */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <Card className="border border-slate-200 bg-blue-50">
                    <CardContent className="p-6 text-center">
                      <p className="text-4xl font-bold text-[#002FA7]">{reportData.totalEntries}</p>
                      <p className="text-sm text-slate-600">Total Entries</p>
                    </CardContent>
                  </Card>
                  <Card className="border border-slate-200 bg-green-50">
                    <CardContent className="p-6 text-center">
                      <p className="text-4xl font-bold text-green-600">{reportData.totalHours.toFixed(1)}</p>
                      <p className="text-sm text-slate-600">Total Hours</p>
                    </CardContent>
                  </Card>
                  <Card className="border border-slate-200 bg-purple-50">
                    <CardContent className="p-6 text-center">
                      <p className="text-4xl font-bold text-purple-600">{Object.keys(reportData.byProject).length}</p>
                      <p className="text-sm text-slate-600">Projects</p>
                    </CardContent>
                  </Card>
                </div>

                {/* Hours by Project */}
                <Card className="border border-slate-200">
                  <CardHeader>
                    <CardTitle className="text-lg font-['Chivo']">Hours by Project</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <Table>
                      <TableHeader>
                        <TableRow className="bg-slate-50">
                          <TableHead>Project</TableHead>
                          <TableHead className="text-right">Entries</TableHead>
                          <TableHead className="text-right">Total Hours</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {Object.entries(reportData.byProject).map(([name, data]) => (
                          <TableRow key={name}>
                            <TableCell className="font-medium">{name}</TableCell>
                            <TableCell className="text-right">{data.entries}</TableCell>
                            <TableCell className="text-right font-semibold text-[#002FA7]">
                              {data.total_hours.toFixed(1)}h
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </CardContent>
                </Card>
              </>
            )}
          </div>
        </TabsContent>
      </Tabs>

      {/* Detail Dialog */}
      <Dialog open={showDetailDialog} onOpenChange={setShowDetailDialog}>
        <DialogContent className="sm:max-w-[600px]">
          <DialogHeader>
            <DialogTitle className="font-['Chivo']">Timesheet Details</DialogTitle>
            <DialogDescription>
              Review and take action on this timesheet entry
            </DialogDescription>
          </DialogHeader>
          
          {selectedTimesheet && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4 p-4 bg-slate-50 rounded-lg">
                <div>
                  <p className="text-sm text-slate-500">Employee</p>
                  <p className="font-medium">{getEmployeeName(selectedTimesheet.employee_id)}</p>
                </div>
                <div>
                  <p className="text-sm text-slate-500">Project</p>
                  <p className="font-medium">{selectedTimesheet.project_name}</p>
                </div>
                <div>
                  <p className="text-sm text-slate-500">Week Starting</p>
                  <p className="font-medium">{selectedTimesheet.week_start_date}</p>
                </div>
                <div>
                  <p className="text-sm text-slate-500">Status</p>
                  {getStatusBadge(selectedTimesheet.status)}
                </div>
              </div>

              {/* Hours breakdown */}
              <div className="grid grid-cols-7 gap-2">
                {DAYS.map((day, idx) => (
                  <div key={day} className="text-center p-2 bg-slate-100 rounded">
                    <p className="text-xs text-slate-500">{DAY_LABELS[idx]}</p>
                    <p className="font-semibold">{selectedTimesheet[`${day}_hours`]}h</p>
                  </div>
                ))}
              </div>

              <div className="flex justify-between items-center p-3 bg-blue-50 rounded-lg">
                <span className="font-medium">Total Hours</span>
                <span className="text-2xl font-bold text-[#002FA7]">
                  {selectedTimesheet.total_hours.toFixed(1)}h
                </span>
              </div>

              {selectedTimesheet.status === 'submitted' && (
                <div className="space-y-2">
                  <label className="text-sm font-medium">Feedback (required for rejection)</label>
                  <Textarea
                    value={feedback}
                    onChange={(e) => setFeedback(e.target.value)}
                    placeholder="Add feedback for the employee..."
                    rows={3}
                    data-testid="approval-feedback"
                  />
                </div>
              )}
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDetailDialog(false)}>
              Close
            </Button>
            {selectedTimesheet?.status === 'submitted' && (
              <>
                <Button
                  variant="outline"
                  className="text-red-600 border-red-200 hover:bg-red-50"
                  onClick={() => handleReject(selectedTimesheet.id)}
                  disabled={processing}
                  data-testid="reject-timesheet"
                >
                  {processing ? <Loader2 className="h-4 w-4 animate-spin" /> : <XCircle className="h-4 w-4 mr-2" />}
                  Reject
                </Button>
                <Button
                  className="bg-green-600 hover:bg-green-700"
                  onClick={() => handleApprove(selectedTimesheet.id)}
                  disabled={processing}
                  data-testid="approve-timesheet"
                >
                  {processing ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle className="h-4 w-4 mr-2" />}
                  Approve
                </Button>
              </>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
