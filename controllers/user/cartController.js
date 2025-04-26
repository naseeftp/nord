const User = require("../../models/userSchema");
const Product = require("../../models/productSchema");
const mongodb = require("mongodb");
const mongoose = require("mongoose");
const Cart = require("../../models/cartSchema"); 
// const { default: items } = require("razorpay/dist/types/items");
const Razorpay = require('razorpay');


const getCartPage = async (req, res) => {
  try {
    const userId = req.session.user
    const page=parseInt(req.query.page)||1;
    const limit=4;
    let cart = await Cart.findOne({ userId }).populate("items.productId")

    if(!cart){
      cart = new Cart({
        userId,
        items:[],
      })
    }

    const validItems=[];
    for(const item of cart.items){
      if(item.productId&&!item.productId.isBlocked){
        validItems.push(item)
      }
    }

    if(validItems.length!==cart.items.length){
      cart.items=validItems;
      await cart.save()
    }



    const totalItems=cart.items.length;
    const totalPages=Math.ceil(totalItems/limit);
    const currentPage=Math.max(1,Math.min(page,totalPages));
    const startIndex=(currentPage-1)*limit;
    const endIndex =startIndex+limit
    const paginatedItems=cart.items.slice(startIndex,endIndex)
     let totalPrice = 0;
    cart.items.forEach(item => {
   
      totalPrice += item.productId.salePrice * item.quantity;
      });
    const userData = await User.findById(userId)
    res.render("cart", {
      cart:{...cart.toObject(),items:paginatedItems},//conversion of  mongoose doc in to plain js obj
      user:userData,
      totalPrice: totalPrice,
      grandTotal: null,
      totalPages,
      currentPage,

    });
  } catch (error) {
    console.error("Error in getCartPage:", error);
    res.redirect("/pageNotFound");
  }
};


const addToCart = async (req, res) => {
  try {
    const { productId, selectedSize } = req.body;
    const userId = req.session.user;

    if (!userId) {
      return res.json({ status: 'login before adding to the cart' });
    }

    const product = await Product.findById(productId).lean();
    if (!product) {
      return res.json({ status: "Product not found" });
    }

  
    const sizeStock = product.sizes?.find(size => size.size === selectedSize);

    if (!sizeStock || sizeStock.quantity <= 0) {
      return res.json({ status: "Out of stock for selected size" });
    }

    const price = product.salePrice || product.regularPrice;
    let userCart = await Cart.findOne({ userId });

    
    if (!userCart) {
      userCart = new Cart({
        userId,
        items: [
          {
            productId,
            selectedSize,
            quantity: 1,
            price: price,
            totalPrice: price,
          },
        ],
      });
    } else {
      const productIndex = userCart.items.findIndex((item) =>
        item.productId.equals(productId) && item.selectedSize === selectedSize
      );

      if (productIndex === -1) {
        userCart.items.push({
          productId,
          selectedSize,
          quantity: 1,
          price: price,
          totalPrice: price,
        });
      } else {
        let cartItem = userCart.items[productIndex];

        
        if (cartItem.quantity + 1 > sizeStock.quantity) {
          return res.json({ status: "Out of stock for selected size" });
        } else {
          cartItem.quantity += 1;
          cartItem.price=price;
          cartItem.totalPrice = cartItem.quantity * cartItem.price;
        }
      }
    }

    await userCart.save();

    
    const user = await User.findById(userId);
    if (!user) {
      return res.json({ status: "User not found" });
    }

    const wishlistIndex = user.wishlist.indexOf(productId);
    if (wishlistIndex !== -1) {
      user.wishlist.splice(wishlistIndex, 1); 
      await user.save();
    }

    req.session.offerPrice = 0;
    req.session.appliedCoupon = null

    return res.json({
      status: true,
      cartLength: userCart.items.length,
      user: userId,
    });

  } catch (error) {
    console.error(error);
    return res.redirect("/pageNotFound");
  }
};


const changeQuantity = async (req, res) => {
  try {
      const { productId, quantity, count, selectedSize } = req.body;
      const userId = req.session.user;


      if (!selectedSize) {
          return res.status(400).json({
              status: false,
              message: "Size not selected"
          });
      }

     
      const cartItems = await Cart.findOne({ userId: userId }).populate("items.productId");

      const findItem = cartItems.items.find((item) => item._id.toString() === productId.toString());

      if (!findItem) {
          return res.status(404).json({
              status: false,
              message: "Product not found in cart"
          });
      }

      const product = await Product.findById(findItem.productId._id);

      if (!product) {
          return res.status(404).json({
              status: false,
              message: "Product not found"
          });
      }

    
      const sizeData = product.sizes.find(size => size.size === selectedSize);
   

      if (!sizeData) {
        return res.status(404).json({
          status: false,
          message: 'Selected size not available.',
          showSwal: true
        });
      }

const newQuantity = parseInt(findItem.quantity) + parseInt(count);

if (newQuantity > sizeData.quantity) {
  return res.status(400).json({status:false, message: `Only ${sizeData.quantity} items available in size ${selectedSize}`})
}

      findItem.quantity = newQuantity;
      findItem.price=product.salePrice||product.regularPrice;
      findItem.totalPrice=findItem.quantity*findItem.price;
      await cartItems.save();

   
      let grandTotal = 0;
      cartItems.items.forEach((item) => {
          grandTotal += item.quantity * item.price;
      });

      req.session.offerPrice = 0;
      req.session.appliedCoupon = null;

      res.json({
          status: true,
          quantityInput: findItem.quantity,
          count: count,
          totalAmount: findItem.quantity * findItem.productId.salePrice,
          grandTotal: grandTotal,
          updatedCart: cartItems
      });

  } catch (error) {
      console.error('Error while changing the quantity:', error);
      res.redirect('/pageNotFound');
  }
};



const deleteProduct = async (req, res) => {
  try {
    const productId = req.query.id;
    const userId = req.session.user;
     const userCart = await Cart.findOne({ userId });
    if (!userCart) {
      console.log("Cart not found for user:", userId);
      return res.status(404).json({ status: false, error: "Cart not found" });
    }
    const itemIndex = userCart.items.findIndex(item => item._id.equals(productId));
    if (itemIndex === -1) {
      console.log("Item not found in cart:", productId);
      return res.status(404).json({ status: false, error: "Item not found in cart" });
    }

    userCart.items.splice(itemIndex, 1);
    await userCart.save();
    req.session.offerPrice = 0;
    req.session.appliedCoupon = null;
    
    res.redirect("/cart");
  } catch (error) {
    console.error("Error in deleteProduct:", error);
    res.redirect("/pageNotFound");
  }
};




module.exports = {
  getCartPage,
  addToCart,
  changeQuantity,
  deleteProduct,
};

 