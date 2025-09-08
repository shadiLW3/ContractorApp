import { Alert } from 'react-native';

// Core role permissions
export const rolePermissions = {
  GC: ['create_project', 'invite_to_project', 'create_event', 'broadcast'],
  Sub: ['manage_team', 'create_event', 'invite_techs_to_project'],
  Tech: ['view_only']
};

// Check if user can invite to a specific project
export const canInviteToProject = async (userId, userRole, project) => {
  // GC who created project can always invite
  if (project.createdBy === userId) return true;
  
  // Sub in project can invite their techs if allowed
  if (userRole === 'Sub' && 
      project.invitedSubs?.some(sub => sub.id === userId && sub.status === 'accepted') &&
      project.allowSubInvites !== false) { // Default to true if not set
    return 'techs_only'; // Can only invite techs
  }
  
  return false;
};

// Check if user can create events for a project
export const canCreateProjectEvent = (userRole, project, userId) => {
  // GC can create events for their projects
  if (userRole === 'GC' && project.createdBy === userId) return true;
  
  // Subs can create events if they're in the project
  if (userRole === 'Sub' && 
      project.invitedSubs?.some(sub => sub.id === userId && sub.status === 'accepted')) {
    return true;
  }
  
  return false;
};

// Check basic role permission
export const hasPermission = (userRole, permission) => {
  return rolePermissions[userRole]?.includes(permission) || false;
};

// Get user's network connections (persists across role changes)
export const getUserConnections = async (db, userId) => {
  // This would fetch from a 'connections' collection
  // For now, we'll use the existing managedBy/managedTechs structure
  return [];
};