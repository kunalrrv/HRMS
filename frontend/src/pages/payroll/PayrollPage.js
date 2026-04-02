import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useAuth } from '../../contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../../components/ui/select';
import { Label } from '../../components/ui/label';
import { DollarSign, FileText, Download, Loader2, Calculator } from 'lucide-react';
import { toast } from 'sonner';
import { jsPDF } from 'jspdf';
import 'jspdf-autotable';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

export default function PayrollPage() {
  const { user } = useAuth();
  const [payrolls, setPayrolls] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showGenerateDialog, setShowGenerateDialog] = useState(false);
  const [generating, setGenerating] = useState(false);

  const [newPayroll, setNewPayroll] = useState({
    employee_id: '',
    month: new Date().getMonth() + 1,
    year: new Date().getFullYear()
  });

  const isAdmin = ['super_admin', 'admin', 'hr'].includes(user?.role);
  const months = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [payrollRes, empRes] = await Promise.all([
        axios.get(`${API}/payroll`, { withCredentials: true }),
        isAdmin ? axios.get(`${API}/employees`, { withCredentials: true }) : Promise.resolve({ data: [] })
      ]);
      setPayrolls(payrollRes.data);
      setEmployees(empRes.data);
    } catch (error) {
      console.error('Failed to fetch payroll data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleGeneratePayroll = async (e) => {
    e.preventDefault();
    setGenerating(true);

    try {
      await axios.post(`${API}/payroll/generate`, newPayroll, { withCredentials: true });
      toast.success('Payroll generated successfully!');
      setShowGenerateDialog(false);
      setNewPayroll({ employee_id: '', month: new Date().getMonth() + 1, year: new Date().getFullYear() });
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to generate payroll');
    }

    setGenerating(false);
  };

  const generatePDF = (payroll) => {
    const doc = new jsPDF();
    
    // Header
    doc.setFillColor(0, 47, 167);
    doc.rect(0, 0, 210, 40, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(24);
    doc.setFont('helvetica', 'bold');
    doc.text('TalentOps', 20, 25);
    doc.setFontSize(12);
    doc.setFont('helvetica', 'normal');
    doc.text('Payslip', 170, 25);

    // Reset color
    doc.setTextColor(0, 0, 0);

    // Employee Info
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text('Employee Details', 20, 55);
    doc.setFontSize(11);
    doc.setFont('helvetica', 'normal');
    doc.text(`Name: ${payroll.employee_name}`, 20, 65);
    doc.text(`Pay Period: ${months[payroll.month - 1]} ${payroll.year}`, 20, 73);

    // Earnings Table
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text('Earnings', 20, 90);

    doc.autoTable({
      startY: 95,
      head: [['Component', 'Amount (INR)']],
      body: [
        ['Basic Salary', `₹${payroll.basic.toLocaleString()}`],
        ['House Rent Allowance (HRA)', `₹${payroll.hra.toLocaleString()}`],
        ['Other Allowances', `₹${payroll.allowances.toLocaleString()}`],
        ['Gross Salary', `₹${payroll.gross_salary.toLocaleString()}`],
      ],
      theme: 'striped',
      headStyles: { fillColor: [0, 47, 167] },
      margin: { left: 20, right: 20 }
    });

    // Deductions Table
    const deductionsY = doc.lastAutoTable.finalY + 15;
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text('Deductions', 20, deductionsY);

    doc.autoTable({
      startY: deductionsY + 5,
      head: [['Component', 'Amount (INR)']],
      body: [
        ['Provident Fund (Employee)', `₹${payroll.pf_employee.toLocaleString()}`],
        ['ESI (Employee)', `₹${payroll.esi_employee.toLocaleString()}`],
        ['Professional Tax', `₹${payroll.professional_tax.toLocaleString()}`],
        ['TDS', `₹${payroll.tds.toLocaleString()}`],
        ['Total Deductions', `₹${payroll.total_deductions.toLocaleString()}`],
      ],
      theme: 'striped',
      headStyles: { fillColor: [220, 38, 38] },
      margin: { left: 20, right: 20 }
    });

    // Net Salary
    const netY = doc.lastAutoTable.finalY + 15;
    doc.setFillColor(240, 253, 244);
    doc.rect(20, netY, 170, 25, 'F');
    doc.setFontSize(16);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(22, 163, 74);
    doc.text('Net Salary', 30, netY + 15);
    doc.text(`₹${payroll.net_salary.toLocaleString()}`, 145, netY + 15);

    // Footer
    doc.setTextColor(100, 116, 139);
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.text('This is a computer-generated document and does not require a signature.', 105, 280, { align: 'center' });
    doc.text(`Generated on: ${new Date().toLocaleDateString()}`, 105, 285, { align: 'center' });

    // Save the PDF
    doc.save(`Payslip_${payroll.employee_name}_${months[payroll.month - 1]}_${payroll.year}.pdf`);
    toast.success('Payslip downloaded!');
  };

  return (
    <div className="animate-fade-in space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-[#0F172A] font-['Chivo']">Payroll</h1>
          <p className="text-slate-500 mt-1">Manage salary and generate payslips</p>
        </div>
        {isAdmin && (
          <Dialog open={showGenerateDialog} onOpenChange={setShowGenerateDialog}>
            <DialogTrigger asChild>
              <Button className="bg-[#002FA7] hover:bg-[#00227A]" data-testid="generate-payroll-btn">
                <Calculator className="h-4 w-4 mr-2" />
                Generate Payroll
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[400px]">
              <DialogHeader>
                <DialogTitle className="font-['Chivo']">Generate Payroll</DialogTitle>
                <DialogDescription>
                  Create payroll for an employee
                </DialogDescription>
              </DialogHeader>
              <form onSubmit={handleGeneratePayroll}>
                <div className="grid gap-4 py-4">
                  <div className="space-y-2">
                    <Label>Employee</Label>
                    <Select
                      value={newPayroll.employee_id}
                      onValueChange={(value) => setNewPayroll({ ...newPayroll, employee_id: value })}
                    >
                      <SelectTrigger data-testid="payroll-employee">
                        <SelectValue placeholder="Select employee" />
                      </SelectTrigger>
                      <SelectContent>
                        {employees.map((emp) => (
                          <SelectItem key={emp.id} value={emp.id}>{emp.user_name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Month</Label>
                      <Select
                        value={newPayroll.month.toString()}
                        onValueChange={(value) => setNewPayroll({ ...newPayroll, month: parseInt(value) })}
                      >
                        <SelectTrigger data-testid="payroll-month">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {months.map((month, idx) => (
                            <SelectItem key={idx + 1} value={(idx + 1).toString()}>{month}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>Year</Label>
                      <Select
                        value={newPayroll.year.toString()}
                        onValueChange={(value) => setNewPayroll({ ...newPayroll, year: parseInt(value) })}
                      >
                        <SelectTrigger data-testid="payroll-year">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {[2024, 2025, 2026].map((year) => (
                            <SelectItem key={year} value={year.toString()}>{year}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </div>
                <DialogFooter>
                  <Button type="button" variant="outline" onClick={() => setShowGenerateDialog(false)}>
                    Cancel
                  </Button>
                  <Button 
                    type="submit" 
                    disabled={generating || !newPayroll.employee_id}
                    className="bg-[#002FA7] hover:bg-[#00227A]"
                    data-testid="submit-payroll"
                  >
                    {generating ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Generate'}
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        )}
      </div>

      {/* Payroll Summary Cards for Employees */}
      {!isAdmin && payrolls.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card className="border border-slate-200">
            <CardContent className="p-6">
              <div className="flex items-center gap-3">
                <div className="p-3 bg-green-100 rounded-lg">
                  <DollarSign className="h-6 w-6 text-green-600" />
                </div>
                <div>
                  <p className="text-sm text-slate-500">Latest Net Salary</p>
                  <p className="text-2xl font-bold text-[#0F172A]">
                    ₹{payrolls[0]?.net_salary?.toLocaleString() || 0}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="border border-slate-200">
            <CardContent className="p-6">
              <div className="flex items-center gap-3">
                <div className="p-3 bg-blue-100 rounded-lg">
                  <FileText className="h-6 w-6 text-blue-600" />
                </div>
                <div>
                  <p className="text-sm text-slate-500">Total Payslips</p>
                  <p className="text-2xl font-bold text-[#0F172A]">{payrolls.length}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="border border-slate-200">
            <CardContent className="p-6">
              <div className="flex items-center gap-3">
                <div className="p-3 bg-purple-100 rounded-lg">
                  <Calculator className="h-6 w-6 text-purple-600" />
                </div>
                <div>
                  <p className="text-sm text-slate-500">Latest Period</p>
                  <p className="text-2xl font-bold text-[#0F172A]">
                    {payrolls[0] ? `${months[payrolls[0].month - 1].slice(0, 3)} ${payrolls[0].year}` : '-'}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Payroll List */}
      <Card className="border border-slate-200">
        <CardHeader className="border-b border-slate-200">
          <CardTitle className="text-lg font-['Chivo'] flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Payroll Records
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <div className="p-8 text-center">
              <Loader2 className="h-8 w-8 animate-spin mx-auto text-[#002FA7]" />
            </div>
          ) : payrolls.length === 0 ? (
            <div className="p-8 text-center text-slate-500">
              <DollarSign className="h-12 w-12 mx-auto mb-4 text-slate-300" />
              <p>No payroll records found</p>
              {isAdmin && <p className="text-sm">Generate payroll for employees to get started</p>}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-slate-50">
                    {isAdmin && <TableHead className="font-semibold">Employee</TableHead>}
                    <TableHead className="font-semibold">Period</TableHead>
                    <TableHead className="font-semibold text-right">Gross</TableHead>
                    <TableHead className="font-semibold text-right">Deductions</TableHead>
                    <TableHead className="font-semibold text-right">Net Salary</TableHead>
                    <TableHead className="font-semibold">Status</TableHead>
                    <TableHead className="font-semibold">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {payrolls.map((payroll) => (
                    <TableRow key={payroll.id} data-testid={`payroll-row-${payroll.id}`}>
                      {isAdmin && <TableCell className="font-medium">{payroll.employee_name}</TableCell>}
                      <TableCell>
                        <Badge variant="outline">
                          {months[payroll.month - 1]} {payroll.year}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">₹{payroll.gross_salary.toLocaleString()}</TableCell>
                      <TableCell className="text-right text-red-600">-₹{payroll.total_deductions.toLocaleString()}</TableCell>
                      <TableCell className="text-right font-semibold text-green-600">
                        ₹{payroll.net_salary.toLocaleString()}
                      </TableCell>
                      <TableCell>
                        <Badge className="bg-green-100 text-green-800">{payroll.status}</Badge>
                      </TableCell>
                      <TableCell>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => generatePDF(payroll)}
                          data-testid={`download-payslip-${payroll.id}`}
                        >
                          <Download className="h-4 w-4 mr-1" />
                          PDF
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* India Tax Info Card */}
      <Card className="border border-slate-200 bg-blue-50">
        <CardContent className="p-6">
          <h3 className="font-semibold text-[#002FA7] mb-2">India Payroll Calculations</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm text-slate-600">
            <div>
              <p><strong>PF:</strong> 12% of Basic (max ₹15,000 ceiling)</p>
              <p><strong>ESI:</strong> 0.75% employee + 3.25% employer (if gross ≤ ₹21,000)</p>
            </div>
            <div>
              <p><strong>Professional Tax:</strong> ₹200/month (varies by state)</p>
              <p><strong>TDS:</strong> Based on new tax regime slabs</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
