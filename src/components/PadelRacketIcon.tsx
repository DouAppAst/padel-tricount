import { SvgIcon, type SvgIconProps } from '@mui/material'

// Solid perforated head + short handle: a padel racket, not a strung tennis racket.
const HEAD =
  'M12 2C7.6 2 5 5.2 5 9c0 3.2 1.8 5.6 4.5 6.6l.8 1.4h3.4l.8-1.4C17.2 14.6 19 12.2 19 9c0-3.8-2.6-7-7-7z'
const HOLES: [number, number][] = [
  [10.2, 5.5],
  [13.8, 5.5],
  [8.4, 8],
  [12, 8],
  [15.6, 8],
  [8.4, 10.5],
  [12, 10.5],
  [15.6, 10.5],
  [10.2, 13],
  [13.8, 13],
]
const HOLE_RADIUS = 0.9
const hole = ([x, y]: [number, number]) =>
  `M${x - HOLE_RADIUS} ${y}a${HOLE_RADIUS} ${HOLE_RADIUS} 0 1 0 ${2 * HOLE_RADIUS} 0` +
  `a${HOLE_RADIUS} ${HOLE_RADIUS} 0 1 0 ${-2 * HOLE_RADIUS} 0z`

export function PadelRacketIcon(props: SvgIconProps) {
  return (
    <SvgIcon {...props}>
      <path fillRule="evenodd" d={HEAD + HOLES.map(hole).join('')} />
      <rect x="10.6" y="16.5" width="2.8" height="5.5" rx="1" />
    </SvgIcon>
  )
}
