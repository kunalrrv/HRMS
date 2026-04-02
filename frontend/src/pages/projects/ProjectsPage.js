import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Badge } from '../../components/ui/badge';
import { Textarea } from '../../components/ui/textarea';
import { Switch } from '../../components/ui/switch';
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
import { FolderKanban, Plus, Pencil, Trash2, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

export default function ProjectsPage() {
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showDialog, setShowDialog] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editingProject, setEditingProject] = useState(null);
  const [showInactive, setShowInactive] = useState(false);
  
  const [formData, setFormData] = useState({
    name: '',
    code: '',
    description: '',
    is_active: true
  });

  useEffect(() => {
    fetchProjects();
  }, [showInactive]);

  const fetchProjects = async () => {
    try {
      const { data } = await axios.get(`${API}/projects?active_only=${!showInactive}`, { withCredentials: true });
      setProjects(data);
    } catch (error) {
      toast.error('Failed to fetch projects');
    } finally {
      setLoading(false);
    }
  };

  const handleOpenDialog = (project = null) => {
    if (project) {
      setEditingProject(project);
      setFormData({
        name: project.name,
        code: project.code || '',
        description: project.description || '',
        is_active: project.is_active
      });
    } else {
      setEditingProject(null);
      setFormData({
        name: '',
        code: '',
        description: '',
        is_active: true
      });
    }
    setShowDialog(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);

    try {
      if (editingProject) {
        await axios.put(`${API}/projects/${editingProject.id}`, formData, { withCredentials: true });
        toast.success('Project updated');
      } else {
        await axios.post(`${API}/projects`, formData, { withCredentials: true });
        toast.success('Project created');
      }
      setShowDialog(false);
      fetchProjects();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to save project');
    }

    setSaving(false);
  };

  const handleDelete = async (project) => {
    if (!window.confirm(`Are you sure you want to deactivate "${project.name}"?`)) return;
    
    try {
      await axios.delete(`${API}/projects/${project.id}`, { withCredentials: true });
      toast.success('Project deactivated');
      fetchProjects();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to delete project');
    }
  };

  return (
    <div className="animate-fade-in space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-[#0F172A] font-['Chivo']">Projects</h1>
          <p className="text-slate-500 mt-1">Manage projects for timesheet tracking</p>
        </div>
        <Dialog open={showDialog} onOpenChange={setShowDialog}>
          <DialogTrigger asChild>
            <Button 
              className="bg-[#002FA7] hover:bg-[#00227A]" 
              onClick={() => handleOpenDialog()}
              data-testid="add-project-btn"
            >
              <Plus className="h-4 w-4 mr-2" />
              Add Project
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[500px]">
            <DialogHeader>
              <DialogTitle className="font-['Chivo']">
                {editingProject ? 'Edit Project' : 'Create New Project'}
              </DialogTitle>
              <DialogDescription>
                {editingProject ? 'Update project details' : 'Add a new project for timesheet tracking'}
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleSubmit}>
              <div className="grid gap-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Project Name *</Label>
                  <Input
                    id="name"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="e.g., Website Redesign"
                    required
                    data-testid="project-name"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="code">Project Code</Label>
                  <Input
                    id="code"
                    value={formData.code}
                    onChange={(e) => setFormData({ ...formData, code: e.target.value.toUpperCase() })}
                    placeholder="e.g., WEB001"
                    maxLength={10}
                    data-testid="project-code"
                  />
                  <p className="text-xs text-slate-500">Auto-generated if left empty</p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="description">Description</Label>
                  <Textarea
                    id="description"
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    placeholder="Brief description of the project..."
                    rows={3}
                    data-testid="project-description"
                  />
                </div>
                <div className="flex items-center justify-between">
                  <Label htmlFor="is_active">Active</Label>
                  <Switch
                    id="is_active"
                    checked={formData.is_active}
                    onCheckedChange={(checked) => setFormData({ ...formData, is_active: checked })}
                    data-testid="project-active"
                  />
                </div>
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setShowDialog(false)}>
                  Cancel
                </Button>
                <Button 
                  type="submit" 
                  disabled={saving || !formData.name}
                  className="bg-[#002FA7] hover:bg-[#00227A]"
                  data-testid="submit-project"
                >
                  {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : (editingProject ? 'Update' : 'Create')}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Filter */}
      <Card className="border border-slate-200">
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Switch
                id="show-inactive"
                checked={showInactive}
                onCheckedChange={setShowInactive}
              />
              <Label htmlFor="show-inactive" className="text-sm">Show inactive projects</Label>
            </div>
            <p className="text-sm text-slate-500">{projects.length} project(s)</p>
          </div>
        </CardContent>
      </Card>

      {/* Projects Table */}
      <Card className="border border-slate-200">
        <CardHeader className="border-b border-slate-200">
          <CardTitle className="text-lg font-['Chivo'] flex items-center gap-2">
            <FolderKanban className="h-5 w-5" />
            All Projects
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <div className="p-8 text-center">
              <Loader2 className="h-8 w-8 animate-spin mx-auto text-[#002FA7]" />
            </div>
          ) : projects.length === 0 ? (
            <div className="p-8 text-center text-slate-500">
              <FolderKanban className="h-12 w-12 mx-auto mb-4 text-slate-300" />
              <p>No projects found</p>
              <p className="text-sm">Create your first project to enable timesheet tracking</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="bg-slate-50">
                  <TableHead className="font-semibold">Project Name</TableHead>
                  <TableHead className="font-semibold">Code</TableHead>
                  <TableHead className="font-semibold">Description</TableHead>
                  <TableHead className="font-semibold">Status</TableHead>
                  <TableHead className="font-semibold">Created</TableHead>
                  <TableHead className="font-semibold">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {projects.map((project) => (
                  <TableRow key={project.id} data-testid={`project-row-${project.id}`}>
                    <TableCell className="font-medium text-[#0F172A]">{project.name}</TableCell>
                    <TableCell>
                      <Badge variant="outline">{project.code}</Badge>
                    </TableCell>
                    <TableCell className="max-w-[200px] truncate text-slate-600">
                      {project.description || '-'}
                    </TableCell>
                    <TableCell>
                      <Badge className={project.is_active ? 'bg-green-100 text-green-800' : 'bg-slate-100 text-slate-800'}>
                        {project.is_active ? 'Active' : 'Inactive'}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-slate-600">
                      {new Date(project.created_at).toLocaleDateString()}
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleOpenDialog(project)}
                          data-testid={`edit-project-${project.id}`}
                        >
                          <Pencil className="h-3 w-3" />
                        </Button>
                        {project.is_active && (
                          <Button
                            size="sm"
                            variant="outline"
                            className="text-red-600"
                            onClick={() => handleDelete(project)}
                            data-testid={`delete-project-${project.id}`}
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
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
    </div>
  );
}
