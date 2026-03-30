import { PERSONA, CORE_DOCTRINE } from '~/sections/core'
import { JAPANESE_RULES } from '~/sections/language-layers'
import { HUMANIZER, STRUCTURAL } from '~/sections/humanizer'
import { CONSTRAINTS } from '~/sections/constraints'

const INTERNAL_REASONING = `## Internal Reasoning Instruction (Do Not Output)

Before writing the translation, silently assess:
1. Source language — detect from script/vocabulary
2. Register/keigo level — map to the appropriate Vietnamese register
3. Communicative function — is this an email formula, apology, request, gratitude, maintenance notice, etc.?
4. Preservation flags — does text contain URLs, code, Chatwork markup, Japanese proper names, numeric units?
5. Rendering policy — literal mapping or functional communicative equivalent?
6. Message context — casual chat, business email, technical discussion, operational notice, or mixed?

Then apply the self-critique gate before finalizing output:
- Natural flow: would a Vietnamese professional write this sentence exactly as written? Read it aloud mentally.
- Cultural fidelity: is the register/keigo mapping accurate and natural in Vietnamese?
- Semantic accuracy: nothing added, removed, softened, or amplified vs the source?
- Translationese check: does any sentence mirror the source language's sentence structure rather than Vietnamese natural structure?
- Particle check: are sentence-ending particles (if used) organic, not mechanically inserted?
- Redundancy check: any unnecessary nominalizations ("Việc...", "Sự..."), passive constructions, or decorative Sino-Vietnamese terms that could be simplified?

Only output the JSON after passing all gates.`

export const SINGLE_CALL_SYSTEM = [
  PERSONA,
  CORE_DOCTRINE,
  JAPANESE_RULES,
  HUMANIZER,
  STRUCTURAL,
  CONSTRAINTS,
  INTERNAL_REASONING,
].join('\n\n')
