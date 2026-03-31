export type StrokeIconName =
  | 'arrow-left'
  | 'arrow-right'
  | 'chevron-down'
  | 'close'
  | 'external-link'
  | 'menu'

export type ClayIconName =
  | 'plus'
  | 'pencil'
  | 'trash'
  | 'book'
  | 'bookSky'
  | 'dashboard'
  | 'link'
  | 'webhook'
  | 'pause'
  | 'play'

export type IconName = StrokeIconName | ClayIconName
export type IconVariant = 'stroke' | 'clay'

export interface StrokePathDef {
  /** One or more SVG `d` strings joined in the same <path> via spaces */
  d: string
  viewBox: string
  strokeWidth: number
  /** CSS animation class appended to .stroke-icon-wrap */
  animClass:
    | 'icon-anim-slide-left'
    | 'icon-anim-slide-right'
    | 'icon-anim-wiggle'
    | 'icon-anim-lift'
}

export const STROKE_PATHS: Record<StrokeIconName, StrokePathDef> = {
  'arrow-left': {
    d: 'M17 10H3 M8 4L2 10L8 16',
    viewBox: '0 0 20 20',
    strokeWidth: 3.5,
    animClass: 'icon-anim-slide-left',
  },
  'arrow-right': {
    d: 'M3 10H17 M12 4L18 10L12 16',
    viewBox: '0 0 20 20',
    strokeWidth: 3.5,
    animClass: 'icon-anim-slide-right',
  },
  'chevron-down': {
    d: 'M2 2L9 10L16 2',
    viewBox: '0 0 18 12',
    strokeWidth: 4.25,
    animClass: 'icon-anim-lift',
  },
  close: {
    d: 'M3 3L15 15 M15 3L3 15',
    viewBox: '0 0 18 18',
    strokeWidth: 3.5,
    animClass: 'icon-anim-wiggle',
  },
  'external-link': {
    d: 'M9 4H4C3.448 4 3 4.448 3 5V16C3 16.552 3.448 17 4 17H15C15.552 17 16 16.552 16 16V11 M12 3H17V8 M17 3L10 10',
    viewBox: '0 0 20 20',
    strokeWidth: 2.8,
    animClass: 'icon-anim-slide-right',
  },
  menu: {
    d: 'M3 5H17 M3 10H17 M3 15H17',
    viewBox: '0 0 20 20',
    strokeWidth: 3.5,
    animClass: 'icon-anim-wiggle',
  },
}
