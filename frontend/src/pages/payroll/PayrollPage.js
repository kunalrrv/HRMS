import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useAuth } from '../../contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Badge } from '../../components/ui/badge';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '../../components/ui/table';
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger, DialogFooter,
} from '../../components/ui/dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '../../components/ui/select';
import { Label } from '../../components/ui/label';
import { DollarSign, FileText, Download, Loader2, Calculator, Users } from 'lucide-react';
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
  const [showBulkDialog, setShowBulkDialog] = useState(false);
  const [generating, setGenerating] = useState(false);

  const [newPayroll, setNewPayroll] = useState({
    employee_id: '',
    month: new Date().getMonth() + 1,
    year: new Date().getFullYear()
  });
  const [bulkPayroll, setBulkPayroll] = useState({
    month: new Date().getMonth() + 1,
    year: new Date().getFullYear()
  });

  const isAdmin = ['super_admin', 'admin', 'hr'].includes(user?.role);
  const months = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];

  useEffect(() => { fetchData(); }, []);

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

  const handleBulkGenerate = async (e) => {
    e.preventDefault();
    setGenerating(true);
    try {
      const { data } = await axios.post(`${API}/payroll/generate-bulk`, bulkPayroll, { withCredentials: true });
      toast.success(`Generated ${data.generated} payrolls (${data.skipped} skipped)`);
      setShowBulkDialog(false);
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to generate bulk payroll');
    }
    setGenerating(false);
  };

  const fmt = (v) => `$${(v || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  const generatePDF = (payroll) => {
    const doc = new jsPDF();

    doc.setFillColor(0, 47, 167);
    doc.rect(0, 0, 210, 40, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(24);
    doc.setFont('helvetica', 'bold');
    doc.text('TalentOps', 20, 25);
    doc.setFontSize(12);
    doc.setFont('helvetica', 'normal');
    doc.text('Pay Stub', 170, 25);

    doc.setTextColor(0, 0, 0);
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text('Employee Details', 20, 55);
    doc.setFontSize(11);
    doc.setFont('helvetica', 'normal');
    doc.text(`Name: ${payroll.employee_name}`, 20, 65);
    doc.text(`Pay Period: ${months[payroll.month - 1]} ${payroll.year}`, 20, 73);
    doc.text(`State: ${payroll.state_code || 'N/A'}`, 20, 81);

    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text('Earnings', 20, 98);

    doc.autoTable({
      startY: 103,
      head: [['Component', 'Amount (USD)']],
      body: [
        ['Base Salary', fmt(payroll.basic)],
        ['Housing Allowance', fmt(payroll.hra)],
        ['Other Allowances', fmt(payroll.allowances)],
        ['Gross Pay', fmt(payroll.gross_salary)],
      ],
      theme: 'striped',
      headStyles: { fillColor: [0, 47, 167] },
      margin: { left: 20, right: 20 }
    });

    const dedY = doc.lastAutoTable.finalY + 15;
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text('Deductions', 20, dedY);

    doc.autoTable({
      startY: dedY + 5,
      head: [['Component', 'Amount (USD)']],
      body: [
        ['Federal Income Tax', fmt(payroll.federal_tax)],
        [`State Tax (${payroll.state_code || 'N/A'})`, fmt(payroll.state_tax)],
        ['Social Security (6.2%)', fmt(payroll.social_security_employee)],
        ['Medicare (1.45%)', fmt(payroll.medicare_employee)],
        ['Total Deductions', fmt(payroll.total_deductions)],
      ],
      theme: 'striped',
      headStyles: { fillColor: [220, 38, 38] },
      margin: { left: 20, right: 20 }
    });

    const netY = doc.lastAutoTable.finalY + 15;
    doc.setFillColor(240, 253, 244);
    doc.rect(20, netY, 170, 25, 'F');
    doc.setFontSize(16);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(22, 163, 74);
    doc.text('Net Pay', 30, netY + 15);
    doc.text(fmt(payroll.net_salary), 140, netY + 15);

    doc.setTextColor(100, 116, 139);
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.text('This is a computer-generated document and does not require a signature.', 105, 280, { align: 'center' });
    doc.text(`Generated on: ${new Date().toLocaleDateString()}`, 105, 285, { align: 'center' });

    doc.save(`PayStub_${payroll.employee_name}_${months[payroll.month - 1]}_${payroll.year}.pdf`);
    toast.success('Pay stub downloaded!');
  };

  return (
    <div className="animate-fade-in space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-[#0F172A] dark:text-white font-['Chivo']">Payroll</h1>
          <p className="text-slate-500 dark:text-slate-400 mt-1">Manage salary and generate pay stubs (US)</p>
        </div>
        {isAdmin && (
          <div className="flex gap-2">
            <Dialog open={showBulkDialog} onOpenChange={setShowBulkDialog}>
              <DialogTrigger asChild>
                <Button variant="outline" data-testid="bulk-payroll-btn" className="dark:border-slate-600 dark:text-slate-200">
                  <Users className="h-4 w-4 mr-2" />
                  Generate All
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-[400px] dark:bg-slate-800 dark:border-slate-700">
                <DialogHeader>
                  <DialogTitle className="font-['Chivo'] dark:text-white">Bulk Payroll Generation</DialogTitle>
                  <DialogDescription className="dark:text-slate-400">Generate payroll for all employees at once</DialogDescription>
                </DialogHeader>
                <form onSubmit={handleBulkGenerate}>
                  <div className="grid grid-cols-2 gap-4 py-4">
                    <div className="space-y-2">
                      <Label className="dark:text-slate-200">Month</Label>
                      <Select value={bulkPayroll.month.toString()} onValueChange={(v) => setBulkPayroll({ ...bulkPayroll, month: parseInt(v) })}>
                        <SelectTrigger data-testid="bulk-month"><SelectValue /></SelectTrigger>
                        <SelectContent>{months.map((m, i) => <SelectItem key={i + 1} value={(i + 1).toString()}>{m}</SelectItem>)}</SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label className="dark:text-slate-200">Year</Label>
                      <Select value={bulkPayroll.year.toString()} onValueChange={(v) => setBulkPayroll({ ...bulkPayroll, year: parseInt(v) })}>
                        <SelectTrigger data-testid="bulk-year"><SelectValue /></SelectTrigger>
                        <SelectContent>{[2024, 2025, 2026].map(y => <SelectItem key={y} value={y.toString()}>{y}</SelectItem>)}</SelectContent>
                      </Select>
                    </div>
                  </div>
                  <DialogFooter>
                    <Button type="button" variant="outline" onClick={() => setShowBulkDialog(false)}>Cancel</Button>
                    <Button type="submit" disabled={generating} className="bg-[#002FA7] hover:bg-[#00227A]" data-testid="submit-bulk-payroll">
                      {generating ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Generate All'}
                    </Button>
                  </DialogFooter>
                </form>
              </DialogContent>
            </Dialog>

            <Dialog open={showGenerateDialog} onOpenChange={setShowGenerateDialog}>
              <DialogTrigger asChild>
                <Button className="bg-[#002FA7] hover:bg-[#00227A]" data-testid="generate-payroll-btn">
                  <Calculator className="h-4 w-4 mr-2" />
                  Generate Payroll
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-[400px] dark:bg-slate-800 dark:border-slate-700">
                <DialogHeader>
                  <DialogTitle className="font-['Chivo'] dark:text-white">Generate Payroll</DialogTitle>
                  <DialogDescription className="dark:text-slate-400">Create payroll for an employee</DialogDescription>
                </DialogHeader>
                <form onSubmit={handleGeneratePayroll}>
                  <div className="grid gap-4 py-4">
                    <div className="space-y-2">
                      <Label className="dark:text-slate-200">Employee</Label>
                      <Select value={newPayroll.employee_id} onValueChange={(v) => setNewPayroll({ ...newPayroll, employee_id: v })}>
                        <SelectTrigger data-testid="payroll-employee"><SelectValue placeholder="Select employee" /></SelectTrigger>
                        <SelectContent>{employees.map(emp => <SelectItem key={emp.id} value={emp.id}>{emp.user_name}</SelectItem>)}</SelectContent>
                      </Select>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label className="dark:text-slate-200">Month</Label>
                        <Select value={newPayroll.month.toString()} onValueChange={(v) => setNewPayroll({ ...newPayroll, month: parseInt(v) })}>
                          <SelectTrigger data-testid="payroll-month"><SelectValue /></SelectTrigger>
                          <SelectContent>{months.map((m, i) => <SelectItem key={i + 1} value={(i + 1).toString()}>{m}</SelectItem>)}</SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label className="dark:text-slate-200">Year</Label>
                        <Select value={newPayroll.year.toString()} onValueChange={(v) => setNewPayroll({ ...newPayroll, year: parseInt(v) })}>
                          <SelectTrigger data-testid="payroll-year"><SelectValue /></SelectTrigger>
                          <SelectContent>{[2024, 2025, 2026].map(y => <SelectItem key={y} value={y.toString()}>{y}</SelectItem>)}</SelectContent>
                        </Select>
                      </div>
                    </div>
                  </div>
                  <DialogFooter>
                    <Button type="button" variant="outline" onClick={() => setShowGenerateDialog(false)}>Cancel</Button>
                    <Button type="submit" disabled={generating || !newPayroll.employee_id} className="bg-[#002FA7] hover:bg-[#00227A]" data-testid="submit-payroll">
                      {generating ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Generate'}
                    </Button>
                  </DialogFooter>
                </form>
              </DialogContent>
            </Dialog>
          </div>
        )}
      </div>

      {!isAdmin && payrolls.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card className="border border-slate-200 dark:border-slate-700 dark:bg-slate-800">
            <CardContent className="p-6">
              <div className="flex items-center gap-3">
                <div className="p-3 bg-green-100 dark:bg-green-900/30 rounded-lg">
                  <DollarSign className="h-6 w-6 text-green-600" />
                </div>
                <div>
                  <p className="text-sm text-slate-500 dark:text-slate-400">Latest Net Pay</p>
                  <p className="text-2xl font-bold text-[#0F172A] dark:text-white">{fmt(payrolls[0]?.net_salary)}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="border border-slate-200 dark:border-slate-700 dark:bg-slate-800">
            <CardContent className="p-6">
              <div className="flex items-center gap-3">
                <div className="p-3 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
                  <FileText className="h-6 w-6 text-blue-600" />
                </div>
                <div>
                  <p className="text-sm text-slate-500 dark:text-slate-400">Total Pay Stubs</p>
                  <p className="text-2xl font-bold text-[#0F172A] dark:text-white">{payrolls.length}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="border border-slate-200 dark:border-slate-700 dark:bg-slate-800">
            <CardContent className="p-6">
              <div className="flex items-center gap-3">
                <div className="p-3 bg-purple-100 dark:bg-purple-900/30 rounded-lg">
                  <Calculator className="h-6 w-6 text-purple-600" />
                </div>
                <div>
                  <p className="text-sm text-slate-500 dark:text-slate-400">Latest Period</p>
                  <p className="text-2xl font-bold text-[#0F172A] dark:text-white">
                    {payrolls[0] ? `${months[payrolls[0].month - 1].slice(0, 3)} ${payrolls[0].year}` : '-'}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      <Card className="border border-slate-200 dark:border-slate-700 dark:bg-slate-800">
        <CardHeader className="border-b border-slate-200 dark:border-slate-700">
          <CardTitle className="text-lg font-['Chivo'] flex items-center gap-2 dark:text-white">
            <FileText className="h-5 w-5" />
            Payroll Records
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <div className="p-8 text-center"><Loader2 className="h-8 w-8 animate-spin mx-auto text-[#002FA7]" /></div>
          ) : payrolls.length === 0 ? (
            <div className="p-8 text-center text-slate-500 dark:text-slate-400">
              <DollarSign className="h-12 w-12 mx-auto mb-4 text-slate-300 dark:text-slate-600" />
              <p>No payroll records found</p>
              {isAdmin && <p className="text-sm">Generate payroll for employees to get started</p>}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-slate-50 dark:bg-slate-700/50">
                    {isAdmin && <TableHead className="font-semibold">Employee</TableHead>}
                    <TableHead className="font-semibold">Period</TableHead>
                    <TableHead className="font-semibold">State</TableHead>
                    <TableHead className="font-semibold text-right">Gross</TableHead>
                    <TableHead className="font-semibold text-right">Fed Tax</TableHead>
                    <TableHead className="font-semibold text-right">State Tax</TableHead>
                    <TableHead className="font-semibold text-right">SS + Med</TableHead>
                    <TableHead className="font-semibold text-right">Net Pay</TableHead>
                    <TableHead className="font-semibold">Status</TableHead>
                    <TableHead className="font-semibold">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {payrolls.map((p) => (
                    <TableRow key={p.id} data-testid={`payroll-row-${p.id}`}>
                      {isAdmin && <TableCell className="font-medium dark:text-slate-200">{p.employee_name}</TableCell>}
                      <TableCell><Badge variant="outline" className="dark:border-slate-600 dark:text-slate-300">{months[p.month - 1]} {p.year}</Badge></TableCell>
                      <TableCell><Badge variant="outline" className="dark:border-slate-600 dark:text-slate-300">{p.state_code || '-'}</Badge></TableCell>
                      <TableCell className="text-right dark:text-slate-200">{fmt(p.gross_salary)}</TableCell>
                      <TableCell className="text-right text-red-600 dark:text-red-400">{fmt(p.federal_tax)}</TableCell>
                      <TableCell className="text-right text-red-600 dark:text-red-400">{fmt(p.state_tax)}</TableCell>
                      <TableCell className="text-right text-red-600 dark:text-red-400">{fmt(p.social_security_employee + p.medicare_employee)}</TableCell>
                      <TableCell className="text-right font-semibold text-green-600 dark:text-green-400">{fmt(p.net_salary)}</TableCell>
                      <TableCell><Badge className="bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400">{p.status}</Badge></TableCell>
                      <TableCell>
                        <Button size="sm" variant="outline" onClick={() => generatePDF(p)} data-testid={`download-payslip-${p.id}`} className="dark:border-slate-600 dark:text-slate-200">
                          <Download className="h-4 w-4 mr-1" /> PDF
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

      <Card className="border border-slate-200 dark:border-slate-700 bg-blue-50 dark:bg-slate-800">
        <CardContent className="p-6">
          <h3 className="font-semibold text-[#002FA7] dark:text-blue-400 mb-2">US Payroll Calculations</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm text-slate-600 dark:text-slate-400">
            <div>
              <p><strong>Federal Tax:</strong> Progressive brackets (10%&ndash;37%)</p>
              <p><strong>Social Security:</strong> 6.2% employee + 6.2% employer (wage base $168,600)</p>
            </div>
            <div>
              <p><strong>Medicare:</strong> 1.45% + 0.9% additional over $200k</p>
              <p><strong>State Tax:</strong> Configurable per employee (varies by state)</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
