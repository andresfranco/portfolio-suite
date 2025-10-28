#!/usr/bin/env python3
"""
Script to populate section labels for all website components
This creates editable labels for:
- Projects section
- Project modal and details
- Contact section
- Contact page
- Footer
- All buttons and form labels
"""

import sys
import os

# Add the parent directory to the Python path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from sqlalchemy.orm import Session
from app.core.database import SessionLocal, engine
from app.models.section import Section, SectionText
from app.models.language import Language
from app.core.logging import setup_logger

logger = setup_logger("scripts.populate_website_sections")

# Section definitions: code -> {en: text, es: text}
WEBSITE_SECTIONS = {
    # Projects Section
    "SECTION_PROJECTS": {
        "en": "Projects",
        "es": "Proyectos"
    },
    
    # Projects Modal
    "MODAL_PROJECT_TITLE": {
        "en": "Project Details",
        "es": "Detalles del Proyecto"
    },
    
    # Buttons - Projects
    "BTN_VIEW_FULL_DETAILS": {
        "en": "View Full Details",
        "es": "Ver Detalles Completos"
    },
    "BTN_CLOSE": {
        "en": "Close",
        "es": "Cerrar"
    },
    "BTN_BACK_TO_PROJECTS": {
        "en": "Back to Projects",
        "es": "Volver a Proyectos"
    },
    "BTN_BACK_TO_HOME": {
        "en": "Back to Home",
        "es": "Volver al Inicio"
    },
    "BTN_PREVIOUS": {
        "en": "Previous",
        "es": "Anterior"
    },
    "BTN_NEXT": {
        "en": "Next",
        "es": "Siguiente"
    },
    "BTN_VIEW_LIVE_SITE": {
        "en": "View Live Site",
        "es": "Ver Sitio en Vivo"
    },
    "BTN_VIEW_REPOSITORY": {
        "en": "View Repository",
        "es": "Ver Repositorio"
    },
    
    # Project Details Labels
    "LABEL_PROJECT_OVERVIEW": {
        "en": "Project Overview",
        "es": "Descripción del Proyecto"
    },
    "LABEL_SKILLS_TECHNOLOGIES": {
        "en": "Skills & Technologies",
        "es": "Habilidades y Tecnologías"
    },
    "LABEL_PROJECT_DETAILS": {
        "en": "Project Details",
        "es": "Detalles del Proyecto"
    },
    "LABEL_DATE": {
        "en": "Date",
        "es": "Fecha"
    },
    "LABEL_CATEGORY": {
        "en": "Category",
        "es": "Categoría"
    },
    
    # Project Status Messages
    "MSG_PROJECT_NOT_FOUND": {
        "en": "Project not found",
        "es": "Proyecto no encontrado"
    },
    "MSG_LOADING_PROJECT": {
        "en": "Loading project data...",
        "es": "Cargando datos del proyecto..."
    },
    "MSG_PROJECT_UNAVAILABLE": {
        "en": "Project data unavailable",
        "es": "Datos del proyecto no disponibles"
    },
    "MSG_LOADING_PROJECTS": {
        "en": "Loading projects...",
        "es": "Cargando proyectos..."
    },
    
    # Contact Section (Homepage)
    "SECTION_GET_IN_TOUCH": {
        "en": "Get in Touch",
        "es": "Contáctame"
    },
    
    # Social Media Labels
    "SOCIAL_GITHUB": {
        "en": "GitHub",
        "es": "GitHub"
    },
    "SOCIAL_LINKEDIN": {
        "en": "LinkedIn",
        "es": "LinkedIn"
    },
    "SOCIAL_TWITTER": {
        "en": "Twitter",
        "es": "Twitter"
    },
    "LABEL_CONTACT_FORM": {
        "en": "Contact Form",
        "es": "Formulario de Contacto"
    },
    
    # Contact Page
    "LABEL_CONTACT_DESCRIPTION": {
        "en": "Have a question or want to work together? Feel free to reach out!",
        "es": "¿Tienes alguna pregunta o quieres que trabajemos juntos? ¡No dudes en contactarme!"
    },
    "LABEL_CONNECT_WITH_ME": {
        "en": "Connect With Me",
        "es": "Conéctate Conmigo"
    },
    
    # Form Labels
    "FORM_NAME": {
        "en": "Name",
        "es": "Nombre"
    },
    "FORM_EMAIL": {
        "en": "Email",
        "es": "Correo Electrónico"
    },
    "FORM_SUBJECT": {
        "en": "Subject",
        "es": "Asunto"
    },
    "FORM_MESSAGE": {
        "en": "Message",
        "es": "Mensaje"
    },
    "BTN_SEND_MESSAGE": {
        "en": "Send Message",
        "es": "Enviar Mensaje"
    },
    "BTN_SENDING": {
        "en": "Sending...",
        "es": "Enviando..."
    },
    
    # Footer
    "FOOTER_COPYRIGHT": {
        "en": "© {year} Andres Franco. All rights reserved.",
        "es": "© {year} Andres Franco. Todos los derechos reservados."
    },
    
    # Experience Labels (if used)
    "LABEL_YEARS_EXPERIENCE": {
        "en": "Years of Experience",
        "es": "Años de Experiencia"
    },
    "LABEL_EXPERIENCE_OVERVIEW": {
        "en": "Experience Overview",
        "es": "Descripción de la Experiencia"
    },
    "MSG_LOADING_EXPERIENCE": {
        "en": "Loading experience details...",
        "es": "Cargando detalles de experiencia..."
    },
    "LABEL_SKILL_LEVEL": {
        "en": "Skill Level",
        "es": "Nivel de Habilidad"
    },
}


def populate_sections(db: Session):
    """Populate sections table with website labels"""
    
    logger.info("Starting website sections population...")
    
    # Get languages
    languages = db.query(Language).all()
    if not languages:
        logger.error("No languages found in database. Please run language setup first.")
        return
    
    language_map = {lang.code: lang for lang in languages}
    logger.info(f"Found {len(languages)} languages: {list(language_map.keys())}")
    
    # Track stats
    created_count = 0
    updated_count = 0
    error_count = 0
    
    # Process each section
    for code, translations in WEBSITE_SECTIONS.items():
        try:
            # Check if section exists
            section = db.query(Section).filter(Section.code == code).first()
            
            if section:
                logger.debug(f"Section {code} already exists, updating texts...")
                action = "updated"
                updated_count += 1
            else:
                logger.debug(f"Creating new section: {code}")
                section = Section(
                    code=code,
                    created_by=1,
                    updated_by=1
                )
                db.add(section)
                db.flush()
                action = "created"
                created_count += 1
            
            # Add/update section texts for each language
            for lang_code, text in translations.items():
                if lang_code not in language_map:
                    logger.warning(f"Language {lang_code} not found in database, skipping")
                    continue
                
                language = language_map[lang_code]
                
                # Check if section text exists
                section_text = db.query(SectionText).filter(
                    SectionText.section_id == section.id,
                    SectionText.language_id == language.id
                ).first()
                
                if section_text:
                    section_text.text = text
                    section_text.updated_by = 1
                    logger.debug(f"  Updated {lang_code}: {text[:50]}...")
                else:
                    section_text = SectionText(
                        section_id=section.id,
                        language_id=language.id,
                        text=text,
                        created_by=1,
                        updated_by=1
                    )
                    db.add(section_text)
                    logger.debug(f"  Created {lang_code}: {text[:50]}...")
            
            # Commit after each section to avoid losing progress
            db.commit()
            logger.info(f"✓ Section {code} {action}")
            
        except Exception as e:
            logger.error(f"✗ Error processing section {code}: {e}")
            db.rollback()
            error_count += 1
    
    logger.info("=" * 60)
    logger.info(f"Website sections population complete!")
    logger.info(f"  Created: {created_count}")
    logger.info(f"  Updated: {updated_count}")
    logger.info(f"  Errors: {error_count}")
    logger.info(f"  Total: {len(WEBSITE_SECTIONS)}")
    logger.info("=" * 60)


def main():
    """Main function"""
    db = SessionLocal()
    try:
        populate_sections(db)
    except Exception as e:
        logger.error(f"Fatal error: {e}")
        raise
    finally:
        db.close()


if __name__ == "__main__":
    main()
