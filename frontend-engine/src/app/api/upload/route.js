import { NextResponse } from "next/server";

export async function POST(req) {
    try {
        const body = await req.formData();
        const image = body.get("image");

        const formdata = new FormData();
        formdata.append("image", image);

        const imgbbRes = await fetch(
            `https://api.imgbb.com/1/upload?key=${process.env.IMGBB_API_KEY}`,
            {
                method: "POST",
                body: formdata,
            }
        );

        const data = await imgbbRes.json();

        if (!imgbbRes.ok) {
            return NextResponse.json(
                { error: "IMGBB upload failed", details: data },
                { status: 500 }
            );
        }

        return NextResponse.json({ url: data?.data?.display_url });
    } catch (err) {
        return NextResponse.json(
            { error: "Unexpected error", details: err.message },
            { status: 500 }
        );
    }
}
