

const mongoose = require("mongoose");
const { Schema } = mongoose;

const productSchema = new Schema(
  {
    productName: {
      type: String,
      required: true,
    },
    description: {
      type: String,
      required: true,
    },
    brand: {
      type: String,
      required: false,
    },
    category: {
      type: Schema.Types.ObjectId,
      required: true,
      ref: "Category",
    },
    regularPrice: {
      type: Number,
      required: true,
    },
    salePrice: {
      type: Number,
      required: true,
    },
    productOffer: {
      type: Number,
      default: 0,
    },
       
    categoryoffer: { type: Number,
       default: 0 
      },

    finalamount:{
      type:Number,
      default:0,
      require:false,
    },
    sizes: [
      {
        size: { type: String, required: true },
        quantity: { type: Number, required: true, min: 0 },
      }
    ],

    color: {
      type: String,
      required: true,
    },
    productImage: {
      type: [String],
      required: true,
    },
    isBlocked: {
      type: Boolean,
      default: false,
    },
    status: {
      type: String,
      required: true,
      enum: ["Available", "Out of Stock", "Discontinued"],
      default: "Available",
    },
  },
  { timestamps: true } 
);


const Product=mongoose.model("Product",productSchema);
module.exports=Product;