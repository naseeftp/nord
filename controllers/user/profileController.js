const User = require("../../models/userSchema");
const Address=require("../../models/addressSchema");
const Order=require("../../models/orderSchema")
const nodemailer = require("nodemailer");
const bcrypt = require("bcrypt");
const env = require("dotenv").config();
const session = require("express-session");
const Wallet=require('../../models/walletSchema')
const Cart=require('../../models/cartSchema')


async function getUserCounts(userId) {
    if (!userId) return { wishlistCount: 0, cartCount: 0 };
    
    const [user, cart] = await Promise.all([
      User.findById(userId),
      Cart.findOne({ userId })
    ]);
    
    return {
      wishlistCount: user?.wishlist?.length || 0,
      cartCount: cart?.items?.length || 0
    };
  }

function generateOtp() {
    const digits = "1234567890";
    let otp = "";
    for (let i = 0; i < 6; i++) {
        otp += digits[Math.floor(Math.random() * 10)];
    }
    return otp;
}

const sendVerificationEmail = async (email, otp) => {
    try {
        const transporter = nodemailer.createTransport({
            service: "gmail",
            port: 587,
            secure: false,
            requireTLS: true,
            auth: {
                user: process.env.NODEMAILER_EMAIL,
                pass: process.env.NODEMAILER_PASSWORD,
            },
        });

        const mailOptions = {
            from: process.env.NODEMAILER_EMAIL,
            to: email,
            subject: "Your OTP for password reset",
            text: `Your OTP is ${otp}`,
            html: `<b><h4>Your OTP :${otp}</h4></b><br>`,
        };

        const info = await transporter.sendMail(mailOptions);
        console.log("Email sent:", info.messageId);
        return true;
    } catch (error) {
        console.error("Error sending email:", error);
        return false;
    }
};

const getForgotPassPage = async (req, res) => {
    try {
        const { wishlistCount, cartCount } = await getUserCounts(req.session.user);

        res.render("forgot-password",
            {
                wishlistCount,
                cartCount 

            }


        );
    } catch (error) {
        res.redirect("/pageNotFound");
    }
};

const forgotEmailValid = async (req, res) => {
    try {
        const { wishlistCount, cartCount } = await getUserCounts(req.session.user);
        const email = req.body.email;
        const findUser = await User.findOne({ email: email });

        if (!findUser) {
            return res.render("forgot-password", {
                message: "User with this email doesn't exist",
                wishlistCount,
                cartCount
            });
        }

        const otp = generateOtp();
        const emailSent = await sendVerificationEmail(email, otp);

        if (emailSent) {
            req.session.userOtp = otp;
            req.session.email = email;
            res.render("forgotPass-otp", {
                message: "", 
                wishlistCount,
                cartCount
            });
            console.log("OTP:", otp);
        } else {
            res.render("forgot-password", {
                message: "Failed to send OTP. Please try again.",
                wishlistCount,
                cartCount

            });
        }
    } catch (error) {
        console.error("Error in forgotEmailValid:", error);
        res.redirect("/pageNotFound");
    }
};
const verifyForgotPassOtp=async(req,res)=>{
    try {
        const enteredOtp=req.body.otp;
        const { wishlistCount, cartCount } = await getUserCounts(req.session.user);
        if(enteredOtp===req.session.userOtp){
            res.json({success:true,redirectUrl:"/reset-password"});
        }else{
            res.json({success:false,message:"OTP not matching"})
        }

    } catch (error) {
       res.status(500).json({success:false,message:"An error occured please try again"});

    }
}

const getResetPassPage=async(req,res)=>{
    try {
res.render("reset-password",{
    wishlistCount,
    cartCount 

});
       
    } catch (error) {
     res.redirect("/pageNotFound");

    }
}

const  resendOtp=async(req,res)=>{
    try {
        const otp=generateOtp();
        req.session.userOtp=otp;
        const email=req.session.email;
        console.log("Resending OTP to email:",email);
        const emailSent=await sendVerificationEmail(email,otp);
        if(emailSent){
         console.log("Resend OTP:",otp);
         res.status(200).json({success:true,message:"resend otp successfull"})

        }
    } catch (error) {
       console.error("Error in resend otp",error) ;
       res.status(500).json({success:false,message:"internal server error"})
    }
}


const resetPassword = async (req, res) => {

    try {
        
        console.log('request body: ', req.body);

        const { newPass1 } = req.body

        const email = req.session.email

        const hashedNewPass = await bcrypt.hash(newPass1, 10)

        const updatePassword = await User.updateOne(
            { email: email }, 
            {$set: {
                password: hashedNewPass
            }}
        )

        if (updatePassword) {
            return res.redirect('/')
        }
        
        res.redirect('/reset-password')
        
    } catch (error) {
        
        console.log('Error while updating the password', error);
        res.redirect('/pageNotFound')

    }
}


const userProfile=async(req,res)=>{
    try {
        const userId=req.session.user;
        const { wishlistCount, cartCount } = await getUserCounts(userId);
        const userData=await  User.findById(userId);
        let wallet= await Wallet.findOne({userId:userId});
        const addressData=await Address.findOne({userId : userId});
        const orders = await Order.find({ userId: userId })
        .sort({ createdOn: 1 }); 
        if(!wallet){
            wallet={balance:0,  transactions: []};
        }


        res.render('dashbord',{
        user:userData,userAddress:addressData,
        orders: orders || [],
        searchQuery: req.query || {},
        wallet,
        transactions: wallet.transactions,
        wishlistCount,
        cartCount

        })

    } catch (error) {
    console.error("Error for retrieve profile data",error);
    res.redirect("/pageNotFound")

        
    }
}
const getOrders = async (req, res) => {
    try {
      const userId = req.session.user;
      const { wishlistCount, cartCount } = await getUserCounts(userId);
      if (!userId) {
        return res.status(401).send('User not found');
      }

      const user= await User.findById(userId)
      const limit = 6;
      const currentPage = parseInt(req.query.page) || 1;
      const skip = (currentPage - 1) * limit;
      const searchQuery = req.query.search ? req.query.search.trim() : '';
    let query = { userId };
      if (searchQuery) {
        query.orderId = { $regex: searchQuery, $options: 'i' };
      }
        const totalOrders = await Order.countDocuments(query);
        const orders = await Order.find(query)
        .sort({ createdOn: -1 })
        .skip(skip)
        .limit(limit)
        .lean();
  
      const totalPages = Math.ceil(totalOrders / limit);
  
      res.render('orderprofile', {
        user,
        orders,
        currentPage,
        totalPages,
        totalOrders,
        searchQuery,
        noMatch: searchQuery && orders.length === 0,
        wishlistCount,
        cartCount
      });
    } catch (error) {
      console.error('Error in getting orders:', error);
      res.status(500).send('Server Error');
    }
  };



const getAddress = async (req, res) => {
    try {
      const userId = req.session.user;
      const { wishlistCount, cartCount } = await getUserCounts(userId);
      if (!userId) {
        return res.status(401).send('Unauthorized');
      }
  
      const limit = 2;
      const currentPage = parseInt(req.query.page) || 1;
      const skip = (currentPage - 1) * limit;
  
     
      const addressData = await Address.findOne({ userId }).lean();
      const totalAddresses = addressData && addressData.address ? addressData.address.length : 0;
      const totalPages = Math.ceil(totalAddresses / limit);
  
    
      const paginatedAddressData = await Address.findOne({ userId }, {
        address: { $slice: [skip, limit] }
      }).lean();
  
      const userData = {
        name: '',
        email: '',
        phone: '',
        referralCode: '',
      };
  
      res.render('profileaddress', {
        user: userData,
        userAddress: { address: paginatedAddressData ? paginatedAddressData.address : [] },
        currentPage,
        totalPages,
        wishlistCount,
        cartCount
  
      });
    } catch (error) {
      console.error('Error in getAddress:', error);
      res.status(500).send('Server Error');
    }
  };
const changeEmail=async(req,res)=>{
try {
    const userId = req.session.user;
    const { wishlistCount, cartCount } = await getUserCounts(userId);
    res.render("change-email",{
        wishlistCount,
        cartCount

    });
} catch (error) {
    res.redirect("/pageNotFound")
}

}
const changeEmailValid=async(req,res)=>{
try {
    const {email}=req.body;
    const userExists=await User.findOne({email});
    if(userExists){
    
     const otp=generateOtp();
     const emailSent=await sendVerificationEmail(email,otp);
     if(emailSent){
     req.session.userOtp=otp;
     req.session.userData=req.body;
     req.session.email= email;
     res.render("change-email-otp");
     console.log("email sent:",email,);
     console.log("your otp:",otp)
        
     }
     else{
      res.json("email-error");

     }
    }else{

        res.render("change-email",{
         message:"user with this namee allredy exist"
        })
     }

} catch (error) {
    res.redirect('/pageNotFound');
}
}

const verifyEmailOtp=async(req,res)=>{
try {
    const enteredOtp=req.body.otp;
    if(enteredOtp===req.session.userOtp){
        req.session.userData=req.body.userData;
        res.render("new-email",{
        userData:req.session.userData,
            message: null
        }, )
    }
    else{
    res.render("change-email-otp",{
    message:"otp not matching",
    userData:req.session.userData

    })

    }
    
} catch (error) {
    res.redirect('/pageNotFound');
    }
}

const updateEmail=async(req,res)=>{
    try {
        const newEmail=req.body.newEmail;
        const userId=req.session.user;

        const emailExisted = await User.findOne({ email: newEmail })

        if (emailExisted) {
            return res.render('new-email', { message: 'Email is already existed!'})
        }
        await  User.findByIdAndUpdate(userId,{email:newEmail});
        res.redirect("/userProfile")


    } catch (error) {
        res.redirect("/pageNotFound")
    }
      
}


const changePassword=async(req,res)=>{
try {
    const userId = req.session.user;
    const { wishlistCount, cartCount } = await getUserCounts(userId);
    res.render("updatePassword",
        {
            wishlistCount,
            cartCount
      

        }
    );
  } catch (error) {
    res.redirect("/pageNotFound");
    
}
}

const changePasswordValid=async(req,res)=>{
try {
    const {email}=req.body;
    const userExists=await User.findOne({email});
    if(userExists){
    const otp=generateOtp();
    const emailSent=await sendVerificationEmail(email,otp);
    if(emailSent){
       req.session.userOtp=otp;
       req.session.userData=req.body;
       req.session.email=email;
       res.render("change-password-otp", { email: email });
       console.log('OTP:',otp);

    }
    else{
        res.json({
           success:false,
           message:"failed to send otp ,please try again "
        })
    }

    }else{
      res.render("change-password",{
      message:"user with this mail does not exist"

      })

    }

} catch (error) {
    console.log("Error in change password validation",Error);
    red.redirect("/pageNotFound");
    
}
}

const verifyChangePassOtp=async(req,res)=>{
try {
    const enteredOtp=req.body.otp;
    if(enteredOtp===req.session.userOtp){
    res.json({success:true,redirectUrl:"/reset-password"})

    }
    else{

        res.json({success:false,message:"otp not matching"})
    }

} catch (error) {
    res.status(500).json({success:false,message:"an error occured.please try again later"})
    
}
}

const addAddress=async(req,res)=>{
try {
    const user=req.session.user;
    const { wishlistCount, cartCount } = await getUserCounts(user);
    res.render("add-address",{user:user,
        wishlistCount,
        cartCount
  
    })
    
} catch (error) {
    res.redirect("/pageNotFound")
}
}

const postAddAddress = async (req, res) => {
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

        res.redirect("/useraddress");
    } catch (error) {
        console.log("error adding address:", error);
        res.redirect("/pageNotFound");
    }
};

const editAddress=async (req,res)=>{
try {
 const addressId=req.query.id;
 const user=req.session.user;
 const { wishlistCount, cartCount } = await getUserCounts(user);
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
res.render("edit-address",{address:addressData,user:user,
    wishlistCount,
    cartCount

})
} catch (error) {
    console.error("error in edit address",error);
    res.redirect("/pageNotFound")

}
}

const postEditAddress=async(req,res)=>{
try {
    const data=req.body;
    const addressId=req.query.id;
    const user=req.session.user;
    const findAddress= await Address.findOne({"address._id":addressId});
    if(!findAddress){
        res.redirect("/pageNotFound");
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
    res.redirect("/useraddress")

} catch (error) {
    console.error("error in edit address",error);
    res.redirect("/pageNotFound")
    
}

}
const deleteAddress=async(req,res)=>{
try {
    const addressId=req.query.id;
    const findAddress=await Address.findOne({"address._id":addressId});
    if(!findAddress){
    return res.status(404).send("address not found");

    }
    await Address.updateOne({
    "address._id":addressId

    },
   {
     $pull:{
     address:{
       _id:addressId,
    }

     }

   }

)
res.redirect('/useraddress')

} catch (error) {
   console.log("error in delete address") ;
   res.redirect("/pageNotFound")
}

}


const getUpdatePassword=async(req,res)=>{
try {
   const userId=req.session.user;
   const { wishlistCount, cartCount } = await getUserCounts(userId);
   if(!userId){
    return res.redirect('/login')
   } 
    const userData=await User.findById(userId);
    res.render('updatePassword',{user:userData,
        wishlistCount,
        cartCount
  
    })


} catch (error) {
console.error("error while loading update password",error)
res.redirect('pageNotFound')
}
}



const updatePassword=async(req,res)=>{
try {
    const{currentPassword,newPassword}=req.body;
    const userId=req.session.user
    const user=await User.findById(userId)
    if(!user){
        return res.status(400).json({success:false,message:'user not  fount'})
    }
 
  const isMatch= await bcrypt.compare(currentPassword,user.password);
   
  if(!isMatch){
    return res.status(400).json({success:false,message:'current not password is incorrect'})
}

const salt=await bcrypt.genSalt(10);
const hashedPassword=await bcrypt.hash(newPassword,salt);
user.password=hashedPassword;
await user.save()
res.json({success:true,message:'password updated successfully'});

} catch (error) {
 console.error(error)  
 res.status(500).json({success:false,message:'server error'});
}


}

const getEditProfile=async(req,res)=>{
 try {
    const userId=req.session.user
    const { wishlistCount, cartCount } = await getUserCounts(userId);
    if(!userId){
  
      return res.redirect('/login')
    }
    const userData=await User.findById(userId)
    res.render("editProfile",{user:userData,
        wishlistCount,
        cartCount



    })


 } catch (error) {
    console.error("error while loading edit profile",error);
    res.redirect('/pageNotFound')
 }
    
  }
  
  const updateProfile = async (req, res) => {
    try {
        const userId = req.session.user;
        if (!userId) return res.redirect("/login");

        const { name: rawName, phone: rawPhone } = req.body;
        const name = rawName?.trim() || '';
        const phone = rawPhone?.trim() || '';

        if (!/^(?=.*[A-Za-z])[A-Za-z\s]{3,}$/.test(name)) {
            return res.status(400).json({
                success: false,
                message: "Name must be at least 3 alphabetic characters (spaces allowed)."
            });
        }

      
        if (phone) {
            const digits = phone.split('').map(Number);
            const isInvalidPhone = 
                !/^\d{10}$/.test(phone) || 
                /^(\d)\1{9}$/.test(phone) || 
                digits.every((d, i) => i === 0 || d === (digits[i-1] + 1) % 10) || 
                digits.every((d, i) => i === 0 || d === (digits[i-1] - 1 + 10) % 10); 

            if (isInvalidPhone) {
                return res.status(400).json({
                    success: false,
                    message: "Invalid phone number (avoid sequences/repeated digits)."
                });
            }
        }

        const updatedUser = await User.findByIdAndUpdate(
            userId,
            { name, phone: phone || undefined }, 
            { new: true }
        );

        if (!updatedUser) return res.status(404).json({ message: "User not found." });

        res.json({ success: true, message: 'Profile updated.', user: updatedUser });

    } catch (error) {
        console.error("Error updating profile:", error);
        res.status(500).json({ message: "Internal server error." });
    }
};





module.exports = {
    getForgotPassPage,
    forgotEmailValid,
    verifyForgotPassOtp,
    getResetPassPage,
    resendOtp,
    resetPassword,
    userProfile,
    changeEmail,
    changeEmailValid,
    verifyEmailOtp,
    updateEmail,
    changePassword,
    changePasswordValid,
    verifyChangePassOtp,
    addAddress,
    postAddAddress,
    editAddress,
    postEditAddress,
    deleteAddress,

    getUpdatePassword,
    updatePassword,
    getEditProfile,
    updateProfile,

    getAddress,
    getOrders

};