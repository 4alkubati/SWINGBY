// moderation.js — client half of report + block (App Store Guideline 1.2).
//
// Backend: backend/app/api/moderation.py, mounted at /moderation.
//
// Two mechanisms, both of which Apple requires an app with user-generated
// content to ship, and both of which a reviewer WILL go looking for:
//
//   report — flag a message, review, job post, photo, business or person
//   block  — stop hearing from someone at all
//
// Blocking is stored one-way and enforced symmetrically by the backend, so
// there is deliberately no "who blocked me" call here: the app can ask whether
// a conversation is blocked (isBlocked) but never which side did it. Telling
// someone they have been blocked is how a block becomes an escalation.
//
// Nothing here throws for the caller to translate — every function returns a
// plain value or lets the axios error through, matching googleReviews.js.
//
// `api` UNWRAPS the axios response to its JSON body (api.js — the response
// interceptor returns `response.data`). Every function here originally read
// `res.data.items`, which is `undefined.items` on an already-unwrapped body —
// so listBlockedUsers, listMyReports and listReportQueue silently returned []
// forever and isBlocked() always answered false. That made the Guideline 1.2
// block/report surfaces look shipped while doing nothing. Read `res` directly.

import { api } from './api';

/**
 * Every surface in the app that can carry user-generated content.
 * Mirrors content_reports.target_type in migration 20260731090000; a value the
 * backend does not recognise is a 400, so these are the only legal strings.
 */
export const REPORT_TARGETS = {
  MESSAGE: 'message',
  REVIEW: 'review',
  SERVICE_POST: 'service_post',
  BUSINESS: 'business',
  USER: 'user',
  BOOKING_PHOTO: 'booking_photo',
  VOICE_NOTE: 'voice_note',
};

/**
 * The reasons offered in the report sheet, in the order they are shown.
 * `key` is what the backend stores; `labelKey` is the i18n lookup. Kept as one
 * ordered list rather than an object so the sheet renders straight from it and
 * a new reason cannot be added to one half without the other.
 */
export const REPORT_REASONS = [
  { key: 'harassment', labelKey: 'moderation.reasonHarassment' },
  { key: 'hate_speech', labelKey: 'moderation.reasonHateSpeech' },
  { key: 'sexual_content', labelKey: 'moderation.reasonSexualContent' },
  { key: 'violence', labelKey: 'moderation.reasonViolence' },
  { key: 'scam_or_fraud', labelKey: 'moderation.reasonScam' },
  { key: 'off_platform_solicitation', labelKey: 'moderation.reasonOffPlatform' },
  { key: 'spam', labelKey: 'moderation.reasonSpam' },
  { key: 'other', labelKey: 'moderation.reasonOther' },
];

/**
 * File a report.
 *
 * Resolves `{ ok: true }` on success and `{ ok: false, alreadyReported: true }`
 * on a 409 — a duplicate is not a failure worth an error dialog, it means the
 * report is already in the queue, and the sheet says so.
 */
export async function reportContent({ targetType, targetId, reason, details }) {
  try {
    const res = await api.post('/moderation/reports', {
      target_type: targetType,
      target_id: targetId,
      reason,
      details: details || null,
    });
    return { ok: true, report: res };
  } catch (err) {
    if (err?.response?.status === 409) {
      return { ok: false, alreadyReported: true };
    }
    throw err;
  }
}

/** Reports the signed-in user filed. Auto-filed rows are excluded server-side. */
export async function listMyReports() {
  const res = await api.get('/moderation/reports/mine');
  return res?.items || [];
}

/** Block a user. Idempotent — blocking twice is a success, not a 409. */
export async function blockUser(userId, reason) {
  const res = await api.post('/moderation/blocks', {
    blocked_id: userId,
    reason: reason || null,
  });
  return res;
}

/** Unblock. Idempotent — unblocking someone who is not blocked is a success. */
export async function unblockUser(userId) {
  const res = await api.delete(`/moderation/blocks/${userId}`);
  return res;
}

/** Accounts the signed-in user has blocked — backs Settings → Safety. */
export async function listBlockedUsers() {
  const res = await api.get('/moderation/blocks');
  return res?.items || [];
}

/**
 * Is there a block in EITHER direction between me and `userId`?
 *
 * The chat screen calls this to render a "you can't reply in this thread" state
 * instead of letting someone type a message that will 403 on send. Fails open
 * (returns false) so a moderation lookup outage cannot lock a working thread —
 * the send itself is still gated server-side, which is the real enforcement.
 */
export async function isBlocked(userId) {
  if (!userId) return false;
  try {
    const res = await api.get(`/moderation/blocks/check/${userId}`);
    return Boolean(res?.blocked);
  } catch {
    return false;
  }
}

// ── Admin ────────────────────────────────────────────────────────────────────
// Report review lives in-app rather than in web/admin/, for the same reason
// refund decisions did: web/admin/ is not deployed.

export async function listReportQueue() {
  const res = await api.get('/moderation/reports/admin/queue');
  return res?.items || [];
}

/**
 * Resolve a report. `action` is one of:
 *   none            reviewed, nothing wrong (dismisses)
 *   content_hidden  stamp hidden_at so the content stops rendering
 *   user_warned     recorded, no automatic consequence
 *   user_suspended  flip users.is_suspended
 */
export async function resolveReport(reportId, action, resolution) {
  const res = await api.patch(`/moderation/reports/${reportId}/resolve`, {
    action_taken: action,
    resolution: resolution || null,
  });
  return res;
}
