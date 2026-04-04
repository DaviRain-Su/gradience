/**
 * Modern Minimal Design System
 * 
 * Clean, sophisticated UI components following modern minimalism principles:
 * - Generous whitespace
 * - Subtle shadows and borders
 * - Refined typography
 * - Smooth animations
 */

import React from 'react';

// ============ Color Palette ============

export const colors = {
  // Background
  bg: {
    primary: '#0a0a0a',
    secondary: '#111111',
    tertiary: '#1a1a1a',
    elevated: '#222222',
  },
  
  // Text
  text: {
    primary: '#ffffff',
    secondary: '#a0a0a0',
    tertiary: '#666666',
    muted: '#444444',
  },
  
  // Accent
  accent: {
    primary: '#3b82f6',    // Blue
    secondary: '#8b5cf6',  // Purple
    success: '#22c55e',    // Green
    warning: '#f59e0b',    // Yellow
    error: '#ef4444',      // Red
  },
  
  // Borders
  border: {
    subtle: '#222222',
    default: '#333333',
    hover: '#444444',
    focus: '#3b82f6',
  },
};

// ============ Spacing Scale ============

export const spacing = {
  xs: '4px',
  sm: '8px',
  md: '16px',
  lg: '24px',
  xl: '32px',
  '2xl': '48px',
  '3xl': '64px',
};

// ============ Typography ============

export const typography = {
  fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', sans-serif",
  
  sizes: {
    xs: '12px',
    sm: '14px',
    base: '16px',
    lg: '18px',
    xl: '20px',
    '2xl': '24px',
    '3xl': '32px',
    '4xl': '40px',
  },
  
  weights: {
    normal: 400,
    medium: 500,
    semibold: 600,
    bold: 700,
  },
  
  lineHeights: {
    tight: 1.25,
    normal: 1.5,
    relaxed: 1.75,
  },
};

// ============ Shadows ============

export const shadows = {
  sm: '0 1px 2px rgba(0, 0, 0, 0.3)',
  md: '0 4px 6px -1px rgba(0, 0, 0, 0.4)',
  lg: '0 10px 15px -3px rgba(0, 0, 0, 0.5)',
  xl: '0 20px 25px -5px rgba(0, 0, 0, 0.6)',
  glow: '0 0 20px rgba(59, 130, 246, 0.3)',
};

// ============ Border Radius ============

export const radius = {
  sm: '6px',
  md: '8px',
  lg: '12px',
  xl: '16px',
  '2xl': '24px',
  full: '9999px',
};

// ============ Transitions ============

export const transitions = {
  fast: '150ms ease',
  normal: '250ms ease',
  slow: '350ms ease',
  spring: '500ms cubic-bezier(0.34, 1.56, 0.64, 1)',
};

// ============ Component Styles ============

export const componentStyles = {
  // Card
  card: {
    background: colors.bg.elevated,
    border: `1px solid ${colors.border.subtle}`,
    borderRadius: radius.lg,
    padding: spacing.lg,
    transition: transitions.normal,
    hover: {
      borderColor: colors.border.hover,
      transform: 'translateY(-2px)',
      boxShadow: shadows.md,
    },
  },
  
  // Button
  button: {
    primary: {
      background: colors.accent.primary,
      color: colors.text.primary,
      borderRadius: radius.md,
      padding: `${spacing.sm} ${spacing.lg}`,
      fontWeight: typography.weights.medium,
      transition: transitions.fast,
      hover: {
        background: '#2563eb',
        transform: 'translateY(-1px)',
      },
      active: {
        transform: 'translateY(0)',
      },
    },
    secondary: {
      background: 'transparent',
      color: colors.text.secondary,
      border: `1px solid ${colors.border.default}`,
      borderRadius: radius.md,
      padding: `${spacing.sm} ${spacing.lg}`,
      transition: transitions.fast,
      hover: {
        borderColor: colors.border.hover,
        color: colors.text.primary,
      },
    },
    ghost: {
      background: 'transparent',
      color: colors.text.secondary,
      borderRadius: radius.md,
      padding: `${spacing.sm} ${spacing.md}`,
      transition: transitions.fast,
      hover: {
        background: colors.bg.tertiary,
        color: colors.text.primary,
      },
    },
  },
  
  // Input
  input: {
    background: colors.bg.tertiary,
    border: `1px solid ${colors.border.subtle}`,
    borderRadius: radius.md,
    padding: `${spacing.sm} ${spacing.md}`,
    color: colors.text.primary,
    transition: transitions.fast,
    focus: {
      borderColor: colors.border.focus,
      boxShadow: `0 0 0 3px rgba(59, 130, 246, 0.1)`,
    },
    placeholder: {
      color: colors.text.tertiary,
    },
  },
  
  // Tag
  tag: {
    background: 'rgba(59, 130, 246, 0.1)',
    color: colors.accent.primary,
    borderRadius: radius.full,
    padding: `${spacing.xs} ${spacing.sm}`,
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.medium,
  },
};

// ============ Animation Keyframes ============

export const animations = {
  fadeIn: `
    @keyframes fadeIn {
      from { opacity: 0; }
      to { opacity: 1; }
    }
  `,
  
  slideUp: `
    @keyframes slideUp {
      from { 
        opacity: 0;
        transform: translateY(20px);
      }
      to { 
        opacity: 1;
        transform: translateY(0);
      }
    }
  `,
  
  slideInRight: `
    @keyframes slideInRight {
      from { 
        opacity: 0;
        transform: translateX(20px);
      }
      to { 
        opacity: 1;
        transform: translateX(0);
      }
    }
  `,
  
  scaleIn: `
    @keyframes scaleIn {
      from { 
        opacity: 0;
        transform: scale(0.95);
      }
      to { 
        opacity: 1;
        transform: scale(1);
      }
    }
  `,
  
  pulse: `
    @keyframes pulse {
      0%, 100% { opacity: 1; }
      50% { opacity: 0.5; }
    }
  `,
  
  shimmer: `
    @keyframes shimmer {
      0% { background-position: -200% 0; }
      100% { background-position: 200% 0; }
    }
  `,
  
  spin: `
    @keyframes spin {
      from { transform: rotate(0deg); }
      to { transform: rotate(360deg); }
    }
  `,
};

// ============ Utility Classes ============

export const utilityClasses = {
  // Layout
  container: 'max-w-6xl mx-auto px-6',
  section: 'py-12',
  
  // Text
  textGradient: 'bg-gradient-to-r from-blue-400 to-purple-500 bg-clip-text text-transparent',
  
  // Effects
  glass: 'backdrop-blur-xl bg-white/5 border border-white/10',
  glow: 'shadow-[0_0_20px_rgba(59,130,246,0.3)]',
  
  // Interactive
  hoverLift: 'transition-transform duration-250 hover:-translate-y-0.5',
  hoverGlow: 'transition-shadow duration-250 hover:shadow-[0_0_20px_rgba(59,130,246,0.2)]',
};

// ============ Export CSS Variables ============

export function generateCSSVariables(): string {
  return `
    :root {
      /* Background */
      --bg-primary: ${colors.bg.primary};
      --bg-secondary: ${colors.bg.secondary};
      --bg-tertiary: ${colors.bg.tertiary};
      --bg-elevated: ${colors.bg.elevated};
      
      /* Text */
      --text-primary: ${colors.text.primary};
      --text-secondary: ${colors.text.secondary};
      --text-tertiary: ${colors.text.tertiary};
      --text-muted: ${colors.text.muted};
      
      /* Accent */
      --accent-primary: ${colors.accent.primary};
      --accent-secondary: ${colors.accent.secondary};
      --accent-success: ${colors.accent.success};
      --accent-warning: ${colors.accent.warning};
      --accent-error: ${colors.accent.error};
      
      /* Border */
      --border-subtle: ${colors.border.subtle};
      --border-default: ${colors.border.default};
      --border-hover: ${colors.border.hover};
      --border-focus: ${colors.border.focus};
      
      /* Typography */
      --font-family: ${typography.fontFamily};
      
      /* Spacing */
      --spacing-xs: ${spacing.xs};
      --spacing-sm: ${spacing.sm};
      --spacing-md: ${spacing.md};
      --spacing-lg: ${spacing.lg};
      --spacing-xl: ${spacing.xl};
      
      /* Radius */
      --radius-sm: ${radius.sm};
      --radius-md: ${radius.md};
      --radius-lg: ${radius.lg};
      --radius-xl: ${radius.xl};
    }
    
    ${animations.fadeIn}
    ${animations.slideUp}
    ${animations.slideInRight}
    ${animations.scaleIn}
    ${animations.pulse}
    ${animations.shimmer}
    ${animations.spin}
  `;
}
