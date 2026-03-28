export function WebhookStep01Svg() {
  return (
    <svg
      viewBox="0 0 260 170"
      width="260"
      xmlns="http://www.w3.org/2000/svg"
      role="img"
      aria-label="Chatwork Admin — navigate to Integrations → API → Webhook"
    >
      {/* Top nav bar */}
      <rect width="260" height="30" fill="#1a1f36" />
      <circle cx="14" cy="15" r="5" fill="#e84040" />
      <text x="24" y="19" fontFamily="sans-serif" fontSize="9" fill="white" fontWeight="bold">
        Chatwork
      </text>
      <text x="214" y="19" fontFamily="sans-serif" fontSize="8" fill="#888">
        Logout
      </text>

      {/* Sidebar */}
      <rect y="30" width="128" height="140" fill="#f5f5f5" />
      <line x1="128" y1="30" x2="128" y2="170" stroke="#ddd" strokeWidth="1" />

      {/* Main content hint */}
      <rect x="128" y="30" width="132" height="140" fill="white" />
      <text x="158" y="80" fontFamily="sans-serif" fontSize="8" fill="#e0e0e0">
        Admin Panel
      </text>

      {/* Integrations section header */}
      <rect x="0" y="40" width="3" height="12" fill="#e84040" />
      <text x="9" y="50" fontFamily="sans-serif" fontSize="8" fill="#e84040" fontWeight="bold">
        Integrations
      </text>

      {/* Integrations sub-items */}
      <text x="13" y="65" fontFamily="sans-serif" fontSize="7.5" fill="#555">
        3rd-Party Integrations
      </text>
      <text x="13" y="78" fontFamily="sans-serif" fontSize="7.5" fill="#555">
        Authorized OAuth Service
      </text>

      {/* API section header */}
      <rect x="0" y="88" width="3" height="12" fill="#e84040" />
      <text x="9" y="98" fontFamily="sans-serif" fontSize="8" fill="#e84040" fontWeight="bold">
        API
      </text>

      {/* API sub-items */}
      <text x="13" y="113" fontFamily="sans-serif" fontSize="7.5" fill="#555">
        API Token
      </text>
      <text x="13" y="126" fontFamily="sans-serif" fontSize="7.5" fill="#555">
        OAuth
      </text>

      {/* Webhook item — highlighted */}
      <rect x="0" y="131" width="128" height="20" fill="rgba(232,64,64,0.07)" />
      <rect x="0" y="131" width="3" height="20" fill="#e84040" />
      <text x="9" y="145" fontFamily="sans-serif" fontSize="8" fill="#1a1a2e" fontWeight="bold">
        ▶ Webhook
      </text>

      {/* Red dashed highlight border */}
      <rect
        x="2"
        y="132"
        width="124"
        height="18"
        rx="2"
        fill="none"
        stroke="#e84040"
        strokeWidth="1.5"
        strokeDasharray="3,2"
      />

      {/* Pill label */}
      <rect x="58" y="120" width="64" height="12" rx="6" fill="#e84040" />
      <text x="90" y="129" fontFamily="sans-serif" fontSize="7" fill="white" textAnchor="middle">
        ← Click here
      </text>
    </svg>
  )
}
