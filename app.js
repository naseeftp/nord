const express=require("express");
const passport=require("./config/passport");
const env=require("dotenv").config();
const session=require("express-session")
const db=require("./config/db")
const userRouter=require("./routes/userRouter");
const adminRouter=require('./routes/adminRouter');
const nocache = require('nocache')
const User=require("./models/userSchema")
const flash=require('connect-flash');

db()

const app=express();
const path=require('path');

app.use(express.json())
app.use(express.urlencoded({extended:true}))
app.use(session({
    secret:process.env.SESSION_SECRET,
    resave:false,
    saveUninitialized:true,
    cookie:{
        secure:false,
        httpOnly:true,
        maxAge:72*60*60*1000
    }
}))
app.use(flash());
app.use((req,res,next)=>{
    res.locals.error=req.flash('error');
    res.locals.success=req.flash("success");
    next();
})
app.use(passport.initialize());
app.use(passport.session());

app.use(nocache())

app.use((req,res,next)=>{
    res.set('cache-control','no-Store')//http header 
    next();
});
app.set("view engine","ejs");
app.set("views",[path.join(__dirname,'views/admin'),(__dirname,'views/user')])
app.use(express.static(path.join(__dirname, "public")));
app.use('/uploads', express.static('public/uploads'));


app.use("/",userRouter)
app.use("/admin",adminRouter)

app.use(async (req, res, next) => {
    try {
        if (req.session.user) {
            const user = await User.findById(req.session.user);
            if (user && user.isBlocked) {
                delete req.session.user;
                return res.redirect('/login');
            }
        }
        next();
    } catch (error) {
        console.error("Error checking blocked user:", error);
        res.status(500).send('Server Error');
    }
  });

app.listen(process.env.PORT,()=>{
    console.log(`server running http://localhost:${process.env.PORT}`)
})





