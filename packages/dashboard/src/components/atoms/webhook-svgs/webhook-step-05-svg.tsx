export function WebhookStep05Svg() {
  return (
    <svg
      viewBox="0 0 260 90"
      width="260"
      xmlns="http://www.w3.org/2000/svg"
      role="img"
      aria-label="Chatwork webhook settings — click Save to activate the webhook"
    >
      {/* Top nav */}
      <rect width="260" height="26" fill="#1a1f36" />
      <circle cx="12" cy="13" r="4" fill="#e84040" />
      <text x="20" y="17" fontFamily="sans-serif" fontSize="8" fill="white" fontWeight="bold">
        Edit Webhook
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

      {/* Back button */}
      <rect
        x="10"
        y="58"
        width="44"
        height="20"
        rx="3"
        fill="white"
        stroke="#bbb"
        strokeWidth="1.5"
      />
      <text x="32" y="71" fontFamily="sans-serif" fontSize="8" fill="#666" textAnchor="middle">
        Back
      </text>

      {/* 3D shadow — behind Save button */}
      <rect x="193" y="57" width="62" height="30" rx="4" fill="#1a1a2e" />
      {/* Save button bg — covers shadow in center */}
      <rect x="192" y="56" width="56" height="24" rx="3" fill="#1a4080" />
      {/* Highlight border — thick solid, no dash */}
      <rect
        x="189"
        y="53"
        width="62"
        height="30"
        rx="4"
        fill="rgba(232,64,64,0.08)"
        stroke="#e84040"
        strokeWidth="3"
      />
      {/* Save text — on top */}
      <text
        x="220"
        y="71"
        fontFamily="sans-serif"
        fontSize="9"
        fill="white"
        fontWeight="bold"
        textAnchor="middle"
      >
        Save
      </text>

      {/* Label shadow */}
      <rect x="192" y="45" width="72" height="14" rx="14" fill="#1a1a2e" />
      {/* Label — Shantell Sans, dark outline */}
      <rect
        x="188"
        y="41"
        width="72"
        height="14"
        rx="14"
        fill="#e84040"
        stroke="#1a1a2e"
        strokeWidth="2.5"
      />
      <text
        x="224"
        y="51.5"
        fontFamily="'Shantell Sans', cursive"
        fontSize="7.5"
        fill="white"
        fontWeight="800"
        textAnchor="middle"
      >
        Click to save ↓
      </text>

      {/* Delete link — context */}
      <text x="10" y="84" fontFamily="sans-serif" fontSize="7" fill="#bbb">
        × Delete
      </text>
    </svg>
  )
}
