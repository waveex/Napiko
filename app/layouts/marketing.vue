<script setup lang="ts">
/**
 * Układ stron publicznych o produkcie (/, /dla-warsztatow, /dla-klientow, /bezpieczenstwo).
 * Kontekst kolorystyczny (warsztat / klient) wynika ze strony: definePageMeta({ themeContext }).
 */
import { resolveThemeContext } from '~/utils/theme'

const { data: session } = await useAuthSession()
const route = useRoute()
const context = computed(() => resolveThemeContext(route.meta.themeContext))

const links = [
  { to: '/dla-warsztatow', key: 'workshops' },
  { to: '/dla-klientow', key: 'customers' },
  { to: '/bezpieczenstwo', key: 'security' },
] as const

const menuOpen = ref(false)
watch(() => route.fullPath, () => {
  menuOpen.value = false
})
</script>

<template>
  <div class="mk-shell flex min-h-dvh flex-col">
    <a
      href="#tresc"
      class="mk-skip"
    >{{ $t('marketing.nav.skip') }}</a>

    <header class="mk-header">
      <UContainer class="flex h-full items-center gap-3">
        <NapikoBrand to="/" />

        <nav
          class="ms-6 hidden items-center gap-1 xl:flex"
          :aria-label="$t('marketing.nav.label')"
        >
          <NuxtLink
            v-for="link in links"
            :key="link.to"
            :to="link.to"
            class="mk-nav-link"
          >
            {{ $t(`marketing.nav.${link.key}`) }}
          </NuxtLink>
        </nav>

        <div class="ms-auto hidden items-center gap-2 xl:flex">
          <ThemeSwitcher />
          <LocaleSwitcher />
          <UButton
            v-if="session"
            to="/app"
            :label="$t('nav.dashboard')"
          />
          <template v-else>
            <UButton
              to="/login"
              color="neutral"
              variant="ghost"
              :label="$t('common.login')"
            />
            <UButton
              v-if="context === 'customer'"
              to="/dla-warsztatow"
              trailing-icon="i-lucide-arrow-right"
              :label="$t('marketing.nav.forWorkshop')"
            />
            <UButton
              v-else
              to="/register"
              :label="$t('marketing.nav.register')"
            />
          </template>
        </div>

        <UButton
          class="ms-auto xl:hidden"
          color="neutral"
          variant="ghost"
          :icon="menuOpen ? 'i-lucide-x' : 'i-lucide-menu'"
          :aria-label="menuOpen ? $t('marketing.nav.close') : $t('marketing.nav.open')"
          :aria-expanded="menuOpen"
          aria-controls="mk-menu"
          @click="menuOpen = !menuOpen"
        />
      </UContainer>

      <div
        v-show="menuOpen"
        id="mk-menu"
        class="mk-menu xl:hidden"
      >
        <UContainer class="flex flex-col gap-1 py-4">
          <NuxtLink
            v-for="link in links"
            :key="link.to"
            :to="link.to"
            class="mk-nav-link mk-nav-link-block"
          >
            {{ $t(`marketing.nav.${link.key}`) }}
          </NuxtLink>
          <div class="mt-3 flex flex-wrap items-center gap-2">
            <ThemeSwitcher />
            <LocaleSwitcher />
          </div>
          <div class="mt-3 grid gap-2 sm:grid-cols-2">
            <UButton
              v-if="session"
              to="/app"
              block
              :label="$t('nav.dashboard')"
            />
            <template v-else>
              <UButton
                to="/login"
                color="neutral"
                variant="subtle"
                block
                :label="$t('common.login')"
              />
              <UButton
                v-if="context === 'customer'"
                to="/dla-warsztatow"
                block
                trailing-icon="i-lucide-arrow-right"
                :label="$t('marketing.nav.forWorkshop')"
              />
              <UButton
                v-else
                to="/register"
                block
                :label="$t('marketing.nav.register')"
              />
            </template>
          </div>
        </UContainer>
      </div>
    </header>

    <main
      id="tresc"
      class="flex-1"
    >
      <slot />
    </main>

    <footer class="mk-footer">
      <UContainer class="grid gap-8 py-10 md:grid-cols-[1.4fr_1fr_1fr]">
        <div class="space-y-3">
          <NapikoBrand to="/" />
          <p class="max-w-sm text-sm text-muted">
            {{ $t('marketing.footer.tagline') }}
          </p>
        </div>
        <nav
          class="space-y-2 text-sm"
          :aria-label="$t('marketing.footer.product')"
        >
          <p class="font-semibold">
            {{ $t('marketing.footer.product') }}
          </p>
          <ul class="space-y-1.5 text-muted">
            <li
              v-for="link in links"
              :key="link.to"
            >
              <NuxtLink
                :to="link.to"
                class="hover:text-default"
              >
                {{ $t(`marketing.nav.${link.key}`) }}
              </NuxtLink>
            </li>
          </ul>
        </nav>
        <nav
          class="space-y-2 text-sm"
          :aria-label="$t('marketing.footer.account')"
        >
          <p class="font-semibold">
            {{ $t('marketing.footer.account') }}
          </p>
          <ul class="space-y-1.5 text-muted">
            <li>
              <NuxtLink
                to="/login"
                class="hover:text-default"
              >
                {{ $t('common.login') }}
              </NuxtLink>
            </li>
            <li>
              <NuxtLink
                to="/register"
                class="hover:text-default"
              >
                {{ $t('marketing.nav.register') }}
              </NuxtLink>
            </li>
          </ul>
        </nav>
      </UContainer>
      <div class="border-t border-default">
        <UContainer class="flex flex-wrap items-center justify-between gap-2 py-4 text-xs text-muted">
          <span>© {{ new Date().getFullYear() }} Napiko</span>
          <span>{{ $t('marketing.footer.demo') }}</span>
        </UContainer>
      </div>
    </footer>
  </div>
</template>
