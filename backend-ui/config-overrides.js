/**
 * Webpack config override for react-app-rewired.
 *
 * Webpack 5 removed automatic polyfills for Node.js built-ins.
 * Axios 1.x imports Node-specific modules (http, https, stream, …) in its
 * server-side adapter; those paths are remapped to a null module via the
 * axios package.json "browser" field, but the mapping is not always picked
 * up when the package also has an "exports" field.
 *
 * Setting each module to `false` here tells webpack to replace the import
 * with an empty module, which is safe because the browser adapter (XHR/fetch)
 * is used at runtime, never the http adapter.
 */
module.exports = {
  webpack: (config) => {
    config.resolve.fallback = {
      ...config.resolve.fallback,
      http: false,
      https: false,
      http2: false,
      url: false,
      stream: false,
      zlib: false,
      util: false,
      net: false,
      tls: false,
      fs: false,
      path: false,
      os: false,
      crypto: false,
      assert: false,
    };
    return config;
  },
};
