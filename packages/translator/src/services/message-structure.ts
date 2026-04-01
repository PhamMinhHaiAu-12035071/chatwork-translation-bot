import type { TranslationIngressCommand } from '@chatwork-bot/core'

interface DecorationSnapshotEnvelope {
  snapshot?: {
    renderTemplate?: MessageRenderNodeLike[]
  }
}

type MessageRenderNodeLike =
  | { type: 'literal'; content?: string }
  | { type: 'translationSlot' }
  | { type: 'hr' }
  | { type: 'code'; content?: string }
  | { type: 'rp' }
  | { type: 'info' | 'title' | 'quote' | 'qt'; children?: MessageRenderNodeLike[] }

export function hasMeaningfulLiteralStructure(command: TranslationIngressCommand): boolean {
  const rawSnapshot = command.audit.rawSourceSnapshot as DecorationSnapshotEnvelope
  const renderTemplate = rawSnapshot.snapshot?.renderTemplate
  if (renderTemplate === undefined) return false
  return renderNodesHaveMeaningfulLiteralStructure(renderTemplate)
}

function renderNodesHaveMeaningfulLiteralStructure(nodes: MessageRenderNodeLike[]): boolean {
  return nodes.some((node) => renderNodeHasMeaningfulLiteralStructure(node))
}

function renderNodeHasMeaningfulLiteralStructure(node: MessageRenderNodeLike): boolean {
  if (node.type === 'translationSlot') return false
  if (node.type === 'hr' || node.type === 'rp') return true
  if (node.type === 'literal') return (node.content?.trim().length ?? 0) > 0
  if (node.type === 'code') return (node.content?.trim().length ?? 0) > 0
  return renderNodesHaveMeaningfulLiteralStructure(node.children ?? [])
}
