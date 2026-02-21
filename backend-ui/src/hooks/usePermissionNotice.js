import { useMemo } from 'react';
import { useAuthorization } from '../contexts/AuthorizationContext';
import { buildViewDeniedMessage } from '../utils/permissionMessages';

/**
 * usePermissionNotice
 * Reusable hook to derive field-level permission denial and a friendly message.
 * - required: string | string[] (permission(s) like 'VIEW_CATEGORIES'). If array, any grants access.
 * - moduleKey: string used to build a consistent message (e.g., 'categories').
 * - contextError: optional error string from a data context; if it contains permission hints, mark denied.
 */
export function usePermissionNotice(required, moduleKey, contextError) {
  const { hasPermission, hasAnyPermission, isSystemAdmin } = useAuthorization();

  const isAllowedByPerm = useMemo(() => {
    if (isSystemAdmin()) return true;
    if (!required) return true;
    if (Array.isArray(required)) return hasAnyPermission(required);
    return hasPermission(required);
  }, [required, hasPermission, hasAnyPermission, isSystemAdmin]);

  const deniedByContext = useMemo(() => {
    if (!contextError) return false;
    const msg = String(contextError).toLowerCase();
    return msg.includes('403') || msg.includes('forbidden') || msg.includes('permission');
  }, [contextError]);

  const isDenied = !isAllowedByPerm || deniedByContext;
  const message = buildViewDeniedMessage(moduleKey);

  return { isDenied, message };
}

export default usePermissionNotice;
