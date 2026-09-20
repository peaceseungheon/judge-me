const designTokens = {
  colors: {
    light: {
      brand: 'blue-700',
      accent: 'amber-600',
      canvas: 'slate-50',
      surface: 'white',
      text: 'slate-950',
      muted: 'slate-600',
      border: 'slate-200'
    },
    dark: {
      brand: 'blue-300',
      accent: 'amber-300',
      canvas: 'slate-950',
      surface: 'slate-900',
      text: 'slate-50',
      muted: 'slate-400',
      border: 'slate-800'
    }
  },
  typography: {
    fontSans: ['Inter', 'Noto Sans KR', 'ui-sans-serif', 'system-ui', 'sans-serif'],
    heading: 'font-semibold text-highlighted',
    body: 'text-base leading-7 text-default',
    label: 'text-sm font-medium text-default'
  },
  spacing: {
    pageInline: 'px-4 sm:px-6 lg:px-8',
    pageBlock: 'py-10 lg:py-14',
    panel: 'p-5 sm:p-6',
    field: 'space-y-2',
    inline: 'gap-3'
  }
} as const

export default defineAppConfig({
  designTokens,
  ui: {
    colors: {
      primary: 'blue',
      secondary: 'amber',
      neutral: 'slate',
      success: 'green',
      warning: 'amber',
      error: 'red',
      info: 'sky'
    },
    container: {
      base: `w-full max-w-6xl mx-auto ${designTokens.spacing.pageInline}`
    },
    card: {
      slots: {
        base: `my-0 rounded-lg border border-default bg-default ${designTokens.spacing.panel}`,
        title: designTokens.typography.heading,
        description: 'text-sm text-muted'
      },
      defaultVariants: {
        color: 'primary'
      }
    },
    button: {
      slots: {
        base: `rounded-md font-medium ${designTokens.spacing.inline}`
      },
      defaultVariants: {
        size: 'md'
      }
    },
    formField: {
      slots: {
        root: designTokens.spacing.field,
        label: designTokens.typography.label,
        description: 'text-sm text-muted',
        help: 'mt-2 text-sm text-muted'
      },
      defaultVariants: {
        size: 'md'
      }
    },
    input: {
      slots: {
        base: 'rounded-md bg-default text-highlighted ring-default'
      },
      defaultVariants: {
        size: 'md'
      }
    },
    textarea: {
      slots: {
        base: 'rounded-md bg-default text-highlighted ring-default'
      },
      defaultVariants: {
        size: 'md'
      }
    }
  }
})
