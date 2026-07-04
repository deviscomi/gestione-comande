import { useMemo } from 'react'

export function usePizzaPrice(pizza, { selectedVariants = [], ingredients, additions } = {}) {
  return useMemo(() => {
    if (!pizza) return '0.00'
    let price = parseFloat(pizza.base_price ?? 0)

    selectedVariants.forEach(code => {
      const v = pizza.variants?.find(v => v.code === code)
      if (v) price += parseFloat(v.price_add ?? 0)
    })

    pizza.default_ingredients?.forEach(ing => {
      if (ingredients?.[ing.id] === 'removed') {
        price -= parseFloat(ing.price_remove ?? 0)
      }
    })

    additions?.forEach(({ ingredient }) => {
      price += parseFloat(ingredient?.price_add ?? 0)
    })

    return Math.max(0, price).toFixed(2)
  }, [pizza, selectedVariants, ingredients, additions])
}
