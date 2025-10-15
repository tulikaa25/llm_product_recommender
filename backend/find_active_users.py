import pandas as pd
import json
import os
import sys

# --- Configuration ---
# NOTE: The path must be relative to where you run this script.
# We assume you run this from the project root OR the backend folder.
FILE_PATH = 'data/interactions_final.json'

# --- Execution ---
try:
    # 1. Load the filtered data (JSONL format)
    with open(FILE_PATH, 'r') as f:
        # Use list comprehension to handle JSON lines format
        interactions_data = [json.loads(line) for line in f]

    reviews_df = pd.DataFrame(interactions_data)

    # 2. Count how many reviews each user provided in the FINAL dataset
    active_users = reviews_df['user_id'].value_counts().reset_index()
    active_users.columns = ['user_id', 'review_count']

    # 3. Find the top 10 most active users (for robust testing)
    top_active_users = active_users.head(10)

    print("\n--- TOP 10 MOST ACTIVE USER IDs ---")
    print("These IDs are guaranteed to trigger the full Hybrid ML model.")
    print("-" * 40)
    print(top_active_users)
    print("-" * 40)

except FileNotFoundError:
    print(f"\nERROR: File not found at path: {FILE_PATH}")
    print("Please ensure 'interactions_final.json' is in your 'backend/data/' folder.")
except KeyError as e:
    print(f"\nERROR: DataFrame is missing key {e}. Ensure file structure is correct.")
except Exception as e:
    print(f"\nAn unexpected error occurred: {e}")


