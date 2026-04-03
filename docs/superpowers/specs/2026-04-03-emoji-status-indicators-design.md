# Emoji Status Indicators for Translation Messages

**Version:** 1.0  
**Date:** 2026-04-03  
**Prepared by:** AI-assisted (Claude)  
**Status:** Draft - Pending User Review

---

## Objective

Replace plain `[Created]` and `[Updated]` text indicators with visually striking emoji-decorated Unicode bold status badges that provide instant visual recognition (<1s) of message event type in a team internal context.

**Success Criteria:**
- Created vs Updated distinction is instantly recognizable without reading text
- Format works consistently across desktop and mobile Chatwork apps
- Visual style aligns with team's preference for bold, eye-catching design

---

## Scope

### In Scope
- Replace plain `[Created]` and `[Updated]` status text in translation message headers
- Implement emoji burst decoration pattern (3 emoji + text + 3 emoji)
- Use Unicode bold characters for status text
- Differentiate Created/Updated with distinct emoji themes

### Non-Goals
- Changing any other part of the translation message format
- Adding color support (not possible in Chatwork text)
- Customizable emoji sets per user/room
- Animation or interactive elements

---

## Visual Design

### Format Structure

```
[piconname:{account_id}] {emoji_set} {bold_status} {emoji_set}
{translated_body}
```

### Status Indicators

**Created Message:**
```
[piconname:100] 🌿🌺🌿 𝐂𝐫𝐞𝐚𝐭𝐞𝐝 🌿🌺🌿
Vietnamese translation text here
```

**Updated Message:**
```
[piconname:100] 🔥⚡🔥 𝐔𝐩𝐝𝐚𝐭𝐞𝐝 🔥⚡🔥
Vietnamese translation text here
```

### Visual Language

**Theme Mapping:**
- **Created** → Nature theme (🌿🌺🌿) - represents growth, fresh content, new beginnings
- **Updated** → Energy theme (🔥⚡🔥) - represents change, impact, attention-grabbing alert

**Typography:**
- Unicode Mathematical Bold characters for status text
- Created: `𝐂𝐫𝐞𝐚𝐭𝐞𝐝` (U+1D402 series)
- Updated: `𝐔𝐩𝐝𝐚𝐭𝐞𝐝` (U+1D414 series)

### Design Rationale

**Why emoji burst (3x3 pattern):**
- Creates "explosion" visual effect for maximum attention
- Symmetrical framing emphasizes the status as important
- Aligns with neubrutalism principles: bold, repetitive, no subtlety

**Why different emoji themes:**
- Color-coded visual distinction (green nature vs red/orange energy)
- Leverages universal emoji language for instant recognition
- More reliable than relying solely on text differences

**Why Unicode bold over ASCII caps:**
- More visually striking and distinct from plain text
- Maintains consistent letter spacing
- Smaller visual footprint than `ALL CAPS`

---

## Technical Implementation

### Code Changes Required

**File:** `packages/chatwork/src/services/compose-translated-message.ts`

**Current implementation:**
```typescript
const eventType = command.sourceEventType === 'message_created' ? 'Created' : 'Updated'
const header = `[piconname:${String(command.senderAccountId)}] [${eventType}]`
```

**New implementation:**
```typescript
const eventDecoration = command.sourceEventType === 'message_created' 
  ? '🌿🌺🌿 𝐂𝐫𝐞𝐚𝐭𝐞𝐝 🌿🌺🌿'
  : '🔥⚡🔥 𝐔𝐩𝐝𝐚𝐭𝐞𝐝 🔥⚡🔥'
const header = `[piconname:${String(command.senderAccountId)}] ${eventDecoration}`
```

### Unicode Character Mapping

**Created (𝐂𝐫𝐞𝐚𝐭𝐞𝐝):**
- 𝐂: U+1D402 (MATHEMATICAL BOLD CAPITAL C)
- 𝐫: U+1D41B (MATHEMATICAL BOLD SMALL R)
- 𝐞: U+1D41A (MATHEMATICAL BOLD SMALL E)
- 𝐚: U+1D41A (MATHEMATICAL BOLD SMALL A)
- 𝐭: U+1D42D (MATHEMATICAL BOLD SMALL T)
- 𝐞: U+1D41A (MATHEMATICAL BOLD SMALL E)
- 𝐝: U+1D417 (MATHEMATICAL BOLD SMALL D)

**Updated (𝐔𝐩𝐝𝐚𝐭𝐞𝐝):**
- 𝐔: U+1D414 (MATHEMATICAL BOLD CAPITAL U)
- 𝐩: U+1D429 (MATHEMATICAL BOLD SMALL P)
- 𝐝: U+1D417 (MATHEMATICAL BOLD SMALL D)
- 𝐚: U+1D41A (MATHEMATICAL BOLD SMALL A)
- 𝐭: U+1D42D (MATHEMATICAL BOLD SMALL T)
- 𝐞: U+1D41A (MATHEMATICAL BOLD SMALL E)
- 𝐝: U+1D417 (MATHEMATICAL BOLD SMALL D)

### Dependencies

**No new dependencies required:**
- Unicode characters are native JavaScript strings
- Emoji are standard Unicode code points
- Chatwork API already supports Unicode in message body

---

## Testing Strategy

### Unit Tests

**Test file:** `packages/chatwork/src/services/compose-translated-message.test.ts`

**Test cases to update:**
1. `returns single message with piconname header and translated body`
   - Update assertion: expect header contains `🌿🌺🌿 𝐂𝐫𝐞𝐚𝐭𝐞𝐝 🌿🌺🌿`

2. `shows [Updated] indicator for message_updated events`
   - Update assertion: expect header contains `🔥⚡🔥 𝐔𝐩𝐝𝐚𝐭𝐞𝐝 🔥⚡🔥`

3. All other tests: update expected header format

**New test to add:**
```typescript
it('uses correct emoji decoration for created vs updated', async () => {
  const createdCommand = makeCommand('Test', { webhook_event_type: 'message_created' })
  const updatedCommand = makeCommand('Test', { webhook_event_type: 'message_updated' })
  
  const createdResult = await composeTranslatedMessage(createdCommand, { ... })
  const updatedResult = await composeTranslatedMessage(updatedCommand, { ... })
  
  expect(createdResult.message).toContain('🌿🌺🌿 𝐂𝐫𝐞𝐚𝐭𝐞𝐝 🌿🌺🌿')
  expect(updatedResult.message).toContain('🔥⚡🔥 𝐔𝐩𝐝𝐚𝐭𝐞𝐝 🔥⚡🔥')
})
```

### Manual Testing

**Platforms to verify:**
- [ ] Chatwork Desktop (macOS/Windows)
- [ ] Chatwork Mobile (iOS)
- [ ] Chatwork Mobile (Android)
- [ ] Chatwork Web (Chrome/Safari)

**Visual checks:**
- [ ] Emoji render correctly (not as boxes/tofu)
- [ ] Unicode bold characters display properly
- [ ] Created/Updated are instantly distinguishable
- [ ] Format looks good in message list view
- [ ] Format looks good in conversation view
- [ ] No line breaking issues between emoji and text

---

## Risks & Trade-offs

### Known Risks

**1. Unicode Bold Font Rendering**
- **Risk:** Some Android devices may not support Mathematical Bold Unicode characters
- **Fallback:** System will render as regular ASCII (Created/Updated)
- **Mitigation:** Emoji burst decoration still provides visual distinction
- **Severity:** Low (team uses modern devices, emoji is primary visual cue)

**2. Emoji Set Variations**
- **Risk:** 🌿🌺🔥⚡ may look different across Apple/Google/Samsung emoji sets
- **Impact:** Visual theme (color/style) varies but meaning remains clear
- **Mitigation:** Chose universal emoji with consistent meaning across platforms
- **Severity:** Low (distinction still clear, team confirmed internal use only)

**3. Screen Reader Accessibility**
- **Risk:** Screen readers will announce "leaf flower leaf C-r-e-a-t-e-d leaf flower leaf"
- **Impact:** Verbose and potentially annoying for blind users
- **Mitigation:** Team context is internal, no accessibility requirements stated
- **Severity:** Low for current scope (should be documented for future consideration)

**4. Copy-Paste Behavior**
- **Risk:** When users copy messages, emoji decoration is included
- **Impact:** May clutter external documents if pasted
- **Mitigation:** This is expected behavior; users can manually clean up if needed
- **Severity:** Very Low (minor UX trade-off for visual impact)

### Trade-offs Accepted

**Visual Impact vs Cleanliness:**
- **Chosen:** Maximum visual impact (emoji burst)
- **Trade-off:** Slightly noisier message list view
- **Reasoning:** User explicitly requested "đập vào mặt" design, instant recognition is critical

**Unicode Bold vs ASCII Caps:**
- **Chosen:** Unicode Mathematical Bold (`𝐂𝐫𝐞𝐚𝐭𝐞𝐝`)
- **Trade-off:** Potential rendering issues on older devices
- **Reasoning:** More aesthetically aligned with user's neubrutalism vision; emoji provides fallback

**Fixed Emoji vs Configurable:**
- **Chosen:** Hardcoded emoji themes (nature vs energy)
- **Trade-off:** No per-user or per-room customization
- **Reasoning:** Simplicity, consistency, no storage/config overhead

---

## Acceptance Criteria

### Functional
- [ ] Created messages display: `🌿🌺🌿 𝐂𝐫𝐞𝐚𝐭𝐞𝐝 🌿🌺🌿`
- [ ] Updated messages display: `🔥⚡🔥 𝐔𝐩𝐝𝐚𝐭𝐞𝐝 🔥⚡🔥`
- [ ] All existing translation functionality unchanged
- [ ] All unit tests pass with updated expectations

### Visual
- [ ] Created vs Updated instantly distinguishable (<1s recognition)
- [ ] Format renders correctly on desktop and mobile
- [ ] No line breaking issues in message display
- [ ] Emoji and Unicode bold characters display (not as boxes)

### Code Quality
- [ ] No hardcoded strings; emoji/text defined as constants
- [ ] TypeScript type safety maintained
- [ ] Lint and typecheck pass
- [ ] No performance degradation

---

## Implementation Notes

### Constants Definition (Recommended)

```typescript
// Message status decorations
const STATUS_DECORATIONS = {
  created: '🌿🌺🌿 𝐂𝐫𝐞𝐚𝐭𝐞𝐝 🌿🌺🌿',
  updated: '🔥⚡🔥 𝐔𝐩𝐝𝐚𝐭𝐞𝐝 🔥⚡🔥',
} as const
```

### Alternative: Helper Function

```typescript
function getStatusDecoration(eventType: 'message_created' | 'message_updated'): string {
  return eventType === 'message_created'
    ? '🌿🌺🌿 𝐂𝐫𝐞𝐚𝐭𝐞𝐝 🌿🌺🌿'
    : '🔥⚡🔥 𝐔𝐩𝐝𝐚𝐭𝐞𝐝 🔥⚡🔥'
}
```

---

## Future Considerations

### Out of Scope (Potential Future Enhancements)

**Configurable Emoji Themes:**
- Per-room or per-user customizable emoji sets
- Requires: Storage schema, dashboard UI, migration
- Benefit: Personalization, branding flexibility

**A/B Testing Framework:**
- Test multiple emoji combinations for recognition speed
- Requires: Analytics integration, user testing setup
- Benefit: Data-driven optimization

**Accessibility Mode:**
- Option to disable emoji decoration for screen reader users
- Requires: User preference storage, configuration UI
- Benefit: Improved accessibility compliance

---

## Rollout

**Deployment Strategy:**
- Simple code change, no data migration required
- No feature flag needed (non-breaking change)
- Deploy directly to production after testing

**Rollback Plan:**
- Revert commit if rendering issues discovered
- Fallback format: Previous plain `[Created]`/`[Updated]` text

**Communication:**
- Notify team of new visual format
- Collect feedback on cross-platform rendering
- Monitor for any user confusion or rendering bugs

---

## Open Questions

*None remaining - all clarifications obtained during brainstorming.*

---

## Appendix: Unicode Reference

### Creating Unicode Bold Text Programmatically

```typescript
// Utility function to convert ASCII to Unicode Bold (if needed in future)
function toMathBold(text: string): string {
  return text.split('').map(char => {
    const code = char.charCodeAt(0)
    if (code >= 65 && code <= 90) { // A-Z
      return String.fromCodePoint(code - 65 + 0x1D400)
    }
    if (code >= 97 && code <= 122) { // a-z
      return String.fromCodePoint(code - 97 + 0x1D41A)
    }
    return char
  }).join('')
}

// Example usage:
// toMathBold('Created') → '𝐂𝐫𝐞𝐚𝐭𝐞𝐝'
// toMathBold('Updated') → '𝐔𝐩𝐝𝐚𝐭𝐞𝐝'
```

**Note:** For this implementation, we hardcode the final strings rather than converting at runtime for performance and simplicity.
