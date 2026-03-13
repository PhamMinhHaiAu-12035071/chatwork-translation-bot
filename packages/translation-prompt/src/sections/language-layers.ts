export const JAPANESE_RULES = `## Japanese-Specific Rules

### Keigo Register Mapping (Critical)
Detect the politeness level and map to the Vietnamese equivalent — do NOT flatten or elevate:

| Japanese Level      | Example pattern      | Vietnamese Equivalent                |
|---------------------|----------------------|--------------------------------------|
| Teineigo (丁寧語)   | です/ます            | "vui lòng", "cảm ơn", "xin"         |
| Sonkeigo (尊敬語)   | ご〜いただく         | "kính gửi", "trân trọng", "xin phép" |
| Kenjōgo (謙譲語)    | させていただく       | "xin được", "cho phép tôi"           |
| Kudaketa (くだけた) | だ/だよ              | casual Vietnamese, no excess form    |

### Business Email Formulas — Render by Communicative Function
Japanese business email contains conventional opening and closing formulas (e.g., お世話になっております, よろしくお願いいたします, 以上、よろしくお願い申し上げます). Do not translate literally — render as functional Vietnamese that serves the same communicative purpose in context.

- Determine the communicative function of the formula (greeting, closing, request for cooperation, sign-off, etc.) and produce natural functional Vietnamese for that function.
- Do not insert fixed phrases such as "Trân trọng cảm ơn", "cảm ơn", or "xem xét" unless the source text genuinely carries that specific meaning. Inserting them by default is forbidden.
- If the formula is a general polite close with no specific meaning beyond courtesy, render it as a natural Vietnamese polite close appropriate to the register — do not over-specify the sentiment.

### IT/Business International Terms — KEEP IN ENGLISH
These terms are standard in Vietnamese tech workplaces. Do NOT translate them into Vietnamese:
project, release, sprint, deploy, staging, production, deadline, milestone, review, update, report, task, issue, bug, fix, PR, merge, branch, commit, schedule, meeting, agenda, feedback, team, manager, lead, backlog, ticket, pipeline, onboarding, offboarding, dashboard

### Proper Nouns & Names
- Company names, product names: keep in original form.
- Katakana loanwords from English: use the original English word, not Vietnamese transliteration.
  プロジェクト → project | リリース → release | ミーティング → meeting | デプロイ → deploy
- Japanese personal names must stay in original Japanese script. Do not romanize or transliterate names by default.
  If allowRomajiGloss=true, add a reader-first romaji gloss inline in parentheses on first mention only, e.g., 田中さん (Tanaka). Keep later mentions in original script unless repeating the gloss is needed to avoid referential confusion.
  Use plain romaji in the gloss. Do not use Tanaka-san as the default gloss format. Do not turn name glosses into translator notes, endnotes, or glossary-style annotations.
- For Latin/Vietnamese-readable names that carry a Japanese honorific in the source (e.g., Thanhさん), do not retain the raw honorific if it makes the Vietnamese sentence feel translated or unnatural. Rewrite naturally in Vietnamese while staying gender-neutral unless the source explicitly establishes gender.
- Company or organization names normally stay in original form. If allowRomajiGloss=true for a company/organization, gloss it once only when it is a main referent and script-only rendering would slow reader comprehension.
- forbidGenderInference=true: do not infer or assign gender from a Japanese name. Do not add anh/chị or any gender-specific honorifics based on a name alone. Use gender-neutral forms unless the source text explicitly indicates gender.

### Japanese Formatting Conventions
- ※ (annotation marker) → "Lưu ý:"
- 「」 (Japanese quotation marks) → Vietnamese double quotes " "
- ・ (bullet point) → "-"`

export const ENGLISH_RULES = `## English-Specific Rules

### Register & Tone
Detect source register (formal, casual, technical, marketing) and map to equivalent Vietnamese register. Do not change the register or tone.

### Word Choice
- Direct object pronouns matter: "you" vs "they" maps to specific Vietnamese forms
- Passive voice is common in English but often unnatural in Vietnamese — use active voice preferentially
- Questions often expect action — translate as directives in Vietnamese when natural

### Formatting Conventions
- Double quotes " " → Vietnamese double quotes " "
- Bullet points and lists: preserve structure, reflow text naturally`
