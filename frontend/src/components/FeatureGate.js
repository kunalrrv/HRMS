import React from 'react';
import { useNavigate } from 'react-router-dom';
import { usePlan } from '../contexts/PlanContext';
import { Card, CardContent } from './ui/card';
import { Button } from './ui/button';
import { Lock, ArrowRight, AlertTriangle } from 'lucide-react';

export function FeatureGate({ feature, children, fallbackTitle }) {
  const { planInfo, hasFeature, loading } = usePlan();
  const navigate = useNavigate();

  if (loading) return children;

  // If plan is expired, show expiry message
  if (planInfo?.expired) {
    return (
      <div className="animate-fade-in flex items-center justify-center min-h-[400px]">
        <Card className="border border-amber-300 dark:border-amber-600 bg-amber-50 dark:bg-amber-900/20 max-w-md w-full">
          <CardContent className="p-8 text-center">
            <AlertTriangle className="h-12 w-12 text-amber-600 mx-auto mb-4" />
            <h2 className="text-xl font-bold text-[#0F172A] dark:text-white font-['Chivo'] mb-2">Trial Expired</h2>
            <p className="text-slate-600 dark:text-slate-400 mb-6">
              Your free trial has ended. Upgrade to continue using TalentOps.
            </p>
            <Button onClick={() => navigate('/subscription')} className="bg-[#002FA7] hover:bg-[#00227A]" data-testid="upgrade-expired-btn">
              View Plans <ArrowRight className="h-4 w-4 ml-2" />
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // If feature is not available, show upgrade prompt
  if (!hasFeature(feature)) {
    const planNeeded = feature === 'audit_logs' ? 'Enterprise' :
                       ['recruitment', 'timesheets', 'projects', 'reports', 'bulk_payroll'].includes(feature) ? 'Professional' :
                       feature === 'payroll' ? 'Starter' : 'a higher';
    return (
      <div className="animate-fade-in flex items-center justify-center min-h-[400px]">
        <Card className="border border-slate-200 dark:border-slate-700 dark:bg-slate-800 max-w-md w-full">
          <CardContent className="p-8 text-center">
            <div className="w-16 h-16 bg-slate-100 dark:bg-slate-700 rounded-full flex items-center justify-center mx-auto mb-4">
              <Lock className="h-8 w-8 text-slate-400 dark:text-slate-500" />
            </div>
            <h2 className="text-xl font-bold text-[#0F172A] dark:text-white font-['Chivo'] mb-2">
              {fallbackTitle || 'Feature Locked'}
            </h2>
            <p className="text-slate-600 dark:text-slate-400 mb-6">
              This feature requires the <strong>{planNeeded}</strong> plan or higher.
              Upgrade to unlock it.
            </p>
            <Button onClick={() => navigate('/subscription')} className="bg-[#002FA7] hover:bg-[#00227A]" data-testid="upgrade-feature-btn">
              Upgrade Plan <ArrowRight className="h-4 w-4 ml-2" />
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return children;
}
