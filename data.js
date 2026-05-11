/**
 * DATA MANAGEMENT (Supabase Cloud Version)
 * Logic Frete - Multi-device synchronization
 */

const SUPABASE_URL = 'https://xzemyhfmydvekoqitnsu.supabase.co';
const SUPABASE_KEY = 'sb_publishable_WzdundBjLnVYIp-jgoxJEg_dY1irGLY';

const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

const StorageManager = {
  // Local cache for performance
  _cache: {
    users: [],
    drivers: [],
    routes: [],
    deliveries: []
  },

  /**
   * INITIALIZATION
   * Fetches all data from Supabase to local cache
   */
  async init() {
    console.log("Iniciando conexão com Supabase...");
    try {
      const users = await this.fetchUsers();
      
      // FIRST RUN: Create default admin if no users exist
      if (users.length === 0) {
        console.log("Banco de dados vazio. Criando admin padrão...");
        const adminUser = {
          name: 'Administrador',
          username: 'admin',
          password: 'admin123',
          role: 'Master',
          permissions: ['view_route', 'edit_route', 'reorder_stops', 'edit_notes']
        };
        await this.saveUser(adminUser);
      }

      await Promise.all([
        this.fetchDrivers(),
        this.fetchRoutes(),
        this.fetchDeliveries()
      ]);
      console.log("Sincronização inicial concluída.");
    } catch (err) {
      console.error("Erro na sincronização inicial:", err);
    }
  },

  // --- FETCHERS ---
  async fetchUsers() {
    const { data, error } = await supabase.from('users').select('*');
    if (!error) this._cache.users = data;
    return this._cache.users;
  },
  async fetchDrivers() {
    const { data, error } = await supabase.from('drivers').select('*');
    if (!error) this._cache.drivers = data;
    return this._cache.drivers;
  },
  async fetchRoutes() {
    const { data, error } = await supabase.from('routes').select('*');
    if (!error) {
      this._cache.routes = data.map(r => ({
        ...r,
        distanceKm: r.distance_km,
        durationMin: r.duration_min,
        driverId: r.driver_id
      }));
    }
    return this._cache.routes;
  },
  async fetchDeliveries() {
    const { data, error } = await supabase.from('deliveries').select('*');
    if (!error) {
      this._cache.deliveries = data.map(d => ({
        ...d,
        routeId: d.route_id
      }));
    }
    return this._cache.deliveries;
  },

  // --- USERS ---
  getUsers() { return this._cache.users; },
  async saveUser(user) {
    const { data, error } = await supabase.from('users').upsert(user).select();
    if (!error) await this.fetchUsers();
    return data ? data[0] : null;
  },
  async deleteUser(id) {
    await supabase.from('users').delete().eq('id', id);
    await this.fetchUsers();
  },

  // --- DRIVERS ---
  getDrivers() { return this._cache.drivers; },
  async saveDriver(driver) {
    const { data, error } = await supabase.from('drivers').upsert(driver).select();
    if (!error) await this.fetchDrivers();
    return data ? data[0] : null;
  },
  async deleteDriver(id) {
    await supabase.from('drivers').delete().eq('id', id);
    await this.fetchDrivers();
  },

  // --- ROUTES ---
  getRoutes() { return this._cache.routes; },
  getRoute(id) { return this._cache.routes.find(r => r.id === id); },
  async saveRoute(route) {
    const dbRoute = {
      ...route,
      distance_km: route.distanceKm,
      duration_min: route.durationMin,
      driver_id: route.driverId
    };
    delete dbRoute.distanceKm;
    delete dbRoute.durationMin;
    delete dbRoute.driverId;

    const { data, error } = await supabase.from('routes').upsert(dbRoute).select();
    if (!error) await this.fetchRoutes();
    return data ? data[0] : null;
  },
  async deleteRoute(id) {
    await supabase.from('routes').delete().eq('id', id);
    await this.fetchRoutes();
  },

  // --- DELIVERIES ---
  getDeliveries() { return this._cache.deliveries; },
  getDeliveriesByRoute(routeId) {
    return this._cache.deliveries.filter(d => d.routeId === routeId).sort((a, b) => a.order - b.order);
  },
  async saveDelivery(delivery) {
    const dbDelivery = {
      ...delivery,
      route_id: delivery.routeId
    };
    delete dbDelivery.routeId;

    const { data, error } = await supabase.from('deliveries').upsert(dbDelivery).select();
    if (!error) await this.fetchDeliveries();
    return data ? data[0] : null;
  },
  async deleteDelivery(id) {
    await supabase.from('deliveries').delete().eq('id', id);
    await this.fetchDeliveries();
  },

  // --- AUTH ---
  getCurrentUser() {
    const session = localStorage.getItem('logic_frete_session');
    return session ? JSON.parse(session) : null;
  },
  setCurrentUser(user) {
    localStorage.setItem('logic_frete_session', JSON.stringify(user));
  },
  logout() {
    localStorage.removeItem('logic_frete_session');
  },

  // --- DASHBOARD STATS ---
  getDashboardStats() {
    const routes = this.getRoutes();
    const now = new Date();
    const todayStr = now.getFullYear() + '-' + String(now.getMonth() + 1).padStart(2, '0') + '-' + String(now.getDate()).padStart(2, '0');
    
    const todayRoutes = routes.filter(r => r.date && String(r.date).startsWith(todayStr));
    const pendingCount = todayRoutes.filter(r => r.status === 'planned').length;
    const doneCount = todayRoutes.filter(r => r.status === 'done').length;
    
    let totalKm = todayRoutes.reduce((sum, r) => sum + (parseFloat(String(r.distanceKm || '0')) || 0), 0);
    
    return {
      routesToday: todayRoutes.length,
      pending: pendingCount,
      done: doneCount,
      km: totalKm.toFixed(1)
    };
  }
};
