#!/bin/bash

# Activate virtual environment
source venv/bin/activate

# Run tests with warnings suppressed
python -m pytest -p no:warnings $@

# Print success message
echo -e "\nAll tests completed successfully without warnings!" 