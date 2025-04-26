const Coupon=require("../../models/couponSchema");
const mongoose=require("mongoose")


const loadCoupon=async(req,res)=>{
try {
    const findCoupons=await Coupon.find({});
    return res.render("coupon",{coupons:findCoupons})
} catch (error) {
  return res.redirect("/pageerror")  
}

}
const createCoupon=async(req,res)=>{
try {
    const couponName=req.body.couponName.trim().toLowerCase();
    const existingCoupon=await Coupon.findOne({ name:{$regex:`^${couponName}$`,$options:"i"}});
    
    
    if (existingCoupon) {
      req.flash("error", "Coupon with this name already exists.");
      return res.redirect("/admin/coupon");
    }
    const data={
        couponName:req.body.couponName.trim(),
        starDate:new Date(req.body.startDate+"T00:00:00"),
        endDate:new Date(req.body.endDate+"T00:00:00"),
        offerPrice:parseInt(req.body.offerPrice),
        minimumPrice:parseInt(req.body.minimumPrice),
    }
    const newCoupon=new Coupon({
        name:data.couponName,
        createdOn:data.starDate,
        expireOn:data.endDate,
        offerPrice:data.offerPrice,
        minimumPrice:data.minimumPrice,
});
await newCoupon.save();
await req.flash("success","Coupon created successfully ")
return res.redirect('/admin/coupon');
} catch (error) {
    console.log(" error while addigng coupon",error)
    req.flash("error","something went wrong please try again")
    return res.redirect('/admin/coupon');
}
}

const editCoupon=async(req,res)=>{
try {
    const id=req.query.id;
    const findCoupon=await Coupon.findOne({_id:id});
    res.render('edit-coupon',{
    findCoupon:findCoupon,
})
} catch (error) {
    res.redirect('/pageerror')
}

}



const updateCoupon = async (req, res) => {
    try {
        const couponId = req.body.couponId;
        let selectedCoupon = await Coupon.findOne({ _id: couponId });

        if (selectedCoupon) {
            const existingCoupon = await Coupon.findOne({
                name: { $regex: new RegExp(`^${req.body.couponName}$`, "i") },
                _id: { $ne: couponId } 
            });

            if (existingCoupon) {
                return res.status(400).json({ message: "Coupon name already exists. Please choose a different name." });
            }

            const startDate = new Date(req.body.startDate);
            const endDate = new Date(req.body.endDate);

            const updatedCoupon = await Coupon.findOneAndUpdate(
                { _id: selectedCoupon._id },
                {
                    $set: {
                        name: req.body.couponName,
                        createdOn: startDate,
                        expireOn: endDate,
                        offerPrice: parseInt(req.body.offerPrice),
                        minimumPrice: parseInt(req.body.minimumPrice),
                    },
                },
                { new: true } 
            );

            if (updatedCoupon) {
                return res.status(200).json({ message: "Coupon updated successfully" });
            } else {
                return res.status(500).json({ message: "Coupon update failed" });
            }
        } else {
            return res.status(404).json({ message: "Coupon not found" });
        }
    } catch (error) {
        console.log("Error while updating coupon:", error);
        res.status(500).json({ message: "Internal server error" });
    }
};


const deleteCoupon=async(req,res)=>{
try {
  
  const id=req.query.id;
  await Coupon.deleteOne({_id:id});
  res.status(200).send({success:true,message:'Coupen deleted successfully'})
} catch (error) {
   console.error("error while deleting coupon:",error);
   res.status(500).send({success:false,message:"failed to delete coupon"})
}
}


module.exports={
    loadCoupon,
    createCoupon,
    editCoupon,
    updateCoupon,
    deleteCoupon
}