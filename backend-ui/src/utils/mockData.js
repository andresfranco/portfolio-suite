/**
 * Mock data for fallback when API is unavailable
 * Used for development and testing purposes
 */

// Mock roles data
export const mockRoles = {
  results: [
    {
      id: 1,
      name: "Admin",
      description: "Full system administrator with all permissions",
      permissions: ["CREATE_USER", "UPDATE_USER", "DELETE_USER", "VIEW_DASHBOARD", "MANAGE_ROLES", "MANAGE_PERMISSIONS"]
    },
    {
      id: 2,
      name: "Editor",
      description: "Can edit content but with limited administrative access",
      permissions: ["CREATE_USER", "UPDATE_USER", "VIEW_DASHBOARD"]
    },
    {
      id: 3,
      name: "Viewer",
      description: "Read-only access to the system",
      permissions: ["VIEW_DASHBOARD"]
    }
  ],
  page: 1,
  page_size: 10,
  total: 3
};

// Mock permissions data
export const mockPermissions = {
  results: [
    { id: 1, name: "CREATE_USER", description: "Ability to create new users" },
    { id: 2, name: "UPDATE_USER", description: "Ability to update existing users" },
    { id: 3, name: "DELETE_USER", description: "Ability to delete users" },
    { id: 4, name: "VIEW_DASHBOARD", description: "Ability to view the dashboard" },
    { id: 5, name: "MANAGE_ROLES", description: "Ability to manage roles" },
    { id: 6, name: "MANAGE_PERMISSIONS", description: "Ability to manage permissions" }
  ],
  page: 1,
  page_size: 10,
  total: 6
};

const mockData = {
  roles: mockRoles,
  permissions: mockPermissions
};

export default mockData;