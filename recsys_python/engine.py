from flask import Flask, request, jsonify
from pymongo import MongoClient
import pandas as pd
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics.pairwise import cosine_similarity
import numpy as np
import os
import json
from surprise import Dataset, Reader, SVD
from collections import defaultdict 


app = Flask(__name__)

# --- CONFIGURATION ---
MONGO_URI = os.environ.get('MONGO_URI', "mongodb+srv://Tulikauser:8LmfvHVfkH9dCgEf@samplecluster.5gtxiob.mongodb.net/recommender_db?retryWrites=true&w=majority")
client = MongoClient(MONGO_URI)
db = client['recommender_db']
PRODUCTS_COLLECTION = db['products']
INTERACTIONS_COLLECTION = db['interactions']
RECOMMENDATION_LIMIT = 5

# --- UTILITY FUNCTIONS ---

def list_to_string(lst):
    return ' '.join(lst) if isinstance(lst, list) else str(lst)

def get_hybrid_recommendations(user_id):
    
    # 1. FETCH DATA
    products_list = list(PRODUCTS_COLLECTION.find({}))
    interactions_list = list(INTERACTIONS_COLLECTION.find({}))

    products_df = pd.DataFrame(products_list)
    interactions_df = pd.DataFrame(interactions_list)
    
    # Safety checks
    if products_df.empty:
        return []
        
    products_df['_id_str'] = products_df['_id'].astype(str)
    
    # --- Cold Start for New User ---
    if interactions_df.empty or products_df.empty:
        popular_recs = products_df.sort_values(by='rating', ascending=False).head(RECOMMENDATION_LIMIT)
        return [{
            'product_id': row['product_id'],
            'score': 1.0,
            'reasoning': "Top-rated and highly popular among all users (Cold Start)."
        } for _, row in popular_recs.iterrows()]

    # CRITICAL FIX: Ensure the product ID is a string for both Pandas (CBF) and Surprise (CF)
    interactions_df['product_id_str'] = interactions_df['product_id'].astype(str)
    
    # --- 2. TRUE COLLABORATIVE FILTERING (CF) ---
    
    # a. Prepare data for Surprise: [user_id, item_id (product_id_str), rating (value)]
    cf_data = interactions_df[['user_id', 'product_id_str', 'value']].copy()
    cf_data.rename(columns={'product_id_str': 'product_id', 'value': 'rating'}, inplace=True)
    
    # Ensure user_id is treated as a string for Surprise stability
    cf_data['user_id'] = cf_data['user_id'].astype(str)

    reader = Reader(rating_scale=(1.0, 5.0))
    data = Dataset.load_from_df(cf_data[['user_id', 'product_id', 'rating']], reader)
    
    # b. Train the SVD Model 
    trainset = data.build_full_trainset()
    algo_cf = SVD(n_epochs=20, lr_all=0.005, reg_all=0.02)
    algo_cf.fit(trainset)

    # --- 3. CONTENT-BASED FILTERING (CBF) ---
    
    # a. Create CBF Corpus: Combine description and features
    products_df['description'] = products_df['description'].fillna('')
    products_df['features'] = products_df['features'].apply(lambda x: list_to_string(x) if isinstance(x, list) else str(x)).fillna('')
    
    content_corpus = products_df['description'] + ' ' + products_df['features']
    
    tfidf = TfidfVectorizer(stop_words='english')
    product_features_matrix = tfidf.fit_transform(content_corpus)
    
    # b. Calculate User Profile (Mean vector of user's historical items)
    # Get the ObjectIds (as strings) of the user's past interactions
    user_interacted_ids_obj_str = interactions_df[interactions_df['user_id'] == user_id]['product_id_str'].tolist()
    
    # We match the list of ObjectIds (as strings) from user history 
    # against the _id_str (ObjectId as string) in the products DataFrame
    user_history_indices = products_df[products_df['_id_str'].isin(user_interacted_ids_obj_str)].index.tolist()
    
    if not user_history_indices:
        # If the user has interactions but none of them matched the final product catalog (due to filtering)
        return [{
            'product_id': row['product_id'],
            'score': 0.5,
            'reasoning': "User has interactions, but none matched the final product catalog for CBF profile. Defaulting to popularity."
        } for _, row in products_df.sort_values(by='rating', ascending=False).head(RECOMMENDATION_LIMIT).iterrows()]

    # FIX: Explicitly convert the result of mean() operation to a dense numpy array
    user_profile_vector = np.asarray(product_features_matrix[user_history_indices].mean(axis=0))
    
    cbf_scores = cosine_similarity(user_profile_vector, product_features_matrix).flatten()
    products_df['cbf_score'] = cbf_scores

    # --- 4. HYBRID SCORING, RANKING & EXPLANATION PREP ---
    
    CBF_WEIGHT = 0.7
    CF_WEIGHT = 0.3
    
    purchased_ids = interactions_df[interactions_df['user_id'] == user_id]['product_id_str'].tolist()
    
    # Exclude items the user has already interacted with by matching their _id_str
    recommendable_products = products_df[~products_df['_id_str'].isin(purchased_ids)].copy()
    
    output_recs = []
    
    for _, row in recommendable_products.iterrows():
        product_id_str = row['product_id']

        # Get the SVD-predicted rating for this item
        predicted_rating = algo_cf.predict(user_id, product_id_str).est
        
        # Normalize the predicted rating (1-5 scale) to a 0-1 scale for weighting
        cf_score_normalized = predicted_rating / 5.0 
        
        # Calculate Hybrid Contributions
        cbf_contribution = CBF_WEIGHT * row['cbf_score']
        cf_contribution = CF_WEIGHT * cf_score_normalized
        
        hybrid_score = cbf_contribution + cf_contribution

        if hybrid_score > 0.4: # Relevance threshold
            
            # Determine the dominant factor for the LLM justification
            if cbf_contribution >= cf_contribution:
                dominant_factor = 'CBF'
                llm_input_reason = f"interest in features: {row['features'][:5]} and product content."
            else:
                dominant_factor = 'CF'
                llm_input_reason = f"highly rated by similar users (predicted score: {round(predicted_rating, 2)} out of 5)."
            
            output_recs.append({
                'product_id': product_id_str, 
                'score': round(hybrid_score, 4),
                'reasoning': llm_input_reason,
                'dominant_factor': dominant_factor
            })

    # 5. FINAL RANKING
    top_recs = pd.DataFrame(output_recs).sort_values(by='score', ascending=False).head(RECOMMENDATION_LIMIT)
    return top_recs.to_dict('records')

# --- FLASK ROUTE ---
@app.route('/get-recommendations', methods=['GET'])
def recommend():
    user_id = request.args.get('userId')
    
    if not user_id:
        return jsonify({"error": "Missing userId"}), 400
    
    try:
        recommendations = get_hybrid_recommendations(user_id)
        return jsonify(recommendations)
    except Exception as e:
        print(f"Internal ML Error: {e}")
        return jsonify({"error": "Internal recommendation engine failure"}), 500

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=8000)
