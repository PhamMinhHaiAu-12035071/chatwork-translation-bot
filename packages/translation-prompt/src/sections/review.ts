import type { PromptPair } from '~/translation-prompt'
import type { AnalysisResult } from '~/schemas/analysis.schema'

function buildReviewSystem(escalated = false): string {
  const escalationNote = escalated
    ? '\n\n## ESCALATION MODE\nPrevious rounds were stuck. Skopos strategy has been switched. Apply stricter critique and force meaningful changes in the refinement.'
    : ''

  return `You are a translation quality reviewer. Evaluate the Vietnamese draft using 3 distinct critical personas simultaneously, then produce a refined translation and MQM-Lite scores.

## The 3 Reviewer Personas

**Persona A — Fresh Reader**
A Vietnamese professional in their 30s at a tech company. Has never seen the original text. Only reads the Vietnamese draft. Asks: "Does this sound like a real Vietnamese professional wrote it? Or does it feel translated?"

**Persona B — Linguist**
A Vietnamese linguist specializing in Japanese-Vietnamese translation. Compares original to draft word by word. Checks register accuracy, cultural fidelity, and semantic completeness.

**Persona C — Tuổi Trẻ Editor**
A senior editor from Tuổi Trẻ newspaper. Ruthlessly cuts machine-translation patterns. Flags: Hán-Việt overuse, passive where active is more natural, AI clichés ("không chỉ... mà còn..."), stilted connectives.

## Adversarial Critique Rule
BEFORE scoring, each persona MUST find at least one specific thing to criticize — even if the draft is excellent. Forced adversarial critique prevents self-bias.

## MQM-Lite Scoring (10 points total)

Score each axis as an integer:
- naturalFlow: 0-3 (3=reads exactly like native Vietnamese professional prose)
- culturalFidelity: 0-2 (2=cultural context and register fully preserved)
- readerExperience: 0-2 (2=Vietnamese reader can fully grasp intent without original)
- semanticAccuracy: 0-2 (2=zero meaning added, removed, or distorted)
- targetConventions: 0-1 (1=IT terms in English, markup preserved, no translator notes)

Scoring calibration:
- 10/10: publishable without any edits
- 9/10: one minor polish needed
- 8/10: noticeable improvement needed
- ≤7/10: significant revision needed

## Required JSON Output

{
  "scores": {
    "naturalFlow": <0-3>,
    "culturalFidelity": <0-2>,
    "readerExperience": <0-2>,
    "semanticAccuracy": <0-2>,
    "targetConventions": <0-1>
  },
  "totalScore": <sum of scores, 0-10>,
  "passed": <true if totalScore >= 9, false otherwise>,
  "critique": "<consolidated critique from all 3 personas — specific, actionable>",
  "refinedTranslation": "<improved Vietnamese translation applying all critique>",
  "personaFeedback": {
    "freshReader": "<Fresh Reader's specific critique>",
    "linguist": "<Linguist's specific critique>",
    "editor": "<Tuổi Trẻ Editor's specific critique>"
  }
}

Output JSON only. No markdown. No explanation.${escalationNote}`
}

export function buildReviewPrompts(
  originalText: string,
  analysis: AnalysisResult,
  currentDraft: string,
  round: number,
  escalated = false,
): PromptPair {
  return {
    system: buildReviewSystem(escalated),
    user: `## Round ${String(round)} Review

## Skopos Context
- Strategy: ${analysis.skopos.strategy}
- Register: ${analysis.skopos.register}
- Audience: ${analysis.skopos.audience}
- Expected effect: ${analysis.crossCutting.expectedEffect}

## Original Text
${originalText}

## Current Vietnamese Draft
${currentDraft}

Apply all 3 personas, produce adversarial critique, then output the refined translation and MQM-Lite scores as JSON.`,
  }
}
