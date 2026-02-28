/**
 * Centralized permissions system for BandWith
 * Defines what each role can do in the app
 */

export type UserRole = 'admin' | 'member';

// Permission categories
export interface Permissions {
  // Dashboard Cards
  canViewFinanceCard: boolean;
  canViewAnalyticsCard: boolean;
  canViewMembersCard: boolean;
  canViewInventoryCard: boolean;
  canViewTasksCard: boolean;
  canViewEventsCard: boolean;
  canViewSetlistCard: boolean;
  canViewChatCard: boolean;
  
  // Actions
  canInviteMembers: boolean;
  canRemoveMembers: boolean;
  canEditBandDetails: boolean;
  canManageFinances: boolean;
  canCreateEvents: boolean;
  canEditEvents: boolean;
  canDeleteEvents: boolean;
  canCreateSetlists: boolean;
  canEditSetlists: boolean;
  canManageInventory: boolean;
  canCreateTaskTemplates: boolean;
  canManageContracts: boolean;
  
  // Navigation
  canAccessSettings: boolean;
  canAccessChat: boolean;
}

// Admin has full access
const adminPermissions: Permissions = {
  // Dashboard Cards - all visible
  canViewFinanceCard: true,
  canViewAnalyticsCard: true,
  canViewMembersCard: true,
  canViewInventoryCard: true,
  canViewTasksCard: true,
  canViewEventsCard: true,
  canViewSetlistCard: true,
  canViewChatCard: true,
  
  // Actions - full control
  canInviteMembers: true,
  canRemoveMembers: true,
  canEditBandDetails: true,
  canManageFinances: true,
  canCreateEvents: true,
  canEditEvents: true,
  canDeleteEvents: true,
  canCreateSetlists: true,
  canEditSetlists: true,
  canManageInventory: true,
  canCreateTaskTemplates: true,
  canManageContracts: true,
  
  // Navigation
  canAccessSettings: true,
  canAccessChat: true,
};

// Member has limited access
const memberPermissions: Permissions = {
  // Dashboard Cards - limited
  canViewFinanceCard: false, // Can only see personal finances (handled separately)
  canViewAnalyticsCard: false,
  canViewMembersCard: true, // Can view but not manage
  canViewInventoryCard: true, // Can view but not manage
  canViewTasksCard: true, // Can see own tasks
  canViewEventsCard: true, // Can view calendar
  canViewSetlistCard: true, // Can view setlists
  canViewChatCard: true,
  
  // Actions - limited
  canInviteMembers: false,
  canRemoveMembers: false,
  canEditBandDetails: false,
  canManageFinances: false,
  canCreateEvents: false,
  canEditEvents: false,
  canDeleteEvents: false,
  canCreateSetlists: false,
  canEditSetlists: false, // Can mark songs as ready, but not edit structure
  canManageInventory: false,
  canCreateTaskTemplates: false,
  canManageContracts: false,
  
  // Navigation
  canAccessSettings: true, // Personal settings only
  canAccessChat: true,
};

/**
 * Get permissions for a given role
 */
export const getPermissions = (role: UserRole): Permissions => {
  return role === 'admin' ? adminPermissions : memberPermissions;
};

/**
 * Check if user has a specific permission
 */
export const hasPermission = (role: UserRole, permission: keyof Permissions): boolean => {
  const permissions = getPermissions(role);
  return permissions[permission];
};

/**
 * UI Theme colors based on role
 */
export const getRoleTheme = (role: UserRole) => {
  if (role === 'admin') {
    return {
      backgroundColor: '#E6E5E1', // Warm gray
      accentColor: '#D4FB46', // Lime
      badgeColor: 'bg-amber-500',
      badgeText: 'text-amber-700',
      roleLabel: 'Admin',
    };
  }
  
  return {
    backgroundColor: '#F0F7D8', // Light lime tint (harmonizes with accent)
    accentColor: '#D4FB46', // Same lime accent
    badgeColor: 'bg-blue-500',
    badgeText: 'text-blue-700',
    roleLabel: 'Member',
  };
};

/**
 * Dashboard cards configuration based on role
 */
export interface DashboardCardConfig {
  id: string;
  visible: boolean;
  readonly: boolean;
}

export const getDashboardCardsConfig = (role: UserRole): Record<string, DashboardCardConfig> => {
  const permissions = getPermissions(role);
  
  return {
    finance: {
      id: 'finance',
      visible: permissions.canViewFinanceCard,
      readonly: !permissions.canManageFinances,
    },
    analytics: {
      id: 'analytics',
      visible: permissions.canViewAnalyticsCard,
      readonly: true,
    },
    members: {
      id: 'members',
      visible: permissions.canViewMembersCard,
      readonly: !permissions.canInviteMembers,
    },
    inventory: {
      id: 'inventory',
      visible: permissions.canViewInventoryCard,
      readonly: !permissions.canManageInventory,
    },
    tasks: {
      id: 'tasks',
      visible: permissions.canViewTasksCard,
      readonly: !permissions.canCreateTaskTemplates,
    },
    events: {
      id: 'events',
      visible: permissions.canViewEventsCard,
      readonly: !permissions.canCreateEvents,
    },
    setlist: {
      id: 'setlist',
      visible: permissions.canViewSetlistCard,
      readonly: !permissions.canCreateSetlists,
    },
    chat: {
      id: 'chat',
      visible: permissions.canViewChatCard,
      readonly: false,
    },
  };
};
