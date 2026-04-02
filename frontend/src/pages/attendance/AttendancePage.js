import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useAuth } from '../../contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Badge } from '../../components/ui/badge';
import { Calendar } from '../../components/ui/calendar';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../../components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../../components/ui/select';
import { Clock, Play, Square, Loader2, CalendarDays } from 'lucide-react';
import { toast } from 'sonner';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

export default function AttendancePage() {
  const { user } = useAuth();
  const [attendance, setAttendance] = useState([]);
  const [todayStatus, setTodayStatus] = useState(null);
  const [loading, setLoading] = useState(true);
  const [clockingIn, setClockingIn] = useState(false);
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [employees, setEmployees] = useState([]);
  const [selectedEmployee, setSelectedEmployee] = useState('all');

  const isAdmin = ['super_admin', 'admin', 'hr'].includes(user?.role);

  useEffect(() => {
    fetchData();
    if (isAdmin) {
      fetchEmployees();
    }
  }, [selectedEmployee]);

  const fetchEmployees = async () => {
    try {
      const { data } = await axios.get(`${API}/employees`, { withCredentials: true });
      setEmployees(data);
    } catch (error) {
      console.error('Failed to fetch employees:', error);
    }
  };

  const fetchData = async () => {
    try {
      const [todayRes, historyRes] = await Promise.all([
        axios.get(`${API}/attendance/today`, { withCredentials: true }),
        axios.get(`${API}/attendance${selectedEmployee !== 'all' ? `?employee_id=${selectedEmployee}` : ''}`, { withCredentials: true })
      ]);
      setTodayStatus(todayRes.data);
      setAttendance(historyRes.data);
    } catch (error) {
      console.error('Failed to fetch attendance:', error);
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

  const getStatusBadge = (record) => {
    if (!record.clock_in) {
      return <Badge className="bg-slate-100 text-slate-800">Absent</Badge>;
    }
    if (record.clock_in && !record.clock_out) {
      return <Badge className="bg-blue-100 text-blue-800">Working</Badge>;
    }
    return <Badge className="bg-green-100 text-green-800">Present</Badge>;
  };

  // Get dates with attendance for calendar
  const attendanceDates = attendance.map(a => new Date(a.date));

  return (
    <div className="animate-fade-in space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-[#0F172A] font-['Chivo']">Attendance</h1>
          <p className="text-slate-500 mt-1">Track and manage attendance</p>
        </div>
      </div>

      {/* Today's Attendance Card */}
      <Card className="border border-slate-200 bg-gradient-to-r from-[#002FA7] to-[#00227A] text-white">
        <CardContent className="p-6">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <h3 className="text-lg font-semibold mb-1">Today's Attendance</h3>
              <p className="text-blue-100 text-sm">
                {new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
              </p>
              <div className="flex items-center gap-6 mt-4 text-sm">
                <div>
                  <p className="text-blue-200">Clock In</p>
                  <p className="text-xl font-semibold">{formatTime(todayStatus?.clock_in)}</p>
                </div>
                <div>
                  <p className="text-blue-200">Clock Out</p>
                  <p className="text-xl font-semibold">{formatTime(todayStatus?.clock_out)}</p>
                </div>
                {todayStatus?.total_hours && (
                  <div>
                    <p className="text-blue-200">Total Hours</p>
                    <p className="text-xl font-semibold">{todayStatus.total_hours.toFixed(2)}</p>
                  </div>
                )}
              </div>
            </div>
            <div className="flex gap-3">
              {!todayStatus?.clocked_in ? (
                <Button
                  onClick={() => handleClockAction('clock_in')}
                  disabled={clockingIn}
                  className="bg-white text-[#002FA7] hover:bg-blue-50"
                  data-testid="clock-in-btn"
                >
                  {clockingIn ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4 mr-2" />}
                  Clock In
                </Button>
              ) : !todayStatus?.clocked_out ? (
                <Button
                  onClick={() => handleClockAction('clock_out')}
                  disabled={clockingIn}
                  className="bg-white text-[#002FA7] hover:bg-blue-50"
                  data-testid="clock-out-btn"
                >
                  {clockingIn ? <Loader2 className="h-4 w-4 animate-spin" /> : <Square className="h-4 w-4 mr-2" />}
                  Clock Out
                </Button>
              ) : (
                <Badge className="bg-green-500 text-white px-4 py-2">
                  Completed for today
                </Badge>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Calendar */}
        <Card className="border border-slate-200">
          <CardHeader>
            <CardTitle className="text-lg font-['Chivo'] flex items-center gap-2">
              <CalendarDays className="h-5 w-5" />
              Attendance Calendar
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Calendar
              mode="single"
              selected={selectedDate}
              onSelect={setSelectedDate}
              className="rounded-md border"
              modifiers={{
                present: attendanceDates
              }}
              modifiersStyles={{
                present: { backgroundColor: '#dcfce7', color: '#16a34a' }
              }}
            />
          </CardContent>
        </Card>

        {/* Attendance History */}
        <Card className="border border-slate-200 lg:col-span-2">
          <CardHeader className="border-b border-slate-200 flex flex-row items-center justify-between">
            <CardTitle className="text-lg font-['Chivo'] flex items-center gap-2">
              <Clock className="h-5 w-5" />
              Attendance History
            </CardTitle>
            {isAdmin && (
              <Select value={selectedEmployee} onValueChange={setSelectedEmployee}>
                <SelectTrigger className="w-[200px]" data-testid="filter-employee">
                  <SelectValue placeholder="All Employees" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Employees</SelectItem>
                  {employees.map((emp) => (
                    <SelectItem key={emp.id} value={emp.id}>{emp.user_name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </CardHeader>
          <CardContent className="p-0">
            {loading ? (
              <div className="p-8 text-center">
                <Loader2 className="h-8 w-8 animate-spin mx-auto text-[#002FA7]" />
              </div>
            ) : attendance.length === 0 ? (
              <div className="p-8 text-center text-slate-500">
                <Clock className="h-12 w-12 mx-auto mb-4 text-slate-300" />
                <p>No attendance records found</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-slate-50">
                      <TableHead className="font-semibold">Date</TableHead>
                      <TableHead className="font-semibold">Clock In</TableHead>
                      <TableHead className="font-semibold">Clock Out</TableHead>
                      <TableHead className="font-semibold text-right">Hours</TableHead>
                      <TableHead className="font-semibold">Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {attendance.slice(0, 20).map((record) => (
                      <TableRow key={record.id} data-testid={`attendance-row-${record.id}`}>
                        <TableCell className="font-medium">
                          {new Date(record.date).toLocaleDateString('en-US', { 
                            weekday: 'short',
                            month: 'short', 
                            day: 'numeric' 
                          })}
                        </TableCell>
                        <TableCell>{formatTime(record.clock_in)}</TableCell>
                        <TableCell>{formatTime(record.clock_out)}</TableCell>
                        <TableCell className="text-right">
                          {record.total_hours ? `${record.total_hours.toFixed(2)}h` : '-'}
                        </TableCell>
                        <TableCell>{getStatusBadge(record)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
