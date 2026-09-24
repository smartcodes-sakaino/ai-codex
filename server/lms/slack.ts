// Minimal Slack Web API client — just chat.postMessage with a bot token.
// SLACK_BOT_TOKEN unset means Slack is simply not configured, not an error:
// the in-app stagnation badge still works on its own.

export function isSlackConfigured(): boolean {
  return !!process.env.SLACK_BOT_TOKEN;
}

export async function postSlackMessage(channel: string, text: string): Promise<void> {
  const token = process.env.SLACK_BOT_TOKEN;
  if (!token) throw new Error("SLACK_BOT_TOKEN is not set");
  const res = await fetch("https://slack.com/api/chat.postMessage", {
    method: "POST",
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ channel, text }),
  });
  const data = (await res.json()) as { ok: boolean; error?: string };
  if (!data.ok) {
    // e.g. "channel_not_found" / "not_in_channel" when the bot hasn't been invited.
    throw new Error(`Slack API error: ${data.error ?? res.status}`);
  }
}
