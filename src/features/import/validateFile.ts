import { getStorageQuotaEstimate } from '../../data/db';
import { formatBytes } from '../../lib/format';

export type ValidationResult =
  | {
      valid: true;
      warning?: string;
    }
  | {
      valid: false;
      code:
        | 'not-a-pdf'
        | 'empty-or-truncated'
        | 'storage-full'
        | 'password-protected'
        | 'corrupted';
      title: string;
      message: string;
      recoveryLabel: string;
    };

const MAX_WARN_SIZE_BYTES = 150 * 1024 * 1024; // 150 MB

/**
 * Checks %PDF- header bytes, minimum valid structure, file size warning (>150 MB),
 * and remaining storage quota from navigator.storage.estimate().
 */
export async function validatePdfBytes(
  buffer: ArrayBuffer,
  fileSize: number
): Promise<ValidationResult> {
  if (buffer.byteLength < 8) {
    return {
      valid: false,
      code: 'not-a-pdf',
      title: 'This file is not a valid PDF',
      message: 'The selected file is empty or does not begin with a PDF header.',
      recoveryLabel: 'Choose another file',
    };
  }

  const headerBytes = new Uint8Array(buffer, 0, Math.min(1024, buffer.byteLength));
  const headerAscii = Array.from(headerBytes)
    .map((b) => String.fromCharCode(b))
    .join('');

  if (!headerAscii.includes('%PDF-')) {
    return {
      valid: false,
      code: 'not-a-pdf',
      title: 'Not a PDF document',
      message: 'This file does not contain a PDF signature (%PDF-). Please choose a standard PDF file.',
      recoveryLabel: 'Choose another file',
    };
  }

  // Check storage quota
  const quotaInfo = await getStorageQuotaEstimate();
  if (quotaInfo && quotaInfo.quota > 0 && quotaInfo.remaining < fileSize * 1.1) {
    return {
      valid: false,
      code: 'storage-full',
      title: 'Device storage is full',
      message: `This file requires ${formatBytes(fileSize)}, but only ${formatBytes(
        quotaInfo.remaining
      )} remains available in browser storage. Remove an existing book from your library to free space.`,
      recoveryLabel: 'Back to library',
    };
  }

  const warning =
    fileSize > MAX_WARN_SIZE_BYTES
      ? `Large file (${formatBytes(fileSize)}). Initial extraction may take a moment.`
      : undefined;

  return {
    valid: true,
    warning,
  };
}

export function classifyPdfLoadError(err: unknown): {
  code: 'password-protected' | 'corrupted';
  title: string;
  message: string;
  recoveryLabel: string;
} {
  const errObj = err as { name?: string; message?: string } | null;
  const name = errObj?.name ?? '';
  const msg = (errObj?.message ?? '').toLowerCase();

  if (name === 'PasswordException' || msg.includes('password') || msg.includes('encrypted')) {
    return {
      code: 'password-protected',
      title: 'Password-protected PDF',
      message: 'Protected files are not supported in this version. Remove the password in your PDF viewer and import it again.',
      recoveryLabel: 'Choose another file',
    };
  }

  return {
    code: 'corrupted',
    title: 'Could not read this PDF',
    message: 'The file appears to be truncated, damaged, or unreadable.',
    recoveryLabel: 'Choose another file',
  };
}
