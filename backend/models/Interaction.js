import mongoose from 'mongoose';

const InteractionSchema = new mongoose.Schema({
    user_id: { type: String, required: true },
    product_id: { 
        type: mongoose.Schema.Types.ObjectId, 
        ref: 'Product', 
        required: true 
    },
    action_type: { 
        type: String, 
        enum: ['view', 'add_to_cart', 'purchase', 'rating'], 
        required: true 
    },
    value: { type: Number, default: 1 }, 
}, {
    timestamps: true
});

InteractionSchema.index({ user_id: 1, product_id: 1 });

const Interaction = mongoose.model('Interaction', InteractionSchema);
export default Interaction;