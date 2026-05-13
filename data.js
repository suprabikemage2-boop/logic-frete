/**
 * DATA MANAGEMENT (Supabase Cloud Version)
 * Logic Frete - Multi-device synchronization
 */

const SUPABASE_URL = 'https://xzemyhfmydvekoqitnsu.supabase.co';
const SUPABASE_KEY = 'sb_publishable_WzdundBjLnVYIp-jgoxJEg_dY1irGLY';

let _supabaseInstance;

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

  // --- Helpers for data mapping ---
  _mapRoute(r) {
    if (!r) return null;
    return {
      ...r,
      distanceKm: r.distance_km,
      durationMin: r.duration_min,
      driverId: r.driver_id,
      origin: (() => {
        if (!r.origin) return null;
        if (typeof r.origin === 'object') return r.origin;
        try { return JSON.parse(r.origin); } catch(e) { return null; }
      })()
    };
  },

  _mapDelivery(d) {
    if (!d) return null;
    return {
      ...d,
      routeId: d.route_id
    };
  },

  async init() {
    console.log("Data: Iniciando sincronização...");
    const client = getSupabase();
    if (!client) {
      throw new Error("Supabase não disponível. Verifique sua conexão.");
    }

    try {
      // Fetch users first to check admin
      const { data: users, error: uError } = await client.from('users').select('*');
      if (uError) throw uError;
      this._cache.users = users || [];

      const hasAdmin = this._cache.users.some(u => u.username === 'admin');
      if (!hasAdmin) {
        console.log("Data: Criando admin padrão...");
        await this.saveUser({
          name: 'Administrador',
          username: 'admin',
          password: 'admin123',
          role: 'MASTER'
        });
      }

      // Parallel fetch for other data
      const [driversRes, routesRes, deliveriesRes] = await Promise.all([
        client.from('drivers').select('*'),
        client.from('routes').select('*'),
        client.from('deliveries').select('*')
      ]);

      if (driversRes.error) throw driversRes.error;
      this._cache.drivers = driversRes.data || [];

      if (routesRes.error) throw routesRes.error;
      this._cache.routes = (routesRes.data || []).map(r => this._mapRoute(r));

      if (deliveriesRes.error) throw deliveriesRes.error;
      this._cache.deliveries = (deliveriesRes.data || []).map(d => this._mapDelivery(d));

      console.log(`Data: Sincronização concluída. [Users: ${this._cache.users.length} | Rotas: ${this._cache.routes.length} | Entregas: ${this._cache.deliveries.length} | Motoristas: ${this._cache.drivers.length}]`);
    } catch (err) {
      console.error("Data: Erro crítico na inicialização:", err);
      throw new Error(`Falha ao carregar dados do servidor: ${err.message}`);
    }
  },

  // ─── USERS ─────────────────────────────────────────────────────────────────
  getUsers() { return this._cache.users; },

  async fetchUsers() {
    const client = getSupabase();
    if (!client) return this._cache.users;
    try {
      const { data, error } = await client.from('users').select('*');
      if (error) throw error;
      this._cache.users = data || [];
      return this._cache.users;
    } catch (err) {
      console.error("fetchUsers error:", err);
      return this._cache.users;
    }
  },

  async saveUser(user) {
    const client = getSupabase();
    if (!client) throw new Error("Supabase não conectado");

    const payload = { ...user };
    if (!payload.id) delete payload.id;

    const { data, error } = await client.from('users').upsert(payload).select();
    if (error) throw new Error(`Erro ao salvar usuário: ${error.message}`);
    
    await this.fetchUsers();
    return data ? data[0] : null;
  },

  async deleteUser(id) {
    const client = getSupabase();
    if (!client) return;
    const { error } = await client.from('users').delete().eq('id', id);
    if (error) throw new Error(`Erro ao deletar usuário: ${error.message}`);
    this._cache.users = this._cache.users.filter(u => u.id !== id);
  },

  // ─── DRIVERS ───────────────────────────────────────────────────────────────
  getDrivers() { return this._cache.drivers; },

  async fetchDrivers() {
    const client = getSupabase();
    if (!client) return this._cache.drivers;
    try {
      const { data, error } = await client.from('drivers').select('*');
      if (error) throw error;
      this._cache.drivers = data || [];
      return this._cache.drivers;
    } catch (err) {
      console.error("fetchDrivers error:", err);
      return this._cache.drivers;
    }
  },

  async saveDriver(driver) {
    const client = getSupabase();
    if (!client) throw new Error("Supabase não conectado");

    const payload = { ...driver };
    if (!payload.id) delete payload.id;

    const { data, error } = await client.from('drivers').upsert(payload).select();
    if (error) throw new Error(`Erro ao salvar motorista: ${error.message}`);
    
    await this.fetchDrivers();
    return data ? data[0] : null;
  },

  async deleteDriver(id) {
    const client = getSupabase();
    if (!client) return;
    const { error } = await client.from('drivers').delete().eq('id', id);
    if (error) throw new Error(`Erro ao deletar motorista: ${error.message}`);
    this._cache.drivers = this._cache.drivers.filter(d => d.id !== id);
  },

  // ─── ROUTES ────────────────────────────────────────────────────────────────
  getRoutes() { return this._cache.routes; },
  getRoute(id) { return this._cache.routes.find(r => r.id === id); },

  async fetchRoutes() {
    const client = getSupabase();
    if (!client) return this._cache.routes;
    try {
      const { data, error } = await client.from('routes').select('*');
      if (error) throw error;
      this._cache.routes = (data || []).map(r => this._mapRoute(r));
      return this._cache.routes;
    } catch (err) {
      console.error("fetchRoutes error:", err);
      return this._cache.routes;
    }
  },

  async saveRoute(route) {
    const client = getSupabase();
    if (!client) throw new Error("Supabase não conectado");

    const payload = {
      name: route.name,
      date: route.date || null,
      notes: route.notes || null,
      vehicle: route.vehicle || null,
      plate: route.plate || null,
      color: route.color || 'default',
      status: route.status || 'planned',
      distance_km: route.distanceKm || null,
      duration_min: route.durationMin || null,
      driver_id: route.driverId || null,
      origin: route.origin ? JSON.stringify(route.origin) : null
    };

    if (route.id) payload.id = route.id;

    const { data, error } = await client.from('routes').upsert(payload).select();
    if (error) throw new Error(`Erro ao salvar rota: ${error.message}`);
    
    await this.fetchRoutes();
    return data ? this._mapRoute(data[0]) : null;
  },

  async deleteRoute(id) {
    const client = getSupabase();
    if (!client) return;
    const { error } = await client.from('routes').delete().eq('id', id);
    if (error) throw new Error(`Erro ao deletar rota: ${error.message}`);
    await this.fetchRoutes();
  },

  // ─── DELIVERIES ────────────────────────────────────────────────────────────
  getDeliveries() { return this._cache.deliveries; },

  getDeliveriesByRoute(routeId) {
    return this._cache.deliveries
      .filter(d => d.routeId === routeId)
      .sort((a, b) => (a.order || 0) - (b.order || 0));
  },

  async fetchDeliveries() {
    const client = getSupabase();
    if (!client) return this._cache.deliveries;
    try {
      const { data, error } = await client.from('deliveries').select('*');
      if (error) throw error;
      this._cache.deliveries = (data || []).map(d => this._mapDelivery(d));
      return this._cache.deliveries;
    } catch (err) {
      console.error("fetchDeliveries error:", err);
      return this._cache.deliveries;
    }
  },

  async saveDelivery(delivery) {
    const client = getSupabase();
    if (!client) throw new Error("Supabase não conectado");

    const payload = {
      recipient: delivery.recipient,
      cpf: delivery.cpf || null,
      phone: delivery.phone || null,
      address: delivery.address || null,
      lat: delivery.lat || null,
      lng: delivery.lng || null,
      order: delivery.order || 1,
      status: delivery.status || 'pending',
      notes: delivery.notes || null,
      route_id: delivery.routeId
    };

    if (delivery.id) payload.id = delivery.id;

    const { data, error } = await client.from('deliveries').upsert(payload).select();
    if (error) throw new Error(`Erro ao salvar parada: ${error.message}`);
    
    await this.fetchDeliveries();
    return data ? this._mapDelivery(data[0]) : null;
  },

  async deleteDelivery(id) {
    const client = getSupabase();
    if (!client) return;
    const { error } = await client.from('deliveries').delete().eq('id', id);
    if (error) throw new Error(`Erro ao deletar parada: ${error.message}`);
    this._cache.deliveries = this._cache.deliveries.filter(d => d.id !== id);
    await this.fetchDeliveries();
  },

  // ─── AUTH ──────────────────────────────────────────────────────────────────
  async login(username, password) {
    console.log(`Auth: Tentativa de login para '${username}'. Usuários carregados: ${this._cache.users.length}`);
    let user = this._cache.users.find(u => u.username === username && u.password === password);
    if (!user) {
      console.log("Auth: Usuário não encontrado no cache. Buscando no servidor...");
      await this.fetchUsers();
      user = this._cache.users.find(u => u.username === username && u.password === password);
    }
    if (user) { 
      console.log("Auth: Login bem-sucedido!");
      this.setCurrentUser(user); 
      return true; 
    }
    console.warn("Auth: Login falhou (usuário ou senha incorretos).");
    return false;
  },

  getCurrentUser() {
    const session = localStorage.getItem('logic_frete_session');
    return session ? JSON.parse(session) : null;
  },
  setCurrentUser(user) { localStorage.setItem('logic_frete_session', JSON.stringify(user)); },
  logout() { localStorage.removeItem('logic_frete_session'); },

  // ─── DASHBOARD ─────────────────────────────────────────────────────────────
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

