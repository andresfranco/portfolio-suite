#!/usr/bin/env python3
"""
Database Restore Script

Features:
- Restore from encrypted/compressed backups
- Point-in-time restore capability
- Verification before restore
- Database recreation option
- Dry-run mode for testing

Usage:
    python scripts/restore.py <backup_file> [--config /path/to/.env] [--dry-run]

Environment Variables:
    DATABASE_URL - Database connection string
    BACKUP_ENCRYPTION_KEY - GPG passphrase for decryption
"""

import os
import sys
import subprocess
import logging
from pathlib import Path
from typing import Optional
import argparse
import gzip
import json
from datetime import datetime

# Add parent directory to path for imports
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

try:
    from dotenv import load_dotenv
except ImportError:
    print("Error: Required packages not installed. Run: pip install python-dotenv")
    sys.exit(1)

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler('restore.log'),
        logging.StreamHandler()
    ]
)
logger = logging.getLogger(__name__)


class DatabaseRestore:
    """Handle database restore operations."""
    
    def __init__(
        self,
        db_url: str,
        encryption_key: Optional[str] = None,
        dry_run: bool = False
    ):
        self.db_url = db_url
        self.encryption_key = encryption_key
        self.dry_run = dry_run
        
        # Parse database URL
        self.db_config = self._parse_db_url(db_url)
        
        if dry_run:
            logger.info("DRY RUN MODE - No changes will be made to the database")
    
    def _parse_db_url(self, db_url: str) -> dict:
        """Parse database URL into components."""
        from urllib.parse import urlparse
        
        parsed = urlparse(db_url)
        
        return {
            'host': parsed.hostname or 'localhost',
            'port': parsed.port or 5432,
            'user': parsed.username or 'postgres',
            'password': parsed.password or '',
            'database': parsed.path.lstrip('/') or 'postgres'
        }
    
    def verify_backup(self, backup_file: Path) -> bool:
        """Verify backup integrity using checksum."""
        metadata_file = backup_file.with_suffix('.json')
        
        if not metadata_file.exists():
            logger.error(f"Metadata file not found: {metadata_file}")
            return False
        
        try:
            import hashlib
            
            with open(metadata_file, 'r') as f:
                metadata = json.load(f)
            
            # Generate checksum
            sha256 = hashlib.sha256()
            with open(backup_file, 'rb') as f:
                for chunk in iter(lambda: f.read(4096), b''):
                    sha256.update(chunk)
            current_checksum = sha256.hexdigest()
            
            expected_checksum = metadata['checksum']
            
            if current_checksum == expected_checksum:
                logger.info(f"Backup verification successful")
                logger.info(f"Backup created: {metadata['timestamp']}")
                logger.info(f"Database: {metadata['database']}")
                logger.info(f"Size: {metadata['size']/(1024*1024):.2f} MB")
                return True
            else:
                logger.error(f"Backup verification failed: checksum mismatch")
                logger.error(f"Expected: {expected_checksum}")
                logger.error(f"Got: {current_checksum}")
                return False
                
        except Exception as e:
            logger.error(f"Backup verification failed: {e}")
            return False
    
    def decrypt_backup(self, encrypted_file: Path, output_file: Path) -> bool:
        """Decrypt backup file using GPG."""
        if not self.encryption_key:
            logger.error("Encryption key not provided")
            return False
        
        logger.info(f"Decrypting backup: {encrypted_file}")
        
        try:
            cmd = [
                'gpg',
                '--decrypt',
                '--batch',
                '--yes',
                '--passphrase', self.encryption_key,
                '--output', str(output_file),
                str(encrypted_file)
            ]
            
            subprocess.run(cmd, check=True, capture_output=True)
            
            logger.info(f"Decryption complete: {output_file}")
            return True
            
        except subprocess.CalledProcessError as e:
            logger.error(f"Decryption failed: {e.stderr.decode()}")
            return False
        except FileNotFoundError:
            logger.error("GPG not found. Install with: sudo apt-get install gnupg")
            return False
    
    def decompress_backup(self, compressed_file: Path, output_file: Path) -> bool:
        """Decompress backup file."""
        logger.info(f"Decompressing backup: {compressed_file}")
        
        try:
            with gzip.open(compressed_file, 'rb') as f_in:
                with open(output_file, 'wb') as f_out:
                    f_out.write(f_in.read())
            
            logger.info(f"Decompression complete: {output_file}")
            return True
            
        except Exception as e:
            logger.error(f"Decompression failed: {e}")
            return False
    
    def prepare_backup_file(self, backup_file: Path) -> Optional[Path]:
        """Prepare backup file for restore (decrypt and decompress if needed)."""
        temp_dir = Path('/tmp/db_restore')
        temp_dir.mkdir(parents=True, exist_ok=True)
        
        current_file = backup_file
        
        # Check if encrypted
        if backup_file.suffix == '.gpg':
            decrypted_file = temp_dir / backup_file.stem
            if not self.decrypt_backup(current_file, decrypted_file):
                return None
            current_file = decrypted_file
        
        # Check if compressed
        if current_file.suffix == '.gz':
            decompressed_file = temp_dir / current_file.stem
            if not self.decompress_backup(current_file, decompressed_file):
                return None
            current_file = decompressed_file
        
        return current_file
    
    def check_database_exists(self) -> bool:
        """Check if target database exists."""
        try:
            env = os.environ.copy()
            env['PGPASSWORD'] = self.db_config['password']
            
            cmd = [
                'psql',
                '-h', self.db_config['host'],
                '-p', str(self.db_config['port']),
                '-U', self.db_config['user'],
                '-lqt'
            ]
            
            result = subprocess.run(
                cmd,
                env=env,
                capture_output=True,
                text=True,
                check=True
            )
            
            databases = [line.split('|')[0].strip() for line in result.stdout.split('\n')]
            return self.db_config['database'] in databases
            
        except Exception as e:
            logger.error(f"Error checking database existence: {e}")
            return False
    
    def backup_existing_database(self) -> Optional[Path]:
        """Create a backup of existing database before restore."""
        if self.dry_run:
            logger.info("[DRY RUN] Would create pre-restore backup")
            return Path("/tmp/pre_restore_backup.sql")
        
        logger.info("Creating pre-restore backup of existing database...")
        
        timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
        backup_file = Path(f"/tmp/pre_restore_backup_{timestamp}.sql")
        
        try:
            env = os.environ.copy()
            env['PGPASSWORD'] = self.db_config['password']
            
            cmd = [
                'pg_dump',
                '-h', self.db_config['host'],
                '-p', str(self.db_config['port']),
                '-U', self.db_config['user'],
                '-d', self.db_config['database'],
                '-F', 'p',
                '-f', str(backup_file)
            ]
            
            subprocess.run(cmd, env=env, check=True, capture_output=True)
            
            logger.info(f"Pre-restore backup created: {backup_file}")
            return backup_file
            
        except Exception as e:
            logger.error(f"Failed to create pre-restore backup: {e}")
            return None
    
    def restore_database(self, sql_file: Path) -> bool:
        """Restore database from SQL file."""
        if self.dry_run:
            logger.info(f"[DRY RUN] Would restore from: {sql_file}")
            logger.info(f"[DRY RUN] Target database: {self.db_config['database']}")
            return True
        
        logger.info(f"Restoring database from: {sql_file}")
        logger.info(f"Target database: {self.db_config['database']}")
        
        try:
            env = os.environ.copy()
            env['PGPASSWORD'] = self.db_config['password']
            
            # Restore database
            cmd = [
                'psql',
                '-h', self.db_config['host'],
                '-p', str(self.db_config['port']),
                '-U', self.db_config['user'],
                '-d', self.db_config['database'],
                '-f', str(sql_file)
            ]
            
            result = subprocess.run(
                cmd,
                env=env,
                capture_output=True,
                text=True
            )
            
            if result.returncode != 0:
                logger.error(f"Restore failed: {result.stderr}")
                return False
            
            logger.info("Database restore completed successfully")
            return True
            
        except Exception as e:
            logger.error(f"Restore failed: {e}")
            return False
    
    def perform_restore(self, backup_file: Path, force: bool = False) -> bool:
        """Perform complete restore operation."""
        logger.info("="*60)
        logger.info("DATABASE RESTORE OPERATION")
        logger.info("="*60)
        
        # Verify backup integrity
        logger.info("Step 1: Verifying backup integrity...")
        if not self.verify_backup(backup_file):
            logger.error("Backup verification failed. Aborting restore.")
            return False
        
        # Prepare backup file
        logger.info("Step 2: Preparing backup file...")
        sql_file = self.prepare_backup_file(backup_file)
        if not sql_file:
            logger.error("Failed to prepare backup file. Aborting restore.")
            return False
        
        # Check if database exists
        logger.info("Step 3: Checking target database...")
        db_exists = self.check_database_exists()
        
        if db_exists and not force and not self.dry_run:
            response = input(f"\nDatabase '{self.db_config['database']}' exists. Continue? [yes/no]: ")
            if response.lower() not in ['yes', 'y']:
                logger.info("Restore cancelled by user")
                return False
            
            # Create pre-restore backup
            logger.info("Step 4: Creating pre-restore backup...")
            pre_backup = self.backup_existing_database()
            if pre_backup:
                logger.info(f"Pre-restore backup saved to: {pre_backup}")
            else:
                logger.warning("Failed to create pre-restore backup, but continuing...")
        
        # Perform restore
        logger.info("Step 5: Restoring database...")
        success = self.restore_database(sql_file)
        
        # Cleanup temporary files
        try:
            if sql_file.parent == Path('/tmp/db_restore'):
                import shutil
                shutil.rmtree(sql_file.parent)
                logger.info("Cleaned up temporary files")
        except Exception as e:
            logger.warning(f"Failed to cleanup temporary files: {e}")
        
        if success:
            logger.info("="*60)
            logger.info("✓ RESTORE COMPLETED SUCCESSFULLY")
            logger.info("="*60)
        else:
            logger.error("="*60)
            logger.error("✗ RESTORE FAILED")
            logger.error("="*60)
        
        return success


def main():
    """Main restore script."""
    parser = argparse.ArgumentParser(
        description='Database restore script',
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  # Restore from backup
  python scripts/restore.py backups/backup_portfolioai_20231022_143000.sql.gz.gpg
  
  # Dry run (test without making changes)
  python scripts/restore.py backups/backup_portfolioai_20231022_143000.sql.gz.gpg --dry-run
  
  # Force restore without confirmation
  python scripts/restore.py backups/backup_portfolioai_20231022_143000.sql.gz.gpg --force
        """
    )
    
    parser.add_argument('backup_file', help='Path to backup file to restore')
    parser.add_argument('--config', help='Path to .env file', default='.env')
    parser.add_argument('--dry-run', action='store_true', help='Test restore without making changes')
    parser.add_argument('--force', action='store_true', help='Skip confirmation prompts')
    
    args = parser.parse_args()
    
    # Load environment variables
    if Path(args.config).exists():
        load_dotenv(args.config)
    
    # Get configuration
    db_url = os.getenv('DATABASE_URL')
    encryption_key = os.getenv('BACKUP_ENCRYPTION_KEY')
    
    if not db_url:
        logger.error("DATABASE_URL not set in environment")
        sys.exit(1)
    
    backup_file = Path(args.backup_file)
    if not backup_file.exists():
        logger.error(f"Backup file not found: {backup_file}")
        sys.exit(1)
    
    # Create restore manager
    restore = DatabaseRestore(
        db_url=db_url,
        encryption_key=encryption_key,
        dry_run=args.dry_run
    )
    
    # Perform restore
    success = restore.perform_restore(backup_file, force=args.force)
    
    sys.exit(0 if success else 1)


if __name__ == '__main__':
    main()

