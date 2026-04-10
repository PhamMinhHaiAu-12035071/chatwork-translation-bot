# Kagi Style Verification Checklist

## Context

Kagi translation styles require actual UI interaction (not URL params) to apply correctly.
Each style must be manually verified before enabling on dashboard.

**Currently verified:** Wild

**Pending verification:** Warm, Easy, Clear, Bright, Smooth, Calm, Rich, Crisp, Gentle, Bold, Fresh

---

## Verification Process

### Prerequisites

- Research environment set up: `cd nghien_cuu_cua_toi && bun install`
- Kagi translate page accessible at translate.kagi.com
- Headless browser working (Puppeteer installed)

### 9-Step Checklist for Each Style

#### 1. Review Style Preset Configuration

Check `packages/provider-kagi/src/types.ts` → `KAGI_STYLE_PRESETS[styleName]`:

```typescript
{
  translationType: 'natural' | 'literal',
  formality: 'standard' | 'vietnamese_casual' | 'vietnamese_formal',
  readingLevel: 'standard' | 'a1' | 'a2' | 'b1' | 'b2' | 'c1' | 'c2',
  speakerGender: 'unknown',
  addresseeGender: 'unknown',
  context?: string
}
```

#### 2. Test in Research Environment

Edit `nghien_cuu_cua_toi/src/index.ts`:

```typescript
const result = await service.translateText('Hello, how are you?', {
  style: 'Warm', // Style to test
  context: undefined,
})
```

Run: `bun run start:local`

#### 3. Verify UI Interaction Sequence

Watch console logs for:

- ✅ Translation Settings opened
- ✅ Context cleared/filled
- ✅ Gender options clicked (Unknown)
- ✅ Reading level set (observe slider step)
- ✅ Translation style clicked (Natural/Literal)
- ✅ Formality handled correctly

#### 4. Check "Chim Mồi" Requirement

**If `formality !== 'standard'`:**

- ✅ Verify Standard output appears first
- ✅ Verify formality click happens after Standard stable
- ✅ Verify URL updates with formality_context param
- ✅ Verify output changes after formality switch
- ✅ Verify new output stabilizes

**If `formality === 'standard'`:**

- ✅ Verify no "chim mồi" flow triggered
- ✅ Verify output stabilizes once

#### 5. Verify URL Address Bar Reflection

After each UI interaction, URL should update:

- ✅ `speaker_gender=unknown`
- ✅ `addressee_gender=unknown`
- ✅ `language_complexity=N` (or absent for standard)
- ✅ `style=natural` or `style=literal`
- ✅ `formality_context=vi_casual` or `vi_formal` (if applicable)
- ✅ `context=...` (if provided)

#### 6. Test Edge Cases

- **Empty text:** `""` → should handle gracefully
- **Long text:** 500+ characters → verify no timeout
- **Special characters:** Unicode, emojis → verify encoding
- **With context:** Non-empty context → verify context param in URL
- **Without context:** Empty context → verify no context param

#### 7. Compare Output Quality

Translate same text with:

- Target style (e.g., "Warm")
- "Wild" (baseline verified)
- Standard settings (no style)

Output should show clear style differences matching expected persona.

#### 8. Document Findings

Record in verification log below:

```
Style: Warm
Date: 2026-04-10
Tester: [Name]
Status: ✅ PASS / ❌ FAIL

Notes:
- Reading level C1 verified
- Formality "standard" - no chim mồi needed
- Output natural and friendly tone
- All URL params reflected correctly

Issues: None
```

#### 9. Enable in Dashboard

**If all checks pass:**

1. Edit `packages/dashboard/src/lib/free-room-schemas.ts`:

```typescript
const ACTIVE_KAGI_STYLES = ['Wild', 'Warm'] as const
```

2. Add label and description:

```typescript
export const FREE_ROOM_KAGI_STYLE_LABELS = {
  Wild: 'Wild',
  Warm: 'Warm',
}

export const FREE_ROOM_KAGI_STYLE_DESCRIPTIONS = {
  Wild: 'Casual, vivid, and full of energy.',
  Warm: 'Friendly, approachable, and welcoming.',
}
```

3. Test create/edit room flows on dashboard
4. Verify validation works (no other styles selectable)
5. Commit: `feat(dashboard): enable Warm style after verification`

---

## Verification Log

| Style  | Status      | Date       | Tester | Notes                                           |
| ------ | ----------- | ---------- | ------ | ----------------------------------------------- |
| Wild   | ✅ VERIFIED | 2026-04-09 | [Name] | All checks pass, "chim mồi" for vi_casual works |
| Warm   | ⏳ PENDING  | -          | -      | -                                               |
| Easy   | ⏳ PENDING  | -          | -      | -                                               |
| Clear  | ⏳ PENDING  | -          | -      | -                                               |
| Bright | ⏳ PENDING  | -          | -      | -                                               |
| Smooth | ⏳ PENDING  | -          | -      | -                                               |
| Calm   | ⏳ PENDING  | -          | -      | -                                               |
| Rich   | ⏳ PENDING  | -          | -      | -                                               |
| Crisp  | ⏳ PENDING  | -          | -      | -                                               |
| Gentle | ⏳ PENDING  | -          | -      | -                                               |
| Bold   | ⏳ PENDING  | -          | -      | -                                               |
| Fresh  | ⏳ PENDING  | -          | -      | -                                               |

---

## Troubleshooting

### Issue: URL params don't appear after UI interaction

**Possible causes:**

- Timing delay too short (increase `STYLE_OPTION_CLICK_GAP_MS`)
- Kagi UI changed (update selectors)
- JavaScript events not dispatching (check `dispatchEvent` calls)

**Fix:** Increase delays, verify selectors, check browser console for JS errors

### Issue: "Chim mồi" flow doesn't work

**Possible causes:**

- Kagi fixed the formality bug (workaround no longer needed)
- Output comparison threshold too strict

**Fix:** Try direct formality application without "chim mồi". If works, remove workaround.

### Issue: Output quality doesn't match expected style

**Possible causes:**

- Style definition incorrect in KAGI_STYLE_PRESETS
- UI interaction sequence wrong
- Kagi backend changed style behavior

**Fix:** Review preset configuration, verify UI sequence in browser DevTools, test manually on Kagi website

---

**End of Verification Checklist**
