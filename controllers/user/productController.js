const Product=require("../../models/productSchema");
const Category=require("../../models/categorySchema");
const User=require("../../models/userSchema");
const Cart=require("../../models/cartSchema")




// const productDetails=async(req,res)=>{
//   try {

//     const  productId=req.query.id;
//     const userId=req.session.user;
//     const userData=await User.findById(userId);
//      const product = await Product.findById(productId).populate('category');
//     const findCategory=Product.category;
//     const  categoryOffer=findCategory?.categoryoffer||0;
//     const productOffer=product.productOffer||0;
//     const totalOffer=categoryOffer+productOffer;
     
//    if(!product||product.isBlocked){
//    return res.render("page-404")

//    }

//     res.render("productdetails",{
//     user:userData,
//     product:product,
//     sizes:product.sizes,
//     totalOffer:totalOffer,
//     category:findCategory,


//     })
// } catch (error) {
//     console.log('error for fetching data', error);
//     res.redirect('/pageNotFound')
//   }

// }
const productDetails = async (req, res) => {
  try {
    const productId = req.query.id;
    const userId = req.session.user;
    
    // Fetch all necessary data in parallel
    const [userData, product, cart] = await Promise.all([
      userId ? User.findById(userId) : Promise.resolve(null),
      Product.findById(productId).populate('category'),
      userId ? Cart.findOne({ userId }) : Promise.resolve(null)
    ]);

    if (!product || product.isBlocked) {
      return res.render("page-404");
    }

    const findCategory = product.category;
    const categoryOffer = findCategory?.categoryoffer || 0;
    const productOffer = product.productOffer || 0;
    const totalOffer = categoryOffer + productOffer;

    // Calculate counts
    const wishlistCount = userData?.wishlist?.length || 0;
    const cartCount = cart?.items?.length || 0;

    res.render("productdetails", {
      user: userData,
      product: product,
      sizes: product.sizes,
      totalOffer: totalOffer,
      category: findCategory,
      // Add these counts
      wishlistCount,
      cartCount
    });

  } catch (error) {
    console.log('Error fetching product details:', error);
    res.redirect('/pageNotFound');
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
          cartItem.totalPrice = cartItem.quantity * cartItem.price;
        }
      }
    }

    await userCart.save();

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





module.exports={
productDetails,
addToCart,

}