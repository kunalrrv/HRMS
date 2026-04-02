import React, { useState } from 'react';
import { NavLink, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { useTheme } from '../../contexts/ThemeContext';
import {
  LayoutDashboard, Users, Clock, Calendar as CalendarIcon, DollarSign, Briefcase,
  Settings, LogOut, Menu, X, Building2, CreditCard, ChevronDown,
  ClipboardList, FolderKanban, ClipboardCheck, Moon, Sun, CalendarDays, UserCircle,
  Lock, ScrollText
} from 'lucide-react';
import { usePlan } from '../../contexts/PlanContext';
import { Button } from '../ui/button';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from '../ui/dropdown-menu';
import { Avatar, AvatarFallback } from '../ui/avatar';

const navItems = [
  { path: '/dashboard', label: 'Dashboard', icon: LayoutDashboard, roles: ['super_admin', 'admin', 'hr', 'employee'] },
  { path: '/profile', label: 'My Profile', icon: UserCircle, roles: ['employee'] },
  { path: '/employees', label: 'Employees', icon: Users, roles: ['super_admin', 'admin', 'hr'] },
  { path: '/attendance', label: 'Attendance', icon: Clock, roles: ['super_admin', 'admin', 'hr', 'employee'] },
  { path: '/calendar', label: 'Calendar', icon: CalendarDays, roles: ['super_admin', 'admin', 'hr', 'employee'] },
  { path: '/timesheet', label: 'My Timesheet', icon: ClipboardList, roles: ['super_admin', 'admin', 'hr', 'employee'], feature: 'timesheets' },
  { path: '/timesheet/admin', label: 'Timesheet Mgmt', icon: ClipboardCheck, roles: ['super_admin', 'admin', 'hr'], feature: 'timesheets' },
  { path: '/leaves', label: 'Leaves', icon: CalendarIcon, roles: ['super_admin', 'admin', 'hr', 'employee'] },
  { path: '/payroll', label: 'Payroll', icon: DollarSign, roles: ['super_admin', 'admin', 'hr', 'employee'], feature: 'payroll' },
  { path: '/recruitment', label: 'Recruitment', icon: Briefcase, roles: ['super_admin', 'admin', 'hr'], feature: 'recruitment' },
  { path: '/projects', label: 'Projects', icon: FolderKanban, roles: ['super_admin', 'admin'], feature: 'projects' },
  { path: '/audit-logs', label: 'Audit Logs', icon: ScrollText, roles: ['super_admin', 'admin', 'hr'], feature: 'audit_logs' },
  { path: '/settings', label: 'Settings', icon: Settings, roles: ['super_admin', 'admin'] },
  { path: '/subscription', label: 'Subscription', icon: CreditCard, roles: ['super_admin', 'admin'] },
];

export default function Sidebar() {
  const { user, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const { hasFeature } = usePlan();
  const navigate = useNavigate();
  const location = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  const filteredNavItems = navItems.filter(item => item.roles.includes(user?.role));

  const getInitials = (name) => {
    if (!name) return 'U';
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  };

  const NavContent = () => (
    <>
      <div className="p-6 border-b border-slate-200 dark:border-slate-700">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-[#002FA7] rounded-lg flex items-center justify-center">
            <Building2 className="h-6 w-6 text-white" />
          </div>
          <div>
            <h1 className="font-bold text-lg text-[#0F172A] dark:text-white font-['Chivo']">TalentOps</h1>
            <p className="text-xs text-slate-500 dark:text-slate-400">HRMS Platform</p>
          </div>
        </div>
      </div>

      <nav className="flex-1 p-4 overflow-y-auto">
        <ul className="space-y-1">
          {filteredNavItems.map((item) => {
            const Icon = item.icon;
            const isActive = location.pathname === item.path || (item.path !== '/dashboard' && location.pathname.startsWith(item.path + '/'));
            const isLocked = item.feature && !hasFeature(item.feature);
            return (
              <li key={item.path}>
                <NavLink
                  to={item.path}
                  onClick={() => setMobileOpen(false)}
                  data-testid={`nav-${item.label.toLowerCase().replace(/\s+/g, '-')}`}
                  className={`flex items-center gap-3 px-4 py-2.5 rounded-md text-sm font-medium transition-all duration-150
                    ${isActive
                      ? 'border-l-4 border-[#002FA7] bg-blue-50/50 dark:bg-blue-900/20 text-[#002FA7] dark:text-blue-400 ml-[-1px]'
                      : isLocked
                        ? 'text-slate-400 dark:text-slate-600 hover:bg-slate-50 dark:hover:bg-slate-700'
                        : 'text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-700 hover:text-slate-900 dark:hover:text-white'
                    }`}
                >
                  <Icon className="h-5 w-5" />
                  <span className="flex-1">{item.label}</span>
                  {isLocked && <Lock className="h-3.5 w-3.5 text-slate-400 dark:text-slate-600" />}
                </NavLink>
              </li>
            );
          })}
        </ul>
      </nav>

      {/* Theme Toggle + User Menu */}
      <div className="p-4 border-t border-slate-200 dark:border-slate-700 space-y-3">
        <button
          onClick={toggleTheme}
          data-testid="theme-toggle"
          className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
        >
          {theme === 'dark' ? <Sun className="h-5 w-5 text-amber-500" /> : <Moon className="h-5 w-5" />}
          {theme === 'dark' ? 'Light Mode' : 'Dark Mode'}
        </button>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              data-testid="user-menu-trigger"
              className="w-full flex items-center gap-3 p-2 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
            >
              <Avatar className="h-9 w-9">
                <AvatarFallback className="bg-[#002FA7] text-white text-sm">
                  {getInitials(user?.name)}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 text-left">
                <p className="text-sm font-medium text-slate-900 dark:text-white truncate">{user?.name}</p>
                <p className="text-xs text-slate-500 dark:text-slate-400 capitalize">{user?.role?.replace('_', ' ')}</p>
              </div>
              <ChevronDown className="h-4 w-4 text-slate-400" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <div className="px-2 py-1.5">
              <p className="text-sm font-medium">{user?.name}</p>
              <p className="text-xs text-slate-500">{user?.email}</p>
            </div>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => navigate('/settings')} data-testid="menu-settings">
              <Settings className="mr-2 h-4 w-4" /> Settings
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={handleLogout} className="text-red-600" data-testid="menu-logout">
              <LogOut className="mr-2 h-4 w-4" /> Logout
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </>
  );

  return (
    <>
      <div className="lg:hidden fixed top-4 left-4 z-50">
        <Button variant="outline" size="icon" onClick={() => setMobileOpen(!mobileOpen)}
          data-testid="mobile-menu-toggle" className="bg-white dark:bg-slate-800 shadow-md">
          {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </Button>
      </div>

      {mobileOpen && (
        <div className="lg:hidden fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-40" onClick={() => setMobileOpen(false)} />
      )}

      <aside className={`fixed lg:static inset-y-0 left-0 z-40 w-64 bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-700 flex flex-col transform transition-transform duration-200 ease-out
        ${mobileOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}`}>
        <NavContent />
      </aside>
    </>
  );
}
