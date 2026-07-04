import api from '../axios'

export const ordersApi = {
  getZones:    ()      => api.get('/zones'),
  getTables:   (p)     => api.get('/tables', { params: p }),
  getTable:    (id)    => api.get(`/tables/${id}`),
  updateCovers:(id, n) => api.patch(`/tables/${id}/covers`, { covers: n }),
  duplicateTable:(id, suffix) => api.post(`/tables/${id}/duplicate`, { suffix }),
  removeDuplicate:(id) => api.delete(`/tables/${id}/duplicate`),
  moveOrder:   (id, targetId) => api.patch(`/tables/${id}/move-order`, { target_table_id: targetId }),

  getActiveOrders: () => api.get('/orders/active'),
  getOrder:        (id) => api.get(`/orders/${id}`),
  createOrder: (tableId) => api.post('/orders', { table_id: tableId }),
  closeOrder:  (id)    => api.patch(`/orders/${id}/close`),
  getKdsStatus:(id)    => api.get(`/orders/${id}/kds-status`),

  getOrderItems: (orderId) => api.get(`/orders/${orderId}/items`),
  addOrderItem:  (orderId, data) => api.post(`/orders/${orderId}/items`, data),
  updateOrderItem:(orderId, itemId, data) => api.patch(`/orders/${orderId}/items/${itemId}`, data),
  deleteOrderItem:(orderId, itemId) => api.delete(`/orders/${orderId}/items/${itemId}`),

  sendOrder:    (orderId, data = {}) => api.post(`/orders/${orderId}/send`, data),
  preContoOrder:(orderId)           => api.post(`/orders/${orderId}/pre-conto`),
  preContoPdf:  (orderId)           => api.get(`/orders/${orderId}/pre-conto/pdf`, { responseType: 'blob' }),
  getSends:    (orderId) => api.get(`/orders/${orderId}/sends`),
  reprintSend: (orderId, sendId) => api.post(`/orders/${orderId}/sends/${sendId}/reprint`),
  reprintPrintJob: (jobId) => api.post(`/print-jobs/${jobId}/reprint`),

  getScheduleToday: () => api.get('/service-schedule/today'),
}
