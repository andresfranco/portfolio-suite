// Utility to build consistent permission error messages across modules

/**
 * Map canonical module keys to friendly display names for UX.
 */
export const MODULE_DISPLAY_NAMES = {
  categorytypes: 'Category Types',
  categories: 'Categories',
  skilltypes: 'Skill Types',
  skills: 'Skills',
  projects: 'Projects',
  portfolios: 'Portfolios',
  roles: 'Roles',
  users: 'Users',
  permissions: 'Permissions',
  languages: 'Languages',
  experiences: 'Experiences',
  sections: 'Sections',
  translations: 'Translations'
};

/**
 * Returns a friendly message for lacking permission to view a module.
 * Example: "You do not have permission to view Category Types. Please contact your Administrator."
 */
export function buildViewDeniedMessage(moduleKey) {
  const key = (moduleKey || '').toLowerCase();
  const name = MODULE_DISPLAY_NAMES[key] || moduleKey || 'this module';
  return `You do not have permission to view ${name}. Please contact your Administrator.`;
}

/**
 * Returns a friendly message for lacking permission to manage (create/edit/delete) a module.
 */
export function buildManageDeniedMessage(moduleKey) {
  const key = (moduleKey || '').toLowerCase();
  const name = MODULE_DISPLAY_NAMES[key] || moduleKey || 'this module';
  return `You do not have permission to manage ${name}. Please contact your Administrator.`;
}

/**
 * Returns a generic permission denied message.
 */
export function buildGenericDeniedMessage(resourceName = 'this resource') {
  return `You do not have permission to access ${resourceName}. Please contact your Administrator.`;
}
