import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Badge } from '../../components/ui/badge';
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
import { Label } from '../../components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../components/ui/select';
import { Plus, Search, Users, Mail, Phone, Building2, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { Avatar, AvatarFallback } from '../../components/ui/avatar';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

export default function EmployeesPage() {
  const navigate = useNavigate();
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [departmentFilter, setDepartmentFilter] = useState('all');
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [addingEmployee, setAddingEmployee] = useState(false);
  
  const [newUser, setNewUser] = useState({
    name: '',
    email: '',
    password: '',
    department: '',
    designation: '',
    date_of_joining: new Date().toISOString().split('T')[0],
    phone: ''
  });

  const departments = ['Engineering', 'Product', 'Design', 'Marketing', 'Sales', 'HR', 'Finance', 'Operations'];

  useEffect(() => {
    fetchEmployees();
  }, [departmentFilter, searchQuery]);

  const fetchEmployees = async () => {
    try {
      let url = `${API}/employees`;
      const params = new URLSearchParams();
      if (departmentFilter !== 'all') params.append('department', departmentFilter);
      if (searchQuery) params.append('search', searchQuery);
      if (params.toString()) url += `?${params.toString()}`;

      const { data } = await axios.get(url, { withCredentials: true });
      setEmployees(data);
    } catch (error) {
      toast.error('Failed to fetch employees');
    } finally {
      setLoading(false);
    }
  };

  const handleAddEmployee = async (e) => {
    e.preventDefault();
    setAddingEmployee(true);

    try {
      // First register the user
      const registerRes = await axios.post(`${API}/auth/register`, {
        name: newUser.name,
        email: newUser.email,
        password: newUser.password,
        role: 'employee'
      }, { withCredentials: true });

      // Then create employee record
      await axios.post(`${API}/employees`, {
        user_id: registerRes.data.id,
        department: newUser.department,
        designation: newUser.designation,
        date_of_joining: newUser.date_of_joining,
        phone: newUser.phone
      }, { withCredentials: true });

      toast.success('Employee added successfully!');
      setShowAddDialog(false);
      setNewUser({
        name: '',
        email: '',
        password: '',
        department: '',
        designation: '',
        date_of_joining: new Date().toISOString().split('T')[0],
        phone: ''
      });
      fetchEmployees();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to add employee');
    }

    setAddingEmployee(false);
  };

  const getInitials = (name) => {
    if (!name) return 'U';
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  };

  const filteredEmployees = employees;

  return (
    <div className="animate-fade-in space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-[#0F172A] font-['Chivo']">Employees</h1>
          <p className="text-slate-500 mt-1">Manage your team members</p>
        </div>
        <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
          <DialogTrigger asChild>
            <Button className="bg-[#002FA7] hover:bg-[#00227A]" data-testid="add-employee-btn">
              <Plus className="h-4 w-4 mr-2" />
              Add Employee
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[500px]">
            <DialogHeader>
              <DialogTitle className="font-['Chivo']">Add New Employee</DialogTitle>
              <DialogDescription>
                Create a new employee account and profile
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleAddEmployee}>
              <div className="grid gap-4 py-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="name">Full Name *</Label>
                    <Input
                      id="name"
                      value={newUser.name}
                      onChange={(e) => setNewUser({ ...newUser, name: e.target.value })}
                      required
                      data-testid="employee-name"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="email">Email *</Label>
                    <Input
                      id="email"
                      type="email"
                      value={newUser.email}
                      onChange={(e) => setNewUser({ ...newUser, email: e.target.value })}
                      required
                      data-testid="employee-email"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="password">Password *</Label>
                    <Input
                      id="password"
                      type="password"
                      value={newUser.password}
                      onChange={(e) => setNewUser({ ...newUser, password: e.target.value })}
                      required
                      data-testid="employee-password"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="phone">Phone</Label>
                    <Input
                      id="phone"
                      value={newUser.phone}
                      onChange={(e) => setNewUser({ ...newUser, phone: e.target.value })}
                      data-testid="employee-phone"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="department">Department *</Label>
                    <Select
                      value={newUser.department}
                      onValueChange={(value) => setNewUser({ ...newUser, department: value })}
                    >
                      <SelectTrigger data-testid="employee-department">
                        <SelectValue placeholder="Select department" />
                      </SelectTrigger>
                      <SelectContent>
                        {departments.map((dept) => (
                          <SelectItem key={dept} value={dept}>{dept}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="designation">Designation *</Label>
                    <Input
                      id="designation"
                      value={newUser.designation}
                      onChange={(e) => setNewUser({ ...newUser, designation: e.target.value })}
                      required
                      data-testid="employee-designation"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="doj">Date of Joining *</Label>
                  <Input
                    id="doj"
                    type="date"
                    value={newUser.date_of_joining}
                    onChange={(e) => setNewUser({ ...newUser, date_of_joining: e.target.value })}
                    required
                    data-testid="employee-doj"
                  />
                </div>
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setShowAddDialog(false)}>
                  Cancel
                </Button>
                <Button 
                  type="submit" 
                  disabled={addingEmployee || !newUser.name || !newUser.email || !newUser.password || !newUser.department || !newUser.designation}
                  className="bg-[#002FA7] hover:bg-[#00227A]"
                  data-testid="submit-employee"
                >
                  {addingEmployee ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Add Employee'}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Filters */}
      <Card className="border border-slate-200">
        <CardContent className="p-4">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <Input
                placeholder="Search by name or email..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
                data-testid="search-employees"
              />
            </div>
            <Select value={departmentFilter} onValueChange={setDepartmentFilter}>
              <SelectTrigger className="w-full sm:w-[200px]" data-testid="filter-department">
                <SelectValue placeholder="All Departments" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Departments</SelectItem>
                {departments.map((dept) => (
                  <SelectItem key={dept} value={dept}>{dept}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Employee List */}
      <Card className="border border-slate-200">
        <CardHeader className="border-b border-slate-200">
          <CardTitle className="text-lg font-['Chivo'] flex items-center gap-2">
            <Users className="h-5 w-5" />
            Team Directory ({filteredEmployees.length})
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <div className="p-8 text-center">
              <Loader2 className="h-8 w-8 animate-spin mx-auto text-[#002FA7]" />
            </div>
          ) : filteredEmployees.length === 0 ? (
            <div className="p-8 text-center text-slate-500">
              <Users className="h-12 w-12 mx-auto mb-4 text-slate-300" />
              <p>No employees found</p>
              <p className="text-sm">Add your first team member to get started</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-slate-50">
                    <TableHead className="font-semibold">Employee</TableHead>
                    <TableHead className="font-semibold">Department</TableHead>
                    <TableHead className="font-semibold">Designation</TableHead>
                    <TableHead className="font-semibold">Contact</TableHead>
                    <TableHead className="font-semibold">Joined</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredEmployees.map((emp) => (
                    <TableRow 
                      key={emp.id} 
                      className="cursor-pointer hover:bg-slate-50"
                      onClick={() => navigate(`/employees/${emp.id}`)}
                      data-testid={`employee-row-${emp.id}`}
                    >
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <Avatar className="h-10 w-10">
                            <AvatarFallback className="bg-[#002FA7] text-white">
                              {getInitials(emp.user_name)}
                            </AvatarFallback>
                          </Avatar>
                          <div>
                            <p className="font-medium text-[#0F172A]">{emp.user_name}</p>
                            <p className="text-sm text-slate-500">{emp.employee_code}</p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="font-normal">
                          {emp.department}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-slate-600">{emp.designation}</TableCell>
                      <TableCell>
                        <div className="space-y-1">
                          <p className="text-sm flex items-center gap-1 text-slate-600">
                            <Mail className="h-3 w-3" />
                            {emp.user_email}
                          </p>
                          {emp.phone && (
                            <p className="text-sm flex items-center gap-1 text-slate-600">
                              <Phone className="h-3 w-3" />
                              {emp.phone}
                            </p>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-slate-600">
                        {new Date(emp.date_of_joining).toLocaleDateString()}
                      </TableCell>
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
