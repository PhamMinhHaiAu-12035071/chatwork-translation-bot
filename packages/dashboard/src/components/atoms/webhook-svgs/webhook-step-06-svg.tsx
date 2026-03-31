export function WebhookStep06Svg() {
  return (
    <svg
      viewBox="0 0 260 90"
      width="260"
      xmlns="http://www.w3.org/2000/svg"
      role="img"
      aria-label="Chatwork webhook settings — click Create to save the new webhook"
    >
      {/* Top nav */}
      <rect width="260" height="26" fill="#1a1f36" />
      <circle cx="12" cy="13" r="4" fill="#e84040" />
      <text x="20" y="17" fontFamily="sans-serif" fontSize="8" fill="white" fontWeight="bold">
        Create New Webhook
      </text>

      {/* Form area */}
      <rect y="26" width="260" height="64" fill="white" />

      {/* Status row — dimmed context */}
      <line x1="0" y1="26" x2="260" y2="26" stroke="#eee" strokeWidth="1" />
      <text x="10" y="42" fontFamily="sans-serif" fontSize="7.5" fill="#bbb">
        Status
      </text>
      <circle cx="90" cy="39" r="4" fill="none" stroke="#bbb" strokeWidth="1.5" />
      <circle cx="90" cy="39" r="2.5" fill="#bbb" />
      <text x="98" y="42" fontFamily="sans-serif" fontSize="7.5" fill="#bbb">
        Enable
      </text>

      {/* Divider */}
      <line x1="0" y1="50" x2="260" y2="50" stroke="#eee" strokeWidth="1" />

      {/* 3D shadow — behind Create button */}
      <rect x="99" y="57" width="68" height="30" rx="4" fill="#1a1a2e" />
      {/* Create button bg — blue color */}
      <rect x="98" y="56" width="64" height="24" rx="3" fill="#2563eb" />
      {/* Highlight border — thick solid */}
      <rect
        x="95"
        y="53"
        width="70"
        height="30"
        rx="4"
        fill="rgba(37,99,235,0.08)"
        stroke="#2563eb"
        strokeWidth="3"
      />
      {/* Create text — on top */}
      <text
        x="130"
        y="71"
        fontFamily="sans-serif"
        fontSize="9"
        fill="white"
        fontWeight="bold"
        textAnchor="middle"
      >
        Create
      </text>

      {/* Label shadow */}
      <rect x="94" y="45" width="80" height="14" rx="14" fill="#1a1a2e" />
      {/* Label — Shantell Sans, dark outline */}
      <rect
        x="90"
        y="41"
        width="80"
        height="14"
        rx="14"
        fill="#e84040"
        stroke="#1a1a2e"
        strokeWidth="2.5"
      />
      <text
        x="130"
        y="51.5"
        fontFamily="'Shantell Sans', cursive"
        fontSize="7.5"
        fill="white"
        fontWeight="800"
        textAnchor="middle"
      >
        Click to Create ↓
      </text>
    </svg>
  )
}
