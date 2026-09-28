<template>
  <div class="flex min-h-dvh flex-col bg-muted">
    <header class="flex flex-wrap items-center justify-between gap-3 border-b border-default bg-default px-4 py-3 sm:px-6">
      <OxyBrand />
      <div class="flex gap-2">
        <ThemeSwitcher /><LocaleSwitcher />
      </div>
    </header>
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
