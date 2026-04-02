import React, { useState, useEffect, useMemo } from 'react';
import axios from 'axios';
import { useAuth } from '../../contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Badge } from '../../components/ui/badge';
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
  DialogTrigger,
  DialogFooter,
} from '../../components/ui/dialog';
import { 
  Clock, 
  Plus, 
  ChevronLeft, 
  ChevronRight, 
  Save, 
  Send, 
  Loader2,
  Trash2,
  Calendar,
  Download,
  FileText
} from 'lucide-react';
import { toast } from 'sonner';
import { jsPDF } from 'jspdf';
import 'jspdf-autotable';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const DAYS = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
const DAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

function getWeekStart(date) {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1); // Adjust for Sunday
  return new Date(d.setDate(diff));
}

function formatDate(date) {
  return date.toISOString().split('T')[0];
}

function getWeekDates(weekStart) {
  const dates = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(weekStart);
    d.setDate(d.getDate() + i);
    dates.push(d);
  }
  return dates;
}

export default function TimesheetPage() {
  const { user } = useAuth();
  const [currentWeekStart, setCurrentWeekStart] = useState(() => getWeekStart(new Date()));
  const [timesheets, setTimesheets] = useState([]);
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [selectedProject, setSelectedProject] = useState('');
  
  // Local state for editing hours
  const [editedEntries, setEditedEntries] = useState({});

  const isAdmin = ['super_admin', 'admin', 'hr'].includes(user?.role);
  const weekDates = useMemo(() => getWeekDates(currentWeekStart), [currentWeekStart]);

  useEffect(() => {
    fetchData();
  }, [currentWeekStart]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [projectsRes, timesheetsRes] = await Promise.all([
        axios.get(`${API}/projects`, { withCredentials: true }),
        axios.get(`${API}/timesheets/week/${formatDate(currentWeekStart)}`, { withCredentials: true })
      ]);
      setProjects(projectsRes.data);
      setTimesheets(timesheetsRes.data.entries || []);
      
      // Initialize edited entries
      const initial = {};
      (timesheetsRes.data.entries || []).forEach(entry => {
        initial[entry.id] = { ...entry };
      });
      setEditedEntries(initial);
    } catch (error) {
      console.error('Failed to fetch data:', error);
      toast.error('Failed to load timesheet data');
    } finally {
      setLoading(false);
    }
  };

  const handlePrevWeek = () => {
    const newDate = new Date(currentWeekStart);
    newDate.setDate(newDate.getDate() - 7);
    setCurrentWeekStart(newDate);
  };

  const handleNextWeek = () => {
    const newDate = new Date(currentWeekStart);
    newDate.setDate(newDate.getDate() + 7);
    setCurrentWeekStart(newDate);
  };

  const handleCurrentWeek = () => {
    setCurrentWeekStart(getWeekStart(new Date()));
  };

  const handleAddProject = async () => {
    if (!selectedProject) {
      toast.error('Please select a project');
      return;
    }

    // Check if project already added this week
    if (timesheets.find(t => t.project_id === selectedProject)) {
      toast.error('This project is already added for this week');
      return;
    }

    setSaving(true);
    try {
      await axios.post(`${API}/timesheets`, {
        project_id: selectedProject,
        week_start_date: formatDate(currentWeekStart),
        monday_hours: 0,
        tuesday_hours: 0,
        wednesday_hours: 0,
        thursday_hours: 0,
        friday_hours: 0,
        saturday_hours: 0,
        sunday_hours: 0
      }, { withCredentials: true });
      
      toast.success('Project added to timesheet');
      setShowAddDialog(false);
      setSelectedProject('');
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to add project');
    }
    setSaving(false);
  };

  const handleHoursChange = (entryId, day, value) => {
    const numValue = Math.max(0, Math.min(24, parseFloat(value) || 0));
    setEditedEntries(prev => ({
      ...prev,
      [entryId]: {
        ...prev[entryId],
        [`${day}_hours`]: numValue
      }
    }));
  };

  const handleSaveEntry = async (entryId) => {
    const entry = editedEntries[entryId];
    if (!entry) return;

    setSaving(true);
    try {
      await axios.post(`${API}/timesheets`, {
        project_id: entry.project_id,
        week_start_date: formatDate(currentWeekStart),
        monday_hours: entry.monday_hours,
        tuesday_hours: entry.tuesday_hours,
        wednesday_hours: entry.wednesday_hours,
        thursday_hours: entry.thursday_hours,
        friday_hours: entry.friday_hours,
        saturday_hours: entry.saturday_hours,
        sunday_hours: entry.sunday_hours,
        notes: entry.notes
      }, { withCredentials: true });
      
      toast.success('Timesheet saved');
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to save timesheet');
    }
    setSaving(false);
  };

  const handleSubmitEntry = async (entryId) => {
    try {
      await axios.put(`${API}/timesheets/${entryId}/submit`, {}, { withCredentials: true });
      toast.success('Timesheet submitted for approval');
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to submit timesheet');
    }
  };

  const handleDeleteEntry = async (entryId) => {
    if (!window.confirm('Are you sure you want to delete this entry?')) return;
    
    try {
      await axios.delete(`${API}/timesheets/${entryId}`, { withCredentials: true });
      toast.success('Entry deleted');
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to delete entry');
    }
  };

  const getStatusBadge = (status) => {
    const styles = {
      draft: 'bg-slate-100 text-slate-800',
      submitted: 'bg-blue-100 text-blue-800',
      approved: 'bg-green-100 text-green-800',
      rejected: 'bg-red-100 text-red-800'
    };
    return <Badge className={styles[status] || styles.draft}>{status || 'Draft'}</Badge>;
  };

  const calculateTotalHours = (entry) => {
    return DAYS.reduce((sum, day) => sum + (entry[`${day}_hours`] || 0), 0);
  };

  const weekTotalHours = Object.values(editedEntries).reduce((sum, entry) => sum + calculateTotalHours(entry), 0);

  // Export functions
  const exportWeekToCSV = () => {
    if (timesheets.length === 0) {
      toast.error('No data to export');
      return;
    }

    const headers = ['Project', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun', 'Total', 'Status'];
    const rows = timesheets.map(t => {
      const entry = editedEntries[t.id] || t;
      return [
        t.project_name,
        entry.monday_hours,
        entry.tuesday_hours,
        entry.wednesday_hours,
        entry.thursday_hours,
        entry.friday_hours,
        entry.saturday_hours,
        entry.sunday_hours,
        calculateTotalHours(entry).toFixed(1),
        t.status
      ];
    });

    const csvContent = [headers, ...rows].map(row => row.join(',')).join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `timesheet_${formatDate(currentWeekStart)}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
    
    toast.success('CSV exported');
  };

  const exportWeekToPDF = () => {
    if (timesheets.length === 0) {
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
    doc.text('Weekly Timesheet', 20, 28);

    // Week info
    doc.setTextColor(0, 0, 0);
    doc.setFontSize(11);
    const weekEnd = new Date(currentWeekStart);
    weekEnd.setDate(weekEnd.getDate() + 6);
    doc.text(`Week: ${formatDate(currentWeekStart)} to ${formatDate(weekEnd)}`, 20, 48);
    doc.text(`Employee: ${user?.name || 'Unknown'}`, 20, 56);
    doc.text(`Total Hours: ${weekTotalHours.toFixed(1)}`, 20, 64);

    // Table
    const tableData = timesheets.map(t => {
      const entry = editedEntries[t.id] || t;
      return [
        t.project_name,
        entry.monday_hours.toString(),
        entry.tuesday_hours.toString(),
        entry.wednesday_hours.toString(),
        entry.thursday_hours.toString(),
        entry.friday_hours.toString(),
        entry.saturday_hours.toString(),
        entry.sunday_hours.toString(),
        calculateTotalHours(entry).toFixed(1),
        t.status
      ];
    });

    doc.autoTable({
      startY: 75,
      head: [['Project', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun', 'Total', 'Status']],
      body: tableData,
      theme: 'striped',
      headStyles: { fillColor: [0, 47, 167] },
      margin: { left: 10, right: 10 },
      styles: { fontSize: 9 },
      columnStyles: {
        0: { cellWidth: 40 },
        9: { cellWidth: 20 }
      }
    });

    // Footer
    doc.setFontSize(9);
    doc.setTextColor(100);
    doc.text(`Generated: ${new Date().toLocaleDateString()}`, 20, 280);

    doc.save(`timesheet_${formatDate(currentWeekStart)}.pdf`);
    toast.success('PDF exported');
  };

  // Filter out projects that are already in this week's timesheet
  const availableProjects = projects.filter(p => !timesheets.find(t => t.project_id === p.id));

  return (
    <div className="animate-fade-in space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-[#0F172A] font-['Chivo']">Timesheet</h1>
          <p className="text-slate-500 mt-1">Track your hours by project</p>
        </div>
        <div className="flex gap-2">
          {timesheets.length > 0 && (
            <>
              <Button variant="outline" onClick={exportWeekToCSV} data-testid="export-csv">
                <Download className="h-4 w-4 mr-2" />
                CSV
              </Button>
              <Button variant="outline" onClick={exportWeekToPDF} data-testid="export-pdf">
                <FileText className="h-4 w-4 mr-2" />
                PDF
              </Button>
            </>
          )}
          <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
            <DialogTrigger asChild>
              <Button className="bg-[#002FA7] hover:bg-[#00227A]" data-testid="add-project-btn">
                <Plus className="h-4 w-4 mr-2" />
                Add Project
              </Button>
            </DialogTrigger>
          <DialogContent className="sm:max-w-[400px]">
            <DialogHeader>
              <DialogTitle className="font-['Chivo']">Add Project to Timesheet</DialogTitle>
              <DialogDescription>
                Select a project to track hours for this week
              </DialogDescription>
            </DialogHeader>
            <div className="py-4">
              <Label>Project</Label>
              <Select value={selectedProject} onValueChange={setSelectedProject}>
                <SelectTrigger className="mt-2" data-testid="select-project">
                  <SelectValue placeholder="Select a project" />
                </SelectTrigger>
                <SelectContent>
                  {availableProjects.length === 0 ? (
                    <SelectItem value="_none" disabled>No projects available</SelectItem>
                  ) : (
                    availableProjects.map(project => (
                      <SelectItem key={project.id} value={project.id}>
                        {project.name} ({project.code})
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
              {projects.length === 0 && (
                <p className="text-sm text-amber-600 mt-2">
                  No projects found. Ask your admin to add projects.
                </p>
              )}
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowAddDialog(false)}>Cancel</Button>
              <Button 
                onClick={handleAddProject}
                disabled={saving || !selectedProject}
                className="bg-[#002FA7] hover:bg-[#00227A]"
                data-testid="confirm-add-project"
              >
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Add Project'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
        </div>
      </div>

      {/* Week Navigation */}
      <Card className="border border-slate-200">
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <Button variant="outline" size="icon" onClick={handlePrevWeek} data-testid="prev-week">
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <div className="flex items-center gap-4">
              <div className="text-center">
                <p className="text-lg font-semibold text-[#0F172A]">
                  {weekDates[0].toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} - {weekDates[6].toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                </p>
                <p className="text-sm text-slate-500">Week starting {formatDate(currentWeekStart)}</p>
              </div>
              <Button variant="outline" size="sm" onClick={handleCurrentWeek} data-testid="current-week">
                <Calendar className="h-4 w-4 mr-1" />
                Today
              </Button>
            </div>
            <Button variant="outline" size="icon" onClick={handleNextWeek} data-testid="next-week">
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Timesheet Grid */}
      <Card className="border border-slate-200">
        <CardHeader className="border-b border-slate-200">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg font-['Chivo'] flex items-center gap-2">
              <Clock className="h-5 w-5" />
              Weekly Hours
            </CardTitle>
            <div className="text-right">
              <p className="text-sm text-slate-500">Total Hours</p>
              <p className="text-2xl font-bold text-[#002FA7]">{weekTotalHours.toFixed(1)}</p>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <div className="p-8 text-center">
              <Loader2 className="h-8 w-8 animate-spin mx-auto text-[#002FA7]" />
            </div>
          ) : timesheets.length === 0 ? (
            <div className="p-8 text-center text-slate-500">
              <Clock className="h-12 w-12 mx-auto mb-4 text-slate-300" />
              <p>No timesheet entries for this week</p>
              <p className="text-sm">Click "Add Project" to start tracking hours</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-slate-50">
                    <TableHead className="font-semibold min-w-[200px]">Project</TableHead>
                    {DAY_LABELS.map((day, idx) => (
                      <TableHead key={day} className="font-semibold text-center w-20">
                        <div>{day}</div>
                        <div className="text-xs font-normal text-slate-400">
                          {weekDates[idx].getDate()}
                        </div>
                      </TableHead>
                    ))}
                    <TableHead className="font-semibold text-center w-20">Total</TableHead>
                    <TableHead className="font-semibold text-center w-28">Status</TableHead>
                    <TableHead className="font-semibold w-32">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {timesheets.map((entry) => {
                    const editedEntry = editedEntries[entry.id] || entry;
                    const total = calculateTotalHours(editedEntry);
                    const isEditable = entry.status === 'draft' || !entry.status;
                    
                    return (
                      <TableRow key={entry.id} data-testid={`timesheet-row-${entry.id}`}>
                        <TableCell>
                          <div>
                            <p className="font-medium text-[#0F172A]">{entry.project_name}</p>
                          </div>
                        </TableCell>
                        {DAYS.map((day) => (
                          <TableCell key={day} className="text-center p-1">
                            <Input
                              type="number"
                              min="0"
                              max="24"
                              step="0.5"
                              value={editedEntry[`${day}_hours`] || ''}
                              onChange={(e) => handleHoursChange(entry.id, day, e.target.value)}
                              disabled={!isEditable}
                              className="w-16 text-center mx-auto h-9"
                              data-testid={`hours-${entry.id}-${day}`}
                            />
                          </TableCell>
                        ))}
                        <TableCell className="text-center">
                          <span className="font-semibold text-[#002FA7]">{total.toFixed(1)}</span>
                        </TableCell>
                        <TableCell className="text-center">
                          {getStatusBadge(entry.status)}
                        </TableCell>
                        <TableCell>
                          {isEditable ? (
                            <div className="flex gap-1">
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleSaveEntry(entry.id)}
                                disabled={saving}
                                data-testid={`save-${entry.id}`}
                              >
                                <Save className="h-3 w-3" />
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                className="text-blue-600"
                                onClick={() => handleSubmitEntry(entry.id)}
                                data-testid={`submit-${entry.id}`}
                              >
                                <Send className="h-3 w-3" />
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                className="text-red-600"
                                onClick={() => handleDeleteEntry(entry.id)}
                                data-testid={`delete-${entry.id}`}
                              >
                                <Trash2 className="h-3 w-3" />
                              </Button>
                            </div>
                          ) : (
                            <span className="text-xs text-slate-400">-</span>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Instructions */}
      <Card className="border border-slate-200 bg-blue-50">
        <CardContent className="p-4">
          <h4 className="font-semibold text-[#002FA7] mb-2">How to use Timesheet</h4>
          <ul className="text-sm text-slate-600 space-y-1 list-disc list-inside">
            <li>Click "Add Project" to add a project to track hours</li>
            <li>Enter hours worked each day (max 24 hours per day)</li>
            <li>Click the save icon to save your progress</li>
            <li>Click the send icon to submit for approval</li>
            <li>Once submitted, you cannot edit until rejected or new week</li>
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
