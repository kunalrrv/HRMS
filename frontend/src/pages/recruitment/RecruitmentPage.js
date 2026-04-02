import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Badge } from '../../components/ui/badge';
import { Textarea } from '../../components/ui/textarea';
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../../components/ui/tabs';
import { Briefcase, Plus, Users, MapPin, Clock, DollarSign, Loader2, GripVertical } from 'lucide-react';
import { toast } from 'sonner';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const stages = [
  { id: 'applied', label: 'Applied', color: 'bg-slate-100 text-slate-800' },
  { id: 'screening', label: 'Screening', color: 'bg-blue-100 text-blue-800' },
  { id: 'interview', label: 'Interview', color: 'bg-purple-100 text-purple-800' },
  { id: 'offer', label: 'Offer', color: 'bg-amber-100 text-amber-800' },
  { id: 'hired', label: 'Hired', color: 'bg-green-100 text-green-800' },
  { id: 'rejected', label: 'Rejected', color: 'bg-red-100 text-red-800' }
];

export default function RecruitmentPage() {
  const [jobs, setJobs] = useState([]);
  const [candidates, setCandidates] = useState([]);
  const [selectedJob, setSelectedJob] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showJobDialog, setShowJobDialog] = useState(false);
  const [showCandidateDialog, setShowCandidateDialog] = useState(false);
  const [saving, setSaving] = useState(false);

  const [newJob, setNewJob] = useState({
    title: '',
    department: '',
    location: '',
    employment_type: 'Full-time',
    description: '',
    requirements: '',
    salary_range_min: '',
    salary_range_max: ''
  });

  const [newCandidate, setNewCandidate] = useState({
    job_id: '',
    name: '',
    email: '',
    phone: ''
  });

  const departments = ['Engineering', 'Product', 'Design', 'Marketing', 'Sales', 'HR', 'Finance', 'Operations'];
  const employmentTypes = ['Full-time', 'Part-time', 'Contract', 'Internship'];

  useEffect(() => {
    fetchJobs();
  }, []);

  useEffect(() => {
    if (selectedJob) {
      fetchCandidates(selectedJob.id);
    }
  }, [selectedJob]);

  const fetchJobs = async () => {
    try {
      const { data } = await axios.get(`${API}/jobs`, { withCredentials: true });
      setJobs(data);
      if (data.length > 0 && !selectedJob) {
        setSelectedJob(data[0]);
      }
    } catch (error) {
      console.error('Failed to fetch jobs:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchCandidates = async (jobId) => {
    try {
      const { data } = await axios.get(`${API}/candidates?job_id=${jobId}`, { withCredentials: true });
      setCandidates(data);
    } catch (error) {
      console.error('Failed to fetch candidates:', error);
    }
  };

  const handleCreateJob = async (e) => {
    e.preventDefault();
    setSaving(true);

    try {
      const payload = {
        ...newJob,
        salary_range_min: newJob.salary_range_min ? parseFloat(newJob.salary_range_min) : null,
        salary_range_max: newJob.salary_range_max ? parseFloat(newJob.salary_range_max) : null
      };
      await axios.post(`${API}/jobs`, payload, { withCredentials: true });
      toast.success('Job posted successfully!');
      setShowJobDialog(false);
      setNewJob({
        title: '', department: '', location: '', employment_type: 'Full-time',
        description: '', requirements: '', salary_range_min: '', salary_range_max: ''
      });
      fetchJobs();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to create job');
    }

    setSaving(false);
  };

  const handleAddCandidate = async (e) => {
    e.preventDefault();
    setSaving(true);

    try {
      await axios.post(`${API}/candidates`, {
        ...newCandidate,
        job_id: selectedJob.id
      }, { withCredentials: true });
      toast.success('Candidate added successfully!');
      setShowCandidateDialog(false);
      setNewCandidate({ job_id: '', name: '', email: '', phone: '' });
      fetchCandidates(selectedJob.id);
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to add candidate');
    }

    setSaving(false);
  };

  const handleStageChange = async (candidateId, newStage) => {
    try {
      await axios.put(`${API}/candidates/${candidateId}/stage`, { stage: newStage }, { withCredentials: true });
      toast.success('Candidate stage updated!');
      fetchCandidates(selectedJob.id);
    } catch (error) {
      toast.error('Failed to update stage');
    }
  };

  const getCandidatesByStage = (stageId) => {
    return candidates.filter(c => c.stage === stageId);
  };

  return (
    <div className="animate-fade-in space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-[#0F172A] font-['Chivo']">Recruitment</h1>
          <p className="text-slate-500 mt-1">Manage job postings and candidates</p>
        </div>
        <Dialog open={showJobDialog} onOpenChange={setShowJobDialog}>
          <DialogTrigger asChild>
            <Button className="bg-[#002FA7] hover:bg-[#00227A]" data-testid="post-job-btn">
              <Plus className="h-4 w-4 mr-2" />
              Post New Job
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[600px]">
            <DialogHeader>
              <DialogTitle className="font-['Chivo']">Post New Job</DialogTitle>
              <DialogDescription>
                Create a new job opening
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleCreateJob}>
              <div className="grid gap-4 py-4 max-h-[60vh] overflow-y-auto">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Job Title *</Label>
                    <Input
                      value={newJob.title}
                      onChange={(e) => setNewJob({ ...newJob, title: e.target.value })}
                      placeholder="e.g., Senior Software Engineer"
                      required
                      data-testid="job-title"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Department *</Label>
                    <Select
                      value={newJob.department}
                      onValueChange={(value) => setNewJob({ ...newJob, department: value })}
                    >
                      <SelectTrigger data-testid="job-department">
                        <SelectValue placeholder="Select department" />
                      </SelectTrigger>
                      <SelectContent>
                        {departments.map((dept) => (
                          <SelectItem key={dept} value={dept}>{dept}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Location *</Label>
                    <Input
                      value={newJob.location}
                      onChange={(e) => setNewJob({ ...newJob, location: e.target.value })}
                      placeholder="e.g., Bangalore, India"
                      required
                      data-testid="job-location"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Employment Type *</Label>
                    <Select
                      value={newJob.employment_type}
                      onValueChange={(value) => setNewJob({ ...newJob, employment_type: value })}
                    >
                      <SelectTrigger data-testid="job-type">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {employmentTypes.map((type) => (
                          <SelectItem key={type} value={type}>{type}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Salary Min (₹)</Label>
                    <Input
                      type="number"
                      value={newJob.salary_range_min}
                      onChange={(e) => setNewJob({ ...newJob, salary_range_min: e.target.value })}
                      placeholder="e.g., 800000"
                      data-testid="job-salary-min"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Salary Max (₹)</Label>
                    <Input
                      type="number"
                      value={newJob.salary_range_max}
                      onChange={(e) => setNewJob({ ...newJob, salary_range_max: e.target.value })}
                      placeholder="e.g., 1500000"
                      data-testid="job-salary-max"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Description *</Label>
                  <Textarea
                    value={newJob.description}
                    onChange={(e) => setNewJob({ ...newJob, description: e.target.value })}
                    placeholder="Job description..."
                    rows={3}
                    required
                    data-testid="job-description"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Requirements *</Label>
                  <Textarea
                    value={newJob.requirements}
                    onChange={(e) => setNewJob({ ...newJob, requirements: e.target.value })}
                    placeholder="Required skills and qualifications..."
                    rows={3}
                    required
                    data-testid="job-requirements"
                  />
                </div>
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setShowJobDialog(false)}>
                  Cancel
                </Button>
                <Button 
                  type="submit" 
                  disabled={saving || !newJob.title || !newJob.department || !newJob.location}
                  className="bg-[#002FA7] hover:bg-[#00227A]"
                  data-testid="submit-job"
                >
                  {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Post Job'}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <Tabs defaultValue="kanban" className="space-y-4">
        <TabsList>
          <TabsTrigger value="kanban" data-testid="tab-kanban">Candidate Pipeline</TabsTrigger>
          <TabsTrigger value="jobs" data-testid="tab-jobs">Job Postings</TabsTrigger>
        </TabsList>

        {/* Job Postings Tab */}
        <TabsContent value="jobs">
          {loading ? (
            <div className="p-8 text-center">
              <Loader2 className="h-8 w-8 animate-spin mx-auto text-[#002FA7]" />
            </div>
          ) : jobs.length === 0 ? (
            <Card className="border border-slate-200">
              <CardContent className="p-8 text-center text-slate-500">
                <Briefcase className="h-12 w-12 mx-auto mb-4 text-slate-300" />
                <p>No job postings yet</p>
                <p className="text-sm">Create your first job opening to start recruiting</p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {jobs.map((job) => (
                <Card 
                  key={job.id} 
                  className={`border cursor-pointer card-hover ${selectedJob?.id === job.id ? 'border-[#002FA7] bg-blue-50/30' : 'border-slate-200'}`}
                  onClick={() => setSelectedJob(job)}
                  data-testid={`job-card-${job.id}`}
                >
                  <CardContent className="p-6">
                    <div className="flex items-start justify-between mb-3">
                      <h3 className="font-semibold text-[#0F172A]">{job.title}</h3>
                      <Badge className={job.is_active ? 'bg-green-100 text-green-800' : 'bg-slate-100 text-slate-800'}>
                        {job.is_active ? 'Active' : 'Closed'}
                      </Badge>
                    </div>
                    <div className="space-y-2 text-sm text-slate-600">
                      <p className="flex items-center gap-2">
                        <Users className="h-4 w-4" />
                        {job.department}
                      </p>
                      <p className="flex items-center gap-2">
                        <MapPin className="h-4 w-4" />
                        {job.location}
                      </p>
                      <p className="flex items-center gap-2">
                        <Clock className="h-4 w-4" />
                        {job.employment_type}
                      </p>
                      {(job.salary_range_min || job.salary_range_max) && (
                        <p className="flex items-center gap-2">
                          <DollarSign className="h-4 w-4" />
                          ₹{job.salary_range_min?.toLocaleString() || '0'} - ₹{job.salary_range_max?.toLocaleString() || '0'}
                        </p>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        {/* Kanban Tab */}
        <TabsContent value="kanban">
          {!selectedJob ? (
            <Card className="border border-slate-200">
              <CardContent className="p-8 text-center text-slate-500">
                <Briefcase className="h-12 w-12 mx-auto mb-4 text-slate-300" />
                <p>Select a job to view the candidate pipeline</p>
              </CardContent>
            </Card>
          ) : (
            <>
              {/* Selected Job Info */}
              <Card className="border border-slate-200 mb-4">
                <CardContent className="p-4 flex items-center justify-between">
                  <div>
                    <h3 className="font-semibold text-[#0F172A]">{selectedJob.title}</h3>
                    <p className="text-sm text-slate-500">{selectedJob.department} • {selectedJob.location}</p>
                  </div>
                  <Dialog open={showCandidateDialog} onOpenChange={setShowCandidateDialog}>
                    <DialogTrigger asChild>
                      <Button className="bg-[#002FA7] hover:bg-[#00227A]" data-testid="add-candidate-btn">
                        <Plus className="h-4 w-4 mr-2" />
                        Add Candidate
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="sm:max-w-[400px]">
                      <DialogHeader>
                        <DialogTitle className="font-['Chivo']">Add Candidate</DialogTitle>
                        <DialogDescription>
                          Add a new candidate to {selectedJob.title}
                        </DialogDescription>
                      </DialogHeader>
                      <form onSubmit={handleAddCandidate}>
                        <div className="grid gap-4 py-4">
                          <div className="space-y-2">
                            <Label>Name *</Label>
                            <Input
                              value={newCandidate.name}
                              onChange={(e) => setNewCandidate({ ...newCandidate, name: e.target.value })}
                              required
                              data-testid="candidate-name"
                            />
                          </div>
                          <div className="space-y-2">
                            <Label>Email *</Label>
                            <Input
                              type="email"
                              value={newCandidate.email}
                              onChange={(e) => setNewCandidate({ ...newCandidate, email: e.target.value })}
                              required
                              data-testid="candidate-email"
                            />
                          </div>
                          <div className="space-y-2">
                            <Label>Phone</Label>
                            <Input
                              value={newCandidate.phone}
                              onChange={(e) => setNewCandidate({ ...newCandidate, phone: e.target.value })}
                              data-testid="candidate-phone"
                            />
                          </div>
                        </div>
                        <DialogFooter>
                          <Button type="button" variant="outline" onClick={() => setShowCandidateDialog(false)}>
                            Cancel
                          </Button>
                          <Button 
                            type="submit" 
                            disabled={saving || !newCandidate.name || !newCandidate.email}
                            className="bg-[#002FA7] hover:bg-[#00227A]"
                            data-testid="submit-candidate"
                          >
                            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Add Candidate'}
                          </Button>
                        </DialogFooter>
                      </form>
                    </DialogContent>
                  </Dialog>
                </CardContent>
              </Card>

              {/* Kanban Board */}
              <div className="flex gap-4 overflow-x-auto pb-4">
                {stages.filter(s => s.id !== 'rejected').map((stage) => (
                  <div key={stage.id} className="flex-shrink-0 w-72">
                    <div className="mb-3 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Badge className={stage.color}>{stage.label}</Badge>
                        <span className="text-sm text-slate-500">
                          ({getCandidatesByStage(stage.id).length})
                        </span>
                      </div>
                    </div>
                    <div className="space-y-3 min-h-[200px] bg-slate-50 rounded-lg p-3">
                      {getCandidatesByStage(stage.id).map((candidate) => (
                        <Card 
                          key={candidate.id} 
                          className="border border-slate-200 bg-white cursor-move"
                          data-testid={`candidate-card-${candidate.id}`}
                        >
                          <CardContent className="p-4">
                            <div className="flex items-start gap-2">
                              <GripVertical className="h-4 w-4 text-slate-400 mt-1 flex-shrink-0" />
                              <div className="flex-1 min-w-0">
                                <p className="font-medium text-[#0F172A] truncate">{candidate.name}</p>
                                <p className="text-sm text-slate-500 truncate">{candidate.email}</p>
                                {candidate.phone && (
                                  <p className="text-xs text-slate-400">{candidate.phone}</p>
                                )}
                                <Select
                                  value={candidate.stage}
                                  onValueChange={(value) => handleStageChange(candidate.id, value)}
                                >
                                  <SelectTrigger className="mt-2 h-8 text-xs" data-testid={`stage-select-${candidate.id}`}>
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {stages.map((s) => (
                                      <SelectItem key={s.id} value={s.id}>{s.label}</SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                      {getCandidatesByStage(stage.id).length === 0 && (
                        <div className="text-center py-8 text-slate-400 text-sm">
                          No candidates
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
