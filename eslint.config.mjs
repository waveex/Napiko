// @ts-check
import withNuxt from './.nuxt/eslint.config.mjs'

export default withNuxt(
  {
    ignores: ['docs/**', 'netlify/database/**'],
  },
  {
    rules: {
      'vue/multi-word-component-names': 'off',
    },
  },
)
