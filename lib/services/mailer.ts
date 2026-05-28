// Gmail's hidden ~20/hour rate limit and 500/day cap mean we cannot send to fake addresses
// without burning sender rep. ALLOWED_TEST_RECIPIENTS is a comma-separated list of real
// inboxes (the dev's own + a handful of testers) — anything else is recorded as simulated.

import nodemailer from "nodemailer";

const allowed = (process.env.ALLOWED_TEST_RECIPIENTS ?? "")
  .split(",")
  .map((s) => s.trim().toLowerCase())
  .filter(Boolean);

const SMTP_USER = process.env.SMTP_USER;
const SMTP_APP_PASSWORD = process.env.SMTP_APP_PASSWORD;

// Build the transport once. If creds are missing we never construct it — sendOrSimulate short-circuits.
const transporter =
  SMTP_USER && SMTP_APP_PASSWORD
    ? nodemailer.createTransport({
        host: "smtp.gmail.com",
        port: 587,
        secure: false, // STARTTLS upgrades the connection after the initial handshake
        auth: { user: SMTP_USER, pass: SMTP_APP_PASSWORD },
      })
    : null;

// Gmail throttles aggressively; the drain loop already paces itself, but we pace here too so any
// caller of sendOrSimulate stays under the per-minute ceiling without having to remember to sleep.
const SEND_PACING_MS = 200;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function sendOrSimulate(params: {
  to: string;
  subject: string;
  body: string;
}): Promise<{ simulated: boolean; messageId?: string }> {
  const isAllowed = allowed.includes(params.to.toLowerCase());

  // No creds or not on the allowlist → record as simulated. Either way we still pace, so the
  // drain loop's timing is the same whether a send is real or simulated.
  if (!transporter || !isAllowed) {
    await sleep(SEND_PACING_MS);
    return { simulated: true };
  }

  const info = await transporter.sendMail({
    from: SMTP_USER,
    to: params.to,
    subject: params.subject,
    text: params.body,
  });

  await sleep(SEND_PACING_MS);
  return { simulated: false, messageId: info.messageId };
}
