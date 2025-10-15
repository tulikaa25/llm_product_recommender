import express from 'express';
import cors from 'cors';
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import connectDB from './config/db.js';
import recommendationRoutes from './routes/recommendationRoutes.js';

dotenv.config();

connectDB();

const app = express();
const port = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());
app.use('/api/recommendations', recommendationRoutes);

app.get('/', (req, res) => {
  res.send('Product Recommender API is running!');
});

app.listen(port, () => {
    console.log(`Server is running on port: ${port}`);
});
