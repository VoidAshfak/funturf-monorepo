import {v2 as cloudinary} from "cloudinary"
import fs from "fs"


// Configuration
cloudinary.config({ 
    cloud_name: 'funturf', 
    api_key: process.env.CLOUDINARY_API_KEY, 
    api_secret: process.env.CLOUDINARY_SECRET_KEY
});

const uploadMedia = async (localFilePath) => {

    try {
        if (!localFilePath) return null;
        const response = await cloudinary.uploader.upload(localFilePath, {
            resource_type: 'auto',
        })
        console.log("Media uploaded successfully", response.url);
        return response;
    } catch (error) {
        fs.unlinkSync(localFilePath); // Delete the file
        console.log("Media upload failed", error);
        throw error;
    }
}

export {uploadMedia}