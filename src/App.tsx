/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { AppProviders } from './app/providers';
import { AppRoutes } from './app/routes';
import { ToastHost } from './ui/ToastHost';

export default function App() {
  return (
    <AppProviders>
      <AppRoutes />
      <ToastHost />
    </AppProviders>
  );
}
