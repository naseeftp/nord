//requiring schema
const User=require("../../models/userSchema");
const Category=require("../../models/categorySchema");
const Product=require("../../models/productSchema");
const Brand=require("../../models/brandSchema");
const Cart = require('../../models/cartSchema')
const  order=require("../../models/orderSchema")
const Coupon=require('../../models/couponSchema')
const { v4: uuidv4 } = require('uuid');
const env=require("dotenv").config();
const nodemailer=require("nodemailer")
const bcrypt=require("bcrypt");
const { addCategoryOffer } = require("../admin/offerController");
const mongoose = require("mongoose");
const Razorpay=require('razorpay')
const Wallet=require('../../models/walletSchema')



const DELIVERY_CHARGE=50;

const pageNotFound=async(req,res)=>{
try {
  res.render("page-404")
} catch (error) {
  res.redirect("/pageNotFound")
}

}

const loadHomepage=async(req,res)=>{
try{
  const user=req.session.user
 
  let userData = null
  if(user){
    userData=await User.findById(user).lean()
  }
  res.render("home",{user:userData})
}catch(error){
    console.log("home page is not found")
    res.status(500).send("server error")
}
}
const loadSignup=async(req,res)=>{
try{
return res.render("signup")
}
catch(error){
console.log("signup page is not found",error)
res.status(500).send("server error")
}
}

function generateOtp(){
    return Math.floor(100000+Math.random()*900000).toString();
}
async function sendVerificationEmail(email,otp){
    try{
       const transporter  =nodemailer.createTransport({
       service:'gmail',
       port:587,
       secure:false,
       requireTLS:true,
       auth:{

        user:process.env.NODEMAILER_EMAIL,
        pass:process.env.NODEMAILER_PASSWORD
       }
    })
      const info=await transporter.sendMail({
        from:process.env.NODEMAILER_EMAIL,
        to:email,
        subject:"verify your account",
        text:`your otp is ${otp}`,
        html:`<b>your OTP:${otp}</b>`,

      })
      return info.accepted.length>0

    }
    catch(error){
      console.error("error sending email",error)
      return false;
    }
}

const signup = async (req, res) => {
  try {
    const { name, phone, email, password, Confirm, referralCode } = req.body;

    if (password !== Confirm) {
      console.log("password:", password);
      return res.render("signup", { message: "Passwords do not match" });
    }

    const passwordPattern = /^(?=.*[A-Z])(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]+$/;
    if (!passwordPattern.test(password)) {
      return res.render("signup", {
        message:
          "Password must contain at least one uppercase letter and one special character",
      });
    }

    const findUser = await User.findOne({ email });
    if (findUser) {
      console.log("Found user: ", findUser);
      return res.render("signup", {
        message: "User with this email already exists",
      });
    }

  
    let referredByUser = null;
    if (referralCode) {
      referredByUser = await User.findOne({ referralCode });
      if (!referredByUser) {
        return res.render("signup", { message: "Invalid referral code" });
      }
    }

    const otp = generateOtp();
    const emailSent = await sendVerificationEmail(email, otp);

    if (!emailSent) {
      console.log("Email not sent", emailSent);
      return res.json("email-error");
    }

    req.session.userOtp = otp;
    req.session.userData = { phone, name, email, password, referredBy: referredByUser ? referredByUser._id : null };

    res.render("verify_otp");
    console.log("OTP sent", otp);
  } catch (error) {
    console.error("signup error", error);
    res.redirect("/pageNotFound");
  }
};

const securepassword=async (password)=>{
 try {
   const passwordHash=await bcrypt.hash(password,10)
   return  passwordHash;
 } catch (error) {
  
 }

}




const verifyOtp = async (req, res) => {
  try {
    const { otp } = req.body;
    if (otp === req.session.userOtp) {
      const userData = req.session.userData;
      const passwordHash = await securepassword(userData.password);

      const saveUserData = new User({
        name: userData.name,
        email: userData.email,
        phone: userData.phone,
        password: passwordHash,
        referredBy: userData.referredBy,
      });

      await saveUserData.save();
      req.session.user = saveUserData._id;

      
      let userWallet = await Wallet.findOne({ userId: saveUserData._id });
      if (!userWallet) {
        userWallet = new Wallet({
          userId: saveUserData._id,
          balance: 0,
          refundAmount: 0,
          totalDebited: 0,
          transactions: [],
        });
      }

     
      if (userData.referredBy) {
        const referrer = await User.findById(userData.referredBy);
        if (referrer) {
        
          userWallet.transactions.push({
            transactionId: uuidv4(),
            amount: 70,
            transactionType: "credit",
            transactionPurpose: "referral",
            description: `Referral bonus for signing up using ${referrer.referralCode}`,
            createdAt: new Date(),
          });
          userWallet.balance += 70;

       
          let referrerWallet = await Wallet.findOne({ userId: referrer._id });
          if (!referrerWallet) {
            referrerWallet = new Wallet({
              userId: referrer._id,
              balance: 0,
              refundAmount: 0,
              totalDebited: 0,
              transactions: [],
            });
          }
          referrerWallet.transactions.push({
            transactionId: uuidv4(),
            amount: 100,
            transactionType: "credit",
            transactionPurpose: "referral",
            description: `Referral bonus for referring ${saveUserData.email}`,
            createdAt: new Date(),
          });
          referrerWallet.balance += 100;

         
          referrer.redeemedUsers.push(saveUserData._id);
          await referrer.save();
          await referrerWallet.save();
        }
      }

      await userWallet.save();
      res.json({ success: true, redirectUrl: "/" });
    } else {
      res.status(400).json({ success: false, message: "Invalid OTP, please try again" });
    }
  } catch (error) {
    console.log("Error verifying OTP", error);
    res.status(500).json({ success: false, message: "An error occurred" });
  }
};


const resendOtp=async(req,res)=>{
  try {
    const {email}=req.session.userData;
    if(!email){
      return res.status(400).json({success:false,message:"email not found in session"})
    }
    const otp=generateOtp();
    req.session.userOtp=otp;

    const emailSent=await sendVerificationEmail(email,otp);
    if(emailSent){
      console.log("Resend OTP:",otp);
      res.status(200).json({success:true,message:"OTP resend succesfully"})

    }
    else{
      res.status(500).json({success:false,message:"failed to resend otp please try again"})
    }
  } catch (error) {
   console.error("Error sending Otp")
   res.status(500).json({success:false,message:"internal server error. please try again"})
  }

}

const loadLogin=async(req,res)=>{
try {
  if(!req.session.user)
  {
    return res.render("login")
  }
  else{
    res.redirect("/")
  }
  
} catch (error) {
  res.redirect("/pageNotFound")

}
}
const login=async(req,res)=>{
  try {
    const {email,password}=req.body;
    const findUser=await User.findOne({isAdmin:0,email:email})
    if(!findUser){
      return res.render("login",{message:"user not found"});
    }
    if(findUser.isBlocked)
    {
      return res.render("login",{message:"user is blocked by admin"})
    }

    const passwordMatch=await bcrypt.compare(password,findUser.password)
    if(!passwordMatch)
    {
    return res.render("login",{message:"in correct password"})

    }

    req.session.user=findUser._id;
    res.redirect("/")
  } catch (error) {
    console.error("login error")
    res.render("loginn",{message:"login failed please try again later"})

  }
}

const logout=async(req,res)=>{
try {
  req.session.user = undefined
  req.session.userData = undefined
    return res.redirect("/login")
  
} catch (error) {
    console.log("logout error",error)
    res.redirect("/pageNotFound")
}

}
const loadShoppingPage = async (req, res) => {
  try {
      const user = req.session.user;
      const userData = await User.findOne({ _id: user });
      const categories = await Category.find({ isListed: true });
      const categoryIds = categories.map((category) => category._id.toString());
      const page = parseInt(req.query.page) || 1;
      const limit = 9;
      const skip = (page - 1) * limit;
      const productQuery = {
          isBlocked: false,
          sizes: { $elemMatch: { quantity: { $gt: 0 } } }
      };

      if (categoryIds.length > 0) {
          productQuery.category = { $in: categoryIds };
      }
       const products = await Product.find(productQuery)
          .populate('category')
          .sort({ createdOn: -1 })
          .skip(skip)
          .limit(limit)
          .lean();

        
        
       const totalProducts = await Product.countDocuments(productQuery);
       const totalPages = Math.ceil(totalProducts / limit);
       const brands = await Brand.find({ isBlocked: false });
       const categoriesWithIds = categories.map((category) => ({
          _id: category._id,
          name: category.name,
          addCategoryoffer:category.categoryoffer||0,
      }));
      res.render("shop", {
          user: userData,
          products: products,
          category: categoriesWithIds,
          brand: brands,
          totalProducts: totalProducts,
          totalPages: totalPages,
          currentPage: page , 
          searchQuery: req.query.query || "", 
       

      });
  } catch (error) {
      console.error("Error loading shopping page:", error);
      res.redirect("/pageNotFound");
  }
};

const filterProduct=async(req,res)=>{
try {
const user=req.session.user;
const category=req.query.category;
const brand=req.query.brand;
const findCategory=category?await Category.findOne({_id:category}):null;
const findBrand=brand?await Brand.findOne({_id:brand}):null;
const brands=await Brand.find({}).lean();

const query={
isBlocked:false,

}
if(findCategory){
query.category=findCategory._id;

}

if(findBrand){
  query.brand=findBrand._id;
  
  }

  let findProducts=await Product.find(query).lean();
  findProducts.sort((a,b)=>new Date(b.createdOn)-new Date(a.createdOn));

  const categories=await Category.find({isListed:true});
  let itemsPerage=6;
  let currentPage=parseInt(req.query.page)||1;
  let startIndex=(currentPage-1)*itemsPerage;
  let endIndex=startIndex+itemsPerage;
  let totalPages=Math.ceil(findProducts.length/itemsPerage);
  const currentProduct=findProducts.slice(startIndex,endIndex);
  let userData=null;
  if(user){
  userData=await User.findOne({_id:user});
  if(userData){
   const searchEntry={
   category:findCategory ? findCategory._id:null,
   brand:findBrand ? findBrand.brandName:null,
   searchedOn:new Date(),
   }
  userData.searchHistory.push(searchEntry);
  await userData.save();

}
}
  
req.session.filteredProducts=currentProduct;
res.render("shop",{
user:userData,
products:currentProduct,
category:categories,
brand:brands,
totalPages,
currentPage,
selectedCategory:category||null,
selectedBrand:brand||null,
searchQuery: req.query.query || "", 
})
} catch (error) {
  res.redirect("/pageNotFound");
}


}



const filterByPrice= async(req,res)=>{
    try {
        const user=req.session.user;
        const userData=await User.findOne({_id:user});
        const brands=await Brand.find({}).lean();
        const categories=await Category.find({isListed:true}).lean();
       
      
        let findProducts = await Product.find({
          salePrice: { $gt: req.query.gt, $lt: req.query.lt },
          isBlocked: false,
         
          sizes: { $elemMatch: { quantity: { $gt: 0 } } }
      }).lean();
        
        findProducts.sort((a,b)=>new Date(b.createdOn)-new Date(a.createdOn));

        let itemsPerage=6;
        let currentPage=parseInt(req.query.page)||1;
        let startIndex=(currentPage-1)*itemsPerage;
        let endIndex=startIndex+itemsPerage;
        let totalPages=Math.ceil(findProducts.length/itemsPerage);
        const currentProduct=findProducts.slice(startIndex,endIndex);
        req.session.filterProducts=findProducts;

        res.render("shop",{
        user:userData,
        products:currentProduct,
        category:categories,
        brand:brands,
        totalPages,
        currentPage,
        searchQuery: req.query.query || "", 
    })
    } catch (error) {
      console.log(error);
      res.redirect("/pageNotFound")
      
    }

}

const searchProducts=async(req,res)=>{
    try {
      const user=req.session.user;
      const userData=await User.findOne({_id:user});
      let search=req.body.query||""

      const brands=await Brand.find({}).lean();
      const categories=await Category.find({isListed:true}).lean();
      const categoryIds=categories.map(category=>category._id.toString());
      let searchResult=[];
     
      if (Array.isArray(req.session.filteredProducts) && req.session.filteredProducts.length > 0) {
        searchResult = req.session.filteredProducts.filter(product =>
            product.productName.toLowerCase().includes(search.toLowerCase())
        );


      }else{

        searchResult=await Product.find({
          productName:{$regex:".*"+search+".*",$options:"i"},
          isBlocked:false,
          
          sizes: { $elemMatch: { quantity: { $gt: 0 } } },
          category:{$in:categoryIds}

        })
      }

      searchResult.sort((a,b)=>new Date(b.createdOn)-new Date(a.createdOn));
      let itemsPerage=6;
      let currentPage=parseInt(req.query.page)||1;
      let startIndex=(currentPage-1)*itemsPerage;
      let endIndex=startIndex+itemsPerage;
      let totalPages=Math.ceil(searchResult.length/itemsPerage);
      const currentProduct=searchResult.slice(startIndex,endIndex);
      res.render("shop",{
       user:userData,
       products:currentProduct,
       category:categories,
       brand:brands,
       totalPages,
       currentPage,
       count:searchResult.length,
       searchQuery: search



      });


        } catch (error) {
        
       console.log("error while searching:",error);
       res.redirect("/pageNotFound");
   
        }

}
const productSize = async (req, res) => {
  try {
    console.log("params:",req.params)
      const product = await Product.findById(req.params.productId);
      res.json(product.sizes);
  } catch (error) {
      console.error("Error fetching sizes:", error);
      res.status(500).json({ error: 'Error fetching sizes' });
   }
};


const addToCart = async (req, res) => {
  try {
    const { productId, size } = req.body;
    const userId = req.session.user;



    const product = await Product.findById(productId).lean();
    if (!product) {
      return res.json({ status: "Product not found" });
    }
    if (product.quantity <= 0) {
      return res.json({ status: "Out of stock" });
    }

    const price = product.salePrice || product.regularPrice;

    let userCart = await Cart.findOne({ userId });

    if (!userCart) {
     
      userCart = new Cart({
        userId,
        items: [
          {
            productId,
            selectedSize: size,
            quantity: 1,
            price: price,
            totalPrice: price,
          },
        ],
      });
    } else {
      const productIndex = userCart.items.findIndex((item) =>
        item.productId.equals(productId) && item.selectedSize === size
      );

      if (productIndex === -1) {
        userCart.items.push({
          productId,
          selectedSize: size,
          quantity: 1,
          price: price,
          totalPrice: price,
        });
      } else {
        let cartItem = userCart.items[productIndex];

        if (cartItem.quantity + 1 > product.quantity) {
          return res.json({ status: "Out of stock" });
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


const loadCheckout = async (req, res) => {
  try {
      const userId = req.session.user; 
    
      if (!userId) {
          return res.redirect("/login");
      }
     const cart = await Cart.findOne({ userId }).populate("items.productId");
     const userAddress = await Address.findOne({ userId });
     const user = await User.findById(userId);
     const coupons=await Coupon.find()
     
     const key_id = process.env.RAZORPAY_API_KEY;
     let stockError = null;

     if (cart && cart.items.length > 0) {
      for (const item of cart.items) {
          const product = await Product.findById(item.productId._id);
          const sizeData = product.sizes.find(
              (size) => size.size === item.selectedSize
          );

          if (!sizeData || sizeData.quantity < item.quantity) {
              stockError = `Sorry, only ${
                  sizeData?.quantity || 0
              } units of ${item.productId.productName} (size: ${
                  item.selectedSize
              }) are available. Please reduce the quantity or wait for new stock.`;
              break; 
          }
      }
  }
   
    let grandTotal = 0;
      if (cart) {
          cart.items.forEach((item) => {
              grandTotal += item.price * item.quantity;
          });
      }
      const deliveryCharge=DELIVERY_CHARGE
      const offerPrice = req.session.offerPrice || 0;
      const discountedTotal = (grandTotal - offerPrice)+deliveryCharge;
      const codEligible=discountedTotal<=1000
      res.render("checkout", {
        product: cart ? cart.items : [],
        userAddress,
        grandTotal: discountedTotal,
        user,
        isCart: cart ? "true" : "false",
        Coupon: coupons,
        appliedCoupon: req.session.appliedCoupon || null,
        deliveryCharge,
        key_id,
        codEligible,
        stockError, 
    });
      
  } catch (error) {
      console.error("Error loading checkout:", error);
      res.status(500).send("Internal Server Error");
  }
};


const addAddresscheckout=async(req,res)=>{
  try {
      const user=req.session.user;
      res.render("addaddress",{user:user})
      
  } catch (error) {
      res.redirect("/pageNotFound")
  }
  }
  
  const postAddAddresscheckout = async (req, res) => {
    try {
        const userId = req.session.user;
        const userData = await User.findOne({ _id: userId });

        const { addressType, name, city, landMark, state, pincode, phone, altPhone } = req.body;

        const userAddress = await Address.findOne({ userId: userData._id });

        if (!userAddress) {
            const newAddress = new Address({  
                userId: userData._id,  
                address: [{ addressType, name, city, landMark, state, pincode, phone, altPhone }]
            });
            await newAddress.save();
        } else {
            userAddress.address.push({ addressType, name, city, landMark, state, pincode, phone, altPhone });
            await userAddress.save();
        }

      
        res.redirect("/checkout")
    } catch (error) {
        console.log("error adding address:", error);
        res.redirect("/pageNotFound");
    }
};

const editAddresscheckout=async (req,res)=>{
  try {
   const addressId=req.query.id;
   const user=req.session.user;
   const currentAddress=await Address.findOne({
  "address._id":addressId,
  });
  if(!currentAddress){
  return res.redirect("/pageNotFound")
  }
  
  const addressData=currentAddress.address.find((item)=>{
      return item._id.toString()===addressId.toString();
  })
  
  if(!addressData){
   return res.redirect("/pageNotFound")
  
  }
  res.render("editaddresscheck",{address:addressData,user:user})
  } catch (error) {
      console.error("error in edit address",error);
      res.redirect("/pageNotFound")
  
  }
  }
  
  const postEditAddresscheckout=async(req,res)=>{
  try {
      const data=req.body;
      const addressId=req.query.id;
      const user=req.session.user;
      const findAddress= await Address.findOne({"address._id":addressId});
      if(!findAddress){
           return res.redirect("/pageNotFound");
      }
      await Address.updateOne(
        {"address._id":addressId},
        {$set:{
        "address.$":{
        _id:addressId,
        addressType:data.addressType,
        name:data.name,
        city:data.city,
        landMark:data.landMark,
        state:data.state,
        pincode:data.pincode,
        phone:data.phone,
        altPhone:data.altPhone
  
  
  
        }
  
        }} 
      )
      res.redirect("/checkout")
  
  } catch (error) {
      console.error("error in edit address",error);
      res.redirect("/pageNotFound")
      
  }
  
  }

const paymentFailure=async (req,res)=>{
try {
  const { orderId, paymentMethod, addressId, error, amount } = req.query;
  const userId=req.session.user;
  if(!userId){
    return res.status(401).render('pageNotFound',{message:'user not logged in'})
  }

  const user= await User.findById(userId).select('email phone')
  if(!user){
    return res.status(404).render('pageNotFound',{message:'user not found'})
  }

  res.render('paymentfailure',{
    orderId,
    paymentMethod,
    addressId,
    error:error||null,
    amount: amount || null,
    key_id: process.env.RAZORPAY_API_KEY,
    userEmail: user.email || 'test@example.com',
   userPhone: user.phone || '9999999999'
  })

} catch (error) {
  
  console.error(" error while loading payment failure",error)
  res.status(500).render('page-404',{message:'internal server error'})
}

}



module.exports={
    loadHomepage,
    loadSignup,
    signup,
    verifyOtp,
    resendOtp,
    loadLogin,
    pageNotFound,
    login,
    logout,
    loadShoppingPage,
    filterProduct,
    filterByPrice,
    searchProducts,
    productSize ,
    addToCart,
    loadCheckout,
    addAddresscheckout,
    postAddAddresscheckout,
    editAddresscheckout,
    postEditAddresscheckout,
    paymentFailure
   
    }