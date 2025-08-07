-- Create sample project categories
-- This script adds PROJ type categories for use in the project management system

-- Insert project categories
INSERT INTO categories (code, type_code) VALUES 
('WEB_APP', 'PROJ'),
('MOBILE_APP', 'PROJ'),
('DESKTOP_APP', 'PROJ'),
('API_SERVICE', 'PROJ'),
('WEBSITE', 'PROJ'),
('LIBRARY', 'PROJ'),
('FRAMEWORK', 'PROJ'),
('TOOL', 'PROJ')
ON CONFLICT (code) DO NOTHING;

-- Add category texts for English (language_id = 1)
INSERT INTO category_texts (category_id, language_id, name, description)
SELECT 
  c.id,
  1,
  CASE c.code
    WHEN 'WEB_APP' THEN 'Web Application'
    WHEN 'MOBILE_APP' THEN 'Mobile Application'
    WHEN 'DESKTOP_APP' THEN 'Desktop Application'
    WHEN 'API_SERVICE' THEN 'API Service'
    WHEN 'WEBSITE' THEN 'Website'
    WHEN 'LIBRARY' THEN 'Library'
    WHEN 'FRAMEWORK' THEN 'Framework'
    WHEN 'TOOL' THEN 'Tool'
  END,
  CASE c.code
    WHEN 'WEB_APP' THEN 'Web-based applications and SPAs'
    WHEN 'MOBILE_APP' THEN 'Mobile applications for iOS and Android'
    WHEN 'DESKTOP_APP' THEN 'Desktop applications and GUI programs'
    WHEN 'API_SERVICE' THEN 'REST APIs, GraphQL services, and backend systems'
    WHEN 'WEBSITE' THEN 'Static websites, landing pages, and marketing sites'
    WHEN 'LIBRARY' THEN 'Reusable code libraries and packages'
    WHEN 'FRAMEWORK' THEN 'Development frameworks and boilerplates'
    WHEN 'TOOL' THEN 'Development tools, utilities, and CLIs'
  END
FROM categories c
WHERE c.type_code = 'PROJ'
ON CONFLICT (category_id, language_id) DO NOTHING;

-- Add category texts for Spanish (language_id = 2) if Spanish language exists
INSERT INTO category_texts (category_id, language_id, name, description)
SELECT 
  c.id,
  2,
  CASE c.code
    WHEN 'WEB_APP' THEN 'Aplicación Web'
    WHEN 'MOBILE_APP' THEN 'Aplicación Móvil'
    WHEN 'DESKTOP_APP' THEN 'Aplicación de Escritorio'
    WHEN 'API_SERVICE' THEN 'Servicio API'
    WHEN 'WEBSITE' THEN 'Sitio Web'
    WHEN 'LIBRARY' THEN 'Biblioteca'
    WHEN 'FRAMEWORK' THEN 'Framework'
    WHEN 'TOOL' THEN 'Herramienta'
  END,
  CASE c.code
    WHEN 'WEB_APP' THEN 'Aplicaciones web y SPAs'
    WHEN 'MOBILE_APP' THEN 'Aplicaciones móviles para iOS y Android'
    WHEN 'DESKTOP_APP' THEN 'Aplicaciones de escritorio y programas GUI'
    WHEN 'API_SERVICE' THEN 'APIs REST, servicios GraphQL y sistemas backend'
    WHEN 'WEBSITE' THEN 'Sitios web estáticos, páginas de aterrizaje y sitios de marketing'
    WHEN 'LIBRARY' THEN 'Bibliotecas de código reutilizable y paquetes'
    WHEN 'FRAMEWORK' THEN 'Frameworks de desarrollo y plantillas base'
    WHEN 'TOOL' THEN 'Herramientas de desarrollo, utilidades y CLIs'
  END
FROM categories c
WHERE c.type_code = 'PROJ' AND EXISTS (SELECT 1 FROM languages WHERE id = 2)
ON CONFLICT (category_id, language_id) DO NOTHING;

-- Display the created categories
SELECT 
  c.id,
  c.code,
  c.type_code,
  ct.language_id,
  l.code as language_code,
  ct.name,
  ct.description
FROM categories c
LEFT JOIN category_texts ct ON c.id = ct.category_id
LEFT JOIN languages l ON ct.language_id = l.id
WHERE c.type_code = 'PROJ'
ORDER BY c.code, ct.language_id; 