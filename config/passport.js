
const passport=require("passport");
const GoogleStrategy=require("passport-google-oauth20").Strategy;
const User=require("../models/userSchema");
const env=require("dotenv").config();

passport.use(new GoogleStrategy({
   clientID:process.env.GOOGLE_CLIENT_ID,
   clientSecret:process.env.GOOGLE_CLIENT_SECRET,
   callbackURL: '/auth/google/callback',
   scope:['profile','email'],
   prompt: 'select-account'
},


async (accessToken,refreshToken,Profile,done)=>{
    try {
        
        let user=await User.findOne({googleId:Profile.id})
        if(user){
            return done(null,user)
        }
        else{
            user=new User({
              name:Profile.displayName,
              email:Profile.emails[0].value,
              googleId:Profile.id,
            });
            await user.save();
            return done(null,user)

        }
    } catch (error) {
        return done(error,null)
    }
}

))

passport.serializeUser((user,done)=>{
done(null,user.id)
});

passport.deserializeUser((id,done)=>{
User.findById(id)
.then(user=>{
    done(null,user)
})
.catch(err=>{
   done(err,null)

})
})

module.exports=passport;