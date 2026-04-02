import React from 'react';
import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar';

export default function DashboardLayout() {
  return (
    <div className="min-h-screen bg-[#F9FAFB] flex">
      <Sidebar />
      <main className="flex-1 lg:ml-0 overflow-auto">
        <div className="p-6 md:p-8 pt-16 lg:pt-6">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
