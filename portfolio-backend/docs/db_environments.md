# Multiple Database Environments with Alembic

This guide explains how to run database migrations in different environments using Alembic.

## Environment Configuration

The application supports multiple database environments:

- **development**: Used for local development
- **testing**: Used for running tests
- **staging**: Pre-production environment
- **production**: Live production environment

## Running Migrations

### Using Command-Line Arguments

You can specify which environment to run migrations against using the `-x` parameter:

```bash
# For development environment (default)
alembic upgrade head

# For test environment
alembic -x environment=testing upgrade head

# For staging environment
alembic -x environment=staging upgrade head

# For production environment
alembic -x environment=production upgrade head
```

### Using Environment Variables

Alternatively, you can set the `ENVIRONMENT` environment variable before running migrations:

```bash
# Set environment to testing
export ENVIRONMENT=testing

# Run the migration
alembic upgrade head
```

### Creating New Migrations

To create a new migration:

```bash
# Generate a new migration with a message
alembic revision --autogenerate -m "Description of the changes"

# Then apply it to your current environment
alembic upgrade head
```

## Database URLs

The database URLs for each environment are configured in two places:

1. In the `alembic.ini` file (under each environment section)
2. In the application's `.env` file or environment variables

The system will first check the `alembic.ini` file for the environment-specific URL, then fall back to the application's configuration if needed.

## Environment Variable Reference

- `ENVIRONMENT`: Sets the active environment (development, testing, staging, production)
- `DATABASE_URL`: Default database URL
- `DATABASE_URL_DEVELOPMENT`: Override URL for development environment
- `DATABASE_URL_TESTING`: Override URL for testing environment  
- `DATABASE_URL_STAGING`: Override URL for staging environment
- `DATABASE_URL_PRODUCTION`: Override URL for production environment

## Troubleshooting

If you're having issues with migrations:

1. Check that you're targeting the correct database environment
2. Verify that your database credentials are correct in `alembic.ini` or environment variables
3. Check the console output to see which database URL is being used