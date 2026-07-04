import api from '../axios'

export const menuApi = {
  getCategories: (params) => api.get('/categories', { params }),
  getDishes:     (params) => api.get('/dishes', { params }),
  getDish:       (id)     => api.get(`/dishes/${id}`),
  createDish:    (data)   => api.post('/dishes', data),
  updateDish:    (id, d)  => api.put(`/dishes/${id}`, d),
  toggleDish:    (id)     => api.patch(`/dishes/${id}/toggle`),
  deleteDish:    (id)     => api.delete(`/dishes/${id}`),

  getIngredients:    (p)   => api.get('/ingredients', { params: p }),
  createIngredient:  (d)   => api.post('/ingredients', d),
  updateIngredient:  (id,d)=> api.put(`/ingredients/${id}`, d),
  toggleIngredient:  (id)  => api.patch(`/ingredients/${id}/toggle`),
  deleteIngredient:  (id)  => api.delete(`/ingredients/${id}`),

  getDishVariantGroups:    (p)   => api.get('/dish-variant-groups', { params: p }),
  getDishVariantGroup:     (id)  => api.get(`/dish-variant-groups/${id}`),
  createDishVariantGroup:  (d)   => api.post('/dish-variant-groups', d),
  updateDishVariantGroup:  (id,d)=> api.put(`/dish-variant-groups/${id}`, d),
  toggleDishVariantGroup:  (id)  => api.patch(`/dish-variant-groups/${id}/toggle`),
  deleteDishVariantGroup:  (id)  => api.delete(`/dish-variant-groups/${id}`),

  getIngredientCategories:    (p)   => api.get('/ingredient-categories', { params: p }),
  createIngredientCategory:   (d)   => api.post('/ingredient-categories', d),
  updateIngredientCategory:   (id,d)=> api.put(`/ingredient-categories/${id}`, d),
  toggleIngredientCategory:   (id)  => api.patch(`/ingredient-categories/${id}/toggle`),
  deleteIngredientCategory:   (id)  => api.delete(`/ingredient-categories/${id}`),

  getPizzas:            (p) => api.get('/pizzas', { params: p }),
  getPizza:             (id)=> api.get(`/pizzas/${id}`),
  createPizza:          (d) => api.post('/pizzas', d),
  updatePizza:          (id,d)=> api.put(`/pizzas/${id}`, d),
  togglePizza:          (id)=> api.patch(`/pizzas/${id}/toggle`),
  deletePizza:          (id)=> api.delete(`/pizzas/${id}`),

  getPizzaIngredients:  (p) => api.get('/pizza-ingredients', { params: p }),
  createPizzaIngredient:(d) => api.post('/pizza-ingredients', d),
  updatePizzaIngredient:(id,d)=>api.put(`/pizza-ingredients/${id}`, d),
  togglePizzaIngredient:(id)=> api.patch(`/pizza-ingredients/${id}/toggle`),
  deletePizzaIngredient:(id)=> api.delete(`/pizza-ingredients/${id}`),

  getPizzaVariants:     (p) => api.get('/pizza-variants', { params: p }),
  createPizzaVariant:   (d) => api.post('/pizza-variants', d),
  updatePizzaVariant:   (id,d)=>api.put(`/pizza-variants/${id}`, d),
  togglePizzaVariant:   (id)=> api.patch(`/pizza-variants/${id}/toggle`),
  deletePizzaVariant:   (id)=> api.delete(`/pizza-variants/${id}`),

  getWineQuantities:    (p)   => api.get('/wine-quantities', { params: p }),
  createWineQuantity:   (d)   => api.post('/wine-quantities', d),
  updateWineQuantity:   (id,d)=> api.put(`/wine-quantities/${id}`, d),
  toggleWineQuantity:   (id)  => api.patch(`/wine-quantities/${id}/toggle`),
  deleteWineQuantity:   (id)  => api.delete(`/wine-quantities/${id}`),

  getWines:    (p)    => api.get('/wines', { params: p }),
  getWine:     (id)   => api.get(`/wines/${id}`),
  createWine:  (d)    => api.post('/wines', d),
  updateWine:  (id,d) => api.put(`/wines/${id}`, d),
  toggleWine:  (id)   => api.patch(`/wines/${id}/toggle`),
  deleteWine:  (id)   => api.delete(`/wines/${id}`),
}
