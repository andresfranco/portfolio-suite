# Testing the Portfolio-AI Backend

This directory contains tests for the Portfolio-AI backend API and functionality. The tests are organized following the same structure as the application code.

## Test Structure

- `conftest.py`: Contains fixtures shared across tests
- `utils/`: Contains utility functions for testing
- `api/`: Tests for API endpoints
- `crud/`: Tests for CRUD operations

## Running Tests

To run all tests:

```bash
pytest
```

To run tests for a specific module:

```bash
# Test Role endpoints
pytest app/tests/api/test_roles.py

# Test Permission endpoints
pytest app/tests/api/test_permissions.py
```

To run a specific test:

```bash
pytest app/tests/api/test_roles.py::TestRoleEndpoints::test_create_role_success
```

## Test Database

Tests use a separate test database to avoid affecting the development or production data. The test database is configured in `conftest.py` and is created and dropped for each test to ensure test isolation.

## Writing Tests

When writing tests, follow these guidelines:

1. Create test files with names starting with `test_`
2. Create test functions with names starting with `test_`
3. Use fixtures from `conftest.py` for database access
4. Clean up test data after each test
5. Use descriptive test names that indicate what is being tested
6. Follow the AAA pattern: Arrange, Act, Assert

Example:

```python
def test_create_role_success(db: Session):
    # Arrange: Set up test data
    role_data = {"name": "Test Role", "description": "Test description"}
    
    # Act: Perform the operation being tested
    created_role = crud_role.create_role(db, RoleCreate(**role_data))
    
    # Assert: Verify the results
    assert created_role.name == role_data["name"]
    assert created_role.description == role_data["description"]
    
    # Clean up
    db.delete(created_role)
    db.commit()
```

## Mock Dependencies

For tests that require external services or complex dependencies, use the `unittest.mock` library to create mocks. 