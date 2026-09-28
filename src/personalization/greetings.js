import { APP_CONFIG } from '@/config/app.config';

/**
 * Copy helpers for addressing the user by name. Every helper degrades to
 * natural, name-free copy when no preferred name is known.
 */

export function getTimeOfDayGreeting(date = new Date()) {
  const hour = date.getHours();
  if (hour >= 5 && hour < 12) return 'Good morning';
  if (hour >= 12 && hour < 17) return 'Good afternoon';
  return 'Good evening';
}

/** "Good morning, Priya." */
export function getGreeting(name, date = new Date()) {
  const greeting = getTimeOfDayGreeting(date);
  return name ? `${greeting}, ${name}.` : `${greeting}.`;
}

/** "Hi Priya, welcome to Recundle." — the primary post-login greeting. */
export function getPersonalizedGreeting(name) {
  return name
    ? `Hi ${name}, welcome to ${APP_CONFIG.name}.`
    : `Welcome to ${APP_CONFIG.name}.`;
}

/**
 * Leads a sentence with the user's name: ("Priya", "Here's what's coming up.")
 * → "Priya, here's what's coming up." Use sparingly, where it reads naturally.
 */
export function addressUser(name, sentence) {
  const text = String(sentence ?? '').trim();
  if (!text) return '';
  if (!name) return text.charAt(0).toUpperCase() + text.slice(1);
  return `${name}, ${text.charAt(0).toLowerCase()}${text.slice(1)}`;
}
