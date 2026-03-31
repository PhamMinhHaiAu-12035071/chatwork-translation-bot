export interface ContextTemplate {
  key: string
  icon: string
  name: string
  description: string
  body: string
}

export const CONTEXT_TEMPLATES: ContextTemplate[] = [
  {
    key: 'client',
    icon: '🤝',
    name: 'Client Project',
    description: 'Client-facing, formal tone',
    body: `Room type: Client-facing project room.\nProject: [Project name and brief purpose].\nMembers: [Name (Role, gender) — e.g. Khoa (PM, male), Sarah (Client, female), Nam (Dev, male)].\nTone: Respectful, formal. Use appropriate anh/chị based on member gender.`,
  },
  {
    key: 'internal',
    icon: '🏠',
    name: 'Internal Team',
    description: 'Dev/design team, casual OK',
    body: `Room type: Internal team room.\nProject: [Team name or project — e.g. E-commerce platform squad].\nMembers: [Name (Role, gender) — e.g. Khoa (TL, male), Linh (Dev, female), Minh (QA, male)].\nTone: Natural, casual workplace Vietnamese. Peers are fine with casual register.`,
  },
  {
    key: 'tech',
    icon: '⚙️',
    name: 'Tech Dev Room',
    description: 'Engineering, keep tech terms',
    body: `Room type: Engineering/technical room — incidents, deploys, code reviews.\nTeam: [Team name — e.g. Backend squad].\nMembers: [Name (Role) — e.g. Khoa (BE), Nam (FE), Linh (Infra)].\nTone: Technical and concise. Preserve English technical terms (API, deploy, rollback, PR, CI/CD).`,
  },
  {
    key: 'crossteam',
    icon: '📋',
    name: 'Cross-team Meeting',
    description: 'Multi-dept, neutral tone',
    body: `Room type: Cross-functional coordination room.\nDepartments: [List depts — e.g. Engineering, Design, Marketing, Product].\nMembers: [Mixed seniority — e.g. CEO attends weekly review. Include any senior stakeholders].\nTone: Professional and neutral. Use formal register by default.`,
  },
  {
    key: 'exec',
    icon: '👔',
    name: 'Executive / Board',
    description: 'C-level, very formal',
    body: `Room type: Executive / C-level communication room.\nParticipants: [Titles and names — e.g. CEO (Nguyen Van A, male), CFO (Tran Thi B, female), Board members].\nTone: Very formal. Use "Kính gửi", "trân trọng". Always use respectful ông/bà based on participant gender.`,
  },
]
