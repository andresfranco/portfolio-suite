from sqlalchemy.orm import Session, Query
from typing import Type, List, Optional, Any, Tuple, Union, Dict
from sqlalchemy import asc, desc, or_
from app.core.logging import setup_logger
from app.schemas.project import Filter

logger = setup_logger("app.api.utils.query_builder")

class QueryBuilder:
    """
    Reusable query builder for standardizing database queries with support for
    filtering, sorting, and pagination.
    """
    
    def __init__(self, model: Type = None, db: Session = None, query_or_model=None, db_session=None):
        """
        Initialize QueryBuilder with backward compatibility for existing code.
        
        Args:
            model: SQLAlchemy model class (new interface)
            db: Database session (new interface)
            query_or_model: Query object or model class (legacy interface)
            db_session: Database session (legacy interface)
        """
        # Handle backward compatibility
        if query_or_model is not None and db_session is not None:
            # Legacy interface
            if hasattr(query_or_model, 'filter'):  # It's a query object
                self.query = query_or_model
                self.model = model  # model should be passed separately in legacy calls
                self.db = db_session
            else:  # It's a model class
                self.model = query_or_model
                self.db = db_session
                self.query = db_session.query(query_or_model)
        elif model is not None and db is not None:
            # New interface
            self.model = model
            self.db = db
            self.query = db.query(model)
        else:
            raise ValueError("Must provide either (model, db) or (query_or_model, db_session)")
        self.joins_applied = set()
        logger.debug(f"QueryBuilder initialized for model: {self.model.__name__}")
    
    def apply_filters(self, filters: Union[Optional[List[Filter]], List[Dict[str, Any]]] = None):
        """Apply filters to the query"""
        if not filters:
            return self
        
        for filter_item in filters:
            # Handle both Filter objects and dictionary format
            if isinstance(filter_item, dict):
                field_name = filter_item.get('field')
                value = filter_item.get('value')
                operator = filter_item.get('operator', 'eq')
            else:
                field_name = getattr(filter_item, 'field', None)
                value = getattr(filter_item, 'value', None)
                operator = getattr(filter_item, 'operator', 'contains')

            if not field_name or value is None:
                continue

            logger.debug(f"QueryBuilder apply_filters processing: field={field_name} operator={operator} value={value}")
            field_parts = field_name.split('.')
            # Support dot notation for relationships (e.g., roles.id)
            if len(field_parts) > 1:
                current_model = self.model
                # Traverse relationships except last part
                for rel_part in field_parts[:-1]:
                    rel_attr = getattr(current_model, rel_part, None)
                    if rel_attr is None:
                        current_model = None
                        break
                    # Only join once per relationship name
                    if rel_part not in self.joins_applied:
                        try:
                            self.query = self.query.join(rel_attr)
                            self.joins_applied.add(rel_part)
                            logger.debug(f"QueryBuilder joined relationship: {rel_part}")
                        except Exception:
                            # If join fails, skip this filter safely
                            current_model = None
                            break
                    try:
                        # Advance model to related class
                        current_model = rel_attr.property.mapper.class_
                    except Exception:
                        current_model = None
                        break
                if not current_model:
                    continue
                field = getattr(current_model, field_parts[-1], None)
                if field is None:
                    continue
                # Apply operator including 'in'
                if operator in ['eq', 'equals']:
                    self.query = self.query.filter(field == value)
                elif operator == 'in' and isinstance(value, (list, tuple, set)) and len(value) > 0:
                    self.query = self.query.filter(field.in_(list(value)))
                elif operator == 'contains':
                    self.query = self.query.filter(field.ilike(f"%{value}%"))
                elif operator in ['startswith', 'startsWith']:
                    self.query = self.query.filter(field.ilike(f"{value}%"))
                elif operator in ['endswith', 'endsWith']:
                    self.query = self.query.filter(field.ilike(f"%{value}"))
                elif operator == 'ne':
                    self.query = self.query.filter(field != value)
                elif operator == 'gt':
                    self.query = self.query.filter(field > value)
                elif operator == 'lt':
                    self.query = self.query.filter(field < value)
                elif operator == 'gte':
                    self.query = self.query.filter(field >= value)
                elif operator == 'lte':
                    self.query = self.query.filter(field <= value)
                continue
            else:
                # Direct model attribute
                field = getattr(self.model, field_parts[0], None)
                if field is None:
                    continue
                # Apply operator
                if operator in ['eq', 'equals']:
                    self.query = self.query.filter(field == value)
                elif operator == 'in' and isinstance(value, (list, tuple, set)) and len(value) > 0:
                    self.query = self.query.filter(field.in_(list(value)))
                elif operator == 'contains':
                    self.query = self.query.filter(field.ilike(f"%{value}%"))
                elif operator in ['startswith', 'startsWith']:
                    self.query = self.query.filter(field.ilike(f"{value}%"))
                elif operator in ['endswith', 'endsWith']:
                    self.query = self.query.filter(field.ilike(f"%{value}"))
                elif operator == 'ne':
                    self.query = self.query.filter(field != value)
                elif operator == 'gt':
                    self.query = self.query.filter(field > value)
                elif operator == 'lt':
                    self.query = self.query.filter(field < value)
                elif operator == 'gte':
                    self.query = self.query.filter(field >= value)
                elif operator == 'lte':
                    self.query = self.query.filter(field <= value)
        
        return self
    
    def apply_sort(self, sort_field: Optional[str] = None, sort_order: Optional[str] = 'asc'):
        """Apply sorting to the query"""
        if not sort_field:
            return self
            
        field = getattr(self.model, sort_field, None)
        if field is None:
            return self
            
        if sort_order and sort_order.lower() == 'desc':
            self.query = self.query.order_by(desc(field))
        else:
            self.query = self.query.order_by(asc(field))
            
        return self
    
    def paginate(self, page: int = 1, page_size: int = 10) -> Tuple[List[Any], int]:
        """Paginate results and return items with total count"""
        total = self.query.count()
        items = self.query.offset((page - 1) * page_size).limit(page_size).all()
        return items, total
    
    def apply_or_filters(self, filters: List[Dict[str, Any]]) -> 'QueryBuilder':
        """
        Apply a list of OR filters to the query.
        
        Args:
            filters: List of filter dictionaries with 'field', 'value', and optional 'operator'
        
        Returns:
            Self for method chaining
        """
        if not filters:
            return self
        
        or_conditions = []
        for filter_dict in filters:
            field_name = filter_dict.get('field')
            value = filter_dict.get('value')
            operator = filter_dict.get('operator', 'eq')
            
            if not field_name or value is None:
                continue
                
            field = getattr(self.model, field_name, None)
            if field is None:
                continue
                
            # Create condition based on operator
            if operator in ['eq', 'equals']:
                condition = field == value
            elif operator == 'contains':
                condition = field.ilike(f"%{value}%")
            elif operator in ['startswith', 'startsWith']:
                condition = field.ilike(f"{value}%")
            elif operator in ['endswith', 'endsWith']:
                condition = field.ilike(f"%{value}")
            elif operator == 'ne':
                condition = field != value
            elif operator == 'gt':
                condition = field > value
            elif operator == 'lt':
                condition = field < value
            elif operator == 'gte':
                condition = field >= value
            elif operator == 'lte':
                condition = field <= value
            else:
                continue
                
            or_conditions.append(condition)
        
        if or_conditions:
            self.query = self.query.filter(or_(*or_conditions))
            
        return self
    
    def get_query(self) -> Query:
        """
        Get the current SQLAlchemy query object.
        
        Returns:
            The current query object
        """
        return self.query
    
    def all(self) -> List[Any]:
        """
        Execute the query and return all results.
        
        Returns:
            List of query results
        """
        return self.query.all()
    
    def first(self) -> Optional[Any]:
        """
        Execute the query and return the first result.
        
        Returns:
            First query result or None
        """
        return self.query.first()
    
    def count(self) -> int:
        """
        Get the count of results without executing the main query.
        
        Returns:
            Number of results
        """
        return self.query.count()
    
    def compile(self) -> Query:
        """
        Compile and return the query object for manual execution.
        
        Returns:
            The compiled query object
        """
        return self.query
    
    def apply_sorting(self, sort_field: Optional[str] = None, sort_order: Optional[str] = 'asc', default_sort: Optional[str] = None) -> 'QueryBuilder':
        """
        Apply sorting with a default fallback.
        
        Args:
            sort_field: Primary field to sort by
            sort_order: Sort direction ('asc' or 'desc')
            default_sort: Default field to sort by if sort_field is invalid
        
        Returns:
            Self for method chaining
        """
        # Try the requested sort field first
        if sort_field and hasattr(self.model, sort_field):
            self.apply_sort(sort_field, sort_order)
        elif default_sort and hasattr(self.model, default_sort):
            # Fall back to default sort
            self.apply_sort(default_sort, 'asc')
        
        return self 