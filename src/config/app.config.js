/**
 * app.config.js — APP IDENTITY & AUTH CONFIG
 *
 * Branding, theme, and auth configuration only.
 * Routes are self-declared by each page (export const route).
 * Nav items are self-declared by each page (export const nav).
 * Tables are auto-discovered from mockData/*.json files.
 */

export const APP_CONFIG = {
  name: 'Recundle',
  tagline: 'Track. Bundle. Recundle.',
  emoji: '🚀',
  icon: 'Box',

  defaultTheme: 'system',
  defaultLoginRoute: '/',
};

/**
 * Per-role auth routes and copy.
 * null when the app has no distinct profiles (uses GENERIC_AUTH instead).
 */
export const AUTH_PROFILES = null;

/**
 * Fallback auth copy when AUTH_PROFILES is null or URL profile doesn't match.
 */
export const GENERIC_AUTH = {
  loginTitle: 'Welcome to Recundle',
  signupTitle: 'Welcome to Recundle',
  loginDescription: 'Track. Bundle. Recundle.',
  signupDescription: 'Track. Bundle. Recundle.',
  redirectAfterAuth: '/dashboard',
};
