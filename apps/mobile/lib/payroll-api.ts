import type { PayrollImportRow } from '@finora/shared';
import { fetch } from 'expo/fetch';

import { getApiUrl } from './api-url';

type GetToken = () => Promise<string | null>;

export type PayrollImport = {
  id: string;
  sourceName: string;
  status: 'inspecting' | 'ready' | 'blocked' | 'failed';
  period: string | null;
  total: number;
  currency: string;
  blockingIssues: Array<{ code?: string; message?: string; rowId?: string; blocking?: boolean }>;
  warnings: Array<{ code?: string; message?: string; rowId?: string; blocking?: boolean }>;
  rows: PayrollImportRow[];
  createdAt: string;
  updatedAt: string;
};

async function payrollRequest(path: string, getToken: GetToken, init?: RequestInit) {
  const apiUrl = getApiUrl();
  const token = await getToken();
  if (!apiUrl || !token) throw new Error('Payroll API is not ready.');
  const response = await fetch(`${apiUrl}/v1/payroll${path}`, {
    method: init?.method,
    body: init?.body ?? undefined,
    signal: init?.signal ?? undefined,
    headers: {
      Accept: 'application/json',
      Authorization: `Bearer ${token}`,
      ...(init?.body ? { 'Content-Type': 'application/json' } : {}),
      ...init?.headers,
    },
  });
  const payload = (await response.json().catch(() => null)) as { import?: PayrollImport; imports?: PayrollImport[]; errorCode?: string } | null;
  if (!response.ok) throw new Error(payload?.errorCode ?? 'Payroll request failed.');
  return payload ?? {};
}

export async function listPayrollImports(getToken: GetToken) {
  const payload = await payrollRequest('/imports', getToken);
  return payload.imports ?? [];
}

export async function updatePayrollRow(
  importId: string,
  rowId: string,
  patch: Partial<Pick<PayrollImportRow, 'employeeName' | 'employeeId' | 'role' | 'amount' | 'currency' | 'destinationType' | 'destination' | 'rail' | 'period' | 'payDate' | 'reference'>>,
  getToken: GetToken,
) {
  const payload = await payrollRequest(`/imports/${encodeURIComponent(importId)}/rows/${encodeURIComponent(rowId)}`, getToken, {
    method: 'PATCH',
    body: JSON.stringify(patch),
  });
  if (!payload.import) throw new Error('Payroll update returned no import.');
  return payload.import;
}

export async function deletePayrollRow(importId: string, rowId: string, getToken: GetToken) {
  const payload = await payrollRequest(`/imports/${encodeURIComponent(importId)}/rows/${encodeURIComponent(rowId)}`, getToken, { method: 'DELETE' });
  if (!payload.import) throw new Error('Payroll delete returned no import.');
  return payload.import;
}
