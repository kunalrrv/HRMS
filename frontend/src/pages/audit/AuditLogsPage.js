import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Badge } from '../../components/ui/badge';
import { Button } from '../../components/ui/button';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '../../components/ui/table';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '../../components/ui/select';
import { ScrollText, Loader2, ChevronLeft, ChevronRight } from 'lucide-react';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const ACTION_COLORS = {
  CREATE: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
  UPDATE: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400',
  DELETE: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
  GENERATE: 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400',
  APPROVE: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400',
  REJECT: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
  UPGRADE: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400',
};

export default function AuditLogsPage() {
  const [logs, setLogs] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [filterAction, setFilterAction] = useState('all');
  const [filterResource, setFilterResource] = useState('all');

  useEffect(() => { fetchLogs(); }, [page, filterAction, filterResource]);

  const fetchLogs = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: page.toString(), limit: '25' });
      if (filterAction !== 'all') params.set('action', filterAction);
      if (filterResource !== 'all') params.set('resource_type', filterResource);
      const { data } = await axios.get(`${API}/audit-logs?${params}`, { withCredentials: true });
      setLogs(data.logs);
      setTotal(data.total);
      setPages(data.pages);
    } catch (err) {
      console.error('Failed to fetch audit logs:', err);
    }
    setLoading(false);
  };

  const formatTimestamp = (ts) => {
    if (!ts) return '-';
    const d = new Date(ts);
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) +
      ' ' + d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div className="animate-fade-in space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-[#0F172A] dark:text-white font-['Chivo']">Audit Logs</h1>
        <p className="text-slate-500 dark:text-slate-400 mt-1">Track all actions across your organization</p>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <Select value={filterAction} onValueChange={(v) => { setFilterAction(v); setPage(1); }}>
          <SelectTrigger className="w-full sm:w-[180px] dark:border-slate-600 dark:bg-slate-800" data-testid="filter-action">
            <SelectValue placeholder="Filter by action" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Actions</SelectItem>
            <SelectItem value="CREATE">Create</SelectItem>
            <SelectItem value="UPDATE">Update</SelectItem>
            <SelectItem value="DELETE">Delete</SelectItem>
            <SelectItem value="GENERATE">Generate</SelectItem>
            <SelectItem value="APPROVE">Approve</SelectItem>
            <SelectItem value="REJECT">Reject</SelectItem>
            <SelectItem value="UPGRADE">Upgrade</SelectItem>
          </SelectContent>
        </Select>
        <Select value={filterResource} onValueChange={(v) => { setFilterResource(v); setPage(1); }}>
          <SelectTrigger className="w-full sm:w-[180px] dark:border-slate-600 dark:bg-slate-800" data-testid="filter-resource">
            <SelectValue placeholder="Filter by resource" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Resources</SelectItem>
            <SelectItem value="employee">Employee</SelectItem>
            <SelectItem value="leave">Leave</SelectItem>
            <SelectItem value="payroll">Payroll</SelectItem>
            <SelectItem value="subscription">Subscription</SelectItem>
          </SelectContent>
        </Select>
        <div className="flex-1" />
        <Badge variant="outline" className="self-center dark:border-slate-600 dark:text-slate-300">{total} total events</Badge>
      </div>

      {/* Table */}
      <Card className="border border-slate-200 dark:border-slate-700 dark:bg-slate-800">
        <CardHeader className="border-b border-slate-200 dark:border-slate-700">
          <CardTitle className="text-lg font-['Chivo'] dark:text-white flex items-center gap-2">
            <ScrollText className="h-5 w-5" /> Activity Log
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <div className="p-8 text-center"><Loader2 className="h-8 w-8 animate-spin mx-auto text-[#002FA7]" /></div>
          ) : logs.length === 0 ? (
            <div className="p-8 text-center text-slate-500 dark:text-slate-400">
              <ScrollText className="h-12 w-12 mx-auto mb-4 text-slate-300 dark:text-slate-600" />
              <p>No audit logs found</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-slate-50 dark:bg-slate-700/50">
                    <TableHead className="font-semibold">Timestamp</TableHead>
                    <TableHead className="font-semibold">User</TableHead>
                    <TableHead className="font-semibold">Action</TableHead>
                    <TableHead className="font-semibold">Resource</TableHead>
                    <TableHead className="font-semibold">Details</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {logs.map((log) => (
                    <TableRow key={log.id} data-testid={`audit-row-${log.id}`}>
                      <TableCell className="text-sm text-slate-600 dark:text-slate-300 whitespace-nowrap">{formatTimestamp(log.timestamp)}</TableCell>
                      <TableCell className="font-medium dark:text-slate-200 max-w-[160px] truncate">{log.user_email}</TableCell>
                      <TableCell>
                        <Badge className={ACTION_COLORS[log.action] || 'bg-slate-100 text-slate-800'}>{log.action}</Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="capitalize dark:border-slate-600 dark:text-slate-300">{log.resource_type}</Badge>
                      </TableCell>
                      <TableCell className="text-sm text-slate-600 dark:text-slate-400 max-w-[300px] truncate">{log.details || '-'}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Pagination */}
      {pages > 1 && (
        <div className="flex items-center justify-center gap-4">
          <Button variant="outline" size="sm" disabled={page === 1} onClick={() => setPage(p => p - 1)} className="dark:border-slate-600">
            <ChevronLeft className="h-4 w-4 mr-1" /> Previous
          </Button>
          <span className="text-sm text-slate-600 dark:text-slate-400">Page {page} of {pages}</span>
          <Button variant="outline" size="sm" disabled={page === pages} onClick={() => setPage(p => p + 1)} className="dark:border-slate-600">
            Next <ChevronRight className="h-4 w-4 ml-1" />
          </Button>
        </div>
      )}
    </div>
  );
}
