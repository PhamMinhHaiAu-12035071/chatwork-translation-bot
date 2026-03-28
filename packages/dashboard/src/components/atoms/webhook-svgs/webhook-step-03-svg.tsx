export function WebhookStep03Svg() {
  return (
    <svg
      viewBox="0 0 260 106"
      width="260"
      xmlns="http://www.w3.org/2000/svg"
      role="img"
      aria-label="Chatwork webhook settings — paste the bot URL into the Webhook URL field"
    >
      {/* Top nav */}
      <rect width="260" height="26" fill="#1a1f36" />
      <circle cx="12" cy="13" r="4" fill="#e84040" />
      <text x="20" y="17" fontFamily="sans-serif" fontSize="8" fill="white" fontWeight="bold">
        Edit Webhook
      </text>

      {/* Form area */}
      <rect y="26" width="260" height="80" fill="white" />

      {/* Row 1: Webhook Name — dimmed context */}
      <line x1="0" y1="26" x2="260" y2="26" stroke="#eee" strokeWidth="1" />
      <text x="10" y="42" fontFamily="sans-serif" fontSize="7.5" fill="#bbb">
        Webhook Name
      </text>
      <rect
        x="90"
        y="30"
        width="162"
        height="16"
        rx="2"
        fill="#fafafa"
        stroke="#e0e0e0"
        strokeWidth="1"
      />
      <text x="96" y="41" fontFamily="sans-serif" fontSize="7.5" fill="#ccc">
        JP Project Demo
      </text>

      {/* Divider */}
      <line x1="0" y1="50" x2="260" y2="50" stroke="#eee" strokeWidth="1" />

      {/* Row 2: Webhook URL — HIGHLIGHTED */}
      <text x="10" y="66" fontFamily="sans-serif" fontSize="7.5" fill="#444" fontWeight="500">
        Webhook URL
      </text>
      {/* Required badge */}
      <rect
        x="79"
        y="58"
        width="34"
        height="11"
        rx="1"
        fill="none"
        stroke="#e84040"
        strokeWidth="1"
      />
      <text x="96" y="67" fontFamily="sans-serif" fontSize="6.5" fill="#e84040" textAnchor="middle">
        Required
      </text>

      {/* URL input — red highlight */}
      <rect
        x="118"
        y="55"
        width="134"
        height="18"
        rx="2"
        fill="rgba(232,64,64,0.05)"
        stroke="#e84040"
        strokeWidth="2"
      />
      <text x="123" y="67" fontFamily="sans-serif" fontSize="6.5" fill="#555">
        https://your-bot.server.com/webhook
      </text>

      {/* Helper text */}
      <text x="118" y="82" fontFamily="sans-serif" fontSize="6.5" fill="#aaa">
        Enter URL that starts with https.
      </text>

      {/* Pill label */}
      <rect x="122" y="44" width="82" height="12" rx="6" fill="#e84040" />
      <text x="163" y="53" fontFamily="sans-serif" fontSize="7" fill="white" textAnchor="middle">
        Paste URL here ↓
      </text>
    </svg>
  )
}
