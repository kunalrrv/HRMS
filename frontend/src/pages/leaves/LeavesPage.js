import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useAuth } from '../../contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Badge } from '../../components/ui/badge';
import { Textarea } from '../../components/ui/textarea';
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
  DialogTrigger,
  DialogFooter,
} from '../../components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../../components/ui/select';
import { Calendar, Plus, Check, X, Loader2, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

export default function LeavesPage() {
  const { user } = useAuth();
  const [leaves, setLeaves] = useState([]);
  const [leaveBalance, setLeaveBalance] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showApplyDialog, setShowApplyDialog] = useState(false);
  const [applying, setApplying] = useState(false);
  const [statusFilter, setStatusFilter] = useState('all');

  const [newLeave, setNewLeave] = useState({
    leave_type: 'CL',
    start_date: '',
    end_date: '',
    reason: ''
  });

  const isAdmin = ['super_admin', 'admin', 'hr'].includes(user?.role);

  useEffect(() => {
    fetchData();
  }, [statusFilter]);

  const fetchData = async () => {
    try {
      const leavesUrl = statusFilter === 'all' 
        ? `${API}/leaves`
        : `${API}/leaves?status=${statusFilter}`;

      const [leavesRes, balanceRes] = await Promise.all([
        axios.get(leavesUrl, { withCredentials: true }),
        axios.get(`${API}/leaves/balance`, { withCredentials: true }).catch(() => ({ data: null }))
      ]);
      setLeaves(leavesRes.data);
      setLeaveBalance(balanceRes.data);
    } catch (error) {
      console.error('Failed to fetch leaves:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleApplyLeave = async (e) => {
    e.preventDefault();
    setApplying(true);

    try {
      await axios.post(`${API}/leaves`, newLeave, { withCredentials: true });
      toast.success('Leave application submitted!');
      setShowApplyDialog(false);
      setNewLeave({ leave_type: 'CL', start_date: '', end_date: '', reason: '' });
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to apply for leave');
    }

    setApplying(false);
  };

  const handleApprove = async (leaveId) => {
    try {
      await axios.put(`${API}/leaves/${leaveId}/approve`, {}, { withCredentials: true });
      toast.success('Leave approved!');
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to approve leave');
    }
  };

  const handleReject = async (leaveId) => {
    try {
      await axios.put(`${API}/leaves/${leaveId}/reject`, {}, { withCredentials: true });
      toast.success('Leave rejected');
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to reject leave');
    }
  };

  const getStatusBadge = (status) => {
    const styles = {
      pending: 'bg-amber-100 text-amber-800',
      approved: 'bg-green-100 text-green-800',
      rejected: 'bg-red-100 text-red-800'
    };
    return <Badge className={styles[status]}>{status.charAt(0).toUpperCase() + status.slice(1)}</Badge>;
  };

  const getLeaveTypeBadge = (type) => {
    const labels = { CL: 'Casual Leave', SL: 'Sick Leave', PL: 'Privilege Leave' };
    const styles = { CL: 'bg-blue-100 text-blue-800', SL: 'bg-green-100 text-green-800', PL: 'bg-purple-100 text-purple-800' };
    return <Badge className={styles[type]}>{labels[type]}</Badge>;
  };

  const calculateDays = (start, end) => {
    if (!start || !end) return 0;
    const startDate = new Date(start);
    const endDate = new Date(end);
    return Math.ceil((endDate - startDate) / (1000 * 60 * 60 * 24)) + 1;
  };

  return (
    <div className="animate-fade-in space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-[#0F172A] font-['Chivo']">Leave Management</h1>
          <p className="text-slate-500 mt-1">Apply and manage leaves</p>
        </div>
        <Dialog open={showApplyDialog} onOpenChange={setShowApplyDialog}>
          <DialogTrigger asChild>
            <Button className="bg-[#002FA7] hover:bg-[#00227A]" data-testid="apply-leave-btn">
              <Plus className="h-4 w-4 mr-2" />
              Apply for Leave
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[500px]">
            <DialogHeader>
              <DialogTitle className="font-['Chivo']">Apply for Leave</DialogTitle>
              <DialogDescription>
                Submit a new leave application
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleApplyLeave}>
              <div className="grid gap-4 py-4">
                <div className="space-y-2">
                  <Label>Leave Type</Label>
                  <Select
                    value={newLeave.leave_type}
                    onValueChange={(value) => setNewLeave({ ...newLeave, leave_type: value })}
                  >
                    <SelectTrigger data-testid="leave-type">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="CL">Casual Leave (CL)</SelectItem>
                      <SelectItem value="SL">Sick Leave (SL)</SelectItem>
                      <SelectItem value="PL">Privilege Leave (PL)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Start Date</Label>
                    <Input
                      type="date"
                      value={newLeave.start_date}
                      onChange={(e) => setNewLeave({ ...newLeave, start_date: e.target.value })}
                      required
                      data-testid="leave-start-date"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>End Date</Label>
                    <Input
                      type="date"
                      value={newLeave.end_date}
                      onChange={(e) => setNewLeave({ ...newLeave, end_date: e.target.value })}
                      min={newLeave.start_date}
                      required
                      data-testid="leave-end-date"
                    />
                  </div>
                </div>
                {newLeave.start_date && newLeave.end_date && (
                  <p className="text-sm text-slate-500">
                    Duration: {calculateDays(newLeave.start_date, newLeave.end_date)} day(s)
                  </p>
                )}
                <div className="space-y-2">
                  <Label>Reason</Label>
                  <Textarea
                    value={newLeave.reason}
                    onChange={(e) => setNewLeave({ ...newLeave, reason: e.target.value })}
                    placeholder="Provide a reason for your leave..."
                    required
                    data-testid="leave-reason"
                  />
                </div>
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setShowApplyDialog(false)}>
                  Cancel
                </Button>
                <Button 
                  type="submit" 
                  disabled={applying || !newLeave.start_date || !newLeave.end_date || !newLeave.reason}
                  className="bg-[#002FA7] hover:bg-[#00227A]"
                  data-testid="submit-leave"
                >
                  {applying ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Submit Application'}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Leave Balance Cards */}
      {leaveBalance && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card className="border border-slate-200 bg-blue-50">
            <CardContent className="p-6 text-center">
              <p className="text-3xl font-bold text-[#002FA7]">{leaveBalance.casual_leave}</p>
              <p className="text-sm text-slate-600">Casual Leave</p>
            </CardContent>
          </Card>
          <Card className="border border-slate-200 bg-green-50">
            <CardContent className="p-6 text-center">
              <p className="text-3xl font-bold text-green-600">{leaveBalance.sick_leave}</p>
              <p className="text-sm text-slate-600">Sick Leave</p>
            </CardContent>
          </Card>
          <Card className="border border-slate-200 bg-purple-50">
            <CardContent className="p-6 text-center">
              <p className="text-3xl font-bold text-purple-600">{leaveBalance.privilege_leave}</p>
              <p className="text-sm text-slate-600">Privilege Leave</p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Leave Applications */}
      <Card className="border border-slate-200">
        <CardHeader className="border-b border-slate-200 flex flex-row items-center justify-between">
          <CardTitle className="text-lg font-['Chivo'] flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            Leave Applications
          </CardTitle>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[150px]" data-testid="filter-status">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="pending">Pending</SelectItem>
              <SelectItem value="approved">Approved</SelectItem>
              <SelectItem value="rejected">Rejected</SelectItem>
            </SelectContent>
          </Select>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <div className="p-8 text-center">
              <Loader2 className="h-8 w-8 animate-spin mx-auto text-[#002FA7]" />
            </div>
          ) : leaves.length === 0 ? (
            <div className="p-8 text-center text-slate-500">
              <Calendar className="h-12 w-12 mx-auto mb-4 text-slate-300" />
              <p>No leave applications found</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-slate-50">
                    <TableHead className="font-semibold">Type</TableHead>
                    <TableHead className="font-semibold">Duration</TableHead>
                    <TableHead className="font-semibold">Reason</TableHead>
                    <TableHead className="font-semibold">Status</TableHead>
                    {isAdmin && <TableHead className="font-semibold">Actions</TableHead>}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {leaves.map((leave) => (
                    <TableRow key={leave.id} data-testid={`leave-row-${leave.id}`}>
                      <TableCell>{getLeaveTypeBadge(leave.leave_type)}</TableCell>
                      <TableCell>
                        <div>
                          <p className="font-medium">
                            {new Date(leave.start_date).toLocaleDateString()} - {new Date(leave.end_date).toLocaleDateString()}
                          </p>
                          <p className="text-xs text-slate-500">
                            {calculateDays(leave.start_date, leave.end_date)} day(s)
                          </p>
                        </div>
                      </TableCell>
                      <TableCell className="max-w-[200px] truncate">{leave.reason}</TableCell>
                      <TableCell>{getStatusBadge(leave.status)}</TableCell>
                      {isAdmin && (
                        <TableCell>
                          {leave.status === 'pending' && (
                            <div className="flex gap-2">
                              <Button
                                size="sm"
                                variant="outline"
                                className="text-green-600 border-green-200 hover:bg-green-50"
                                onClick={() => handleApprove(leave.id)}
                                data-testid={`approve-leave-${leave.id}`}
                              >
                                <Check className="h-4 w-4" />
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                className="text-red-600 border-red-200 hover:bg-red-50"
                                onClick={() => handleReject(leave.id)}
                                data-testid={`reject-leave-${leave.id}`}
                              >
                                <X className="h-4 w-4" />
                              </Button>
                            </div>
                          )}
                        </TableCell>
                      )}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
