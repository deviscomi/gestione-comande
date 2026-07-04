import api from '../axios'

export const zonesApi = {
  getAll:      ()             => api.get('/zones'),
  create:      (data)         => api.post('/zones', data),
  update:      (id, data)     => api.put(`/zones/${id}`, data),
  remove:      (id)           => api.delete(`/zones/${id}`),
  toggle:      (id)           => api.patch(`/zones/${id}/toggle`),
  createTable: (zoneId, number) => api.post('/tables', { zone_id: zoneId, number, status: 'libero' }),
  deleteTable: (tableId)      => api.delete(`/tables/${tableId}`),
}
