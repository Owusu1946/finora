import { fetch } from 'expo/fetch';

import { getApiUrl } from './api-url';

const MAX_BYTES = 10 * 1024 * 1024;

type UploadSource =
  | { file: File; name: string; contentType: string }
  | { uri: string; name: string; contentType: string; size?: number };

export async function uploadPayrollAttachment(
  source: UploadSource,
  getToken: () => Promise<string | null>,
) {
  if ('size' in source && source.size && source.size > MAX_BYTES) {
    throw new Error('Attachments must be 10 MB or smaller.');
  }
  if ('file' in source && source.file.size > MAX_BYTES) {
    throw new Error('Attachments must be 10 MB or smaller.');
  }
  const token = await getToken();
  const apiUrl = getApiUrl();
  if (!token || !apiUrl) throw new Error('Finora attachment upload is unavailable.');
  const form = new FormData();
  if ('file' in source) {
    form.append('file', source.file);
  } else {
    form.append(
      'file',
      { uri: source.uri, name: source.name, type: source.contentType } as unknown as Blob,
    );
  }
  const response = await fetch(`${apiUrl}/v1/payroll/attachments`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: form,
  });
  const payload = (await response.json().catch(() => null)) as
    | { ok?: boolean; attachmentId?: string; errorCode?: string }
    | null;
  if (!response.ok || !payload?.ok || !payload.attachmentId) {
    throw new Error(payload?.errorCode ?? 'Attachment upload failed.');
  }
  return { attachmentId: payload.attachmentId, name: source.name, contentType: source.contentType };
}

export function payrollAttachmentContext(attachment: {
  attachmentId: string;
  name: string;
  contentType: string;
}) {
  return `[Finora attachment: id=${attachment.attachmentId}; name=${attachment.name}; type=${attachment.contentType}]`;
}
