# Backend UI - Admin Panel

A React 19 admin panel application with user and role management, MFA support, and comprehensive security features.

This project was bootstrapped with [Create React App](https://github.com/facebook/create-react-app).

## 📁 Project Structure

```
backend-ui/
├── src/                      # Application source code
│   ├── api/                  # API client and interceptors
│   ├── app/                  # Routes, layouts, error boundaries
│   ├── components/           # Shared UI components
│   ├── features/             # Feature modules
│   ├── hooks/                # Custom React hooks
│   ├── lib/                  # Utilities and helpers
│   └── theme.js              # Material-UI theme configuration
├── public/                   # Static assets
├── build/                    # Production build output
├── docs/                     # Documentation
│   ├── architecture/         # Architecture documentation
│   ├── features/             # Feature implementation guides
│   ├── development/          # Development guides
│   ├── api/                  # API documentation
│   └── README.md             # Documentation index
├── config/                   # Configuration files
│   ├── babel.config.js       # Babel configuration
│   ├── jest.config.js        # Jest testing configuration
│   ├── postcss.config.js     # PostCSS configuration
│   ├── eslintrc.js           # ESLint rules
│   └── README.md             # Configuration guide
├── package.json              # Dependencies and scripts
└── README.md                 # This file
```

## 🚀 Key Features

### User & Role Management
- CRUD operations for users and roles
- Role-based access control (RBAC)
- Permission management
- User session tracking

### Security Features
- Multi-factor authentication (TOTP)
- JWT-based authentication
- Secure session management
- Security dashboard with activity monitoring

### Reusable Data Grid
- Dynamic column configuration
- Server-side filtering, sorting, and pagination
- Support for multiple filter types (text, multiselect, etc.)
- Customizable filter components
- Create, edit, and delete actions
- Responsive design

📖 **See**: [Reusable Grid Documentation](./docs/development/reusable_grid_plan.md)

### Performance Optimizations
- Code splitting and lazy loading
- Optimized re-rendering strategies
- Efficient state management
- Memoization patterns

📖 **See**: [React Scalability & Performance Guide](./docs/architecture/react_scalability_performance.md)

## 📚 Documentation

Comprehensive documentation is available in the `docs/` directory:

- **[Documentation Index](./docs/README.md)** - Complete documentation guide
- **[Architecture Documentation](./docs/architecture/)** - System architecture and scalability
- **[Feature Guides](./docs/features/)** - MFA implementation and authentication
- **[Development Guides](./docs/development/)** - Reusable components and patterns
- **[API Documentation](./docs/api/)** - Backend endpoints guide
- **[Configuration Guide](./config/README.md)** - Build and tool configurations

### Quick Links

| Topic | Documentation |
|-------|---------------|
| MFA Implementation | [docs/features/MFA_FRONTEND_IMPLEMENTATION.md](./docs/features/MFA_FRONTEND_IMPLEMENTATION.md) |
| Authentication Fix | [docs/features/authentication_fix_summary.md](./docs/features/authentication_fix_summary.md) |
| Reusable Grid | [docs/development/reusable_grid_plan.md](./docs/development/reusable_grid_plan.md) |
| Architecture Improvements | [docs/architecture/architecture_improvements_implemented.md](./docs/architecture/architecture_improvements_implemented.md) |
| React Performance | [docs/architecture/react_scalability_performance.md](./docs/architecture/react_scalability_performance.md) |
| API Endpoints | [docs/api/endpoints_guide.txt](./docs/api/endpoints_guide.txt) |

## 🔧 Configuration

All build and tool configurations are located in the `config/` directory:

- **Babel Configuration** (`babel.config.js`) - JavaScript transpilation
- **Jest Configuration** (`jest.config.js`) - Testing framework
- **PostCSS Configuration** (`postcss.config.js`) - CSS processing
- **ESLint Configuration** (`eslintrc.js`) - Code linting rules

📖 **See**: [Configuration Guide](./config/README.md) for detailed documentation

## Available Scripts

In the project directory, you can run:

### `npm start`

Runs the app in the development mode.\
Open [http://localhost:3000](http://localhost:3000) to view it in your browser.

The page will reload when you make changes.\
You may also see any lint errors in the console.

### `npm test`

Launches the test runner in the interactive watch mode.\
See the section about [running tests](https://facebook.github.io/create-react-app/docs/running-tests) for more information.

### `npm run build`

Builds the app for production to the `build` folder.\
It correctly bundles React in production mode and optimizes the build for the best performance.

The build is minified and the filenames include the hashes.\
Your app is ready to be deployed!

See the section about [deployment](https://facebook.github.io/create-react-app/docs/deployment) for more information.

### `npm run eject`

**Note: this is a one-way operation. Once you `eject`, you can't go back!**

If you aren't satisfied with the build tool and configuration choices, you can `eject` at any time. This command will remove the single build dependency from your project.

Instead, it will copy all the configuration files and the transitive dependencies (webpack, Babel, ESLint, etc) right into your project so you have full control over them. All of the commands except `eject` will still work, but they will point to the copied scripts so you can tweak them. At this point you're on your own.

You don't have to ever use `eject`. The curated feature set is suitable for small and middle deployments, and you shouldn't feel obligated to use this feature. However we understand that this tool wouldn't be useful if you couldn't customize it when you are ready for it.

## Learn More

You can learn more in the [Create React App documentation](https://facebook.github.io/create-react-app/docs/getting-started).

To learn React, check out the [React documentation](https://reactjs.org/).

### Code Splitting

This section has moved here: [https://facebook.github.io/create-react-app/docs/code-splitting](https://facebook.github.io/create-react-app/docs/code-splitting)

### Analyzing the Bundle Size

This section has moved here: [https://facebook.github.io/create-react-app/docs/analyzing-the-bundle-size](https://facebook.github.io/create-react-app/docs/analyzing-the-bundle-size)

### Making a Progressive Web App

This section has moved here: [https://facebook.github.io/create-react-app/docs/making-a-progressive-web-app](https://facebook.github.io/create-react-app/docs/making-a-progressive-web-app)

### Advanced Configuration

This section has moved here: [https://facebook.github.io/create-react-app/docs/advanced-configuration](https://facebook.github.io/create-react-app/docs/advanced-configuration)

### Deployment

This section has moved here: [https://facebook.github.io/create-react-app/docs/deployment](https://facebook.github.io/create-react-app/docs/deployment)

### `npm run build` fails to minify

This section has moved here: [https://facebook.github.io/create-react-app/docs/troubleshooting#npm-run-build-fails-to-minify](https://facebook.github.io/create-react-app/docs/troubleshooting#npm-run-build-fails-to-minify)
