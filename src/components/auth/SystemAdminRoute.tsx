import { Navigate } from 'react-router-dom';
import { useAtom } from 'jotai';
import { isSystemAdminAtom, isLoadingAtom } from '@/store/auth';
import React from 'react';

interface SystemAdminRouteProps {
  children: React.ReactNode;
}

export const SystemAdminRoute: React.FC<SystemAdminRouteProps> = ({ children }) => {
  const [isSystemAdmin] = useAtom(isSystemAdminAtom);
  const [isLoading] = useAtom(isLoadingAtom);

  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center bg-zinc-950">
        <div className="size-16 animate-spin-slow border-4 border-cyan-400 border-t-transparent rounded-full" />
      </div>
    );
  }

  if (!isSystemAdmin) {
    return <Navigate to="/admin" replace />;
  }

  return <>{children}</>;
};