import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { useAuth } from './AuthContext';

const PlanContext = createContext();

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

export function PlanProvider({ children }) {
  const { user } = useAuth();
  const [planInfo, setPlanInfo] = useState(null);
  const [loading, setLoading] = useState(true);

  const fetchPlan = useCallback(async () => {
    if (!user) { setPlanInfo(null); setLoading(false); return; }
    try {
      const { data } = await axios.get(`${API}/subscription/current`, { withCredentials: true });
      setPlanInfo(data);
    } catch {
      setPlanInfo(null);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => { fetchPlan(); }, [fetchPlan]);

  const hasFeature = (feature) => {
    if (!planInfo) return false;
    if (planInfo.expired) return false;
    return planInfo.limits?.features?.includes(feature) ?? false;
  };

  const canAddEmployee = () => {
    if (!planInfo) return false;
    return planInfo.employee_count < (planInfo.limits?.max_employees ?? 5);
  };

  const refreshPlan = () => fetchPlan();

  return (
    <PlanContext.Provider value={{ planInfo, loading, hasFeature, canAddEmployee, refreshPlan }}>
      {children}
    </PlanContext.Provider>
  );
}

export const usePlan = () => useContext(PlanContext);
