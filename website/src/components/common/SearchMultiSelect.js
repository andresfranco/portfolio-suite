import React, { useEffect, useMemo, useRef, useState } from 'react';

const SearchMultiSelect = ({
  label,
  placeholder = 'Search...',
  emptyMessage = 'No options available',
  noResultsMessage = 'No matches found',
  options = [],
  selectedValues = [],
  onChange,
  getOptionValue,
  getOptionLabel,
  icon = null,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState('');
  const containerRef = useRef(null);

  const selectedSet = useMemo(() => new Set(selectedValues), [selectedValues]);

  const selectedOptions = useMemo(
    () => options.filter((option) => selectedSet.has(getOptionValue(option))),
    [getOptionValue, options, selectedSet]
  );

  const filteredOptions = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    if (!normalizedQuery) {
      return options;
    }

    return options.filter((option) =>
      getOptionLabel(option).toLowerCase().includes(normalizedQuery)
    );
  }, [getOptionLabel, options, query]);

  useEffect(() => {
    const handlePointerDown = (event) => {
      if (containerRef.current && !containerRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handlePointerDown);
    return () => document.removeEventListener('mousedown', handlePointerDown);
  }, []);

  useEffect(() => {
    if (!isOpen && query) {
      setQuery('');
    }
  }, [isOpen, query]);

  const toggleValue = (value) => {
    if (selectedSet.has(value)) {
      onChange(selectedValues.filter((item) => item !== value));
      return;
    }

    onChange([...selectedValues, value]);
  };

  const removeValue = (value) => {
    onChange(selectedValues.filter((item) => item !== value));
  };

  return (
    <div className="space-y-3" ref={containerRef}>
      <label className="flex items-center gap-2 text-sm font-medium text-white/80">
        {icon}
        {label}
      </label>

      <div className="border border-white/10 bg-white/5">
        <div className="px-4 py-3 flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            {selectedOptions.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {selectedOptions.map((option) => {
                  const value = getOptionValue(option);
                  return (
                    <span
                      key={value}
                      className="inline-flex items-center gap-2 px-3 py-1 bg-[#14C800]/15 border border-[#14C800]/40 text-white text-sm"
                    >
                      <span className="truncate">{getOptionLabel(option)}</span>
                      <button
                        type="button"
                        onClick={(event) => {
                          event.stopPropagation();
                          removeValue(value);
                        }}
                        className="text-white/70 hover:text-white"
                        aria-label={`Remove ${getOptionLabel(option)}`}
                      >
                        ×
                      </button>
                    </span>
                  );
                })}
              </div>
            ) : (
              <span className="text-white/45">{placeholder}</span>
            )}
          </div>

          <button
            type="button"
            onClick={() => setIsOpen((open) => !open)}
            className="shrink-0 mt-0.5 text-white/60 hover:text-white"
            aria-expanded={isOpen}
            aria-label={`${isOpen ? 'Close' : 'Open'} ${label}`}
          >
            <svg
              className={`w-4 h-4 transition-transform ${isOpen ? 'rotate-180' : ''}`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>
        </div>

        {isOpen && (
          <div className="border-t border-white/10">
            <div className="p-3 border-b border-white/10">
              <input
                type="text"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder={placeholder}
                className="w-full px-3 py-2 border border-white/10 bg-[#03060a] text-white placeholder-white/35 focus:outline-none focus:ring-2 focus:ring-[#14C800]"
              />
            </div>

            <div className="max-h-64 overflow-y-auto p-2 space-y-1">
              {options.length === 0 ? (
                <p className="px-2 py-3 text-sm text-white/45">{emptyMessage}</p>
              ) : filteredOptions.length === 0 ? (
                <p className="px-2 py-3 text-sm text-white/45">{noResultsMessage}</p>
              ) : (
                filteredOptions.map((option) => {
                  const value = getOptionValue(option);
                  const isSelected = selectedSet.has(value);
                  return (
                    <button
                      key={value}
                      type="button"
                      onClick={() => toggleValue(value)}
                      className={`w-full px-3 py-2 flex items-center justify-between gap-3 text-left transition-colors ${
                        isSelected ? 'bg-[#14C800]/15 text-white' : 'text-white/80 hover:bg-white/5'
                      }`}
                    >
                      <span className="truncate">{getOptionLabel(option)}</span>
                      <span
                        className={`w-4 h-4 border flex items-center justify-center ${
                          isSelected ? 'border-[#14C800] bg-[#14C800] text-[#03060a]' : 'border-white/25'
                        }`}
                      >
                        {isSelected ? '✓' : ''}
                      </span>
                    </button>
                  );
                })
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default SearchMultiSelect;
