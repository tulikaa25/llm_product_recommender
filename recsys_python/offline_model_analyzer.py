import sys
import os
import pandas as pd
from pymongo import MongoClient
from surprise import Dataset, Reader, SVD
from surprise.model_selection import cross_validate

# --- CONFIGURATION (Must match engine.py) ---
# Use the hardcoded URI for reliable standalone execution
MONGO_URI = os.environ.get('MONGO_URI', "mongodb+srv://Tulikauser:8LmfvHVfkH9dCgEf@samplecluster.5gtxiob.mongodb.net/recommender_db?retryWrites=true&w=majority")
DB_NAME = 'recommender_db'
INTERACTIONS_COLLECTION_NAME = 'interactions'

# --- MODEL ACCURACY CHECK FUNCTION ---
def check_model_accuracy():
    print("--- Starting Collaborative Filtering Model Validation ---")
    
    try:
        # 1. Database Connection and Fetching
        client = MongoClient(MONGO_URI)
        db = client[DB_NAME]
        
        interactions_list = list(db[INTERACTIONS_COLLECTION_NAME].find({}))
        client.close() # Close connection immediately after fetching

        if not interactions_list:
            print("Cannot check accuracy: Interactions collection is empty. Run the seeder first.")
            return

        print(f"Loaded {len(interactions_list):,} interaction records.")
        
        # 2. Data Preparation for Surprise
        interactions_df = pd.DataFrame(interactions_list)
        
        # Create the necessary columns for Surprise (user, item, rating)
        cf_data = interactions_df[['user_id', 'product_id', 'value']].copy()
        
        # Convert IDs and rename for Surprise
        cf_data['product_id'] = cf_data['product_id'].astype(str)
        cf_data.rename(columns={'value': 'rating'}, inplace=True)
        cf_data['user_id'] = cf_data['user_id'].astype(str)

        reader = Reader(rating_scale=(1.0, 5.0))
        data = Dataset.load_from_df(cf_data[['user_id', 'product_id', 'rating']], reader)
        
        print("Running 5-Fold Cross-Validation on SVD model...")

        # 3. Model Evaluation (Cross-Validation)
        algo = SVD(n_epochs=20, lr_all=0.005, reg_all=0.02)
        
        # Cross-validation splits the data 5 times, trains on 4 parts, tests on 1
        results = cross_validate(algo, data, measures=['RMSE', 'MAE'], cv=5, verbose=True)

        # 4. Report Results
        print("\n" + "=" * 50)
        print("MODEL ACCURACY REPORT (5-Fold Cross-Validation)")
        print("=" * 50)
        print(f"Mean RMSE (Root Mean Squared Error): {results['test_rmse'].mean():.4f}")
        print(f"Mean MAE (Mean Absolute Error):      {results['test_mae'].mean():.4f}")
        print("-" * 50)
        
        # Context for the user:
        if results['test_rmse'].mean() < 1.1:
             print("Conclusion: RMSE is excellent (below 1.1). The model predicts ratings reliably.")
        else:
             print("Conclusion: RMSE suggests high error. Model may need more data or tuning.")
        
    except Exception as e:
        print(f"\nFATAL ERROR during Accuracy Check: {e}")
        print("Ensure MongoDB is reachable and collections are correctly seeded.")
        sys.exit(1)


if __name__ == '__main__':
    check_model_accuracy()
