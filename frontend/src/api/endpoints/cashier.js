import api from '../axios'

export const cashierApi = {
  getOrders:        ()           => api.get('/cassa/orders'),
  getPaymentStatus: (orderId)    => api.get(`/cassa/orders/${orderId}/payment-status`),
  storePayment:     (orderId, allocations, emitFiscal = true) => api.post(`/cassa/orders/${orderId}/payments`, { allocations, emit_fiscal: emitFiscal }),
  voidPayment:      (paymentId)  => api.post(`/cassa/payments/${paymentId}/void`),

  getFiscalReceipt:   (paymentId)       => api.get(`/cassa/payments/${paymentId}/fiscal-receipt`),
  emitFiscalReceipt:  (paymentId)       => api.post(`/cassa/payments/${paymentId}/fiscal-receipt`),
  retryFiscalReceipt: (paymentId)       => api.post(`/cassa/payments/${paymentId}/fiscal-receipt/retry`),
  skipFiscalReceipt:  (paymentId, note) => api.post(`/cassa/payments/${paymentId}/fiscal-receipt/skip`, { note }),
}
