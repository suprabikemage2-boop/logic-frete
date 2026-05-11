/**
 * DATA MANAGEMENT (Supabase Cloud Version)
 * Logic Frete - Multi-device synchronization
 */

const SUPABASE_URL = 'https://xzemyhfmydvekoqitnsu.supabase.co';
const SUPABASE_KEY = 'sb_publishable_WzdundBjLnVYIp-jgoxJEg_dY1irGLY';

let _supabaseInstance; // Nome alterado para evitar conflito

function getSupabase() {
  if (!_supabaseInstance) {
    if (typeof window.supabase === 'undefined') {
      console.warn("Supabase: SDK não encontrado.");
      return null;
    }
    try {
      _supabaseInstance = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
    } catch (e) {
      console.error("Supabase: Erro ao criar cliente:", e);
      return null;
    }
  }
  return _supabaseInstance;
}

const StorageManager = {
  _cache: {
    users: [],
    drivers: [],
    routes: [],
    deliveries: []
  },

  async init() {
    console.log("Data: Iniciando sincronização...");
    const client = getSupabase();
    if (!client) {
      console.error("Data: Supabase não disponível.");
      return;
    }

    try {
      const { data: users, error: uError } = await client.from('users').select('*');
      if (!uError) this._cache.users = users || [];
      
      if (this._cache.users.length === 0) {
        await this.saveUser({
          name: 'Administrador',
          username: 'admin',
          password: 'admin123',
          role: 'MASTER'
        });
      }

      const [drivers, routes, deliveries] = await Promise.all([
        client.from('drivers').select('*'),
        client.from('routes').select('*'),
        client.from('deliveries').select('*')
      ]);

      if (drivers.data) this._cache.drivers = drivers.data;
      if (routes.data) {
        this._cache.routes = routes.data.map(r => ({
          ...r,
          distanceKm: r.distance_km,
          durationMin: r.duration_min,
          driverId: r.driver_id
        }));
      }
      if (deliveries.data) {
        this._cache.deliveries = deliveries.data.map(d => ({
          ...d,
          routeId: d.route_id
        }));
      }
      console.log("Data: Sincronização OK.");
    } catch (err) {
      console.error("Data: Erro sync:", err);
    }
  },

  getUsers() { return this._cache.users; },
  async fetchUsers() {
    const client = getSupabase();
    if (!client) return [];
    const { data, error } = await client.from('users').select('*');
    if (!error) this._cache.users = data;
    return this._cache.users;
  },
  async saveUser(user) {
    const client = getSupabase();
    if (!client) return null;
    const { data, error } = await client.from('users').upsert(user).select();
    if (!error) await this.fetchUsers();
    return data ? data[0] : null;
  },

  getDrivers() { return this._cache.drivers; },
  async fetchDrivers() {
    const client = getSupabase();
    if (!client) return [];
    const { data, error } = await client.from('drivers').select('*');
    if (!error) this._cache.drivers = data;
    return this._cache.drivers;
  },
  async saveDriver(driver) {
    const client = getSupabase();
    if (!client) return null;
    const { data, error } = await client.from('drivers').upsert(driver).select();
    if (!error) await this.fetchDrivers();
    return data ? data[0] : null;
  },

  getRoutes() { return this._cache.routes; },
  getRoute(id) { return this._cache.routes.find(r => r.id === id); },
  async fetchRoutes() {
    const client = getSupabase();
    if (!client) return [];
    const { data, error } = await client.from('routes').select('*');
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
  async saveRoute(route) {
    const client = getSupabase();
    if (!client) return null;
    const dbRoute = {...route, distance_km: route.distanceKm, duration_min: route.durationMin, driver_id: route.driverId };
    delete dbRoute.distanceKm; delete dbRoute.durationMin; delete dbRoute.driverId;
    const { data, error } = await client.from('routes').upsert(dbRoute).select();
    if (!error) await this.fetchRoutes();
    return data ? data[0] : null;
  },
  async deleteRoute(id) {
    const client = getSupabase();
    if (!client) return;
    await client.from('routes').delete().eq('id', id);
    await this.fetchRoutes();
  },

  getDeliveries() { return this._cache.deliveries; },
  getDeliveriesByRoute(routeId) {
    return this._cache.deliveries.filter(d => d.routeId === routeId).sort((a, b) => a.order - b.order);
  },
  async fetchDeliveries() {
    const client = getSupabase();
    if (!client) return [];
    const { data, error } = await client.from('deliveries').select('*');
    if (!error) {
      this._cache.deliveries = data.map(d => ({...d, routeId: d.route_id}));
    }
    return this._cache.deliveries;
  },
  async saveDelivery(delivery) {
    const client = getSupabase();
    if (!client) return null;
    const dbDelivery = {...delivery, route_id: delivery.routeId};
    delete dbDelivery.routeId;
    const { data, error } = await client.from('deliveries').upsert(dbDelivery).select();
    if (!error) await this.fetchDeliveries();
    return data ? data[0] : null;
  },

  async login(username, password) {
    const user = this._cache.users.find(u => u.username === username && u.password === password);
    if (user) { this.setCurrentUser(user); return true; }
    return false;
  },
  getCurrentUser() {
    const session = localStorage.getItem('logic_frete_session');
    return session ? JSON.parse(session) : null;
  },
  setCurrentUser(user) { localStorage.setItem('logic_frete_session', JSON.stringify(user)); },
  logout() { localStorage.removeItem('logic_frete_session'); },

  getDashboardStats() {
    const routes = this.getRoutes();
    const todayStr = new Date().toISOString().split('T')[0];
    const todayRoutes = routes.filter(r => r.date && String(r.date).startsWith(todayStr));
    const totalKm = todayRoutes.reduce((sum, r) => sum + (parseFloat(r.distanceKm) || 0), 0);
    return {
      routesToday: todayRoutes.length,
      pending: todayRoutes.filter(r => r.status === 'planned').length,
      done: todayRoutes.filter(r => r.status === 'done').length,
      km: totalKm.toFixed(1)
    };
  }
};
