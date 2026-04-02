import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useAuth } from '../../contexts/AuthContext';
import { usePlan } from '../../contexts/PlanContext';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Badge } from '../../components/ui/badge';
import { CreditCard, Check, ArrowRight, Loader2, Users, AlertTriangle, Crown } from 'lucide-react';
import { toast } from 'sonner';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

export default function SubscriptionPage() {
  const { user } = useAuth();
  const { planInfo, refreshPlan } = usePlan();
  const [plans, setPlans] = useState([]);
  const [loading, setLoading] = useState(true);
  const [upgrading, setUpgrading] = useState(null);

  useEffect(() => { fetchPlans(); }, []);

  const fetchPlans = async () => {
    try {
      const { data } = await axios.get(`${API}/subscription/plans`, { withCredentials: true });
      setPlans(data.plans);
    } catch (err) {
      console.error('Failed to fetch plans:', err);
    }
    setLoading(false);
  };

  const handleUpgrade = async (planId) => {
    if (planId === planInfo?.plan) return;
    setUpgrading(planId);
    try {
      const { data: order } = await axios.post(`${API}/subscription/checkout`, { plan: planId }, { withCredentials: true });
      await axios.post(`${API}/subscription/verify`, {
        plan: planId,
        order_id: order.order_id,
        payment_id: `pay_mock_${Date.now()}`,
        amount: order.amount,
      }, { withCredentials: true });
      toast.success(`Upgraded to ${planId.replace('_', ' ')}!`);
      refreshPlan();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Upgrade failed');
    }
    setUpgrading(null);
  };

  const currentPlan = planInfo?.plan || 'free_trial';
  const planOrder = ['free_trial', 'starter', 'professional', 'enterprise'];
  const planColors = {
    free_trial: 'border-slate-200 dark:border-slate-700',
    starter: 'border-blue-200 dark:border-blue-700',
    professional: 'border-purple-200 dark:border-purple-700',
    enterprise: 'border-amber-200 dark:border-amber-600',
  };

  return (
    <div className="animate-fade-in space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-[#0F172A] dark:text-white font-['Chivo']">Subscription</h1>
        <p className="text-slate-500 dark:text-slate-400 mt-1">Manage your plan and billing</p>
      </div>

      {/* Current Plan Card */}
      {planInfo && (
        <Card className={`border-2 ${planColors[currentPlan]} dark:bg-slate-800`}>
          <CardContent className="p-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-[#002FA7] rounded-lg">
                  <Crown className="h-6 w-6 text-white" />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-[#0F172A] dark:text-white font-['Chivo'] capitalize">
                    {currentPlan.replace('_', ' ')} Plan
                  </h2>
                  <div className="flex flex-wrap items-center gap-3 mt-1 text-sm text-slate-500 dark:text-slate-400">
                    <span className="flex items-center gap-1">
                      <Users className="h-4 w-4" />
                      {planInfo.employee_count} / {planInfo.limits.max_employees === 999999 ? 'Unlimited' : planInfo.limits.max_employees} employees
                    </span>
                    {planInfo.expired && (
                      <Badge className="bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400">
                        <AlertTriangle className="h-3 w-3 mr-1" /> Expired
                      </Badge>
                    )}
                    {currentPlan === 'free_trial' && planInfo.trial_ends_at && !planInfo.expired && (
                      <Badge variant="outline" className="dark:border-slate-600 dark:text-slate-300">
                        Expires {new Date(planInfo.trial_ends_at).toLocaleDateString()}
                      </Badge>
                    )}
                  </div>
                </div>
              </div>
              <div className="text-sm text-slate-500 dark:text-slate-400">
                {planInfo.limits.features.length} features enabled
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Plans Grid */}
      {loading ? (
        <div className="p-8 text-center"><Loader2 className="h-8 w-8 animate-spin mx-auto text-[#002FA7]" /></div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {plans.map((plan) => {
            const isCurrent = plan.id === currentPlan;
            const isLower = planOrder.indexOf(plan.id) <= planOrder.indexOf(currentPlan);
            return (
              <Card
                key={plan.id}
                data-testid={`plan-${plan.id}`}
                className={`border-2 dark:bg-slate-800 transition-all ${
                  isCurrent ? 'border-[#002FA7] ring-2 ring-[#002FA7]/20' : planColors[plan.id]
                }`}
              >
                <CardHeader className="pb-4">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-lg font-['Chivo'] dark:text-white">{plan.name}</CardTitle>
                    {isCurrent && <Badge className="bg-[#002FA7] text-white">Current</Badge>}
                  </div>
                  <CardDescription className="dark:text-slate-400">{plan.duration}</CardDescription>
                  <div className="mt-2">
                    <span className="text-3xl font-bold text-[#0F172A] dark:text-white">${plan.price}</span>
                    {plan.price > 0 && <span className="text-sm text-slate-500 dark:text-slate-400">/month</span>}
                  </div>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-2 mb-6">
                    {plan.features.map((feat, i) => (
                      <li key={i} className="flex items-start gap-2 text-sm text-slate-600 dark:text-slate-400">
                        <Check className="h-4 w-4 text-green-500 mt-0.5 flex-shrink-0" />
                        {feat}
                      </li>
                    ))}
                  </ul>
                  {isCurrent ? (
                    <Button className="w-full" variant="outline" disabled data-testid={`btn-${plan.id}`}>
                      Current Plan
                    </Button>
                  ) : isLower ? (
                    <Button className="w-full" variant="outline" disabled data-testid={`btn-${plan.id}`}>
                      Included
                    </Button>
                  ) : (
                    <Button
                      className="w-full bg-[#002FA7] hover:bg-[#00227A]"
                      onClick={() => handleUpgrade(plan.id)}
                      disabled={!!upgrading}
                      data-testid={`btn-${plan.id}`}
                    >
                      {upgrading === plan.id ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <>Upgrade <ArrowRight className="h-4 w-4 ml-2" /></>
                      )}
                    </Button>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <Card className="border border-slate-200 dark:border-slate-700 bg-blue-50 dark:bg-slate-800">
        <CardContent className="p-6 text-center text-sm text-slate-600 dark:text-slate-400">
          <p>Payment is handled via our secure payment gateway (mocked for demo).</p>
          <p className="mt-1">All plans include a 14-day money-back guarantee.</p>
        </CardContent>
      </Card>
    </div>
  );
}
