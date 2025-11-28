import { CheckSquareIcon } from "lucide-react";

export default function VenueFacilities({ facilities }) {
    return (
        <div className="flex flex-wrap items-center justify-start py-2">
            {facilities.map((facility, index) => (
                <div key={index} className="flex items-center justify-evenly p-5 m-5 " >
                    <CheckSquareIcon className="mr-2 text-green-500" />
                    <p className="font-bold"> {facility} </p>
                </div>
            ))}
        </div>
    )
}