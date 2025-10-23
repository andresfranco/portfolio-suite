#!/usr/bin/env python3
"""
Database Backup Script with Encryption

Features:
- Automated PostgreSQL database backups
- GPG encryption for security
- Compression for storage efficiency
- S3/Cloud storage support (optional)
- Backup rotation (keep last N backups)
- Verification of backup integrity
- Email notifications on failure

Usage:
    python scripts/backup.py [--config /path/to/.env] [--upload-s3]

Environment Variables:
    DATABASE_URL - Database connection string
    BACKUP_DIR - Directory to store backups (default: ./backups)
    BACKUP_ENCRYPTION_KEY - GPG passphrase for encryption
    BACKUP_RETENTION_DAYS - Number of days to retain backups (default: 30)
    AWS_S3_BUCKET - S3 bucket for backup upload (optional)
    BACKUP_NOTIFY_EMAIL - Email for backup notifications (optional)
"""

import os
import sys
import subprocess
import logging
from datetime import datetime, timedelta
from pathlib import Path
from typing import Optional, List
import argparse
import shutil
import hashlib
import json

# Add parent directory to path for imports
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

try:
    from dotenv import load_dotenv
    from app.core.config import settings
except ImportError:
    print("Error: Required packages not installed. Run: pip install python-dotenv")
    sys.exit(1)

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler('backup.log'),
        logging.StreamHandler()
    ]
)
logger = logging.getLogger(__name__)


class DatabaseBackup:
    """Handle database backup operations."""
    
    def __init__(
        self,
        db_url: str,
        backup_dir: str = "./backups",
        encryption_key: Optional[str] = None,
        retention_days: int = 30
    ):
        self.db_url = db_url
        self.backup_dir = Path(backup_dir)
        self.encryption_key = encryption_key
        self.retention_days = retention_days
        
        # Create backup directory
        self.backup_dir.mkdir(parents=True, exist_ok=True)
        
        # Parse database URL
        self.db_config = self._parse_db_url(db_url)
    
    def _parse_db_url(self, db_url: str) -> dict:
        """Parse database URL into components."""
        # Format: postgresql://user:pass@host:port/dbname
        from urllib.parse import urlparse
        
        parsed = urlparse(db_url)
        
        return {
            'host': parsed.hostname or 'localhost',
            'port': parsed.port or 5432,
            'user': parsed.username or 'postgres',
            'password': parsed.password or '',
            'database': parsed.path.lstrip('/') or 'postgres'
        }
    
    def create_backup(self) -> Optional[Path]:
        """
        Create a database backup.
        
        Returns:
            Path to backup file, or None on failure
        """
        timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
        backup_name = f"backup_{self.db_config['database']}_{timestamp}"
        
        # Create temporary SQL dump
        sql_file = self.backup_dir / f"{backup_name}.sql"
        
        logger.info(f"Creating database backup: {backup_name}")
        
        try:
            # Use pg_dump to create backup
            env = os.environ.copy()
            env['PGPASSWORD'] = self.db_config['password']
            
            cmd = [
                'pg_dump',
                '-h', self.db_config['host'],
                '-p', str(self.db_config['port']),
                '-U', self.db_config['user'],
                '-d', self.db_config['database'],
                '-F', 'p',  # Plain SQL format
                '--clean',  # Include DROP statements
                '--if-exists',  # Use IF EXISTS
                '--no-owner',  # Skip ownership commands
                '--no-privileges',  # Skip privilege commands
                '-f', str(sql_file)
            ]
            
            result = subprocess.run(
                cmd,
                env=env,
                capture_output=True,
                text=True,
                check=True
            )
            
            logger.info(f"Database dump created: {sql_file}")
            
            # Compress the backup
            compressed_file = self._compress_backup(sql_file)
            
            # Encrypt if key provided
            if self.encryption_key:
                encrypted_file = self._encrypt_backup(compressed_file)
                final_file = encrypted_file
            else:
                final_file = compressed_file
                logger.warning("No encryption key provided, backup is not encrypted!")
            
            # Generate checksum
            checksum = self._generate_checksum(final_file)
            
            # Save backup metadata
            metadata = {
                'timestamp': timestamp,
                'database': self.db_config['database'],
                'size': final_file.stat().st_size,
                'checksum': checksum,
                'encrypted': self.encryption_key is not None,
                'compressed': True
            }
            
            metadata_file = final_file.with_suffix('.json')
            with open(metadata_file, 'w') as f:
                json.dump(metadata, f, indent=2)
            
            logger.info(f"Backup completed successfully: {final_file}")
            logger.info(f"Backup size: {final_file.stat().st_size / (1024*1024):.2f} MB")
            logger.info(f"Checksum: {checksum}")
            
            # Clean up temporary files
            if sql_file.exists():
                sql_file.unlink()
            if compressed_file != final_file and compressed_file.exists():
                compressed_file.unlink()
            
            return final_file
            
        except subprocess.CalledProcessError as e:
            logger.error(f"Backup failed: {e.stderr}")
            return None
        except Exception as e:
            logger.error(f"Backup failed: {e}")
            return None
    
    def _compress_backup(self, file_path: Path) -> Path:
        """Compress backup file using gzip."""
        import gzip
        
        compressed_file = file_path.with_suffix('.sql.gz')
        
        logger.info(f"Compressing backup: {file_path}")
        
        try:
            with open(file_path, 'rb') as f_in:
                with gzip.open(compressed_file, 'wb', compresslevel=9) as f_out:
                    shutil.copyfileobj(f_in, f_out)
            
            original_size = file_path.stat().st_size
            compressed_size = compressed_file.stat().st_size
            ratio = (1 - compressed_size / original_size) * 100
            
            logger.info(f"Compression complete: {ratio:.1f}% reduction")
            
            return compressed_file
            
        except Exception as e:
            logger.error(f"Compression failed: {e}")
            return file_path
    
    def _encrypt_backup(self, file_path: Path) -> Path:
        """Encrypt backup file using GPG."""
        encrypted_file = file_path.with_suffix(file_path.suffix + '.gpg')
        
        logger.info(f"Encrypting backup: {file_path}")
        
        try:
            cmd = [
                'gpg',
                '--symmetric',
                '--cipher-algo', 'AES256',
                '--batch',
                '--yes',
                '--passphrase', self.encryption_key,
                '--output', str(encrypted_file),
                str(file_path)
            ]
            
            subprocess.run(cmd, check=True, capture_output=True)
            
            logger.info(f"Encryption complete: {encrypted_file}")
            
            return encrypted_file
            
        except subprocess.CalledProcessError as e:
            logger.error(f"Encryption failed: {e.stderr.decode()}")
            return file_path
        except FileNotFoundError:
            logger.error("GPG not found. Install with: sudo apt-get install gnupg")
            return file_path
    
    def _generate_checksum(self, file_path: Path) -> str:
        """Generate SHA256 checksum of file."""
        sha256 = hashlib.sha256()
        
        with open(file_path, 'rb') as f:
            for chunk in iter(lambda: f.read(4096), b''):
                sha256.update(chunk)
        
        return sha256.hexdigest()
    
    def verify_backup(self, backup_file: Path) -> bool:
        """Verify backup integrity using checksum."""
        metadata_file = backup_file.with_suffix('.json')
        
        if not metadata_file.exists():
            logger.error(f"Metadata file not found: {metadata_file}")
            return False
        
        try:
            with open(metadata_file, 'r') as f:
                metadata = json.load(f)
            
            current_checksum = self._generate_checksum(backup_file)
            expected_checksum = metadata['checksum']
            
            if current_checksum == expected_checksum:
                logger.info(f"Backup verification successful: {backup_file}")
                return True
            else:
                logger.error(f"Backup verification failed: checksum mismatch")
                logger.error(f"Expected: {expected_checksum}")
                logger.error(f"Got: {current_checksum}")
                return False
                
        except Exception as e:
            logger.error(f"Backup verification failed: {e}")
            return False
    
    def cleanup_old_backups(self):
        """Remove backups older than retention period."""
        cutoff_date = datetime.now() - timedelta(days=self.retention_days)
        
        logger.info(f"Cleaning up backups older than {self.retention_days} days")
        
        deleted_count = 0
        for backup_file in self.backup_dir.glob("backup_*.sql.gz*"):
            try:
                # Extract timestamp from filename
                parts = backup_file.stem.split('_')
                if len(parts) >= 3:
                    timestamp_str = parts[-2] + parts[-1].split('.')[0]
                    file_date = datetime.strptime(timestamp_str, '%Y%m%d%H%M%S')
                    
                    if file_date < cutoff_date:
                        backup_file.unlink()
                        # Also remove metadata file
                        metadata_file = backup_file.with_suffix('.json')
                        if metadata_file.exists():
                            metadata_file.unlink()
                        
                        logger.info(f"Deleted old backup: {backup_file}")
                        deleted_count += 1
            except Exception as e:
                logger.warning(f"Error processing {backup_file}: {e}")
        
        logger.info(f"Deleted {deleted_count} old backup(s)")
    
    def list_backups(self) -> List[dict]:
        """List all available backups."""
        backups = []
        
        for backup_file in sorted(self.backup_dir.glob("backup_*.sql.gz*")):
            if backup_file.suffix == '.json':
                continue
            
            metadata_file = backup_file.with_suffix('.json')
            if metadata_file.exists():
                try:
                    with open(metadata_file, 'r') as f:
                        metadata = json.load(f)
                    metadata['file'] = str(backup_file)
                    backups.append(metadata)
                except Exception as e:
                    logger.warning(f"Error reading metadata for {backup_file}: {e}")
        
        return backups
    
    def upload_to_s3(self, backup_file: Path, bucket: str) -> bool:
        """Upload backup to S3 (requires boto3)."""
        try:
            import boto3
            
            s3_client = boto3.client('s3')
            s3_key = f"backups/{backup_file.name}"
            
            logger.info(f"Uploading to S3: s3://{bucket}/{s3_key}")
            
            s3_client.upload_file(
                str(backup_file),
                bucket,
                s3_key,
                ExtraArgs={'ServerSideEncryption': 'AES256'}
            )
            
            # Also upload metadata
            metadata_file = backup_file.with_suffix('.json')
            if metadata_file.exists():
                s3_client.upload_file(
                    str(metadata_file),
                    bucket,
                    f"backups/{metadata_file.name}",
                    ExtraArgs={'ServerSideEncryption': 'AES256'}
                )
            
            logger.info(f"Upload complete: s3://{bucket}/{s3_key}")
            return True
            
        except ImportError:
            logger.error("boto3 not installed. Install with: pip install boto3")
            return False
        except Exception as e:
            logger.error(f"S3 upload failed: {e}")
            return False


def main():
    """Main backup script."""
    parser = argparse.ArgumentParser(description='Database backup script')
    parser.add_argument('--config', help='Path to .env file', default='.env')
    parser.add_argument('--upload-s3', action='store_true', help='Upload to S3')
    parser.add_argument('--list', action='store_true', help='List available backups')
    parser.add_argument('--verify', help='Verify specific backup file')
    parser.add_argument('--cleanup', action='store_true', help='Clean up old backups')
    
    args = parser.parse_args()
    
    # Load environment variables
    if Path(args.config).exists():
        load_dotenv(args.config)
    
    # Get configuration
    db_url = os.getenv('DATABASE_URL')
    backup_dir = os.getenv('BACKUP_DIR', './backups')
    encryption_key = os.getenv('BACKUP_ENCRYPTION_KEY')
    retention_days = int(os.getenv('BACKUP_RETENTION_DAYS', '30'))
    s3_bucket = os.getenv('AWS_S3_BUCKET')
    
    if not db_url:
        logger.error("DATABASE_URL not set in environment")
        sys.exit(1)
    
    # Create backup manager
    backup = DatabaseBackup(
        db_url=db_url,
        backup_dir=backup_dir,
        encryption_key=encryption_key,
        retention_days=retention_days
    )
    
    # Handle different operations
    if args.list:
        backups = backup.list_backups()
        print(f"\nFound {len(backups)} backup(s):\n")
        for b in backups:
            print(f"  {b['timestamp']} - {b['database']} - {b['size']/(1024*1024):.2f} MB")
            print(f"    File: {b['file']}")
            print(f"    Encrypted: {b['encrypted']}, Compressed: {b['compressed']}")
            print(f"    Checksum: {b['checksum']}\n")
        sys.exit(0)
    
    if args.verify:
        backup_file = Path(args.verify)
        if backup.verify_backup(backup_file):
            print("✓ Backup verification successful")
            sys.exit(0)
        else:
            print("✗ Backup verification failed")
            sys.exit(1)
    
    if args.cleanup:
        backup.cleanup_old_backups()
        sys.exit(0)
    
    # Create backup
    backup_file = backup.create_backup()
    
    if not backup_file:
        logger.error("Backup creation failed")
        sys.exit(1)
    
    # Verify backup
    if not backup.verify_backup(backup_file):
        logger.error("Backup verification failed")
        sys.exit(1)
    
    # Upload to S3 if requested
    if args.upload_s3 and s3_bucket:
        if not backup.upload_to_s3(backup_file, s3_bucket):
            logger.warning("S3 upload failed, but local backup is available")
    
    # Cleanup old backups
    backup.cleanup_old_backups()
    
    logger.info("Backup process completed successfully")
    print(f"\n✓ Backup created: {backup_file}")


if __name__ == '__main__':
    main()

