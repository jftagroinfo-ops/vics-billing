import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.sma.erp',
  appName: 'SMA ERP',
  webDir: 'dist',
  server: {
    androidScheme: 'https'
  }
};

export default config;
