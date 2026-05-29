import { hashString, hashToRange } from "@/lib/utils/hash";

// The dashboard needs engagement numbers (opens, replies, meetings) that we don't actually track in
// this MVP. We fake them — but deterministically from the campaign id, so a given campaign always
// shows the same figures. Never Math.random() here: it would differ between the server render and
// the client, causing a hydration mismatch and numbers that flicker on every reload.
//
// IMPORTANT: open rate, reply rate, meetings, the activity bars, and "replied" contact statuses are
// ALL mock. We don't read the Gmail inbox, so there's no real reply/open detection — that's future
// work. These mocks only make sense once a campaign has actually sent something, so the dashboard
// gates them to active/completed campaigns. A draft has sent nothing and must show zeros / pending.

const OPEN_RATE_MIN = 40;
const OPEN_RATE_MAX = 65;
const REPLY_RATE_MIN = 8;
const REPLY_RATE_MAX = 18;
const MEETING_RATE_MIN = 1; // percent of enrolled
const MEETING_RATE_MAX = 5;

export type CampaignMetrics = {
  openRate: number; // percent
  replyRate: number; // percent
  meetingsBooked: number; // absolute count
};

export function getCampaignMetrics(campaignId: string, enrolledCount: number): CampaignMetrics {
  const openRate = hashToRange(`${campaignId}:open`, OPEN_RATE_MIN, OPEN_RATE_MAX);
  const replyRate = hashToRange(`${campaignId}:reply`, REPLY_RATE_MIN, REPLY_RATE_MAX);
  const meetingPct = hashToRange(`${campaignId}:meetings`, MEETING_RATE_MIN, MEETING_RATE_MAX);

  return {
    openRate,
    replyRate,
    meetingsBooked: Math.round((meetingPct / 100) * enrolledCount),
  };
}

export type ActivityPoint = { day: string; sends: number };
const DAYS_OF_ACTIVITY = 7;

// Seven days of fake daily send counts for the bar chart. Seeded per campaign + day so the bars are
// stable. Scaled to the campaign size so a 4-physician campaign doesn't show 30-send days.
// A draft hasn't sent anything, so its bars are flat zero — only launched campaigns get mock activity.
export function getActivitySeries(
  campaignId: string,
  enrolledCount: number,
  launched: boolean,
): ActivityPoint[] {
  const peak = Math.max(2, enrolledCount);
  return Array.from({ length: DAYS_OF_ACTIVITY }, (_, i) => {
    const daysAgo = DAYS_OF_ACTIVITY - 1 - i;
    return {
      day: daysAgo === 0 ? "Today" : `${daysAgo}d ago`,
      sends: launched ? hashToRange(`${campaignId}:day:${i}`, 0, peak) : 0,
    };
  });
}

export type ContactStatus = "pending" | "contacted" | "replied" | "bounced";

// Hashed per-physician status for physicians whose enrollment is still 'pending' (no real send yet).
// Weighted roughly 70 contacted / 15 replied / 5 bounced / 10 pending, per the spec. "replied" here
// is mock — we don't read the inbox, so a real reply is never actually detected.
export function getMockContactStatus(campaignId: string, physicianId: string): ContactStatus {
  const roll = hashString(`${campaignId}:${physicianId}`) % 100;
  if (roll < 70) return "contacted";
  if (roll < 85) return "replied";
  if (roll < 90) return "bounced";
  return "pending";
}

// Decide what status to show for one physician.
//  1. Real enrollment status always wins once the drain has written it (contacted / bounced).
//  2. Otherwise the physician is still 'pending'. We only invent a mock status for launched
//     (active/completed) campaigns — a draft has sent nothing, so everyone genuinely shows Pending.
export function resolveContactStatus(
  campaignId: string,
  physicianId: string,
  enrollmentStatus: string,
  campaignStatus: string,
): ContactStatus {
  if (enrollmentStatus !== "pending") return enrollmentStatus as ContactStatus;
  if (campaignStatus === "draft") return "pending";
  return getMockContactStatus(campaignId, physicianId);
}
