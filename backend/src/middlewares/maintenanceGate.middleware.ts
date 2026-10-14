import { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';
import { prisma } from '../utils/prisma';
import { JWT_SECRET } from '../utils/config';

// WordPress-style "Coming soon" gate - new to this app (no old equivalent),
// turned on/off and given its password via the admin's Settings page
// (SettingsConfig.maintenanceModeEnabled/maintenancePassword). While on,
// every PUBLIC page shows a branded password screen instead of the real
// site; /api and /admin stay reachable so the team can keep managing
// content and testing with the admin panel's own real login, same as how
// WordPress maintenance-mode plugins leave wp-admin reachable while gating
// the front end.
//
// The unlock cookie stores a hash of the currently-configured password
// (not the password itself, and not an opaque token) - so changing the
// password in Settings immediately invalidates every previously-issued
// cookie without needing a session store.
const COOKIE_NAME = 'site_unlocked';
const COOKIE_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

function unlockHash(password: string): string {
  return crypto.createHmac('sha256', JWT_SECRET).update(password).digest('hex');
}

function parseCookies(header: string | undefined): Record<string, string> {
  const out: Record<string, string> = {};
  if (!header) return out;
  for (const part of header.split(';')) {
    const idx = part.indexOf('=');
    if (idx === -1) continue;
    const key = part.slice(0, idx).trim();
    const value = part.slice(idx + 1).trim();
    if (key) out[key] = decodeURIComponent(value);
  }
  return out;
}

function renderGatePage(opts: { redirect: string; error?: boolean }): string {
  return `<!DOCTYPE html>
<html lang="de"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex, nofollow">
<title>Flugschule Hirondelle</title>
<style>
  body { font-family: Arial, Helvetica, sans-serif; background: #0f172a; color: #e2e8f0; margin: 0; min-height: 100vh; display: flex; align-items: center; justify-content: center; }
  .card { background: #1e293b; padding: 40px; border-radius: 10px; max-width: 420px; width: 90%; box-shadow: 0 10px 30px rgba(0,0,0,0.4); text-align: center; }
  h1 { font-size: 22px; margin: 0 0 12px; color: #fff; }
  p { color: #94a3b8; font-size: 14px; line-height: 1.5; margin: 0 0 24px; }
  input[type="password"] { width: 100%; box-sizing: border-box; padding: 12px 14px; border-radius: 6px; border: 1px solid #334155; background: #0f172a; color: #fff; font-size: 15px; margin-bottom: 14px; }
  button { width: 100%; padding: 12px; border-radius: 6px; border: none; background: #ab8942; color: #fff; font-size: 15px; font-weight: bold; cursor: pointer; }
  button:hover { background: #937234; }
  .error { color: #f87171; font-size: 13px; margin: -8px 0 14px; }
</style>
</head><body>
  <div class="card">
    <h1>Diese Seite befindet sich im Aufbau</h1>
    <p>Wir arbeiten gerade an der neuen Website. Wenn Sie ein Passwort haben, geben Sie es unten ein.</p>
    ${opts.error ? '<div class="error">Falsches Passwort. Bitte erneut versuchen.</div>' : ''}
    <form method="POST" action="/__unlock">
      <input type="hidden" name="redirect" value="${opts.redirect.replace(/"/g, '&quot;')}" />
      <input type="password" name="password" placeholder="Passwort" autofocus required />
      <button type="submit">Weiter</button>
    </form>
  </div>
</body></html>`;
}

export async function maintenanceGate(req: Request, res: Response, next: NextFunction) {
  // API calls and the admin SPA (its own real JWT login governs access
  // there) always pass through untouched. Any actual static file (the
  // built /assets/*.js|css bundle both /admin and the public site load,
  // uploaded images under /uploads, favicons etc.) must pass through too -
  // a gated visitor never gets served the real index.html that references
  // those URLs in the first place (this gate's own page has no asset
  // references at all), so letting them resolve here is safe and doesn't
  // leak anything; without this, /admin's own JS bundle request was being
  // gated too, so the admin SPA never booted - a blank white screen.
  const hasFileExtension = /\.[a-zA-Z0-9]+$/.test(req.path);
  if (req.path.startsWith('/api') || req.path.startsWith('/admin') || req.path === '/__unlock' || hasFileExtension) {
    return next();
  }

  const settings = await prisma.settingsConfig.findUnique({ where: { id: 'default' } });
  if (!settings?.maintenanceModeEnabled || !settings.maintenancePassword) return next();

  const expected = unlockHash(settings.maintenancePassword);
  const cookies = parseCookies(req.headers.cookie);
  if (cookies[COOKIE_NAME] === expected) return next();

  return res.status(200).send(renderGatePage({ redirect: req.originalUrl }));
}

export async function handleUnlockSubmit(req: Request, res: Response) {
  const settings = await prisma.settingsConfig.findUnique({ where: { id: 'default' } });
  const password = typeof req.body?.password === 'string' ? req.body.password : '';
  const redirect = typeof req.body?.redirect === 'string' && req.body.redirect.startsWith('/') ? req.body.redirect : '/';

  if (!settings?.maintenancePassword || password !== settings.maintenancePassword) {
    return res.status(200).send(renderGatePage({ redirect, error: true }));
  }

  res.cookie(COOKIE_NAME, unlockHash(settings.maintenancePassword), {
    httpOnly: true,
    maxAge: COOKIE_MAX_AGE_MS,
    sameSite: 'lax',
  });
  return res.redirect(redirect);
}
