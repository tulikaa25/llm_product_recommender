import mongoose from 'mongoose';
import dotenv from 'dotenv'; // Assuming this is defined elsewhere, but good practice to include

dotenv.config(); 

const connectDB = async () => {
  try {
  
    const conn = await mongoose.connect(process.env.MONGO_URI, {
     
    });

    console.log(`MongoDB Connected: ${conn.connection.host}`);
  } catch (error) {
    console.error(`Error connecting to MongoDB: ${error.message}`);
    process.exit(1);
  }
};

export default connectDB;