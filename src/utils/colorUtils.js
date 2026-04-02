const PASTEL_HUES = [210, 160, 280, 30, 340, 60, 120, 190, 260, 20]

export const generateAvatarColor = (seed) => {
  const index = typeof seed === 'number' ? seed % PASTEL_HUES.length
    : (seed || '').split('').reduce((a, c) => a + c.charCodeAt(0), 0) % PASTEL_HUES.length
  const h = PASTEL_HUES[index]
  return `hsl(${h}, 65%, 60%)`
}

export const generateRandomAvatarColor = () => {
  const h = Math.floor(Math.random() * 360)
  return `hsl(${h}, 65%, 60%)`
}

export const hexToRgba = (hex, alpha = 1) => {
  const r = parseInt(hex.slice(1, 3), 16)
  const g = parseInt(hex.slice(3, 5), 16)
  const b = parseInt(hex.slice(5, 7), 16)
  return `rgba(${r}, ${g}, ${b}, ${alpha})`
}

export const HIGHLIGHT_COLORS = {
  yellow: { bg: '#fef08a', label: 'Yellow', tailwind: 'bg-yellow-200' },
  blue:   { bg: '#bfdbfe', label: 'Blue',   tailwind: 'bg-blue-200' },
  green:  { bg: '#bbf7d0', label: 'Green',  tailwind: 'bg-green-200' },
  pink:   { bg: '#fbcfe8', label: 'Pink',   tailwind: 'bg-pink-200' },
  purple: { bg: '#e9d5ff', label: 'Purple', tailwind: 'bg-purple-200' },
}

export const getHighlightStyle = (color) => {
  const c = HIGHLIGHT_COLORS[color] || HIGHLIGHT_COLORS.yellow
  return { backgroundColor: c.bg + 'b3' }
}

export const getUserInitials = (name) => {
  if (!name) return '?'
  const parts = name.match(/[A-Z][a-z]+/g) || name.split(' ')
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase()
  return name.slice(0, 2).toUpperCase()
}
