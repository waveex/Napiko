export default defineAppConfig({
  ui: {
    colors: {
      primary: 'oxy-blue',
      neutral: 'oxy-slate',
    },
    button: {
      slots: { base: 'oxy-control gap-2 px-4 font-semibold transition-colors duration-150', label: 'whitespace-normal text-start' },
      compoundVariants: [{ color: 'primary', variant: 'solid', class: 'oxy-primary' }],
    },
    input: { slots: { base: 'oxy-control text-base ring-accented' } },
    inputNumber: { slots: { base: 'oxy-control text-base ring-accented' } },
    textarea: { slots: { base: 'oxy-control text-base ring-accented' } },
    select: { slots: { base: 'oxy-control text-base ring-accented', item: 'min-h-12 text-base', content: 'z-[60]' } },
    selectMenu: { slots: { base: 'oxy-control text-base ring-accented', item: 'min-h-12 text-base', content: 'z-[60]' } },
    inputMenu: { slots: { base: 'oxy-control text-base ring-accented', item: 'min-h-12 text-base', content: 'z-[60]' } },
    checkbox: { slots: { root: 'min-h-12 items-center gap-3', base: 'size-6 ring-accented', label: 'text-base', wrapper: 'py-2' } },
    switch: { slots: { root: 'min-h-12 items-center gap-3', label: 'text-base' } },
    formField: { slots: { label: 'text-base font-medium', description: 'text-base', error: 'text-base' } },
    card: { slots: { root: 'rounded-2xl shadow-none', header: 'p-5', body: 'p-5', footer: 'p-5' } },
    pageCard: { slots: { root: 'rounded-2xl', title: 'text-lg', description: 'text-base' } },
    tabs: { slots: { trigger: 'min-h-12 text-base px-4' } },
    dropdownMenu: { slots: { item: 'min-h-12 text-base', content: 'p-2 rounded-xl z-[60]' } },
    navigationMenu: { slots: { link: 'min-h-12 rounded-xl text-base gap-3', list: 'gap-2' } },
    table: { slots: { th: 'text-sm py-4', td: 'text-base py-4 whitespace-normal' } },
    dashboardPanel: { slots: { root: 'min-h-0 h-full', body: 'oxy-panel-body' } },
    // max-lg:pe-16 – miejsce na dzwonek powiadomień w prawym górnym rogu na telefonie (layout dashboard)
    dashboardNavbar: { slots: { root: 'h-auto min-h-20 flex-wrap gap-2 py-3 max-lg:pe-16 lg:px-8 bg-default', title: 'text-xl font-bold whitespace-normal', toggle: 'hidden' } },
    dashboardToolbar: { slots: { root: 'flex-wrap gap-2 py-3 lg:px-8 bg-default' } },
    modal: { slots: { content: 'oxy-dialog', overlay: 'oxy-dialog-overlay', header: 'pe-20 sm:pe-20 shrink-0', title: 'text-xl', description: 'text-base', body: 'min-h-0', close: 'top-3 end-3', footer: 'flex-wrap gap-2 shrink-0' } },
  },
})
