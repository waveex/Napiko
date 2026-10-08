<script setup lang="ts">
const { data: session } = await useAuthSession()
</script>

<template>
  <div class="min-h-dvh flex flex-col">
    <header class="border-b border-default">
      <UContainer class="min-h-20 flex flex-wrap items-center justify-between gap-3 py-3">
        <NuxtLink
          to="/"
          class="font-bold text-lg tracking-tight"
        >
          Napiko
        </NuxtLink>
        <div class="flex flex-wrap items-center gap-2">
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
              to="/register"
              :label="$t('common.register')"
            />
          </template>
        </div>
      </UContainer>
    </header>
    <main class="flex-1">
      <slot />
    </main>
    <footer class="border-t border-default py-6 text-sm text-muted">
      <UContainer>© {{ new Date().getFullYear() }} Napiko</UContainer>
    </footer>
  </div>
</template>
