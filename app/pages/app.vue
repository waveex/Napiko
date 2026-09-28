<script setup lang="ts">
// Wszystkie strony w /app wymagają zalogowania i korzystają z układu panelu.
definePageMeta({ layout: 'dashboard', middleware: 'auth' })
</script>

<template>
  <NuxtPage />
</template>
