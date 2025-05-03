const User = require("../../models/userSchema")
const Product = require("../../models/productSchema");
const Cart=require("../../models/cartSchema")

const loadWishlist = async (req, res) => {
  try {
    const userId = req.session.user;
    const user = await User.findById(userId);
    const cart = await Cart.findOne({ userId });
    const cartCount = cart?.items?.length || 0;
     if (!user || !user.wishlist || !Array.isArray(user.wishlist)) {
      return res.render("wishlist", {
        user: null,
        wishlist: [],
        totalPages: 0,
        currentPage: 1,
        cartCount
      });
    }

    const productQuery = { _id: { $in: user.wishlist } };
    const page = parseInt(req.query.page) || 1;
    const limit = 4;
    const skip = (page - 1) * limit;
    const products = await Product.find(productQuery)
      .populate('category')
      .skip(skip)
      .limit(limit);

    const totalProducts = await Product.countDocuments(productQuery);
    const totalPages = Math.ceil(totalProducts / limit);

    res.render("wishlist", {
      user,
      wishlist: products,
      totalPages: totalPages,
      currentPage: page,
      wishlistCount:user.wishlist.length,
      cartCount
    });
  } catch (error) {
    console.error(error);
    res.redirect("/pageNotFound");
  }
};

const addToWishlist = async (req, res) => {
  try {
    const { productId } = req.body;
    const userId = req.session.user;
    const user = await User.findById(userId);

    if (!user) {
      return res.status(404).json({ status: false, message: "User not found" });
    }

    if (user.wishlist.includes(productId)) {
      return res.status(200).json({ status: false, message: "Product already in wishlist" });
    }

    user.wishlist.push(productId);
    await user.save();
    const cart = await Cart.findOne({ userId });
    return res.status(200).json({ 
      status: true,
       message: "Product added to wishlist",
       wishlistCount: user.wishlist.length,
       cartCount: cart?.items?.length || 0
      
      });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ status: false, message: "Server error" });
  }
};

const removeProduct = async (req, res) => {
  try {
    const productId = req.query.productId;
    const userId = req.session.user;
    const user = await User.findById(userId);
    const cart= await Cart.findOne({userId})
    

    if (!user) {
      return res.status(404).json({ status: false, message: "User not found" });
    }

    const index = user.wishlist.indexOf(productId);
    if (index === -1) {
      return res.status(404).json({ status: false, message: "Product not found in wishlist" });
    }

    user.wishlist.splice(index, 1);
    await user.save();
   

    return res.redirect('/wishlist');
  } catch (error) {
    console.error(error);
    return res.status(500).json({ status: false, message: "Server error" });
  }
};

const getProductSizes = async (req, res) => {
  try {
    const productId = req.params.productId;
    console.log("productId: ",productId)
    const product = await Product.findById(productId).select('sizes');

    console.log("selected: ",product)

    if (!product) {
      return res.status(404).json({ status: false, message: "Product not found" });
    }

    res.status(200).json(product.sizes);
  } catch (error) {
    console.error(error);
    console.log("error while getProductSize: ",error)
    res.status(500).json({ status: false, message: "Server error" });
  }
};

module.exports = {
  loadWishlist,
  addToWishlist,
  removeProduct,
  getProductSizes,
};