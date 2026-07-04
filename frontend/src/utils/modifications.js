// Classificazione centralizzata delle modifiche (varianti) di un order item.
// Unica fonte di verità per come una modifica va scritta e categorizzata nei KDS
// e nel riepilogo ordine. Ritorna { category, label, text }:
//   category: 'remove' | 'add' | 'less' | 'more' | 'option'
//   label:    etichetta in maiuscolo da evidenziare (può essere '')
//   text:     testo dell'ingrediente/valore da mostrare dopo l'etichetta
export function describeMod(mod) {
  const value = (mod.mod_value ?? '').trim()

  switch (mod.mod_type) {
    case 'ingredient_remove':
      return { category: 'remove', label: 'SENZA', text: value }

    case 'ingredient_add':
      return { category: 'add', label: 'AGG.', text: value }

    case 'ingredient_portion': {
      const lower = value.toLowerCase()
      if (lower.startsWith('poco '))       return { category: 'less', label: 'POCO',    text: value.slice(5).trim() }
      if (lower.startsWith('abbondante ')) return { category: 'more', label: 'ABBOND.', text: value.slice(11).trim() }
      return { category: 'option', label: '', text: value }
    }

    case 'pizza_cut':
      return { category: 'option', label: 'TAGLIO', text: value.toUpperCase() }

    case 'cooking':
      return { category: 'option', label: 'COTTURA', text: value }

    case 'variant':
    case 'pizza_variant':
    case 'pizza_dough':
    case 'pizza_mozzarella':
    case 'pizza_base':
      return { category: 'option', label: '', text: `[${value}]` }

    case 'variant_group':
    case 'wine_quantity':
    default:
      return { category: 'option', label: '', text: value }
  }
}

// Versione testuale (senza colore) usata dove serve solo la stringa.
export function formatModDisplay(mod) {
  const { label, text } = describeMod(mod)
  return label ? `${label} ${text}` : text
}
