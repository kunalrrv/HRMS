import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Badge } from '../../components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../../components/ui/tabs';
import {
  ArrowLeft,
  Mail,
  Phone,
  Building2,
  Calendar,
  DollarSign,
  Loader2,
  Save
} from 'lucide-react';
import { toast } from 'sonner';
import { Avatar, AvatarFallback } from '../../components/ui/avatar';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

export default function EmployeeDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [employee, setEmployee] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [salary, setSalary] = useState({ basic: 0, hra: 0, allowances: 0 });

  useEffect(() => {
    fetchEmployee();
  }, [id]);

  const fetchEmployee = async () => {
    try {
      const { data } = await axios.get(`${API}/employees/${id}`, { withCredentials: true });
      setEmployee(data);
      setSalary({
        basic: data.salary_basic || 0,
        hra: data.salary_hra || 0,
        allowances: data.salary_allowances || 0
      });
    } catch (error) {
      toast.error('Failed to fetch employee details');
      navigate('/employees');
    } finally {
      setLoading(false);
    }
  };

  const handleSaveSalary = async () => {
    setSaving(true);
    try {
      await axios.put(`${API}/employees/${id}/salary`, salary, { withCredentials: true });
      toast.success('Salary updated successfully!');
      setEditMode(false);
      fetchEmployee();
    } catch (error) {
      toast.error('Failed to update salary');
    }
    setSaving(false);
  };

  const getInitials = (name) => {
    if (!name) return 'U';
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  };

  const grossSalary = salary.basic + salary.hra + salary.allowances;

  if (loading) {
    return (
      <div className="animate-pulse space-y-6">
        <div className="h-8 w-32 bg-slate-200 rounded" />
        <div className="h-48 bg-slate-200 rounded-lg" />
      </div>
    );
  }

  if (!employee) return null;

  return (
    <div className="animate-fade-in space-y-6">
      {/* Back Button */}
      <Button
        variant="ghost"
        onClick={() => navigate('/employees')}
        className="text-slate-600"
        data-testid="back-to-employees"
      >
        <ArrowLeft className="h-4 w-4 mr-2" />
        Back to Employees
      </Button>

      {/* Employee Header */}
      <Card className="border border-slate-200">
        <CardContent className="p-6">
          <div className="flex flex-col md:flex-row md:items-center gap-6">
            <Avatar className="h-24 w-24">
              <AvatarFallback className="bg-[#002FA7] text-white text-2xl">
                {getInitials(employee.user_name)}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1">
              <h1 className="text-2xl font-bold text-[#0F172A] font-['Chivo']">
                {employee.user_name}
              </h1>
              <p className="text-slate-500">{employee.designation}</p>
              <div className="flex flex-wrap gap-2 mt-3">
                <Badge variant="outline">{employee.department}</Badge>
                <Badge variant="outline" className="bg-blue-50 text-[#002FA7] border-blue-200">
                  {employee.employee_code}
                </Badge>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Tabs */}
      <Tabs defaultValue="info" className="space-y-4">
        <TabsList>
          <TabsTrigger value="info" data-testid="tab-info">Information</TabsTrigger>
          <TabsTrigger value="salary" data-testid="tab-salary">Salary</TabsTrigger>
        </TabsList>

        <TabsContent value="info">
          <Card className="border border-slate-200">
            <CardHeader>
              <CardTitle className="text-lg font-['Chivo']">Personal Information</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <div className="flex items-center gap-3">
                    <Mail className="h-5 w-5 text-slate-400" />
                    <div>
                      <p className="text-sm text-slate-500">Email</p>
                      <p className="font-medium">{employee.user_email}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <Phone className="h-5 w-5 text-slate-400" />
                    <div>
                      <p className="text-sm text-slate-500">Phone</p>
                      <p className="font-medium">{employee.phone || 'Not provided'}</p>
                    </div>
                  </div>
                </div>
                <div className="space-y-4">
                  <div className="flex items-center gap-3">
                    <Building2 className="h-5 w-5 text-slate-400" />
                    <div>
                      <p className="text-sm text-slate-500">Department</p>
                      <p className="font-medium">{employee.department}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <Calendar className="h-5 w-5 text-slate-400" />
                    <div>
                      <p className="text-sm text-slate-500">Date of Joining</p>
                      <p className="font-medium">
                        {new Date(employee.date_of_joining).toLocaleDateString('en-US', {
                          year: 'numeric',
                          month: 'long',
                          day: 'numeric'
                        })}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="salary">
          <Card className="border border-slate-200">
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-lg font-['Chivo']">Salary Structure</CardTitle>
              {!editMode ? (
                <Button
                  variant="outline"
                  onClick={() => setEditMode(true)}
                  data-testid="edit-salary"
                >
                  Edit Salary
                </Button>
              ) : (
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    onClick={() => {
                      setEditMode(false);
                      setSalary({
                        basic: employee.salary_basic || 0,
                        hra: employee.salary_hra || 0,
                        allowances: employee.salary_allowances || 0
                      });
                    }}
                  >
                    Cancel
                  </Button>
                  <Button
                    onClick={handleSaveSalary}
                    disabled={saving}
                    className="bg-[#002FA7] hover:bg-[#00227A]"
                    data-testid="save-salary"
                  >
                    {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
                    Save
                  </Button>
                </div>
              )}
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="space-y-2">
                  <Label>Basic Salary</Label>
                  {editMode ? (
                    <Input
                      type="number"
                      value={salary.basic}
                      onChange={(e) => setSalary({ ...salary, basic: parseFloat(e.target.value) || 0 })}
                      data-testid="salary-basic"
                    />
                  ) : (
                    <p className="text-2xl font-bold text-[#0F172A]">
                      ₹{salary.basic.toLocaleString()}
                    </p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label>HRA</Label>
                  {editMode ? (
                    <Input
                      type="number"
                      value={salary.hra}
                      onChange={(e) => setSalary({ ...salary, hra: parseFloat(e.target.value) || 0 })}
                      data-testid="salary-hra"
                    />
                  ) : (
                    <p className="text-2xl font-bold text-[#0F172A]">
                      ₹{salary.hra.toLocaleString()}
                    </p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label>Allowances</Label>
                  {editMode ? (
                    <Input
                      type="number"
                      value={salary.allowances}
                      onChange={(e) => setSalary({ ...salary, allowances: parseFloat(e.target.value) || 0 })}
                      data-testid="salary-allowances"
                    />
                  ) : (
                    <p className="text-2xl font-bold text-[#0F172A]">
                      ₹{salary.allowances.toLocaleString()}
                    </p>
                  )}
                </div>
              </div>

              <div className="mt-6 pt-6 border-t border-slate-200">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <DollarSign className="h-5 w-5 text-[#002FA7]" />
                    <span className="text-lg font-medium">Gross Salary (Monthly)</span>
                  </div>
                  <span className="text-2xl font-bold text-[#002FA7]">
                    ₹{grossSalary.toLocaleString()}
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
