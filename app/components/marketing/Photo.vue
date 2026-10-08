<script setup lang="ts">
/** Ilustracja „zdjęcia z warsztatu”: tarcza hamulcowa ze zużytym klockiem (SVG, bez plików zewnętrznych). */
defineProps<{ flash?: boolean }>()
</script>

<template>
  <div class="sc-photo">
    <svg
      viewBox="0 0 160 100"
      class="size-full"
      preserveAspectRatio="xMidYMid slice"
      role="img"
      aria-hidden="true"
    >
      <defs>
        <linearGradient
          id="mk-photo-bg"
          x1="0"
          y1="0"
          x2="1"
          y2="1"
        >
          <stop
            offset="0"
            stop-color="#3a3d42"
          />
          <stop
            offset="1"
            stop-color="#1c1e21"
          />
        </linearGradient>
        <radialGradient id="mk-photo-disc">
          <stop
            offset="0.55"
            stop-color="#8d9299"
          />
          <stop
            offset="1"
            stop-color="#5b5f66"
          />
        </radialGradient>
      </defs>
      <rect
        width="160"
        height="100"
        fill="url(#mk-photo-bg)"
      />
      <circle
        cx="78"
        cy="52"
        r="42"
        fill="url(#mk-photo-disc)"
      />
      <circle
        cx="78"
        cy="52"
        r="33"
        fill="none"
        stroke="#4a4e55"
        stroke-width="1.5"
      />
      <circle
        cx="78"
        cy="52"
        r="15"
        fill="#2a2c30"
      />
      <circle
        cx="78"
        cy="52"
        r="6"
        fill="#9ea3aa"
      />
      <g fill="#2a2c30">
        <circle
          cx="78"
          cy="38"
          r="2.4"
        />
        <circle
          cx="91.3"
          cy="47.7"
          r="2.4"
        />
        <circle
          cx="86.2"
          cy="63.3"
          r="2.4"
        />
        <circle
          cx="69.8"
          cy="63.3"
          r="2.4"
        />
        <circle
          cx="64.7"
          cy="47.7"
          r="2.4"
        />
      </g>
      <path
        d="M108 26a42 42 0 0 1 12 26 42 42 0 0 1-12 26l-9-8a30 30 0 0 0 8-18 30 30 0 0 0-8-18z"
        fill="#c4431f"
      />
      <path
        d="M106 33a34 34 0 0 1 8 19 34 34 0 0 1-8 19"
        fill="none"
        stroke="#f1b9a6"
        stroke-width="1.2"
        stroke-dasharray="2 3"
      />
      <circle
        cx="112"
        cy="52"
        r="17"
        fill="none"
        stroke="#ff6b4a"
        stroke-width="2"
      />
    </svg>
    <span
      v-if="flash"
      class="sc-flash"
    />
  </div>
</template>
