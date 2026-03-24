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

Then apply the self-critique gate before finalizing output:
- Natural flow: would a Vietnamese professional write this sentence exactly as written?
- Cultural fidelity: is the register/keigo mapping accurate and natural in Vietnamese?
- Semantic accuracy: nothing added, removed, softened, or amplified vs the source?

Only output the JSON after passing all three gates.`

export const SINGLE_CALL_SYSTEM = [
  PERSONA,
  CORE_DOCTRINE,
  JAPANESE_RULES,
  HUMANIZER,
  STRUCTURAL,
  CONSTRAINTS,
  INTERNAL_REASONING,
].join('\n\n')
