async function uploadFileToServer(file) {
    const formData = new FormData();
    formData.append("image", file);

    const res = await fetch("/api/upload", {
        method: "POST",
        body: formData,
    });

    const data = await res.json();

    if (!res.ok) {
        console.error("Upload failed:", data);
        throw new Error("Image upload failed");
    }

    return data.url; // return the uploaded image URL
};

export async function uploadSingleImageObj(imageObj) {
    if (!imageObj?.file) return null;
    return await uploadFileToServer(imageObj.file);
};

export async function uploadImageObjArray(imageArray) {
    if (!Array.isArray(imageArray) || imageArray.length === 0) return [];

    const uploaded = await Promise.all(
        imageArray.map((img) => uploadSingleImageObj(img))
    );

    return uploaded.filter(Boolean);
}
