import { useAuth } from '../contexts/AuthContext';

const usePermissions = () => {
  const { user, hasPermission } = useAuth();

  // Check all permissions
  const canManageMembers = hasPermission('canManageMembers');
  const canManageEvents = hasPermission('canManageEvents');
  const canManageCourses = hasPermission('canManageCourses');
  const canManageReports = hasPermission('canManageReports');
  const canManageProjects = hasPermission('canManageProjects');
  const canViewStatistics = hasPermission('canViewStatistics');
  const canManageAnnouncements = hasPermission('canManageAnnouncements');
  const canExportData = hasPermission('canExportData');
  const canViewDashboard = hasPermission('canViewDashboard') || true;
  const canManageSector = hasPermission('canManageSector');
  const canManageDistricts = hasPermission('canManageDistricts');
  const canManageAllDistricts = hasPermission('canManageAllDistricts');

  // Check if user is National Commissioner
  const isNationalCommissioner = user?.role === 'national_commissioner';
  const isDistrictCommissioner = user?.role === 'district_commissioner';
  const isScout = user?.role === 'scout' || user?.role === 'unit_leader';
  const isDonor = user?.role === 'donor';

  // Get assigned districts
  const assignedDistricts = user?.permissions?.assignedDistricts || [];

  // Check if user has access to a specific district
  const hasDistrictAccess = (districtName) => {
    if (isNationalCommissioner) return true;
    if (canManageAllDistricts) return true;
    return assignedDistricts.includes(districtName);
  };

  return {
    // Permission checks
    canManageMembers,
    canManageEvents,
    canManageCourses,
    canManageReports,
    canManageProjects,
    canViewStatistics,
    canManageAnnouncements,
    canExportData,
    canViewDashboard,
    canManageSector,
    canManageDistricts,
    canManageAllDistricts,
    
    // Role checks
    isNationalCommissioner,
    isDistrictCommissioner,
    isScout,
    isDonor,
    
    // District access
    assignedDistricts,
    hasDistrictAccess,
    
    // Helper: Check if user has any management permission
    hasAnyManagementPermission: canManageMembers || canManageEvents || canManageCourses || 
                               canManageReports || canManageProjects || canManageAnnouncements,
    
    // Helper: Get all active permissions list
    getActivePermissions: () => {
      const permissions = [];
      if (canManageMembers) permissions.push('Manage Members');
      if (canManageEvents) permissions.push('Manage Events');
      if (canManageCourses) permissions.push('Manage Courses');
      if (canManageReports) permissions.push('Manage Reports');
      if (canManageProjects) permissions.push('Manage Projects');
      if (canViewStatistics) permissions.push('View Statistics');
      if (canManageAnnouncements) permissions.push('Manage Announcements');
      if (canExportData) permissions.push('Export Data');
      if (canManageSector) permissions.push('Manage Sector');
      if (canManageDistricts) permissions.push('Manage Districts');
      return permissions;
    }
  };
};

export default usePermissions;