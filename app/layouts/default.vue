<script setup lang="ts">
const { data: session } = await useAuthSession()
</script>

<template>
  <div class="min-h-dvh flex flex-col">
    <header class="border-b border-default">
      <UContainer class="h-16 flex items-center justify-between gap-4">
        <NuxtLink
          to="/"
          class="font-bold text-lg tracking-tight"
        >
          OXY
        </NuxtLink>
        <div class="flex items-center gap-2">
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
      <UContainer>© {{ new Date().getFullYear() }} OXY</UContainer>
    </footer>
  </div>
</template>
