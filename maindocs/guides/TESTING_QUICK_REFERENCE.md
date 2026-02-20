# Security Features Testing - Quick Reference

This document provides quick commands to re-run all security feature tests.

## Prerequisites

```bash
cd /home/andres/projects/portfolio-suite/portfolio-backend
source venv/bin/activate
pip install pyjwt[crypto] pyyaml -q
```

## Test Commands

### 1. RS256 JWT Implementation Test

**Full test suite** (5 tests):
```bash
cd /home/andres/projects/portfolio-suite/portfolio-backend
source venv/bin/activate
python test_rs256_jwt.py
```

**Expected output**: `🎉 ALL TESTS PASSED! 🎉`

**Key generation test**:
```bash
cd /home/andres/projects/portfolio-suite/portfolio-backend
python scripts/generate_rsa_keys.py --key-size 2048
```

**Key validation**:
```bash
cd /home/andres/projects/portfolio-suite/portfolio-backend
python -c "
from cryptography.hazmat.primitives import serialization
from cryptography.hazmat.backends import default_backend

with open('private_key.pem', 'rb') as f:
    private_key = serialization.load_pem_private_key(f.read(), password=None, backend=default_backend())
    print(f'✅ Private key: {private_key.key_size} bits')

with open('public_key.pem', 'rb') as f:
    public_key = serialization.load_pem_public_key(f.read(), backend=default_backend())
    print(f'✅ Public key: {public_key.key_size} bits')
"
```

---

### 2. HTTPS/TLS Configuration Test

**Full nginx configuration test**:
```bash
cd /home/andres/projects/portfolio-suite
python test_nginx_config.py
```

**Expected output**: `✅ All critical tests PASSED`

**Quick syntax check** (if nginx installed):
```bash
nginx -t -c /home/andres/projects/portfolio-suite/nginx.conf
```

---

### 3. CI/CD Workflow Tests

**All workflows test**:
```bash
cd /home/andres/projects/portfolio-suite
python test_workflows.py
```

**Expected output**: `🎉 ALL WORKFLOW TESTS PASSED! 🎉`

**Individual workflow validation**:
```bash
# Validate YAML syntax
python -c "
import yaml
with open('.github/workflows/deployment-gate.yml') as f:
    print('✅ deployment-gate.yml valid' if yaml.safe_load(f) else '❌ Invalid')
with open('.github/workflows/security-scan.yml') as f:
    print('✅ security-scan.yml valid' if yaml.safe_load(f) else '❌ Invalid')
with open('.github/workflows/dast.yml') as f:
    print('✅ dast.yml valid' if yaml.safe_load(f) else '❌ Invalid')
"
```

---

## Run All Tests (Quick)

**One-line command to run all tests**:
```bash
cd /home/andres/projects/portfolio-suite && \
  (cd portfolio-backend && source venv/bin/activate && python test_rs256_jwt.py 2>&1 | tail -5) && \
  python test_nginx_config.py 2>&1 | tail -5 && \
  python test_workflows.py 2>&1 | tail -5
```

---

## Test Results Summary

After running all tests, check:

1. **JWT Tests**: `5/5 tests passed`
2. **Nginx Config**: `✅ All critical tests PASSED`
3. **Workflows**: `3/3 workflows passed`

---

## Cleanup (Optional)

Remove generated test keys (keep if needed for development):
```bash
cd /home/andres/projects/portfolio-suite/portfolio-backend
rm -f private_key.pem public_key.pem RSA_SETUP_INSTRUCTIONS.txt
```

---

## Re-generate Keys for Production

```bash
cd /home/andres/projects/portfolio-suite/portfolio-backend
python scripts/generate_rsa_keys.py --key-size 4096

# Move to secure location
sudo mkdir -p /etc/portfolio/keys
sudo mv private_key.pem /etc/portfolio/keys/
sudo mv public_key.pem /etc/portfolio/keys/
sudo chmod 600 /etc/portfolio/keys/private_key.pem
sudo chmod 644 /etc/portfolio/keys/public_key.pem

# Update .env
echo "ALGORITHM=RS256" >> .env
echo "JWT_PRIVATE_KEY_PATH=/etc/portfolio/keys/private_key.pem" >> .env
echo "JWT_PUBLIC_KEY_PATH=/etc/portfolio/keys/public_key.pem" >> .env
```

---

## Continuous Testing

Add to your development workflow:

```bash
# Before committing security changes
cd /home/andres/projects/portfolio-suite
./run_security_tests.sh  # Create this script with all test commands
```

**Example `run_security_tests.sh`**:
```bash
#!/bin/bash
set -e

echo "🔐 Running Security Feature Tests..."

echo "1. Testing RS256 JWT..."
(cd portfolio-backend && source venv/bin/activate && python test_rs256_jwt.py)

echo "2. Testing Nginx Configuration..."
python test_nginx_config.py

echo "3. Testing CI/CD Workflows..."
python test_workflows.py

echo "✅ All security tests passed!"
```

---

## Troubleshooting

### JWT Tests Fail

**Issue**: `ModuleNotFoundError: No module named 'jwt'`

**Solution**:
```bash
cd portfolio-backend
source venv/bin/activate
pip install pyjwt[crypto]
```

---

### Nginx Test Fails

**Issue**: Syntax errors or missing configurations

**Solution**: Review `nginx.conf` against `SSL_TLS_SETUP_GUIDE.md`

---

### Workflow Tests Fail

**Issue**: YAML syntax errors

**Solution**:
```bash
# Install yamllint
pip install yamllint

# Validate workflows
yamllint .github/workflows/deployment-gate.yml
yamllint .github/workflows/security-scan.yml
yamllint .github/workflows/dast.yml
```

---

## Documentation

- **Test Report**: `SECURITY_FEATURES_TEST_REPORT.md`
- **Implementation Summary**: `SECURITY_ENHANCEMENTS_SUMMARY.md`
- **SSL/TLS Guide**: `SSL_TLS_SETUP_GUIDE.md`
- **JWT Security**: `portfolio-backend/JWT_SECURITY_GUIDE.md`
- **Incident Response**: `INCIDENT_RESPONSE_PLAYBOOK.md`

---

**Last Updated**: October 23, 2025  
**Test Status**: ✅ ALL TESTS PASSING
