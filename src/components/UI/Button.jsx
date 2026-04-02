import { forwardRef } from 'react'
import { motion } from 'framer-motion'

const variants = {
  primary: 'bg-accent text-white hover:bg-accent/90 shadow-sm',
  secondary: 'bg-surface-2 text-text-primary hover:bg-surface-3 border border-border',
  ghost: 'text-text-secondary hover:bg-surface-2 hover:text-text-primary',
  danger: 'bg-red-500 text-white hover:bg-red-600 shadow-sm',
  outline: 'border border-accent text-accent hover:bg-accent/10',
}

const sizes = {
  xs: 'px-2.5 py-1 text-xs rounded-lg gap-1',
  sm: 'px-3 py-1.5 text-sm rounded-lg gap-1.5',
  md: 'px-4 py-2 text-sm rounded-xl gap-2',
  lg: 'px-5 py-2.5 text-base rounded-xl gap-2',
  icon: 'p-2 rounded-xl',
}

export const Button = forwardRef(({
  children, variant = 'secondary', size = 'md', className = '',
  loading = false, icon, iconRight, disabled, ...props
}, ref) => {
  const base = 'inline-flex items-center justify-center font-medium transition-all duration-150 select-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50 disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap'

  return (
    <motion.button
      ref={ref}
      className={`${base} ${variants[variant]} ${sizes[size]} ${className}`}
      disabled={disabled || loading}
      whileTap={{ scale: 0.97 }}
      {...props}
    >
      {loading ? (
        <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
        </svg>
      ) : icon && <span className="flex-shrink-0">{icon}</span>}
      {size !== 'icon' && children}
      {iconRight && <span className="flex-shrink-0">{iconRight}</span>}
    </motion.button>
  )
})
Button.displayName = 'Button'

export const IconButton = forwardRef(({
  children, variant = 'ghost', tooltip, className = '', ...props
}, ref) => {
  return (
    <Button ref={ref} variant={variant} size="icon" title={tooltip} className={className} {...props}>
      {children}
    </Button>
  )
})
IconButton.displayName = 'IconButton'
