#!/usr/bin/env python3
"""Data processing utilities for testing."""

import json
from typing import List, Dict, Any

# Constants
DEFAULT_BATCH_SIZE = 100
MAX_RETRIES = 3

def process_data(data: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """Process a list of data items."""
    processed = []
    for item in data:
        if validate_item(item):
            processed.append(transform_item(item))
    return processed

def validate_item(item: Dict[str, Any]) -> bool:
    """Validate a single data item."""
    return 'id' in item and 'value' in item

def transform_item(item: Dict[str, Any]) -> Dict[str, Any]:
    """Transform a data item."""
    return {
        'id': item['id'],
        'value': item['value'] * 2,
        'processed': True
    }

class DataProcessor:
    """A class for batch processing data."""

    def __init__(self, batch_size: int = DEFAULT_BATCH_SIZE):
        self.batch_size = batch_size
        self.processed_count = 0

    def process_batch(self, items: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """Process a batch of items."""
        results = []
        for i in range(0, len(items), self.batch_size):
            batch = items[i:i + self.batch_size]
            results.extend(process_data(batch))
            self.processed_count += len(batch)
        return results

    def get_stats(self) -> Dict[str, int]:
        """Get processing statistics."""
        return {
            'processed_count': self.processed_count,
            'batch_size': self.batch_size
        }

# Module-level function
def load_config(filepath: str) -> Dict[str, Any]:
    """Load configuration from a JSON file."""
    with open(filepath, 'r') as f:
        return json.load(f)
