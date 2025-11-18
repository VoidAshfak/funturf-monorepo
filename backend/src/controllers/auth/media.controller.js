import { v2 as cloudinary } from "cloudinary"


// Configuration
const config = cloudinary.config({
    cloud_name: 'funturf',
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_SECRET_KEY,
    secure: true
});



const signMedia = (req, res) => {

    const timestamp = Math.round((new Date).getTime() / 1000);

    const signature = cloudinary.utils.api_sign_request({
        timestamp: timestamp,
        source: 'uw',
        folder: 'images'
    },
        config.api_secret
    );

    res.json({
        signature: signature,
        timestamp: timestamp,
        cloudname: config.cloud_name,
        apikey: config.api_key
    })
}

export { signMedia }
