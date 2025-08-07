-- Connect to the staging database
\c portfolioai_staging;

-- Grant schema usage
GRANT USAGE ON SCHEMA public TO admindb;

-- Make admindb a superuser (this is the most direct solution)
ALTER USER admindb WITH SUPERUSER;

-- Grant privileges on all tables for admindb
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO admindb;

-- Grant privileges on all sequences
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO admindb;

-- Grant privileges on all functions
GRANT ALL PRIVILEGES ON ALL FUNCTIONS IN SCHEMA public TO admindb;

-- Set default privileges for future objects
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO admindb;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO admindb;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON FUNCTIONS TO admindb;

-- Fix the database ownership for portfolioai_dev
-- Note: This must be run as a superuser (postgres)
\c postgres;
ALTER DATABASE portfolioai_dev OWNER TO admindb;
