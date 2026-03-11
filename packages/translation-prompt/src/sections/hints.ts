import type { AnalysisResult } from '~/schemas/analysis.schema'

export function buildStructuredHintsBlock(analysis: AnalysisResult): string {
  const { structuredHints } = analysis
  const { intentLabels, renderingPolicy, preservationRules, reviewFocus } = structuredHints

  const reviewFocusLines =
    reviewFocus.length > 0 ? reviewFocus.map((f) => `- ${f}`).join('\n') : '- (none)'

  return `## Structured Hints
- Phrase type: ${intentLabels.phraseType} (${intentLabels.confidence} confidence)
- Rendering strategy: ${renderingPolicy.strategy}
- Target style: ${renderingPolicy.targetStyle}
- avoidLiteralFormulaTranslation: ${String(renderingPolicy.avoidLiteralFormulaTranslation)}
- Preserve ambiguity: ${String(renderingPolicy.preserveAmbiguity)}

## Preservation Rules
- preserveUrl: ${String(preservationRules.preserveUrl)}
- preserveCode: ${String(preservationRules.preserveCode)}
- preserveUnits: ${String(preservationRules.preserveUnits)}
- preserveChatworkMarkup: ${String(preservationRules.preserveChatworkMarkup)}
- preserveJapaneseNameScript: ${String(preservationRules.preserveJapaneseNameScript)}
- allowRomajiGloss: ${String(preservationRules.allowRomajiGloss)}
- forbidGenderInference: ${String(preservationRules.forbidGenderInference)}

## Review Focus
${reviewFocusLines}`
}
