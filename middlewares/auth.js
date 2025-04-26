const User=require("../models/userSchema");
const userAuth=(req,res,next)=>{
    if(req.session.user){
        User.findById(req.session.user)
        .then(data=>{
            if(data&&!data.isBlocked){
                next();
            }
            else{
                res.redirect("/login")
            }
        })
        .catch(error=>{
            console.log("error in user auth middleware")
            res.status(500).send("internal server error")
        })
    }
    else{
        res.redirect("/login")
    }
}
const adminAuth=(req,res,next)=>{
   
    if (req.session.admin) {
         next()
    } else {
        res.redirect('/admin/login')
    }
}


module.exports={
   userAuth,
   adminAuth,
}
