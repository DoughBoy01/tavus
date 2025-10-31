import { Navigate } from 'react-router-dom';
import { useAtom } from 'jotai';
import { isLegalAdminAtom, isLoadingAtom } from '@/store/auth';
import React from 'react';

interface LegalAdminRouteProps {
  children: React.ReactNode;
}

export const LegalAdminRoute: React.FC<LegalAdminRouteProps> = ({ children }) => {
  const [isLegalAdmin] = useAtom(isLegalAdminAtom);
  const [isLoading] = useAtom(isLoadingAtom);

  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center bg-zinc-950">
        <div className="size-16 animate-spin-slow border-4 border-cyan-400 border-t-transparent rounded-full" />
      </div>
    );
  }

  if (!isLegalAdmin) {
    return <Navigate to="/admin" replace />;
  }

  return <>{children}</>;
};