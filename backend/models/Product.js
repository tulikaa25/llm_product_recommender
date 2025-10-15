import mongoose from 'mongoose';

const ProductSchema = new mongoose.Schema({
    product_id: { type: String, required: true, unique: true },
    name: { type: String, required: true },
    category: { type: String, required: true },
    price: { type: Number, required: true },
    description: { type: String, required: true },
    features: { type: [String], default: [] }, 
    rating: { type: Number, default: 0 },
    reviews_count: { type: Number, default: 0 }
}, {
    timestamps: true
});

const Product = mongoose.model('Product', ProductSchema);
export default Product;