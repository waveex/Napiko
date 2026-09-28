<template>
  <div class="flex min-h-dvh flex-col bg-muted/40">
    <main class="flex-1">
      <slot />
    </main>
    <footer class="py-6 text-center text-xs text-muted">
      {{ $t('approve.footer') }} · <NuxtLink
        to="/"
        class="font-semibold"
      >OXY</NuxtLink>
    </footer>
  </div>
</template>
