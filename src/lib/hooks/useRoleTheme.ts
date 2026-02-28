import { useMemo } from 'react';
import { useBand } from '../BandContext';
import { getRoleTheme, getPermissions, type Permissions, type UserRole } from '../permissions';

export interface RoleTheme {
  backgroundColor: string;
  accentColor: string;
  badgeColor: string;
  badgeText: string;
  roleLabel: string;
}

export interface UseRoleThemeResult {
  role: UserRole;
  theme: RoleTheme;
  permissions: Permissions;
  isAdmin: boolean;
}

/**
 * Hook to get role-based theme and permissions
 */
export const useRoleTheme = (): UseRoleThemeResult => {
  const { selectedBand, isAdmin } = useBand();
  
  const role: UserRole = isAdmin ? 'admin' : 'member';
  
  const result = useMemo(() => ({
    role,
    theme: getRoleTheme(role),
    permissions: getPermissions(role),
    isAdmin,
  }), [role, isAdmin]);
  
  return result;
};

/**
 * CSS class helper for background colors
 */
export const getRoleBgClass = (isAdmin: boolean): string => {
  return isAdmin ? 'bg-[#E6E5E1]' : 'bg-[#F0F7D8]';
};

/**
 * Inline style helper for background colors
 */
export const getRoleBgStyle = (isAdmin: boolean): React.CSSProperties => {
  return {
    backgroundColor: isAdmin ? '#E6E5E1' : '#F0F7D8',
  };
};
