export function WebhookStep04Svg() {
  return (
    <svg
      viewBox="0 0 260 156"
      width="260"
      xmlns="http://www.w3.org/2000/svg"
      role="img"
      aria-label="Chatwork webhook settings — select Room Event, tick Message created and Message updated, enter Room ID"
    >
      {/* Top nav */}
      <rect width="260" height="26" fill="#1a1f36" />
      <circle cx="12" cy="13" r="4" fill="#e84040" />
      <text x="20" y="17" fontFamily="sans-serif" fontSize="8" fill="white" fontWeight="bold">
        Edit Webhook
      </text>

      {/* Form area */}
      <rect y="26" width="260" height="130" fill="white" />

      {/* Webhook URL row — dimmed context */}
      <line x1="0" y1="26" x2="260" y2="26" stroke="#eee" strokeWidth="1" />
      <text x="10" y="42" fontFamily="sans-serif" fontSize="7" fill="#bbb">
        Webhook URL
      </text>
      <rect
        x="88"
        y="30"
        width="164"
        height="14"
        rx="2"
        fill="#fafafa"
        stroke="#e0e0e0"
        strokeWidth="1"
      />
      <text x="94" y="40" fontFamily="sans-serif" fontSize="6.5" fill="#ccc">
        https://your-bot.server.com/webhook
      </text>

      {/* Divider */}
      <line x1="0" y1="48" x2="260" y2="48" stroke="#eee" strokeWidth="1" />

      {/* Event row label */}
      <text x="10" y="65" fontFamily="sans-serif" fontSize="7.5" fill="#444" fontWeight="500">
        Event
      </text>
      {/* Required badge */}
      <rect
        x="38"
        y="57"
        width="34"
        height="11"
        rx="1"
        fill="none"
        stroke="#e84040"
        strokeWidth="1"
      />
      <text x="55" y="66" fontFamily="sans-serif" fontSize="6.5" fill="#e84040" textAnchor="middle">
        Required
      </text>

      {/* Account Event radio — unselected */}
      <rect
        x="88"
        y="56"
        width="72"
        height="18"
        rx="9"
        fill="white"
        stroke="#bbb"
        strokeWidth="1.5"
      />
      <circle cx="99" cy="65" r="4" fill="none" stroke="#bbb" strokeWidth="1.5" />
      <text x="108" y="69" fontFamily="sans-serif" fontSize="7" fill="#666">
        Account Event
      </text>

      {/* Room Event radio — selected */}
      <rect
        x="166"
        y="56"
        width="68"
        height="18"
        rx="9"
        fill="rgba(74,144,217,0.1)"
        stroke="#4a90d9"
        strokeWidth="1.5"
      />
      <circle cx="176" cy="65" r="4" fill="none" stroke="#4a90d9" strokeWidth="1.5" />
      <circle cx="176" cy="65" r="2.5" fill="#4a90d9" />
      <text x="185" y="69" fontFamily="sans-serif" fontSize="7" fill="#1a1a2e" fontWeight="bold">
        Room Event
      </text>

      {/* Message created checkbox */}
      <rect x="88" y="80" width="10" height="10" rx="1.5" fill="#4a90d9" />
      <text x="93" y="89" fontFamily="sans-serif" fontSize="9" fill="white" textAnchor="middle">
        ✓
      </text>
      <text x="103" y="89" fontFamily="sans-serif" fontSize="7.5" fill="#333">
        Message created
      </text>

      {/* Message updated checkbox */}
      <rect x="88" y="95" width="10" height="10" rx="1.5" fill="#4a90d9" />
      <text x="93" y="104" fontFamily="sans-serif" fontSize="9" fill="white" textAnchor="middle">
        ✓
      </text>
      <text x="103" y="104" fontFamily="sans-serif" fontSize="7.5" fill="#333">
        Message updated
      </text>

      {/* Room ID row */}
      <text x="88" y="122" fontFamily="sans-serif" fontSize="7.5" fill="#444">
        Room ID:
      </text>
      <rect
        x="122"
        y="112"
        width="82"
        height="14"
        rx="2"
        fill="white"
        stroke="#bbb"
        strokeWidth="1"
      />
      <text x="128" y="123" fontFamily="sans-serif" fontSize="7.5" fill="#555">
        424846369
      </text>

      {/* Highlight bracket — thick solid, no dash */}
      <rect
        x="84"
        y="52"
        width="172"
        height="78"
        rx="3"
        fill="rgba(232,64,64,0.08)"
        stroke="#e84040"
        strokeWidth="3"
      />

      {/* Label shadow — centered at bracket center x=170, width=168 */}
      <rect x="89" y="140" width="168" height="14" rx="14" fill="#1a1a2e" />
      {/* Label — Shantell Sans, dark outline */}
      <rect
        x="85"
        y="136"
        width="168"
        height="14"
        rx="14"
        fill="#e84040"
        stroke="#1a1a2e"
        strokeWidth="2.5"
      />
      <text
        x="169"
        y="146.5"
        fontFamily="'Shantell Sans', cursive"
        fontSize="7.5"
        fill="white"
        fontWeight="800"
        textAnchor="middle"
      >
        Select + tick both + enter Room ID
      </text>
    </svg>
  )
}
