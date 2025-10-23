#!/usr/bin/env python3
"""
Generate RSA Key Pair for JWT Signing

This script generates RSA private and public keys for asymmetric JWT token signing.
Using RS256 (RSA Signature with SHA-256) is more secure than HS256 for production.

Benefits of RS256:
- Private key stays on auth server only
- Public key can be distributed for token verification
- Better for microservices architecture
- Harder to compromise (no shared secret)

Usage:
    python scripts/generate_rsa_keys.py [--key-size 2048|4096]
    
Output:
    - private_key.pem (Keep this SECRET!)
    - public_key.pem (Can be distributed)
"""

import argparse
import os
from pathlib import Path
from cryptography.hazmat.primitives.asymmetric import rsa
from cryptography.hazmat.primitives import serialization
from cryptography.hazmat.backends import default_backend


def generate_rsa_keypair(key_size: int = 2048) -> tuple:
    """
    Generate RSA private/public key pair.
    
    Args:
        key_size: Size of the key in bits (2048 or 4096)
        
    Returns:
        Tuple of (private_key, public_key) as PEM strings
    """
    print(f"Generating RSA {key_size}-bit key pair...")
    
    # Generate private key
    private_key = rsa.generate_private_key(
        public_exponent=65537,
        key_size=key_size,
        backend=default_backend()
    )
    
    # Serialize private key to PEM format
    private_pem = private_key.private_bytes(
        encoding=serialization.Encoding.PEM,
        format=serialization.PrivateFormat.PKCS8,
        encryption_algorithm=serialization.NoEncryption()  # No password protection
    )
    
    # Get public key from private key
    public_key = private_key.public_key()
    
    # Serialize public key to PEM format
    public_pem = public_key.public_bytes(
        encoding=serialization.Encoding.PEM,
        format=serialization.PublicFormat.SubjectPublicKeyInfo
    )
    
    return private_pem.decode('utf-8'), public_pem.decode('utf-8')


def save_keys(private_key: str, public_key: str, output_dir: Path):
    """Save keys to files with appropriate permissions."""
    
    # Ensure output directory exists
    output_dir.mkdir(parents=True, exist_ok=True)
    
    # Save private key (readable only by owner)
    private_key_path = output_dir / "private_key.pem"
    with open(private_key_path, 'w') as f:
        f.write(private_key)
    os.chmod(private_key_path, 0o600)  # -rw-------
    print(f"✅ Private key saved to: {private_key_path}")
    print(f"   Permissions: -rw------- (owner read/write only)")
    
    # Save public key (readable by all)
    public_key_path = output_dir / "public_key.pem"
    with open(public_key_path, 'w') as f:
        f.write(public_key)
    os.chmod(public_key_path, 0o644)  # -rw-r--r--
    print(f"✅ Public key saved to: {public_key_path}")
    print(f"   Permissions: -rw-r--r-- (readable by all)")


def update_env_example(output_dir: Path):
    """Generate .env configuration instructions."""
    
    instructions_path = output_dir / "RSA_SETUP_INSTRUCTIONS.txt"
    
    with open(instructions_path, 'w') as f:
        f.write("""
╔══════════════════════════════════════════════════════════════════╗
║           RSA Key Setup Instructions for RS256 JWT              ║
╚══════════════════════════════════════════════════════════════════╝

1. COPY KEYS TO SECURE LOCATION:
   
   Development:
   - Keep private_key.pem in portfolio-backend/ directory
   - DO NOT commit to git (already in .gitignore)
   
   Production:
   - Store private_key.pem in a secrets manager:
     * AWS Secrets Manager
     * Azure Key Vault
     * HashiCorp Vault
     * Google Secret Manager
   - Mount as environment variable or file

2. UPDATE .env FILE:
   
   Add these variables to your .env file:
   
   # JWT Algorithm (change from HS256 to RS256)
   ALGORITHM=RS256
   
   # Path to RSA private key (for token signing)
   JWT_PRIVATE_KEY_PATH=/path/to/private_key.pem
   
   # Path to RSA public key (for token verification)
   JWT_PUBLIC_KEY_PATH=/path/to/public_key.pem
   
   # Alternative: Set keys directly as environment variables
   # JWT_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\\n..."
   # JWT_PUBLIC_KEY="-----BEGIN PUBLIC KEY-----\\n..."

3. SECURITY CHECKLIST:
   
   ☐ private_key.pem has permissions 600 (-rw-------)
   ☐ private_key.pem is NOT in version control
   ☐ private_key.pem is backed up securely
   ☐ Production uses secrets manager (not file system)
   ☐ ALGORITHM in .env is set to RS256
   ☐ Old HS256 SECRET_KEY is rotated (no longer used)

4. MIGRATION STEPS:
   
   a) Generate new RS256 tokens for all users:
      - Update ALGORITHM to RS256
      - Restart application
      - All users must re-login (old HS256 tokens invalid)
   
   b) Or gradual migration:
      - Support both HS256 and RS256 temporarily
      - Verify tokens with both algorithms
      - Phase out HS256 after 7 days

5. VERIFY SETUP:
   
   Run this command to test JWT creation:
   
   python -c "
   from app.core.security import create_access_token
   token = create_access_token({'sub': 'test@example.com'})
   print('Token created successfully!')
   print(token[:50] + '...')
   "

6. MICROSERVICES DISTRIBUTION:
   
   If you have multiple services verifying tokens:
   - Distribute public_key.pem to all services
   - Only auth service needs private_key.pem
   - Public key can be hosted at /.well-known/jwks.json

7. KEY ROTATION:
   
   To rotate keys (recommended every 6-12 months):
   - Generate new key pair
   - Keep old public key for 7 days (verify old tokens)
   - Switch to new private key for signing
   - Remove old public key after grace period

═══════════════════════════════════════════════════════════════════

⚠️  CRITICAL SECURITY WARNINGS:

   - NEVER commit private_key.pem to version control
   - NEVER share private_key.pem via email/chat
   - NEVER store private_key.pem in publicly accessible locations
   - ALWAYS use file permissions 600 for private_key.pem
   - ALWAYS use secrets manager in production

═══════════════════════════════════════════════════════════════════
""")
    
    print(f"\n📖 Setup instructions saved to: {instructions_path}")


def main():
    parser = argparse.ArgumentParser(
        description='Generate RSA key pair for JWT signing (RS256)'
    )
    parser.add_argument(
        '--key-size',
        type=int,
        choices=[2048, 4096],
        default=2048,
        help='RSA key size in bits (default: 2048, production: 4096)'
    )
    parser.add_argument(
        '--output-dir',
        type=str,
        default='.',
        help='Output directory for keys (default: current directory)'
    )
    
    args = parser.parse_args()
    
    output_dir = Path(args.output_dir)
    
    print("╔══════════════════════════════════════════════════════════════╗")
    print("║         RSA Key Pair Generator for JWT (RS256)              ║")
    print("╚══════════════════════════════════════════════════════════════╝\n")
    
    # Generate keys
    private_key, public_key = generate_rsa_keypair(args.key_size)
    
    # Save keys
    save_keys(private_key, public_key, output_dir)
    
    # Create setup instructions
    update_env_example(output_dir)
    
    print("\n" + "═" * 66)
    print("✅ SUCCESS! RSA key pair generated successfully!")
    print("═" * 66)
    print("\n⚠️  NEXT STEPS:")
    print("   1. Read RSA_SETUP_INSTRUCTIONS.txt")
    print("   2. Update your .env file with ALGORITHM=RS256")
    print("   3. Set JWT_PRIVATE_KEY_PATH and JWT_PUBLIC_KEY_PATH")
    print("   4. Restart the application")
    print("   5. Test JWT token creation")
    print("\n⚠️  SECURITY REMINDER:")
    print("   - Keep private_key.pem SECRET and secure!")
    print("   - Use secrets manager in production")
    print("   - Set file permissions to 600 (owner read/write only)")
    print("═" * 66 + "\n")


if __name__ == "__main__":
    main()
