import { beforeAll, describe, expect, it, vi } from 'vitest'

type AppConfig = typeof import('../../app.config').default

let appConfig: AppConfig

beforeAll(async () => {
  vi.stubGlobal('defineAppConfig', <T>(config: T) => config)
  appConfig = (await import('../../app.config')).default
})

describe('app design tokens', () => {
  it('defines navy and amber semantic colors for light and dark modes', () => {
    expect(appConfig.ui.colors).toMatchObject({
      primary: 'blue',
      secondary: 'amber',
      neutral: 'slate'
    })
    expect(appConfig.designTokens.colors.light).toMatchObject({
      brand: 'blue-700',
      accent: 'amber-600',
      canvas: 'slate-50',
      surface: 'white',
      text: 'slate-950'
    })
    expect(appConfig.designTokens.colors.dark).toMatchObject({
      brand: 'blue-300',
      accent: 'amber-300',
      canvas: 'slate-950',
      surface: 'slate-900',
      text: 'slate-50'
    })
  })

  it('defines global typography and responsive spacing tokens', () => {
    expect(appConfig.designTokens.typography.fontSans).toContain('Noto Sans KR')
    expect(appConfig.designTokens.typography.heading).toBe('font-semibold text-highlighted')
    expect(appConfig.designTokens.typography.body).toBe('text-base leading-7 text-default')
    expect(appConfig.designTokens.spacing).toEqual({
      pageInline: 'px-4 sm:px-6 lg:px-8',
      pageBlock: 'py-10 lg:py-14',
      panel: 'p-5 sm:p-6',
      field: 'space-y-2',
      inline: 'gap-3'
    })
  })

  it('applies tokens through Nuxt UI component overrides', () => {
    expect(appConfig.ui.container.base).toContain(appConfig.designTokens.spacing.pageInline)
    expect(appConfig.ui.card.slots.base).toContain(appConfig.designTokens.spacing.panel)
    expect(appConfig.ui.card.slots.title).toBe(appConfig.designTokens.typography.heading)
    expect(appConfig.ui.formField.slots.root).toBe(appConfig.designTokens.spacing.field)
    expect(appConfig.ui.formField.slots.label).toBe(appConfig.designTokens.typography.label)
    expect(appConfig.ui.button.slots.base).toContain(appConfig.designTokens.spacing.inline)
    expect(appConfig.ui.input.slots.base).toContain('bg-default')
    expect(appConfig.ui.textarea.slots.base).toContain('text-highlighted')
  })
})
