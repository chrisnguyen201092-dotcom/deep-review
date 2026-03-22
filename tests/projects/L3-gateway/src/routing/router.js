/**
 * Request Router — matches incoming requests to upstream services
 */

class Router {
  constructor(routes = []) {
    this.routes = routes.map(route => ({
      ...route,
      regex: this._pathToRegex(route.path),
    }));
  }

  match(method, pathname) {
    for (const route of this.routes) {
      if (route.methods && !route.methods.includes(method)) continue;
      const match = pathname.match(route.regex);
      if (match) {
        return { ...route, params: match.groups || {} };
      }
    }
    return null;
  }

  _pathToRegex(path) {
    // Convert path patterns like /api/users/:id to regex
    const pattern = path
      .replace(/\/:(\w+)/g, '/(?<$1>[^/]+)')
      .replace(/\*/g, '.*');
    return new RegExp(`^${pattern}$`);
  }

  addRoute(route) {
    this.routes.push({ ...route, regex: this._pathToRegex(route.path) });
  }

  removeRoute(path) {
    this.routes = this.routes.filter(r => r.path !== path);
  }

  listRoutes() {
    return this.routes.map(({ regex, ...rest }) => rest);
  }
}

module.exports = { Router };
