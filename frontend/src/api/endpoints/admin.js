import api from '../axios'

export const adminApi = {
  // Dashboard
  getDashboard: () => api.get('/dashboard'),

  // Users
  getUsers:     (p)    => api.get('/users', { params: p }),
  createUser:   (d)    => api.post('/users', d),
  updateUser:   (id,d) => api.put(`/users/${id}`, d),
  toggleUser:   (id)   => api.patch(`/users/${id}/toggle`),
  updatePin:    (id,p) => api.patch(`/users/${id}/pin`, { pin: p }),
  forceLogout:  (id)   => api.post(`/auth/force-logout/${id}`),
  deleteUser:   (id)   => api.delete(`/users/${id}`),

  // Printers
  getPrinters:    (p)    => api.get('/printers', { params: p }),
  createPrinter:  (d)    => api.post('/printers', d),
  updatePrinter:  (id,d) => api.put(`/printers/${id}`, d),
  togglePrinter:  (id)   => api.patch(`/printers/${id}/toggle`),
  testPrinter:    (id)   => api.post(`/printers/${id}/test`),
  deletePrinter:  (id)   => api.delete(`/printers/${id}`),
  getAgentStatus: ()     => api.get('/agent-status'),

  // Fiscal devices (Registratore Telematico)
  getFiscalDevices:    (p)    => api.get('/fiscal-devices', { params: p }),
  createFiscalDevice:  (d)    => api.post('/fiscal-devices', d),
  updateFiscalDevice:  (id,d) => api.put(`/fiscal-devices/${id}`, d),
  toggleFiscalDevice:  (id)   => api.patch(`/fiscal-devices/${id}/toggle`),
  testFiscalDevice:    (id)   => api.post(`/fiscal-devices/${id}/test`),
  deleteFiscalDevice:  (id)   => api.delete(`/fiscal-devices/${id}`),

  // Fiscal receipts (storico scontrini)
  getFiscalReceipts:   (p)    => api.get('/fiscal-receipts', { params: p }),

  // Print jobs
  getPrintJobs:   (p)   => api.get('/print-jobs', { params: p }),
  getFailedJobs:     ()    => api.get('/print-jobs/failed'),
  deleteFailedJobs:  ()    => api.delete('/print-jobs/failed'),
  retryPrintJob:     (id)  => api.post(`/print-jobs/${id}/retry`),
  reprintJob:     (id)  => api.post(`/print-jobs/${id}/reprint`),

  // Service schedule
  getSchedule:    ()    => api.get('/service-schedule'),
  updateSchedule: (d)   => api.put('/service-schedule', d),

  // Settings
  getSettings:    ()         => api.get('/settings'),
  updateSetting:  (key, val) => api.put(`/settings/${key}`, { value: val }),

  // Reports
  getReportDaily:        (p) => api.get('/reports/daily', { params: p }),
  getReportDishes:       (p) => api.get('/reports/dishes', { params: p }),
  getReportCovers:       (p) => api.get('/reports/covers', { params: p }),
  getReportHourly:       (p) => api.get('/reports/hourly', { params: p }),
  getReportWeekly:       (p) => api.get('/reports/weekly', { params: p }),
  getReportMonthly:      (p) => api.get('/reports/monthly', { params: p }),
  getReportWaiters:      (p) => api.get('/reports/waiters', { params: p }),
  exportReport:  (d)         => api.post('/reports/export', d, { responseType: 'blob' }),
  printReportThermal: (d)    => api.post('/reports/print-thermal', d),

  // Daily closure
  checkClosure:   ()    => api.get('/daily-closures/check'),
  getClosures:    ()    => api.get('/daily-closures'),
  createClosure:  (d)   => api.post('/daily-closures', d),
  getClosureReport: (id)=> api.get(`/daily-closures/${id}/report`, { responseType: 'blob' }),
  printClosureReportThermal: (id) => api.post(`/daily-closures/${id}/print-thermal`),

  // Order history
  getOrderHistory: (p)  => api.get('/orders/history', { params: p }),

  // License
  getLicense: () => api.get('/license'),

  // Activity logs
  getActivityLogs:       (p)      => api.get('/activity-logs', { params: p }),
  getActivityLogActions: ()       => api.get('/activity-logs/actions'),
  getActivityLogsCount:  (before) => api.get('/activity-logs/count', { params: { before } }),
  purgeActivityLogs:     (before) => api.delete('/activity-logs', { params: { before } }),

  // Categories (admin actions)
  createCategory:  (d)    => api.post('/categories', d),
  updateCategory:  (id,d) => api.put(`/categories/${id}`, d),
  toggleCategory:  (id)   => api.patch(`/categories/${id}/toggle`),
  deleteCategory:  (id)   => api.delete(`/categories/${id}`),

  // Import/Export dati di configurazione
  getDataGroups: ()         => api.get('/data/groups'),
  exportData:    (d)        => api.post('/data/export', d, { responseType: 'blob' }),
  importPreview: (formData) => api.post('/data/import/preview', formData),
  importData:    (formData) => api.post('/data/import', formData),
}
