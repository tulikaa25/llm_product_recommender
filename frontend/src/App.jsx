import React, { useState, useEffect } from 'react';
import { RefreshCcw, ShoppingCart, User, MessageSquare, Heart, CheckCircle, Loader, UserCircle } from 'lucide-react';

// NOTE: We assume Lucide icons are defined globally by the index.html script block.

const API_BASE_URL = 'http://localhost:5000/api/recommendations';

// --- COMPONENT 3: Loading Card (Skeleton) ---
const LoadingCard = () => (
  <div className="bg-white dark:bg-gray-800 p-6 rounded-2xl shadow-xl border border-gray-200 dark:border-gray-700 animate-pulse">
    <div className="flex flex-col md:flex-row items-start md:items-center mb-4 space-y-4 md:space-y-0 md:space-x-4">
      <div className="w-24 h-24 bg-gray-300 dark:bg-gray-600 rounded-lg"></div>
      <div className="flex-grow flex flex-col space-y-2">
        <div className="h-7 bg-gray-300 dark:bg-gray-600 rounded w-64"></div>
        <div className="h-4 bg-gray-300 dark:bg-gray-600 rounded w-32"></div>
      </div>
      <div className="h-8 bg-gray-300 dark:bg-gray-600 rounded w-24"></div>
    </div>
    <div className="p-4 mt-4 rounded-lg flex items-start bg-gray-100 dark:bg-gray-700">
      <div className="h-12 bg-gray-300 dark:bg-gray-600 rounded w-full"></div>
    </div>
    <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-600 flex justify-end">
        <div className="h-8 bg-gray-300 dark:bg-gray-600 rounded w-32"></div>
    </div>
  </div>
);


// --- COMPONENT 2: Product Card (Item Display) ---
const RecommendationCard = ({ rec, rank }) => {
  
  // Custom Truncation Logic for better display (Addresses the long title problem)
  const displayTitle = rec.name.length > 60 
    ? rec.name.substring(0, 60).trim() + '...' 
    : rec.name;

  // Determine LLM Tone and Icon based on explanation keywords for visual confirmation
  let icon = React.createElement(Heart, { className: "w-5 h-5 text-red-500" });
  let tag = 'Match Score';
  let tagColor = 'bg-gray-200 text-gray-700 dark:bg-gray-700 dark:text-gray-300';

  if (rec.explanation) {
    const lowerExp = rec.explanation.toLowerCase();
    
    // CF Dominance (Social Proof)
    if (lowerExp.includes('community') || lowerExp.includes('similar customers')) {
      tag = 'CF Match (Social Proof)';
      tagColor = 'bg-green-100 text-green-700 dark:bg-green-800 dark:text-green-100';
      icon = React.createElement(UserCircle, { className: "w-5 h-5 text-green-600" });
    } 
    // CBF Dominance (Personalized Match)
    else if (lowerExp.includes('feature') || lowerExp.includes('attributes') || lowerExp.includes('aligns perfectly')) {
      tag = 'CBF Match (Personalized)';
      tagColor = 'bg-blue-100 text-blue-700 dark:bg-blue-800 dark:text-blue-100';
      icon = React.createElement(MessageSquare, { className: "w-5 h-5 text-blue-600" });
    }
  }

  return (
    <div className="bg-white dark:bg-gray-800 p-6 rounded-2xl shadow-xl border border-gray-200 dark:border-gray-700 transition transform hover:shadow-2xl hover:scale-[1.02]">
      <div className="flex flex-col md:flex-row items-start md:items-center mb-4 space-y-4 md:space-y-0 md:space-x-4">
        {/* Product Image Placeholder */}
        <img 
          src={`https://via.placeholder.com/100/4f46e5/ffffff?text=${rec.category.replace(/[^A-Z]/g, '').substring(0, 3)}`} 
          alt={rec.name} 
          className="w-24 h-24 object-cover rounded-lg shadow-md"
        />
        <div className="flex-grow flex flex-col space-y-1">
          <div className="text-lg font-bold text-gray-800 dark:text-gray-200">
            {rank}. {displayTitle}
          </div>
          <p className="text-sm text-indigo-500 uppercase font-semibold">
            {rec.category}
          </p>
        </div>
        
        <div className="text-right flex flex-col items-end">
          {/* Tag showing the dominant model */}
          <span className={`px-3 py-1 text-xs font-bold rounded-full ${tagColor} mb-2 shadow-sm`}>
            {tag}
          </span>
          {/* Hybrid Score Display */}
          <span className="text-2xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-indigo-600 to-purple-600 dark:from-indigo-400 dark:to-purple-400">
            Score: {rec.score}
          </span>
        </div>
      </div>

      {/* LLM Explanation Block (The most important part) */}
      <div className="p-4 mt-4 rounded-lg bg-gray-100 dark:bg-gray-700 flex items-start border border-gray-200 dark:border-gray-600 shadow-inner">
        <div className="mr-3 mt-1 flex-shrink-0">{icon}</div>
        <div>
          <p className="text-xs text-gray-500 dark:text-gray-400 font-medium italic">
            "Why this product?"
          </p>
          <p className="text-sm text-gray-800 dark:text-gray-200 font-medium mt-1 leading-relaxed">
            {rec.explanation}
          </p>
        </div>
      </div>
      
      {/* Footer/Action */}
      <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-600 flex justify-end">
        <button className="px-5 py-2 text-sm bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-lg shadow-md hover:from-indigo-700 hover:to-purple-700 transition duration-300 flex items-center">
          Add to Cart {React.createElement(ShoppingCart, { className: "w-4 h-4 inline ml-2" })}
        </button>
      </div>
    </div>
  );
};


// --- COMPONENT 1: Main Application (App.jsx) ---
const App = () => {
  const [userId, setUserId] = useState('A3SGXH7AUHU8GW'); // Test ID for Health/Personal Care
  const [loading, setLoading] = useState(false);
  const [recommendations, setRecommendations] = useState([]);
  const [error, setError] = useState(null);

  // Fetch recommendations from the Node.js API Gateway
  const fetchRecommendations = async (id) => {
    if (!id) {
      setError("Please enter a valid User ID.");
      setRecommendations([]);
      return;
    }
    setLoading(true);
    setError(null);
    
    try {
      // Step 1: Call the Node.js API (which coordinates Python & LLM)
      const response = await fetch(`${API_BASE_URL}/${id}`);
      
      if (!response.ok) {
        throw new Error(`API Error: ${response.statusText}`);
      }
      
      const data = await response.json();
      
      setRecommendations(data);
      
      if (data.length === 0) {
        setError("No personalized recommendations found for this user. Try a different, active User ID.");
      }

    } catch (err) {
      console.error("Fetch Error:", err);
      // Fallback message indicating the service chain failed
      setError(`Backend Service Failure. Ensure Node.js (5000) and Python (8000) servers are running.`);
      setRecommendations([]);
    } finally {
      setLoading(false);
    }
  };

  const handleFetchClick = () => {
    fetchRecommendations(userId);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-indigo-100 dark:from-gray-900 dark:to-indigo-950 font-sans p-4 sm:p-8">
      <div className="max-w-5xl mx-auto">
        <header className="text-center py-10 bg-white dark:bg-gray-800 rounded-2xl shadow-xl mb-8">
          <h1 className="text-5xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-indigo-600 to-purple-600 dark:from-indigo-400 dark:to-purple-400 tracking-tight">
            Hybrid E-commerce Recommender
          </h1>
          <p className="text-gray-600 dark:text-gray-400 mt-3 flex items-center justify-center text-lg">
            {React.createElement(CheckCircle, { className: "w-5 h-5 mr-2 text-green-500" })} Powered by Gemini LLM & Hybrid ML Models
          </p>
        </header>

        {/* User Input and Action Card */}
        <div className="bg-white dark:bg-gray-800 p-6 rounded-2xl shadow-2xl mb-8 border border-gray-200 dark:border-gray-700">
          <div className="flex items-center text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
            {React.createElement(User, { className: "w-5 h-5 mr-2 text-indigo-500" })}
            Target User:
          </div>
          <div className="flex flex-col sm:flex-row space-y-4 sm:space-y-0 sm:space-x-4">
            <input
              type="text"
              value={userId}
              onChange={(e) => setUserId(e.target.value)}
              placeholder="e.g., A3SGXH7AUHU8GW"
              className="flex-grow p-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 dark:bg-gray-700 dark:text-white transition duration-200"
              disabled={loading}
            />
            <button
              onClick={handleFetchClick}
              disabled={loading}
              className="px-6 py-3 bg-gradient-to-r from-indigo-600 to-purple-600 text-white font-semibold rounded-lg shadow-md hover:from-indigo-700 hover:to-purple-700 transition duration-300 disabled:bg-indigo-300 flex items-center justify-center"
            >
              {loading ? (
                <>
                  {React.createElement(Loader, { className: "w-5 h-5 mr-2 animate-spin" })} Analyzing...
                </>
              ) : (
                <>
                  {React.createElement(RefreshCcw, { className: "w-5 h-5 mr-2" })} Get Personalized List
                </>
              )}
            </button>
          </div>
        </div>

        {/* Error Display */}
        {error && (
          <div className="p-4 mb-6 bg-red-100 dark:bg-red-900 border-l-4 border-red-500 text-red-700 dark:text-red-300 rounded-xl shadow-md">
            <p className="font-bold">System Error:</p>
            <p className="text-sm">{error}</p>
          </div>
        )}

        {/* Results / Skeleton Loading */}
        <h2 className="text-3xl font-bold text-gray-800 dark:text-gray-200 mb-6 flex items-center">
          {React.createElement(ShoppingCart, { className: "w-7 h-7 mr-3 text-indigo-500" })} Top {recommendations.length} Recommendations
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {loading ? (
            // Skeleton Loader
            Array(4).fill(0).map((_, i) => (
              <LoadingCard key={i} />
            ))
          ) : (
            // Recommendation Cards
            recommendations.map((rec, index) => (
              <RecommendationCard key={rec.product_id} rec={rec} rank={index + 1} />
            ))
          )}
        </div>
      </div>
    </div>
  );
};

window.App = App; // Export App globally for index.html to access
