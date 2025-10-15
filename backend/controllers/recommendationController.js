import Product from '../models/Product.js';
import { GoogleGenAI } from '@google/genai';
import axios from 'axios';

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
const PYTHON_SERVICE_URL = process.env.PYTHON_SERVICE_URL || 'http://localhost:8000';

// Function to generate the LLM explanation based on the Python output
const generateExplanation = async (product, reasons, dominantFactor) => {
    
    let personaPrompt;
    let styleConstraint;
    
    // Determine the prompt structure based on the dominant factor (CBF or CF)
    if (dominantFactor === 'CF') {
        // CF
        personaPrompt = "You are a senior e-commerce trust agent and community expert. Your tone must be warm, enthusiastic, and focused on collective approval.";
        
        styleConstraint = "Write a concise, compelling paragraph of 2-3 sentences. The focus must be on the product's predicted high rating and community enthusiasm from similar customers.";
    } else { // CBF
        
        personaPrompt = "You are a dedicated personal shopping consultant specializing in precise feature matching. Your tone must be direct, knowledgeable, and highly relevant.";
        
        styleConstraint = "Write a concise, compelling paragraph of 2-3 sentences. The focus must be on how the product's specific features (which you must mention) align perfectly with the user's past actions.";
    }

    const prompt = `
        --- INSTRUCTION SET ---
        Role: ${personaPrompt}
        Task: Write the final justification for the product recommendation.
        Format Constraint: ${styleConstraint}
        --- INPUT DATA ---
        Product Name: ${product.name} (Category: ${product.category})
        Technical Justification: ${reasons} 
        
        Write the explanation directly addressing the user.
    `;

    try {
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: prompt,
            config: {
                temperature: 0.5 
            }
        });

        return response.text.trim();
    } catch (error) {
        console.error('LLM API Error:', error);
        return 'We are recommending this item just for you!';
    }
};

export const getRecommendations = async (req, res) => {
    const { userId } = req.params;

    try {
        // 1. COORDINATION: Call the Python Microservice for the core logic
        const pythonResponse = await axios.get(`${PYTHON_SERVICE_URL}/get-recommendations`, {
            params: { userId }
        });
        
        const pythonRecs = pythonResponse.data;
        
        if (pythonRecs.length === 0) {
            return res.json([]);
        }

        // 2. DATA ENRICHMENT: Get full product details from MongoDB
        const recommendedProductIDs = pythonRecs.map(rec => rec.product_id);
        const productsMap = await Product.find({ product_id: { $in: recommendedProductIDs } })
            .then(products => products.reduce((map, p) => ({ ...map, [p.product_id]: p }), {}));

        // 3. LLM EXPLANATION: Combine Python's reasons with the LLM
        const finalRecommendations = await Promise.all(pythonRecs.map(async (rec) => {
            const product = productsMap[rec.product_id];

            if (!product) {
                console.warn(`Product not found in DB for ID: ${rec.product_id}`);
                return null;
            }

            // Pass the dominant factor from Python to tailor the LLM prompt
            const llmExplanation = await generateExplanation(
                product, 
                rec.reasoning, 
                rec.dominant_factor 
            );

            return {
                product_id: rec.product_id,
                name: product.name,
                category: product.category,
                // price: product.price,
                score: rec.score,
                explanation: llmExplanation,
            };
        }));

        res.json(finalRecommendations.filter(rec => rec !== null));

    } catch (error) {
        console.error('API Gateway Error:', error.message);
        res.status(500).json({ message: 'Error retrieving recommendations. Check Python service status.' });
    }
};
