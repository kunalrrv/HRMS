import React, { useState, useEffect, useMemo } from 'react';
import axios from 'axios';
import { useAuth } from '../../contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Badge } from '../../components/ui/badge';
import { ChevronLeft, ChevronRight, CalendarDays, Loader2 } from 'lucide-react';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

export default function CalendarPage() {
  const { user } = useAuth();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [attendance, setAttendance] = useState([]);
  const [leaves, setLeaves] = useState([]);
  const [loading, setLoading] = useState(true);

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();
  const monthName = currentDate.toLocaleString('default', { month: 'long', year: 'numeric' });

  useEffect(() => { fetchCalendarData(); }, [month, year]);

  const fetchCalendarData = async () => {
    setLoading(true);
    try {
      const [attRes, leaveRes] = await Promise.all([
        axios.get(`${API}/attendance`, { withCredentials: true }),
        axios.get(`${API}/leaves`, { withCredentials: true })
      ]);
      setAttendance(attRes.data || []);
      setLeaves(leaveRes.data || []);
    } catch (error) {
      console.error('Failed to fetch calendar data:', error);
    }
    setLoading(false);
  };

  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const firstDayOfWeek = new Date(year, month, 1).getDay();

  const calendarDays = useMemo(() => {
    const days = [];
    const today = new Date();
    const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;

    for (let i = 0; i < firstDayOfWeek; i++) {
      days.push(null);
    }

    for (let d = 1; d <= daysInMonth; d++) {
      const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      const dayOfWeek = new Date(year, month, d).getDay();
      const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
      const isToday = dateStr === todayStr;

      const dayAttendance = attendance.find(a => a.date === dateStr);
      const dayLeaves = leaves.filter(l => {
        if (!l.start_date || !l.end_date) return false;
        return dateStr >= l.start_date && dateStr <= l.end_date;
      });
      const approvedLeave = dayLeaves.find(l => l.status === 'approved');
      const pendingLeave = dayLeaves.find(l => l.status === 'pending');

      let status = 'none';
      if (approvedLeave) status = 'leave';
      else if (pendingLeave) status = 'pending-leave';
      else if (dayAttendance?.clock_in) status = 'present';
      else if (!isWeekend && dateStr < todayStr) status = 'absent';

      days.push({
        day: d,
        dateStr,
        isWeekend,
        isToday,
        status,
        attendance: dayAttendance,
        leave: approvedLeave || pendingLeave,
      });
    }
    return days;
  }, [attendance, leaves, month, year, daysInMonth, firstDayOfWeek]);

  const prevMonth = () => setCurrentDate(new Date(year, month - 1, 1));
  const nextMonth = () => setCurrentDate(new Date(year, month + 1, 1));
  const goToday = () => setCurrentDate(new Date());

  const statusConfig = {
    present: { bg: 'bg-green-100 dark:bg-green-900/30', text: 'text-green-800 dark:text-green-300', dot: 'bg-green-500' },
    absent: { bg: 'bg-red-50 dark:bg-red-900/20', text: 'text-red-700 dark:text-red-400', dot: 'bg-red-500' },
    leave: { bg: 'bg-blue-100 dark:bg-blue-900/30', text: 'text-blue-800 dark:text-blue-300', dot: 'bg-blue-500' },
    'pending-leave': { bg: 'bg-amber-50 dark:bg-amber-900/20', text: 'text-amber-800 dark:text-amber-300', dot: 'bg-amber-500' },
    none: { bg: '', text: 'text-slate-700 dark:text-slate-300', dot: '' },
  };

  const stats = useMemo(() => {
    const present = calendarDays.filter(d => d?.status === 'present').length;
    const absent = calendarDays.filter(d => d?.status === 'absent').length;
    const leaveCount = calendarDays.filter(d => d?.status === 'leave').length;
    const pending = calendarDays.filter(d => d?.status === 'pending-leave').length;
    return { present, absent, leave: leaveCount, pending };
  }, [calendarDays]);

  return (
    <div className="animate-fade-in space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-[#0F172A] dark:text-white font-['Chivo']">Calendar</h1>
          <p className="text-slate-500 dark:text-slate-400 mt-1">Attendance and leave overview</p>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Present', value: stats.present, color: 'green' },
          { label: 'Absent', value: stats.absent, color: 'red' },
          { label: 'On Leave', value: stats.leave, color: 'blue' },
          { label: 'Pending', value: stats.pending, color: 'amber' },
        ].map((s) => (
          <Card key={s.label} className={`border dark:border-slate-700 dark:bg-slate-800`} data-testid={`cal-stat-${s.label.toLowerCase()}`}>
            <CardContent className="p-4 text-center">
              <p className={`text-3xl font-bold text-${s.color}-600 dark:text-${s.color}-400 font-['Chivo']`}>{s.value}</p>
              <p className="text-sm text-slate-500 dark:text-slate-400">{s.label}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Calendar */}
      <Card className="border border-slate-200 dark:border-slate-700 dark:bg-slate-800">
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-lg font-['Chivo'] dark:text-white flex items-center gap-2">
            <CalendarDays className="h-5 w-5" />
            {monthName}
          </CardTitle>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="icon" onClick={prevMonth} data-testid="cal-prev" className="dark:border-slate-600">
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button variant="outline" size="sm" onClick={goToday} data-testid="cal-today" className="dark:border-slate-600 dark:text-slate-200">
              Today
            </Button>
            <Button variant="outline" size="icon" onClick={nextMonth} data-testid="cal-next" className="dark:border-slate-600">
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="p-8 text-center"><Loader2 className="h-8 w-8 animate-spin mx-auto text-[#002FA7]" /></div>
          ) : (
            <div className="grid grid-cols-7 gap-px bg-slate-200 dark:bg-slate-700 rounded-lg overflow-hidden">
              {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((d) => (
                <div key={d} className="bg-slate-100 dark:bg-slate-800 text-center py-2 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase">
                  {d}
                </div>
              ))}
              {calendarDays.map((cell, i) => {
                if (!cell) return <div key={`empty-${i}`} className="bg-white dark:bg-slate-900 min-h-[72px]" />;

                const config = statusConfig[cell.status];
                return (
                  <div
                    key={cell.dateStr}
                    data-testid={`cal-day-${cell.day}`}
                    className={`bg-white dark:bg-slate-900 min-h-[72px] p-2 relative ${cell.isToday ? 'ring-2 ring-[#002FA7] ring-inset' : ''} ${cell.isWeekend ? 'bg-slate-50 dark:bg-slate-900/50' : ''}`}
                  >
                    <span className={`text-sm font-medium ${cell.isToday ? 'bg-[#002FA7] text-white rounded-full w-6 h-6 flex items-center justify-center' : config.text}`}>
                      {cell.day}
                    </span>
                    {cell.status !== 'none' && (
                      <div className="mt-1">
                        {cell.status === 'present' && (
                          <Badge className="text-[10px] px-1 py-0 bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400">P</Badge>
                        )}
                        {cell.status === 'absent' && (
                          <Badge className="text-[10px] px-1 py-0 bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400">A</Badge>
                        )}
                        {cell.status === 'leave' && (
                          <Badge className="text-[10px] px-1 py-0 bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400">
                            {cell.leave?.leave_type || 'L'}
                          </Badge>
                        )}
                        {cell.status === 'pending-leave' && (
                          <Badge className="text-[10px] px-1 py-0 bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400">PL</Badge>
                        )}
                      </div>
                    )}
                    {cell.attendance?.clock_in && (
                      <p className="text-[9px] text-slate-400 mt-0.5">
                        {new Date(cell.attendance.clock_in).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Legend */}
      <div className="flex flex-wrap gap-4 text-sm text-slate-600 dark:text-slate-400">
        <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-full bg-green-500" /> Present</div>
        <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-full bg-red-500" /> Absent</div>
        <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-full bg-blue-500" /> On Leave</div>
        <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-full bg-amber-500" /> Pending Leave</div>
        <div className="flex items-center gap-2"><div className="w-3 h-3 rounded bg-slate-200 dark:bg-slate-700" /> Weekend</div>
        <div className="flex items-center gap-2"><div className="w-3 h-3 rounded ring-2 ring-[#002FA7]" /> Today</div>
      </div>
    </div>
  );
}
