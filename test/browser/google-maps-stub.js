/* Minimal fake `window.google.maps` for browser smoke tests of index.html.
 *
 * It implements just enough of the Maps JavaScript API surface that the
 * viewer and the zone editor call, records every object it creates on
 * `window.__stub`, and lets tests fire events with
 * `google.maps.event.trigger(target, 'click', payload)`.
 *
 * Loaded in place of https://maps.googleapis.com/maps/api/js?...&callback=initMap,
 * so it calls window.initMap() itself at the end.
 */
(function () {
  'use strict';

  const stub = {
    maps: [],
    polygons: [],
    markers: [],
    infoWindows: [],
    drawingManagers: [],
    listeners: [],
  };

  /* ---- events ---- */

  function Listener(target, name, fn) {
    this.target = target;
    this.name = name;
    this.fn = fn;
    this.removed = false;
  }
  Listener.prototype.remove = function () {
    if (this.removed) return;
    this.removed = true;
    const list = this.target.__listeners[this.name] || [];
    const i = list.indexOf(this);
    if (i > -1) list.splice(i, 1);
  };

  function Evented() {
    this.__listeners = {};
  }
  Evented.prototype.addListener = function (name, fn) {
    if (!this.__listeners[name]) this.__listeners[name] = [];
    const l = new Listener(this, name, fn);
    this.__listeners[name].push(l);
    stub.listeners.push(l);
    return l;
  };
  Evented.prototype.__fire = function (name, args) {
    (this.__listeners[name] || []).slice().forEach(l => l.fn.apply(this, args));
  };

  function inherit(Sub) {
    Sub.prototype = Object.create(Evented.prototype);
    Sub.prototype.constructor = Sub;
  }

  /* ---- geometry ---- */

  function LatLng(lat, lng) {
    if (lat && typeof lat === 'object') {
      const o = lat;
      lat = typeof o.lat === 'function' ? o.lat() : o.lat;
      lng = typeof o.lng === 'function' ? o.lng() : o.lng;
    }
    this._lat = Number(lat);
    this._lng = Number(lng);
  }
  LatLng.prototype.lat = function () { return this._lat; };
  LatLng.prototype.lng = function () { return this._lng; };
  LatLng.prototype.equals = function (o) {
    return !!o && this._lat === (typeof o.lat === 'function' ? o.lat() : o.lat)
      && this._lng === (typeof o.lng === 'function' ? o.lng() : o.lng);
  };
  LatLng.prototype.toJSON = function () { return { lat: this._lat, lng: this._lng }; };
  LatLng.prototype.toString = function () { return '(' + this._lat + ', ' + this._lng + ')'; };

  function toLatLng(p) { return p instanceof LatLng ? p : new LatLng(p); }

  function LatLngBounds(sw, ne) {
    this._sw = sw ? toLatLng(sw) : null;
    this._ne = ne ? toLatLng(ne) : null;
  }
  LatLngBounds.prototype.extend = function (p) {
    const ll = toLatLng(p);
    if (!this._sw) { this._sw = new LatLng(ll.lat(), ll.lng()); this._ne = new LatLng(ll.lat(), ll.lng()); return this; }
    this._sw = new LatLng(Math.min(this._sw.lat(), ll.lat()), Math.min(this._sw.lng(), ll.lng()));
    this._ne = new LatLng(Math.max(this._ne.lat(), ll.lat()), Math.max(this._ne.lng(), ll.lng()));
    return this;
  };
  LatLngBounds.prototype.getSouthWest = function () { return this._sw; };
  LatLngBounds.prototype.getNorthEast = function () { return this._ne; };
  LatLngBounds.prototype.isEmpty = function () { return !this._sw; };
  LatLngBounds.prototype.getCenter = function () {
    if (!this._sw) return new LatLng(0, 0);
    return new LatLng((this._sw.lat() + this._ne.lat()) / 2, (this._sw.lng() + this._ne.lng()) / 2);
  };

  function Size(w, h) { this.width = w; this.height = h; }
  function Point(x, y) { this.x = x; this.y = y; }

  /* ---- MVCArray ---- */

  function MVCArray(arr) {
    Evented.call(this);
    this._a = (arr || []).slice();
  }
  inherit(MVCArray);
  MVCArray.prototype.forEach = function (cb) { this._a.slice().forEach((v, i) => cb(v, i)); };
  MVCArray.prototype.getAt = function (i) { return this._a[i]; };
  MVCArray.prototype.getLength = function () { return this._a.length; };
  MVCArray.prototype.getArray = function () { return this._a; };
  MVCArray.prototype.push = function (v) {
    this._a.push(v);
    this.__fire('insert_at', [this._a.length - 1]);
    return this._a.length;
  };
  MVCArray.prototype.pop = function () {
    const v = this._a.pop();
    this.__fire('remove_at', [this._a.length, v]);
    return v;
  };
  MVCArray.prototype.removeAt = function (i) {
    const v = this._a.splice(i, 1)[0];
    this.__fire('remove_at', [i, v]);
    return v;
  };
  MVCArray.prototype.insertAt = function (i, v) {
    this._a.splice(i, 0, v);
    this.__fire('insert_at', [i]);
  };
  MVCArray.prototype.setAt = function (i, v) {
    const prev = this._a[i];
    this._a[i] = v;
    this.__fire('set_at', [i, prev]);
  };
  MVCArray.prototype.clear = function () { while (this._a.length) this.pop(); };

  /* ---- Map ---- */

  function Map(el, opts) {
    Evented.call(this);
    this.el = el;
    this.options = Object.assign({}, opts || {});
    this._center = toLatLng(this.options.center || { lat: 0, lng: 0 });
    this._zoom = this.options.zoom == null ? 0 : this.options.zoom;
    this.fitBoundsCalls = [];
    stub.maps.push(this);
  }
  inherit(Map);
  Map.prototype.getCenter = function () { return this._center; };
  Map.prototype.setCenter = function (c) { this._center = toLatLng(c); this.__fire('center_changed', []); };
  Map.prototype.getZoom = function () { return this._zoom; };
  Map.prototype.setZoom = function (z) { this._zoom = z; this.__fire('zoom_changed', []); };
  Map.prototype.setOptions = function (o) { Object.assign(this.options, o || {}); };
  Map.prototype.fitBounds = function (b, padding) { this.fitBoundsCalls.push({ bounds: b, padding: padding }); this.__fire('bounds_changed', []); };
  Map.prototype.getBounds = function () { return new LatLngBounds({ lat: -90, lng: -180 }, { lat: 90, lng: 180 }); };
  Map.prototype.getDiv = function () { return this.el; };
  Map.prototype.panTo = function (c) { this.setCenter(c); };

  /* ---- Polygon ---- */

  function Polygon(opts) {
    Evented.call(this);
    this.options = {};
    this._path = new MVCArray();
    this.setOptions(opts || {});
    this.id = stub.polygons.length;
    stub.polygons.push(this);
  }
  inherit(Polygon);
  Polygon.prototype.setOptions = function (o) {
    o = o || {};
    if (o.paths !== undefined || o.path !== undefined) {
      const raw = o.paths !== undefined ? o.paths : o.path;
      this.setPath(raw);
    }
    const rest = Object.assign({}, o);
    delete rest.paths; delete rest.path;
    Object.assign(this.options, rest);
    if ('map' in rest) this._map = rest.map;
  };
  Polygon.prototype.setPath = function (path) {
    let arr = path;
    if (path instanceof MVCArray) arr = path.getArray();
    // A "paths" array of rings: use the first ring.
    if (Array.isArray(arr) && arr.length && Array.isArray(arr[0])) arr = arr[0];
    if (arr instanceof MVCArray) arr = arr.getArray();
    const listeners = this._path.__listeners;
    this._path = new MVCArray((arr || []).map(toLatLng));
    this._path.__listeners = listeners;   // keep set_at/insert_at/remove_at wiring
  };
  Polygon.prototype.setPaths = Polygon.prototype.setPath;
  Polygon.prototype.getPath = function () { return this._path; };
  Polygon.prototype.getPaths = function () { return new MVCArray([this._path]); };
  Polygon.prototype.setMap = function (m) { this._map = m; this.options.map = m; };
  Polygon.prototype.getMap = function () { return this._map || null; };
  Polygon.prototype.setVisible = function (v) { this.options.visible = !!v; };
  Polygon.prototype.getVisible = function () { return this.options.visible !== false; };
  Polygon.prototype.setEditable = function (v) { this.options.editable = !!v; };
  Polygon.prototype.getEditable = function () { return !!this.options.editable; };
  Polygon.prototype.setDraggable = function (v) { this.options.draggable = !!v; };

  /* ---- Marker ---- */

  function Marker(opts) {
    Evented.call(this);
    this.options = {};
    this.setOptions(opts || {});
    this.id = stub.markers.length;
    stub.markers.push(this);
  }
  inherit(Marker);
  Marker.prototype.setOptions = function (o) {
    o = o || {};
    Object.assign(this.options, o);
    if (o.position !== undefined) this.options.position = toLatLng(o.position);
    if ('map' in o) this._map = o.map;
  };
  Marker.prototype.setMap = function (m) { this._map = m; this.options.map = m; };
  Marker.prototype.getMap = function () { return this._map || null; };
  Marker.prototype.setVisible = function (v) { this.options.visible = !!v; };
  Marker.prototype.getVisible = function () { return this.options.visible !== false; };
  Marker.prototype.setPosition = function (p) { this.options.position = toLatLng(p); };
  Marker.prototype.getPosition = function () { return this.options.position; };
  Marker.prototype.getLabel = function () { return this.options.label; };
  Marker.prototype.setLabel = function (l) { this.options.label = l; };
  Marker.prototype.setIcon = function (i) { this.options.icon = i; };
  Marker.prototype.getIcon = function () { return this.options.icon; };
  Marker.prototype.setTitle = function (t) { this.options.title = t; };
  Marker.prototype.getTitle = function () { return this.options.title; };
  Marker.prototype.setZIndex = function (z) { this.options.zIndex = z; };
  Marker.prototype.setAnimation = function (a) { this.options.animation = a; };

  /* ---- InfoWindow ---- */

  function InfoWindow(opts) {
    Evented.call(this);
    this.options = Object.assign({}, opts || {});
    this.content = this.options.content;
    this.isOpen = false;
    this.openCount = 0;
    this.id = stub.infoWindows.length;
    stub.infoWindows.push(this);
  }
  inherit(InfoWindow);
  InfoWindow.prototype.open = function (mapOrOpts, anchor) {
    this.isOpen = true;
    this.openCount++;
    this.anchor = anchor;
    this.map = mapOrOpts;
  };
  InfoWindow.prototype.close = function () { this.isOpen = false; };
  InfoWindow.prototype.setContent = function (c) { this.content = c; this.options.content = c; };
  InfoWindow.prototype.getContent = function () { return this.content; };
  InfoWindow.prototype.setPosition = function (p) { this.options.position = toLatLng(p); };
  InfoWindow.prototype.setOptions = function (o) { Object.assign(this.options, o || {}); if (o && 'content' in o) this.content = o.content; };

  /* ---- drawing library ---- */

  function DrawingManager(opts) {
    Evented.call(this);
    this.options = Object.assign({}, opts || {});
    this._map = this.options.map || null;
    stub.drawingManagers.push(this);
  }
  inherit(DrawingManager);
  DrawingManager.prototype.setMap = function (m) { this._map = m; this.options.map = m; };
  DrawingManager.prototype.getMap = function () { return this._map; };
  DrawingManager.prototype.setOptions = function (o) { Object.assign(this.options, o || {}); };
  DrawingManager.prototype.setDrawingMode = function (m) { this.options.drawingMode = m; };
  DrawingManager.prototype.getDrawingMode = function () { return this.options.drawingMode; };

  /* ---- namespace ---- */

  const event = {
    addListener: function (target, name, fn) { return target.addListener(name, fn); },
    addListenerOnce: function (target, name, fn) {
      const l = target.addListener(name, function () { l.remove(); return fn.apply(this, arguments); });
      return l;
    },
    removeListener: function (l) { if (l && typeof l.remove === 'function') l.remove(); },
    clearListeners: function (target, name) {
      (target.__listeners[name] || []).slice().forEach(l => l.remove());
    },
    clearInstanceListeners: function (target) {
      Object.keys(target.__listeners || {}).forEach(n => event.clearListeners(target, n));
    },
    trigger: function (target, name) {
      const args = Array.prototype.slice.call(arguments, 2);
      if (target && typeof target.__fire === 'function') target.__fire(name, args);
    },
  };

  window.google = window.google || {};
  window.google.maps = {
    Map: Map,
    Polygon: Polygon,
    Marker: Marker,
    InfoWindow: InfoWindow,
    LatLng: LatLng,
    LatLngBounds: LatLngBounds,
    MVCArray: MVCArray,
    Size: Size,
    Point: Point,
    SymbolPath: { CIRCLE: 0, FORWARD_CLOSED_ARROW: 1, FORWARD_OPEN_ARROW: 2, BACKWARD_CLOSED_ARROW: 3, BACKWARD_OPEN_ARROW: 4 },
    Animation: { DROP: 2, BOUNCE: 1 },
    MapTypeId: { ROADMAP: 'roadmap', SATELLITE: 'satellite', HYBRID: 'hybrid', TERRAIN: 'terrain' },
    ControlPosition: { TOP_LEFT: 1, TOP_CENTER: 2, TOP_RIGHT: 3, RIGHT_TOP: 7, LEFT_TOP: 5 },
    event: event,
    drawing: {
      DrawingManager: DrawingManager,
      OverlayType: { POLYGON: 'polygon', MARKER: 'marker', POLYLINE: 'polyline', CIRCLE: 'circle', RECTANGLE: 'rectangle' },
    },
    __stub: stub,
  };
  window.__stub = stub;

  // Helper for tests: build a click-style event payload for a LatLng.
  stub.mapEvent = function (lat, lng) {
    return { latLng: new LatLng(lat, lng), stop: function () { this.stopped = true; }, stopped: false };
  };

  if (typeof window.initMap === 'function') {
    stub.initMapCalled = true;
    window.initMap();
  } else {
    stub.initMapCalled = false;
  }
})();
