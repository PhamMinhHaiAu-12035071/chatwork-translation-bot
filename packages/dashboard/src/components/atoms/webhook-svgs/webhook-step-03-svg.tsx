export function WebhookStep03Svg() {
  return (
    <svg
      viewBox="0 0 260 106"
      width="260"
      xmlns="http://www.w3.org/2000/svg"
      role="img"
      aria-label="Chatwork webhook settings — enter a descriptive webhook name"
    >
      {/* Top nav */}
      <rect width="260" height="26" fill="#1a1f36" />
      <circle cx="12" cy="13" r="4" fill="#e84040" />
      <text x="20" y="17" fontFamily="sans-serif" fontSize="8" fill="white" fontWeight="bold">
        Create New Webhook
      </text>

      {/* Form area */}
      <rect y="26" width="260" height="80" fill="white" />

      {/* Row 1: Webhook Name — HIGHLIGHTED */}
      <line x1="0" y1="26" x2="260" y2="26" stroke="#eee" strokeWidth="1" />
      <text x="10" y="42" fontFamily="sans-serif" fontSize="7.5" fill="#444" fontWeight="500">
        Webhook Name
      </text>
      {/* Required badge for Webhook Name */}
      <rect
        x="79"
        y="34"
        width="34"
        height="11"
        rx="1"
        fill="none"
        stroke="#e84040"
        strokeWidth="1"
      />
      <text x="96" y="43" fontFamily="sans-serif" fontSize="6.5" fill="#e84040" textAnchor="middle">
        Required
      </text>

      {/* Name input — thick solid, highlighted */}
      <rect
        x="118"
        y="30"
        width="134"
        height="16"
        rx="3"
        fill="rgba(232,64,64,0.08)"
        stroke="#e84040"
        strokeWidth="3"
      />
      <text x="124" y="41" fontFamily="sans-serif" fontSize="6.5" fill="#555">
        My Translation Bot
      </text>

      {/* Label shadow */}
      <rect x="120" y="17" width="90" height="14" rx="14" fill="#1a1a2e" />
      {/* Label — Shantell Sans, dark outline */}
      <rect
        x="116"
        y="13"
        width="90"
        height="14"
        rx="14"
        fill="#e84040"
        stroke="#1a1a2e"
        strokeWidth="2.5"
      />
      <text
        x="161"
        y="23.5"
        fontFamily="'Shantell Sans', cursive"
        fontSize="7.5"
        fill="white"
        fontWeight="800"
        textAnchor="middle"
      >
        Enter name here ↓
      </text>

      {/* Divider */}
      <line x1="0" y1="50" x2="260" y2="50" stroke="#eee" strokeWidth="1" />

      {/* Row 2: Webhook URL — dimmed context */}
      <text x="10" y="66" fontFamily="sans-serif" fontSize="7.5" fill="#bbb">
        Webhook URL
      </text>
      {/* Required badge - dimmed */}
      <rect
        x="79"
        y="58"
        width="34"
        height="11"
        rx="1"
        fill="none"
        stroke="#e0e0e0"
        strokeWidth="1"
      />
      <text x="96" y="67" fontFamily="sans-serif" fontSize="6.5" fill="#bbb" textAnchor="middle">
        Required
      </text>

      {/* URL input — dimmed */}
      <rect
        x="118"
        y="55"
        width="134"
        height="18"
        rx="3"
        fill="#fafafa"
        stroke="#e0e0e0"
        strokeWidth="1"
      />
      <text x="123" y="67" fontFamily="sans-serif" fontSize="6.5" fill="#ccc">
        (will be filled in next step)
      </text>

      {/* Helper text - dimmed */}
      <text x="118" y="82" fontFamily="sans-serif" fontSize="6.5" fill="#ddd">
        Enter URL that starts with https.
      </text>
    </svg>
  )
}
