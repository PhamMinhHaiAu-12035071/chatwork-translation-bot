import type { ClayIconName } from './icon-paths'
import type React from 'react'

export const CLAY_SYMBOLS: Record<ClayIconName, () => React.JSX.Element> = {
  plus: () => (
    <path
      d="M22 12V32 M12 22H32"
      stroke="#1a1a2e"
      strokeWidth="5.5"
      strokeLinecap="round"
      fill="none"
    />
  ),

  pencil: () => (
    <>
      <path
        d="M29.5 10.5L33.5 14.5L17.5 30.5L11 32.5L13 26Z"
        fill="white"
        stroke="#1a1a2e"
        strokeWidth="2.2"
        strokeLinejoin="round"
      />
      <line x1="13" y1="26" x2="17.5" y2="30.5" stroke="#1a1a2e" strokeWidth="1.5" />
    </>
  ),

  trash: () => (
    <>
      <path d="M17 15H27 M13 18H31" stroke="#1a1a2e" strokeWidth="2.8" strokeLinecap="round" />
      <rect
        x="15"
        y="19.5"
        width="14"
        height="12.5"
        rx="3.5"
        fill="white"
        stroke="#1a1a2e"
        strokeWidth="2.2"
      />
      <line
        x1="19"
        y1="22.5"
        x2="19"
        y2="29"
        stroke="#1a1a2e"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
      <line
        x1="22"
        y1="22.5"
        x2="22"
        y2="29"
        stroke="#1a1a2e"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
      <line
        x1="25"
        y1="22.5"
        x2="25"
        y2="29"
        stroke="#1a1a2e"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </>
  ),

  book: () => (
    <>
      <path d="M22 13V33" stroke="#1a1a2e" strokeWidth="2.5" strokeLinecap="round" />
      <path
        d="M22 13C19 11 13 12 11 14V31C13 29.5 19 29 22 31"
        stroke="#1a1a2e"
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="white"
        fillOpacity="0.7"
      />
      <path
        d="M22 13C25 11 31 12 33 14V31C31 29.5 25 29 22 31"
        stroke="#1a1a2e"
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="white"
        fillOpacity="0.7"
      />
    </>
  ),

  link: () => (
    <>
      <path
        d="M19 26.5C16.515 26.5 14.5 24.485 14.5 22C14.5 19.515 16.515 17.5 19 17.5H20.5"
        stroke="#1a1a2e"
        strokeWidth="3"
        strokeLinecap="round"
        fill="none"
      />
      <path
        d="M25 17.5C27.485 17.5 29.5 19.515 29.5 22C29.5 24.485 27.485 26.5 25 26.5H23.5"
        stroke="#1a1a2e"
        strokeWidth="3"
        strokeLinecap="round"
        fill="none"
      />
      <path d="M18.5 22H25.5" stroke="#1a1a2e" strokeWidth="2.5" strokeLinecap="round" />
    </>
  ),

  webhook: () => (
    <>
      <circle cx="15" cy="22" r="2.5" fill="#1a1a2e" />
      <path
        d="M22 22 C22 17 26 14 30 14"
        stroke="#1a1a2e"
        strokeWidth="2.5"
        strokeLinecap="round"
        fill="none"
      />
      <path
        d="M20 22 C20 15 25 11 32 11"
        stroke="#1a1a2e"
        strokeWidth="2.2"
        strokeLinecap="round"
        fill="none"
        opacity="0.5"
      />
      <path
        d="M22 22 C22 27 26 30 30 30"
        stroke="#1a1a2e"
        strokeWidth="2.5"
        strokeLinecap="round"
        fill="none"
      />
      <path
        d="M20 22 C20 29 25 33 32 33"
        stroke="#1a1a2e"
        strokeWidth="2.2"
        strokeLinecap="round"
        fill="none"
        opacity="0.5"
      />
    </>
  ),

  pause: () => (
    <>
      <rect x="14" y="13" width="5" height="18" rx="2.5" fill="#1a1a2e" />
      <rect x="25" y="13" width="5" height="18" rx="2.5" fill="#1a1a2e" />
    </>
  ),

  play: () => (
    <path
      d="M16 12L32 22L16 32V12Z"
      fill="#1a1a2e"
      stroke="#1a1a2e"
      strokeWidth="1.5"
      strokeLinejoin="round"
    />
  ),
}
