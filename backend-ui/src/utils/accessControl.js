// Reusable access control helpers for filters and grids
import { buildViewDeniedMessage } from './permissionMessages';

// Determine denial for a single resource (filter/column)
export function getAccessNotice({ required, moduleKey, authorization, contextError }) {
  const { isSystemAdmin, hasPermission, hasAnyPermission } = authorization;

  // Permission check
  let allowed = true;
  if (!isSystemAdmin()) {
    if (Array.isArray(required) && required.length > 0) {
      allowed = hasAnyPermission(required);
    } else if (typeof required === 'string' && required) {
      allowed = hasPermission(required);
    }
  }

  // Context-level denial from data fetchers (403/forbidden)
  const deniedByContext = (() => {
    if (!contextError) return false;
    const msg = String(contextError).toLowerCase();
    return msg.includes('403') || msg.includes('forbidden') || msg.includes('permission');
  })();

  const isDenied = !allowed || deniedByContext;
  return {
    isDenied,
    message: buildViewDeniedMessage(moduleKey)
  };
}

// Evaluate access for filters (generic, reusable for any module)
// mapping: { [filterType]: { required: string|string[], moduleKey: string } }
// contextErrors: { [filterType]: string | null }
export function evaluateFilterAccess(activeFilterTypes, mapping, authorization, contextErrors = {}) {
  const noticesByType = {};
  const types = Object.keys(mapping);
  for (const type of types) {
    const { required, moduleKey } = mapping[type] || {};
    noticesByType[type] = getAccessNotice({
      required,
      moduleKey,
      authorization,
      contextError: contextErrors[type]
    });
  }

  const hasDeniedActive = (activeFilterTypes || []).some((t) => noticesByType[t]?.isDenied);
  return { noticesByType, hasDeniedActive };
}

// Evaluate access for grid columns (generic)
// colMapping: { [columnField]: { required: string|string[], moduleKey: string } }
export function evaluateGridColumnAccess(colMapping, authorization) {
  const allowed = new Set();
  const denied = [];
  const fields = Object.keys(colMapping || {});
  for (const field of fields) {
    const { required, moduleKey } = colMapping[field] || {};
    const notice = getAccessNotice({ required, moduleKey, authorization, contextError: null });
    if (notice.isDenied) {
      denied.push(field);
    } else {
      allowed.add(field);
    }
  }
  return { allowedColumns: allowed, deniedColumns: denied };
}
