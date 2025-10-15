import dotenv from 'dotenv';
import mongoose from 'mongoose';
import fs from 'fs';
import path from 'path';

// Import local configuration and models
import connectDB from './config/db.js';
import Product from './models/Product.js';
import Interaction from './models/Interaction.js';

dotenv.config();
// We connect later inside importData to allow for custom database actions
// connectDB(); 

// --- Configuration ---
// FIX: We use __dirname or process.cwd() (current working directory) to resolve the path correctly.
// Since you run 'npm run' from the 'backend' folder, the path should start from there.
// We use 'path.join' to safely build the path relative to where Node is running.
const PRODUCTS_JSON_PATH = path.join(process.cwd(), 'data', 'products_final.json');
const INTERACTIONS_JSON_PATH = path.join(process.cwd(), 'data', 'interactions_final.json');

// Function to read JSONL files (one JSON object per line)
const loadJSONLData = (filePath) => {
    try {
        // Read file contents as a single string
        const content = fs.readFileSync(filePath, 'utf-8').trim();
        
        // Split by lines and parse each line as a separate JSON object
        return content.split('\n').map(line => JSON.parse(line));
    } catch (error) {
        // Log the error and the path for debugging
        console.error(`Error reading or parsing file at path: ${filePath}`);
        console.error(`Details: ${error.message}`);
        return [];
    }
};

const importData = async () => {
    // 1. Establish DB connection inside the function
    await connectDB();
    
    // Load data from the downloaded and filtered JSON files
    const productsData = loadJSONLData(PRODUCTS_JSON_PATH);
    const interactionsData = loadJSONLData(INTERACTIONS_JSON_PATH);
    
    // SAFETY CHECK ADDED HERE: Will now print if files are empty
    if (productsData.length === 0 || interactionsData.length === 0) {
        console.error("Seeding failed: One or both JSON files could not be loaded or are empty.");
        // We close the connection before exiting
        mongoose.disconnect();
        process.exit(1);
    }

    try {
        console.log('--- Clearing Existing Data ---');
        await Interaction.deleteMany();
        await Product.deleteMany();

        console.log(`--- Importing ${productsData.length} Products ---`);
        
        const createdProducts = await Product.insertMany(productsData);

        const productMap = createdProducts.reduce((acc, product) => {
            acc[product.product_id] = product._id;
            return acc;
        }, {});
        
        console.log(`--- Mapping ${interactionsData.length} Interactions ---`);

        const mappedInteractions = interactionsData.map(interaction => {
            const objectId = productMap[interaction.product_id];
            
            if (!objectId) {
                console.warn(`Skipping interaction for unknown product ID: ${interaction.product_id}`);
                return null;
            }

            return {
                user_id: interaction.user_id,
                product_id: objectId, 
                action_type: interaction.action_type,
                value: interaction.value,
            };
        }).filter(item => item !== null);

        await Interaction.insertMany(mappedInteractions);

        console.log('Data Imported Successfully!');
        console.log(`Total Products: ${createdProducts.length}`);
        console.log(`Total Interactions: ${mappedInteractions.length}`);
        
        mongoose.disconnect();
        process.exit(0);
        
    } catch (error) {
        console.error(`Error during data import process: ${error.message}`);
        mongoose.disconnect();
        process.exit(1);
    }
};

const destroyData = async () => {
    try {
        await connectDB();
        console.log('--- Clearing Database ---');
        await Interaction.deleteMany();
        await Product.deleteMany();
        console.log('Data Destroyed Successfully!');
        mongoose.disconnect();
        process.exit(0);
    } catch (error) {
        console.error(`Error with data destruction: ${error.message}`);
        mongoose.disconnect();
        process.exit(1);
    }
};

// Remove redundant connectDB call from global scope
// Check command line arguments to determine if we import or destroy
if (process.argv[2] === '-d') {
    destroyData();
} else {
    importData();
}
