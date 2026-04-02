import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Badge } from '../../components/ui/badge';
import { Check, CreditCard, Zap, Building2, Users, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

export default function SubscriptionPage() {
  const [plans, setPlans] = useState([]);
  const [organization, setOrganization] = useState(null);
  const [loading, setLoading] = useState(true);
  const [processingPlan, setProcessingPlan] = useState(null);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [plansRes, orgRes] = await Promise.all([
        axios.get(`${API}/subscription/plans`, { withCredentials: true }),
        axios.get(`${API}/organizations/current`, { withCredentials: true })
      ]);
      setPlans(plansRes.data.plans);
      setOrganization(orgRes.data);
    } catch (error) {
      console.error('Failed to fetch data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubscribe = async (planId) => {
    if (planId === 'free_trial') return;
    
    setProcessingPlan(planId);

    try {
      // Create checkout
      const { data: checkout } = await axios.post(`${API}/subscription/checkout`, {
        plan: planId
      }, { withCredentials: true });

      // Mock payment flow
      toast.info('Processing payment... (Mocked)');
      
      // Simulate payment delay
      await new Promise(resolve => setTimeout(resolve, 1500));

      // Verify payment
      await axios.post(`${API}/subscription/verify`, {
        plan: planId,
        order_id: checkout.order_id,
        payment_id: `pay_mock_${Date.now()}`,
        amount: checkout.amount
      }, { withCredentials: true });

      toast.success('Subscription activated successfully!');
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to process subscription');
    }

    setProcessingPlan(null);
  };

  const getPlanIcon = (planId) => {
    switch (planId) {
      case 'free_trial':
        return <Zap className="h-6 w-6 text-amber-500" />;
      case 'starter':
        return <Users className="h-6 w-6 text-blue-500" />;
      case 'professional':
        return <Building2 className="h-6 w-6 text-purple-500" />;
      case 'enterprise':
        return <CreditCard className="h-6 w-6 text-green-500" />;
      default:
        return null;
    }
  };

  const isCurrentPlan = (planId) => {
    return organization?.subscription_plan === planId;
  };

  if (loading) {
    return (
      <div className="animate-pulse space-y-6">
        <div className="h-8 w-48 bg-slate-200 rounded" />
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-96 bg-slate-200 rounded-lg" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="animate-fade-in space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-[#0F172A] font-['Chivo']">Subscription</h1>
        <p className="text-slate-500 mt-1">Choose the plan that's right for your team</p>
      </div>

      {/* Current Plan Banner */}
      {organization && (
        <Card className="border border-[#002FA7] bg-blue-50/50">
          <CardContent className="p-6 flex items-center justify-between">
            <div>
              <p className="text-sm text-slate-600">Current Plan</p>
              <p className="text-xl font-bold text-[#002FA7]">
                {organization.subscription_plan.replace('_', ' ').toUpperCase()}
              </p>
              {organization.trial_ends_at && (
                <p className="text-sm text-amber-600 mt-1">
                  Trial ends on {new Date(organization.trial_ends_at).toLocaleDateString()}
                </p>
              )}
            </div>
            <Badge className="bg-[#002FA7] text-white text-lg px-4 py-2">
              Active
            </Badge>
          </CardContent>
        </Card>
      )}

      {/* Plans Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {plans.map((plan) => (
          <Card 
            key={plan.id} 
            className={`border relative ${isCurrentPlan(plan.id) ? 'border-[#002FA7] ring-2 ring-[#002FA7]/20' : 'border-slate-200'}`}
          >
            {isCurrentPlan(plan.id) && (
              <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                <Badge className="bg-[#002FA7] text-white">Current Plan</Badge>
              </div>
            )}
            <CardHeader className="text-center pb-2">
              <div className="mx-auto mb-3">
                {getPlanIcon(plan.id)}
              </div>
              <CardTitle className="font-['Chivo']">{plan.name}</CardTitle>
              <div className="mt-4">
                <span className="text-4xl font-bold text-[#0F172A]">
                  ₹{plan.price.toLocaleString()}
                </span>
                {plan.price > 0 && (
                  <span className="text-slate-500">/month</span>
                )}
              </div>
              <CardDescription>{plan.duration}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <ul className="space-y-3">
                {plan.features.map((feature, idx) => (
                  <li key={idx} className="flex items-start gap-2 text-sm">
                    <Check className="h-4 w-4 text-green-600 mt-0.5 flex-shrink-0" />
                    <span className="text-slate-600">{feature}</span>
                  </li>
                ))}
              </ul>
              <Button
                className={`w-full ${isCurrentPlan(plan.id) ? 'bg-slate-100 text-slate-500' : 'bg-[#002FA7] hover:bg-[#00227A]'}`}
                disabled={isCurrentPlan(plan.id) || processingPlan === plan.id || plan.id === 'free_trial'}
                onClick={() => handleSubscribe(plan.id)}
                data-testid={`subscribe-${plan.id}`}
              >
                {processingPlan === plan.id ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : isCurrentPlan(plan.id) ? (
                  'Current Plan'
                ) : plan.id === 'free_trial' ? (
                  'Free'
                ) : (
                  'Subscribe'
                )}
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Payment Info */}
      <Card className="border border-slate-200 bg-amber-50">
        <CardContent className="p-6">
          <div className="flex items-start gap-3">
            <CreditCard className="h-5 w-5 text-amber-600 mt-0.5" />
            <div>
              <h3 className="font-semibold text-amber-900">Payment Integration</h3>
              <p className="text-sm text-amber-700 mt-1">
                Payment processing is currently in <strong>MOCKED</strong> mode. In production, this would integrate with Razorpay for secure payments.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* FAQ */}
      <Card className="border border-slate-200">
        <CardHeader>
          <CardTitle className="font-['Chivo']">Frequently Asked Questions</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <h4 className="font-medium text-[#0F172A]">Can I change plans later?</h4>
            <p className="text-sm text-slate-600 mt-1">
              Yes, you can upgrade or downgrade your plan at any time. Changes take effect immediately.
            </p>
          </div>
          <div>
            <h4 className="font-medium text-[#0F172A]">What happens after my trial ends?</h4>
            <p className="text-sm text-slate-600 mt-1">
              You'll need to subscribe to a paid plan to continue using all features. You can choose any plan that fits your needs.
            </p>
          </div>
          <div>
            <h4 className="font-medium text-[#0F172A]">Is there a refund policy?</h4>
            <p className="text-sm text-slate-600 mt-1">
              We offer a 30-day money-back guarantee on all paid plans.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
