#!/usr/bin/env python3
"""
Script to associate all website sections with portfolio ID 1
This creates the many-to-many relationships in the portfolio_sections table
"""

import sys
import os

# Add the parent directory to the Python path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from sqlalchemy.orm import Session
from app.core.database import SessionLocal, engine
from app.models.section import Section
from app.models.portfolio import Portfolio
from app.core.logging import setup_logger

logger = setup_logger("scripts.associate_sections_to_portfolio")


def associate_sections_to_portfolio(db: Session, portfolio_id: int = 1):
    """Associate all sections with a portfolio"""
    
    logger.info(f"Starting section association for portfolio ID {portfolio_id}...")
    
    # Get the portfolio
    portfolio = db.query(Portfolio).filter(Portfolio.id == portfolio_id).first()
    if not portfolio:
        logger.error(f"Portfolio with ID {portfolio_id} not found!")
        return False
    
    logger.info(f"Found portfolio: {portfolio.id}")
    
    # Get all sections
    sections = db.query(Section).all()
    if not sections:
        logger.error("No sections found in database!")
        return False
    
    logger.info(f"Found {len(sections)} sections to associate")
    
    # Track stats
    associated_count = 0
    already_associated_count = 0
    
    # Associate each section with the portfolio
    for section in sections:
        # Check if already associated
        if section in portfolio.sections:
            logger.debug(f"Section {section.code} already associated with portfolio {portfolio_id}")
            already_associated_count += 1
        else:
            portfolio.sections.append(section)
            logger.debug(f"Associated section {section.code} with portfolio {portfolio_id}")
            associated_count += 1
    
    # Commit the changes
    try:
        db.commit()
        logger.info("Successfully committed all associations")
    except Exception as e:
        logger.error(f"Error committing associations: {e}")
        db.rollback()
        return False
    
    logger.info("=" * 60)
    logger.info(f"Section association complete!")
    logger.info(f"  Newly associated: {associated_count}")
    logger.info(f"  Already associated: {already_associated_count}")
    logger.info(f"  Total sections: {len(sections)}")
    logger.info(f"  Portfolio total sections: {len(portfolio.sections)}")
    logger.info("=" * 60)
    
    return True


def main():
    """Main function"""
    db = SessionLocal()
    try:
        # Default to portfolio ID 1
        portfolio_id = 1
        
        # Check if portfolio ID provided as command line argument
        if len(sys.argv) > 1:
            try:
                portfolio_id = int(sys.argv[1])
                logger.info(f"Using portfolio ID from argument: {portfolio_id}")
            except ValueError:
                logger.warning(f"Invalid portfolio ID argument: {sys.argv[1]}, using default: 1")
        
        success = associate_sections_to_portfolio(db, portfolio_id)
        
        if success:
            logger.info("✓ Script completed successfully")
            sys.exit(0)
        else:
            logger.error("✗ Script failed")
            sys.exit(1)
            
    except Exception as e:
        logger.error(f"Fatal error: {e}", exc_info=True)
        sys.exit(1)
    finally:
        db.close()


if __name__ == "__main__":
    main()
