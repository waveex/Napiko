/** Wartość opóźniona o `ms` względem źródła (np. wyszukiwarka – zapytanie dopiero po przerwie w pisaniu). */
export function useDebounced<T>(source: Ref<T>, ms = 250): Ref<T> {
  const value = ref(source.value) as Ref<T>
  let timer: ReturnType<typeof setTimeout> | undefined
  watch(source, (next) => {
    clearTimeout(timer)
    timer = setTimeout(() => {
      value.value = next
    }, ms)
  })
  onScopeDispose(() => clearTimeout(timer))
  return value
}
