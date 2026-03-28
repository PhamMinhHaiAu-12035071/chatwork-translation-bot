export function WebhookStep06Svg() {
  return (
    <svg
      viewBox="0 0 260 90"
      width="260"
      xmlns="http://www.w3.org/2000/svg"
      role="img"
      aria-label="Chatwork webhook edit form — note the Room ID from the room filter field before creating a room"
    >
      {/* Top nav */}
      <rect width="260" height="26" fill="#1a1f36" />
      <circle cx="12" cy="13" r="4" fill="#e84040" />
      <text x="20" y="17" fontFamily="sans-serif" fontSize="8" fill="white" fontWeight="bold">
        Edit Webhook
      </text>

      {/* Form area */}
      <rect y="26" width="260" height="64" fill="white" />

      {/* Dimmed row — Room Event context */}
      <line x1="0" y1="26" x2="260" y2="26" stroke="#eee" strokeWidth="1" />
      <text x="10" y="42" fontFamily="sans-serif" fontSize="7" fill="#bbb">
        Event
      </text>
      <circle cx="90" cy="39" r="4" fill="none" stroke="#4a90d9" strokeWidth="1.5" />
      <circle cx="90" cy="39" r="2.5" fill="#4a90d9" />
      <text x="98" y="43" fontFamily="sans-serif" fontSize="7" fill="#bbb">
        Room Event ✓
      </text>

      {/* Divider */}
      <line x1="0" y1="50" x2="260" y2="50" stroke="#eee" strokeWidth="1" />

      {/* Room ID label */}
      <text x="10" y="66" fontFamily="sans-serif" fontSize="7.5" fill="#444" fontWeight="500">
        Room ID:
      </text>

      {/* Room ID value — highlighted */}
      <rect
        x="50"
        y="56"
        width="82"
        height="16"
        rx="2"
        fill="rgba(232,64,64,0.08)"
        stroke="#e84040"
        strokeWidth="3"
      />
      <text x="56" y="67" fontFamily="sans-serif" fontSize="8" fill="#1a1a2e" fontWeight="bold">
        424846369
      </text>

      {/* Label shadow */}
      <rect x="56" y="45" width="80" height="14" rx="14" fill="#1a1a2e" />
      {/* Label — Shantell Sans, dark outline */}
      <rect
        x="52"
        y="41"
        width="80"
        height="14"
        rx="14"
        fill="#e84040"
        stroke="#1a1a2e"
        strokeWidth="2.5"
      />
      <text
        x="92"
        y="51.5"
        fontFamily="'Shantell Sans', cursive"
        fontSize="7.5"
        fill="white"
        fontWeight="800"
        textAnchor="middle"
      >
        Note this ID ↓
      </text>
    </svg>
  )
}
