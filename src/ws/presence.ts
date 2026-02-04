/**
 * Presença em memória: tenant -> employeeId -> { socketIds, name? }.
 * Usado para GET /users/online e para broadcast de user:status.
 */
interface EmployeePresence {
  socketIds: Set<string>;
  name?: string;
}

const tenantToEmployees = new Map<string, Map<string, EmployeePresence>>();

function getOrCreate(tenantId: string, employeeId: string, name?: string): EmployeePresence {
  let byEmployee = tenantToEmployees.get(tenantId);
  if (!byEmployee) {
    byEmployee = new Map();
    tenantToEmployees.set(tenantId, byEmployee);
  }
  let entry = byEmployee.get(employeeId);
  if (!entry) {
    entry = { socketIds: new Set(), name };
    byEmployee.set(employeeId, entry);
  } else if (name !== undefined) {
    entry.name = name;
  }
  return entry;
}

export function addPresence(tenantId: string, employeeId: string, socketId: string, name?: string): void {
  const entry = getOrCreate(tenantId, employeeId, name);
  entry.socketIds.add(socketId);
  if (name !== undefined) entry.name = name;
}

export function removePresence(tenantId: string, employeeId: string, socketId: string): void {
  const byEmployee = tenantToEmployees.get(tenantId);
  if (!byEmployee) return;
  const entry = byEmployee.get(employeeId);
  if (!entry) return;
  entry.socketIds.delete(socketId);
  if (entry.socketIds.size === 0) byEmployee.delete(employeeId);
  if (byEmployee.size === 0) tenantToEmployees.delete(tenantId);
}

export function getOnlineEmployees(tenantId: string): Array<{ userId: string; userName?: string; status: 'online' }> {
  const byEmployee = tenantToEmployees.get(tenantId);
  if (!byEmployee) return [];
  return Array.from(byEmployee.entries()).map(([userId, entry]) => ({
    userId,
    userName: entry.name,
    status: 'online' as const,
  }));
}
