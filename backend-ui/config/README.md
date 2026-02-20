# Configuration Files

Build and development tool configurations for the React frontend.

## 📁 Configuration Files

```
config/
├── babel.config.js     # Babel transpiler configuration
├── jest.config.js      # Jest testing framework configuration
├── postcss.config.js   # PostCSS configuration
├── eslintrc.js         # ESLint linting rules
└── README.md           # This file
```

---

## ⚙️ Configuration Overview

### babel.config.js

**Purpose**: Configure Babel JavaScript transpiler

**Key Settings:**
- Preset: `@babel/preset-env`, `@babel/preset-react`
- Plugins: Private property support, runtime transforms
- Target: Modern browsers as per browserslist

**Usage**: Automatically used by React Scripts during build

**Customization:**
- Add new Babel plugins
- Configure target environments
- Enable/disable specific transforms

### jest.config.js

**Purpose**: Configure Jest testing framework

**Key Settings:**
- Test environment: jsdom (browser-like)
- Setup files: `src/setupTests.js`
- Transform: Babel for JS/JSX files
- Module name mapping for CSS/assets
- Coverage configuration

**Usage**:
```bash
# Run tests with this configuration
npm test

# Generate coverage report
npm test -- --coverage
```

**Customization:**
- Add custom test matchers
- Configure coverage thresholds
- Add module aliases
- Set test timeout values

### postcss.config.js

**Purpose**: Configure PostCSS for CSS processing

**Key Settings:**
- Plugins: Tailwind CSS (if using), Autoprefixer
- Browser compatibility
- CSS transformations

**Usage**: Automatically used during build process

**Customization:**
- Add PostCSS plugins
- Configure CSS optimization
- Enable CSS modules

### eslintrc.js

**Purpose**: Configure ESLint for code linting

**Key Settings:**
- Extends: `react-app`, `react-app/jest`
- Rules: Code quality and style rules
- Parser: Babel ESLint parser
- Environment: Browser, Node, ES6

**Usage**:
```bash
# Lint files (if script added)
npm run lint

# Auto-fix issues
npm run lint -- --fix
```

**Customization:**
- Add custom ESLint rules
- Configure rule severity
- Add plugins
- Define globals

---

## 🔧 Configuration Management

### Editing Configurations

**Best Practices:**
1. **Test changes** - Always test after modifying config
2. **Document changes** - Comment why changes were made
3. **Version control** - Commit config changes separately
4. **Team communication** - Notify team of breaking changes

### Common Customizations

#### Adding a Babel Plugin

```javascript
// babel.config.js
module.exports = {
  presets: [
    '@babel/preset-env',
    '@babel/preset-react'
  ],
  plugins: [
    '@babel/plugin-proposal-private-property-in-object',
    // Add your plugin here
    'your-babel-plugin'
  ]
};
```

#### Configuring Jest Coverage Thresholds

```javascript
// jest.config.js
module.exports = {
  // ... other config
  coverageThreshold: {
    global: {
      branches: 80,
      functions: 80,
      lines: 80,
      statements: 80
    }
  }
};
```

#### Adding ESLint Rules

```javascript
// eslintrc.js
module.exports = {
  extends: [
    'react-app',
    'react-app/jest'
  ],
  rules: {
    // Add custom rules
    'no-console': 'warn',
    'prefer-const': 'error'
  }
};
```

---

## 📦 React Scripts Configuration

**Note**: This project uses **Create React App** (React Scripts), which abstracts most configuration.

### Built-in Configurations

React Scripts provides pre-configured:
- Webpack
- Babel
- ESLint
- PostCSS
- Jest
- Development server

### Overriding Defaults

**Option 1: Eject (Not Recommended)**
```bash
npm run eject
```
⚠️ **Warning**: This is irreversible and exposes all configs

**Option 2: react-app-rewired**
Use `react-app-rewired` to override configs without ejecting
```bash
npm install react-app-rewired --save-dev
```

**Option 3: CRACO**
Use CRACO (Create React App Configuration Override)
```bash
npm install @craco/craco --save-dev
```

---

## 🎯 Configuration Locations

### Where Configs Are Used

| Config File | Used By | When |
|------------|---------|------|
| `babel.config.js` | React Scripts, Jest | Build, Test |
| `jest.config.js` | Jest | Test |
| `postcss.config.js` | PostCSS, React Scripts | Build |
| `eslintrc.js` | ESLint, React Scripts | Lint, Build |

### package.json Configurations

Some configurations are also in `package.json`:

```json
{
  "eslintConfig": {
    "extends": ["react-app", "react-app/jest"]
  },
  "browserslist": {
    "production": [">0.2%", "not dead", "not op_mini all"],
    "development": ["last 1 chrome version"]
  }
}
```

---

## 🔍 Troubleshooting

### Common Issues

#### "Config file not found"

**Solution**: Ensure config files are in the correct location
```bash
# Check if configs exist
ls -la config/

# Verify React Scripts can find them
# React Scripts looks in project root by default
```

#### Babel Transform Errors

**Solution**: Clear cache and reinstall
```bash
# Clear cache
rm -rf node_modules/.cache

# Reinstall dependencies
rm -rf node_modules package-lock.json
npm install
```

#### Jest Configuration Not Applied

**Solution**: Check jest.config.js syntax
```bash
# Verify Jest config
npx jest --showConfig

# Run with specific config
npx jest --config config/jest.config.js
```

#### ESLint Rules Not Working

**Solution**: Check ESLint configuration hierarchy
```bash
# Verify ESLint config
npx eslint --print-config src/App.js

# Check for conflicting configs
# ESLint looks for: .eslintrc.js, .eslintrc, package.json
```

---

## 📚 Environment Variables

### Configuration via Environment

Some build configurations can be controlled via environment variables:

```bash
# Development server port
PORT=3000 npm start

# Build output directory
BUILD_PATH=./dist npm run build

# Disable source maps in production
GENERATE_SOURCEMAP=false npm run build

# Enable HTTPS in development
HTTPS=true npm start
```

### .env Files

Create `.env` file in project root (not in config/):
```bash
# .env
REACT_APP_API_URL=http://localhost:8000
REACT_APP_ENABLE_MFA=true
```

**Note**: Environment variables must be prefixed with `REACT_APP_`

---

## 🚀 Production Builds

### Optimizations Applied

When running `npm run build`, the following optimizations are applied:

1. **Code Minification** (Babel, Terser)
2. **CSS Minification** (PostCSS)
3. **Tree Shaking** (Webpack)
4. **Code Splitting** (Dynamic imports)
5. **Asset Optimization** (Image compression)
6. **Source Maps** (Optional, controlled by GENERATE_SOURCEMAP)

### Build Configuration

Controlled by React Scripts, but can be influenced by:
- Babel config (`babel.config.js`)
- PostCSS config (`postcss.config.js`)
- Environment variables (`.env.production`)
- Package.json settings

---

## 🔐 Security Considerations

### Configuration Security

**Best Practices:**
- ✅ Never commit secrets to config files
- ✅ Use environment variables for sensitive data
- ✅ Keep dependencies updated
- ✅ Audit packages regularly
- ✅ Use HTTPS in production

**Security Audits:**
```bash
# Check for vulnerabilities
npm audit

# Fix vulnerabilities
npm audit fix

# Generate audit report
npm audit --json > audit-report.json
```

---

## 📖 Additional Resources

### Official Documentation

- [Create React App Configuration](https://create-react-app.dev/docs/getting-started)
- [Babel Configuration](https://babeljs.io/docs/en/configuration)
- [Jest Configuration](https://jestjs.io/docs/configuration)
- [PostCSS Configuration](https://postcss.org/)
- [ESLint Configuration](https://eslint.org/docs/user-guide/configuring/)

### Related Documentation

- **Main Frontend README**: `../README.md`
- **Testing Guide**: `../docs/README.md`
- **Package Management**: `../package.json`

---

## 🤝 Contributing

### Making Configuration Changes

1. **Test locally** - Ensure changes work
2. **Document changes** - Add comments in config files
3. **Update this README** - Document new configuration options
4. **Team review** - Get approval for breaking changes
5. **Communicate** - Notify team of changes

### Configuration Checklist

Before committing config changes:
- [ ] Tested in development (`npm start`)
- [ ] Tested build process (`npm run build`)
- [ ] Tested tests (`npm test`)
- [ ] Documented changes in config file
- [ ] Updated this README if needed
- [ ] No secrets or sensitive data in config
- [ ] Team notified of breaking changes

---

**Last Updated**: December 2024  
**Maintained by**: Portfolio Suite Development Team
