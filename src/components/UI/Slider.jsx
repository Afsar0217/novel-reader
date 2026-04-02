export const Slider = ({ label, value, min, max, step = 1, onChange, unit = '', className = '' }) => {
  const percent = ((value - min) / (max - min)) * 100

  return (
    <div className={`space-y-1.5 ${className}`}>
      {label && (
        <div className="flex items-center justify-between">
          <span className="text-xs font-medium text-[var(--text-secondary)]">{label}</span>
          <span className="text-xs text-[var(--text-muted)] font-mono">
            {typeof value === 'number' ? value.toFixed(step < 1 ? 1 : 0) : value}{unit}
          </span>
        </div>
      )}
      <div className="relative flex items-center h-5">
        <div className="absolute w-full h-1.5 rounded-full bg-[var(--surface-3)]">
          <div
            className="h-full rounded-full bg-accent transition-all"
            style={{ width: `${percent}%` }}
          />
        </div>
        <input
          type="range"
          min={min}
          max={max}
          step={step}
          value={value}
          onChange={e => onChange(Number(e.target.value))}
          className="absolute w-full opacity-0 cursor-pointer h-5"
          style={{ margin: 0 }}
        />
        <div
          className="absolute w-3.5 h-3.5 rounded-full bg-accent border-2 border-white shadow-sm pointer-events-none transition-all"
          style={{ left: `calc(${percent}% - 7px)` }}
        />
      </div>
    </div>
  )
}

export const Toggle = ({ checked, onChange, label, size = 'md' }) => {
  const sizes = {
    sm: { track: 'w-8 h-4', thumb: 'w-3 h-3', translate: 'translate-x-4' },
    md: { track: 'w-10 h-5', thumb: 'w-3.5 h-3.5', translate: 'translate-x-5' },
  }
  const s = sizes[size] || sizes.md

  return (
    <label className="flex items-center gap-2.5 cursor-pointer select-none">
      <div
        className={`relative flex-shrink-0 ${s.track} rounded-full transition-colors duration-200 ${
          checked ? 'bg-accent' : 'bg-[var(--surface-3)]'
        }`}
        onClick={() => onChange(!checked)}
      >
        <div
          className={`absolute top-[3px] left-[3px] ${s.thumb} rounded-full bg-white shadow transition-transform duration-200 ${
            checked ? s.translate : 'translate-x-0'
          }`}
        />
      </div>
      {label && <span className="text-sm text-[var(--text-secondary)]">{label}</span>}
    </label>
  )
}
