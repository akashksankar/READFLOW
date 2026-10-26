import React from 'react';
import { Toaster } from 'sonner';

/**
 * Toast host styled strictly with Folio CSS variables.
 * Slide up 12px with fade, 3 to 5s, swipe to dismiss, polite live region.
 */
export function ToastHost() {
  return (
    <Toaster
      position="bottom-center"
      expand={false}
      visibleToasts={2}
      toastOptions={{
        style: {
          background: 'var(--surface)',
          color: 'var(--ink)',
          border: '1px solid var(--line)',
          borderRadius: 'var(--radius-sm)',
          boxShadow: 'var(--shadow-2)',
          fontFamily: 'var(--font-ui)',
          fontSize: '14px',
          padding: '12px 16px',
        },
        actionButtonStyle: {
          background: 'var(--ink)',
          color: 'var(--bg)',
          borderRadius: 'var(--radius-xs)',
          fontFamily: 'var(--font-ui)',
          fontWeight: 500,
          padding: '6px 12px',
          minHeight: '34px',
        },
      }}
    />
  );
}
