const Wallet=require('../../models/walletSchema');
const User=require('../../models/userSchema');
const Transaction = require("../../models/transactionSchema")
const Razorpay=require('razorpay')
const crypto = require("crypto")
const env = require("dotenv").config()

const razorpay = new Razorpay({
    key_id: process.env.RAZORPAY_API_KEY,
    key_secret: process.env.RAZORPAY_API_SECRET,
})


  const loadWallet=async(req,res)=>{
  try {
    const userId=req.session.user;
    const userData=await User.findById(userId)
    const wallet =await Wallet.findOne({userId:userId})

    let transactions=[]
    let totalTransactions=0;
    if(wallet){
        totalTransactions=wallet.transactions.length;
        transactions=wallet.transactions.sort((a,b)=>new Date(b.createdAt)-new Date(a.createdAt))
    }
    res.render('walletprofile',{
        user:userData,
        wallet: wallet||{balance:0},
        transactions:transactions,
    })

  } catch (error) {
   console.error("error loading wallet",error)
   res.status(500).send("internal server error") 
}
}

const getWallethistory=async(req,res)=>{
  try {
    const userId=req.session.user;
    const userData=await User.findById(userId)
    const wallet =await Wallet.findOne({userId:userId})
     const limit=6;
    const currentPage=parseInt(req.query.page)||1;
    let startIndex=(currentPage-1)*limit;
    let endIndex=startIndex+limit;
    let transactions=[]
    let totalTransactions=0;
    let totalPages=0;
    if (wallet) {
   
      const sortedTransactions = wallet.transactions.sort(
        (a, b) => new Date(b.createdAt) - new Date(a.createdAt)
      );
      
      totalTransactions = sortedTransactions.length;
      totalPages = Math.ceil(totalTransactions / limit);
      transactions = sortedTransactions.slice(startIndex, endIndex);
    }
    res.render('wallethistory',{
        user:userData,
        wallet: wallet||{balance:0},
        transactions:transactions,
        currentPage,
        totalPages,
        totalTransactions
    })

  } catch (error) {
   console.error("error loading wallet",error)
   res.status(500).send("internal server error") 
}


}


const createRazorpayOrder = async(req,res)=>{
    try {
        const {amount}=req.body
      
        const userId = req.session.user
        if(!amount||amount<1){
            return res.status(400).json({success:false,message:'invalid amount'})
        }
        
        const options = {
            amount:amount*100,
            currency:"INR",
            receipt: `wallet_${Date.now()}`,
        }
        const order = await razorpay.orders.create(options)
        res.json({ success:true, order_id:order.id,amount:amount*100,key_id:process.env.RAZORPAY_API_KEY })
    
    } catch (error) {
        console.error("error creating razorpay order",error)
        res.status(500).json({success:false,message:"failed to create order"})
    }
}

const verifyPayment = async(req,res)=> {
    try {
        
        const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body
        const userId = req.session.user
        const sign = razorpay_order_id + "|" + razorpay_payment_id
        const expectedSign = crypto
        .createHmac("sha256", process.env.RAZORPAY_API_SECRET)
        .update(sign.toString())
        .digest("hex")
        if (razorpay_signature !== expectedSign) {
            return res.status(400).json({ success: false, message: "Invalid signature" })
        }
        
        const payment = await razorpay.payments.fetch(razorpay_payment_id)
        const amount = payment.amount / 100
        
        let wallet = await Wallet.findOne({ userId: userId })
        if (!wallet){
            wallet = new Wallet ({
                userId: userId,
                balance: 0,
                refundAmount: 0,
                totalDebited: 0,
                transactions: [],
            })
        }
        
        wallet.balance += Number(amount)
        wallet.transactions.push({
            amount: Number(amount),
            transactionType: "credit",
            transactionPurpose: "add",
            description: "Added money to wallet",
        })
        await wallet.save()
        
        await Transaction.create({
            userId: userId,
            amount: Number(amount),
            transactionType: "credit",
            paymentMethod: "online",
            paymentGateway: "razorpay",
            gatewayTransactionId: razorpay_payment_id,
            status: "completed",
            purpose: "wallet_add",
            description: "Added money to wallet",
            walletBalanceAfter: wallet.balance,
        })
        res.json({ success: true, message: "Payment verified and wallet updated successfully",})
    } catch (error) {
        console.error("Error verifying payment:", error)
        res.status(500).json({ success: false, message: "Payment verification failed" })
    }
}

const withdrawMoney = async (req, res) => {
    try {
      const userId = req.session.user
      const { amount } = req.body
  
      if (!amount || amount <= 0) {
        return res.status(400).json({ success: false, message: "Invalid amount" })
      }
  
      const wallet = await Wallet.findOne({ userId: userId })
  
      if (!wallet || wallet.balance < amount) {
        return res.status(400).json({
          success: false,
          message: "Insufficient balance",
        })
      }
  
      wallet.balance -= Number(amount)
      wallet.totalDebited += Number(amount)
      wallet.transactions.push({
        amount: Number(amount),
        transactionType: "debit",
        transactionPurpose: "withdraw",
        description: "Withdrawn from wallet",
      })
  
      await wallet.save()
  
     
      await Transaction.create({
        userId: userId,
        amount: Number(amount),
        transactionType: "debit",
        paymentMethod: "wallet",
        paymentGateway: "wallet",
        status: "completed",
        purpose: "wallet_withdraw",
        description: "Withdrawn from wallet",
        walletBalanceAfter: wallet.balance,
      })
  
      res.json({
        success: true,
        message: "Money withdrawn successfully",
        newBalance: wallet.balance,
      })
    } catch (error) {
      console.error("Error withdrawing money:", error)
      res.status(500).json({ success: false, message: "Internal Server Error" })
    }
}

const getWalletBalance=async(req,res)=>{
try {
   const userId=req.session.user;
   if(!userId){
    return res.status(401).json({
      success:false,
      message:"user not authenticated"
    });
   }

   const wallet=await Wallet.findOne({userId}).select('balance');
   res.json({
    success:true,
    balance:wallet?wallet.balance:0
   })

} catch (error) {
  console.error('wallet balance error',error);
  res.status(500).json({
    success:false,
    message:'error fetching wallet balance',
    error: process.env.NODE_ENV === 'development' ? error.message : null
  })
  
}

}


const getWalletData = async (req, res) => {
  try {
      const userId = req.session.user;
      if (!userId) {
          return res.status(401).json({
              success: false,
              message: "user not authenticated"
          });
      }

      const wallet = await Wallet.findOne({ userId });
      const transactions = wallet ? wallet.transactions.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)) : [];

      res.json({
          success: true,
          balance: wallet ? wallet.balance : 0,
          transactions: transactions.map(t => ({
              transactionId: t.transactionId,
              amount: t.amount,
              transactionType: t.transactionType,
              transactionPurpose: t.transactionPurpose,
              description: t.description,
              createdAt: t.createdAt
          }))
      });
  } catch (error) {
      console.error('wallet data error', error);
      res.status(500).json({
          success: false,
          message: 'error fetching wallet data',
          error: process.env.NODE_ENV === 'development' ? error.message : null
      });
  }
};


module.exports={
    loadWallet,
    createRazorpayOrder,
    verifyPayment,
    withdrawMoney ,
    getWalletBalance,
    getWalletData,
    getWallethistory
}