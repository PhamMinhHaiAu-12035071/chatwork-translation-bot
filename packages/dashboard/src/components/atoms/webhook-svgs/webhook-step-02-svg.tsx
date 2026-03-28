export function WebhookStep02Svg() {
  return (
    <svg
      viewBox="0 0 260 130"
      width="260"
      xmlns="http://www.w3.org/2000/svg"
      role="img"
      aria-label="Chatwork Admin — click Add webhook to create a new webhook"
    >
      {/* Top nav */}
      <rect width="260" height="30" fill="#1a1f36" />
      <circle cx="14" cy="15" r="5" fill="#e84040" />
      <text x="24" y="19" fontFamily="sans-serif" fontSize="9" fill="white" fontWeight="bold">
        Chatwork Admin
      </text>

      {/* Page content */}
      <rect y="30" width="260" height="100" fill="white" />

      {/* Page title */}
      <text x="12" y="54" fontFamily="sans-serif" fontSize="12" fill="#1a1a2e" fontWeight="bold">
        Webhook
      </text>

      {/* 3D shadow — behind button */}
      <rect x="171" y="39" width="84" height="28" rx="4" fill="#1a1a2e" />
      {/* Add webhook button bg — covers shadow in center */}
      <rect x="170" y="38" width="78" height="22" rx="3" fill="#1a4080" />
      {/* Highlight rect — thick solid, no dash */}
      <rect
        x="167"
        y="35"
        width="84"
        height="28"
        rx="4"
        fill="rgba(232,64,64,0.08)"
        stroke="#e84040"
        strokeWidth="3"
      />
      {/* Button text — on top */}
      <text
        x="209"
        y="52"
        fontFamily="sans-serif"
        fontSize="8"
        fill="white"
        fontWeight="bold"
        textAnchor="middle"
      >
        + Add webhook
      </text>

      {/* Label shadow */}
      <rect x="179" y="27" width="68" height="14" rx="14" fill="#1a1a2e" />
      {/* Label — Shantell Sans, dark outline */}
      <rect
        x="175"
        y="23"
        width="68"
        height="14"
        rx="14"
        fill="#e84040"
        stroke="#1a1a2e"
        strokeWidth="2.5"
      />
      <text
        x="209"
        y="33.5"
        fontFamily="'Shantell Sans', cursive"
        fontSize="7.5"
        fill="white"
        fontWeight="800"
        textAnchor="middle"
      >
        ← Click here
      </text>

      {/* Divider */}
      <line x1="8" y1="68" x2="252" y2="68" stroke="#eee" strokeWidth="1" />

      {/* Table header */}
      <rect x="8" y="70" width="244" height="14" fill="#f5f5f5" />
      <text x="16" y="80" fontFamily="sans-serif" fontSize="7" fill="#999">
        Webhook Name
      </text>
      <text x="120" y="80" fontFamily="sans-serif" fontSize="7" fill="#999">
        Webhook URL
      </text>
      <text x="210" y="80" fontFamily="sans-serif" fontSize="7" fill="#999">
        Status
      </text>

      {/* Table row */}
      <line x1="8" y1="84" x2="252" y2="84" stroke="#eee" strokeWidth="0.5" />
      <text x="16" y="96" fontFamily="sans-serif" fontSize="7" fill="#555">
        My Translation Bot
      </text>
      <text x="120" y="96" fontFamily="sans-serif" fontSize="7" fill="#555">
        https://mybot.example.com/...
      </text>
      <circle cx="212" cy="93" r="3" fill="#5bb89a" />

      {/* Empty hint */}
      <line x1="8" y1="100" x2="252" y2="100" stroke="#eee" strokeWidth="0.5" />
      <text x="16" y="116" fontFamily="sans-serif" fontSize="7" fill="#ccc" fontStyle="italic">
        Use the button above to add a new webhook.
      </text>
    </svg>
  )
}
